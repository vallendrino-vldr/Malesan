import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseJson } from "@/lib/gemini/client";
import { runAI } from "@/lib/ai/engine";

/**
 * nodejs, not edge.
 *
 * Routing through the AI engine means resolving a gateway key, and that is
 * AES-256-GCM via `node:crypto` — not something to rely on in the edge runtime.
 * Edge bought this route nothing anyway: it runs once a day on a timer with
 * nobody waiting on the response.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const TRENDS_SYSTEM_PROMPT = `Lo adalah asisten content creator Indonesia.
Tugas lo: berikan 3-5 trend topik, format, atau angle yang lagi rame dibicarakan audiens Indonesia hari ini (TikTok, Twitter/X, Instagram, YouTube Shorts).
Jangan kasih saran generik kayak "dance challenge". Kasih sesuatu yang spesifik, misalnya "Drama X vs Y" atau "Sound jedag jedug lagu daerah".
category harus salah satu dari: lifestyle, tech, entertainment, news, comedy.
region selalu "ID".`;

const TRENDS_SCHEMA = {
  type: "object",
  properties: {
    trends: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          category: { type: "string" },
          region: { type: "string" },
        },
        required: ["title", "summary", "category", "region"],
      },
    },
  },
  required: ["trends"],
} as const;

type Trend = {
  title: string;
  summary: string;
  category: string;
  region: string;
};

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();

    // Generate BEFORE touching what is live. The previous version deactivated
    // every trend first, so a failed call left the product showing no trends at
    // all until the next day's run — a worse state than yesterday's list.
    //
    // The shared client is what earns the extra keys here: rotation across the
    // whole pool, 429 backoff, and usage recorded against the key that answered.
    // Calling `fetch` directly with GEMINI_API_KEY_1 (as this used to) meant the
    // cron only ever hit one key and its spend never showed up in the quota
    // guard. It also hardcoded a fallback model id — the exact class of bug that
    // once 404'd every generation in the product.
    const { text: raw } = await runAI({
      feature: "trends_cron",
      prompt: `${TRENDS_SYSTEM_PROMPT}\n\nBerikan trend hari ini untuk kreator Indonesia.`,
      tier: "free",
      schema: TRENDS_SCHEMA as unknown as Record<string, unknown>,
      // A system job: nobody's credits are involved, so there is no user to
      // attribute the cost to — but the cost is still ours and still recorded.
      userId: null,
      signal: AbortSignal.timeout(40_000),
      budgetMs: 38_000,
    });

    const parsed = parseJson<{ trends?: Trend[] }>(raw);
    const trends = (parsed.trends ?? []).filter((t) => t?.title && t?.summary);

    if (trends.length === 0) {
      throw new Error("Gemini returned no usable trends; keeping yesterday's list live");
    }

    const { error: deactivateError } = await supabase
      .from("trends")
      .update({ is_active: false })
      .eq("is_active", true)
      .select("id");
    if (deactivateError) throw deactivateError;

    // One insert, and the error is read. A discarded error here would report
    // CRON_TRENDS_SUCCESS while the table stayed empty.
    const { data: inserted, error: insertError } = await supabase
      .from("trends")
      .insert(
        trends.map((t) => ({
          source: "google_news",
          title: t.title,
          summary: t.summary,
          category: t.category,
          region: t.region ?? "ID",
          is_active: true,
        })),
      )
      .select("id");
    if (insertError) throw insertError;

    await supabase.from("audit_log").insert({
      action: "CRON_TRENDS_SUCCESS",
      metadata: { count: inserted?.length ?? 0 },
    });

    return NextResponse.json({ success: true, count: inserted?.length ?? 0, trends });
  } catch (err: unknown) {
    console.error(err);
    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    const supabase = createServiceRoleClient();
    await supabase.from("audit_log").insert({
      action: "CRON_TRENDS_FAILED",
      metadata: { error: errorMsg },
    });

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
