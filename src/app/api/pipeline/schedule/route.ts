import { NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { generate, parseJson } from "@/lib/gemini/client";
import { getModel } from "@/lib/config";
import { spendCredits, refundCredits } from "@/lib/credits";

export const maxDuration = 30;

/**
 * "Kapan ini enaknya tayang?"
 *
 * A card that reaches Siap is shootable but undated, and the one thing a
 * creator actually asks at that point is when to post it. This picks a slot —
 * a phrase, not a timestamp: "Senin pagi" is something you can act on, while
 * "2026-08-11 07:30 WIB" is a promise the product cannot keep.
 *
 * Free by default (`cost_schedule_tag` seeds at 0) and it stays free unless the
 * owner sets a price. See the cost note below for why `getCost()` is not used.
 */

const SCHEDULE_SCHEMA = {
  type: "OBJECT",
  properties: {
    schedule_label: { type: "STRING" },
    reason: { type: "STRING" },
  },
  required: ["schedule_label", "reason"],
} as const;

/**
 * What one tag costs, in credits. Zero means free, and zero has to survive the
 * read — `getCost()` treats a non-positive value as "unconfigured" and falls
 * back to a per-module floor, so a configured 0 would come back as something
 * else entirely (and this key is not a module in the first place). Read the row.
 */
async function scheduleTagCost(): Promise<number> {
  const { data, error } = await createServiceRoleClient()
    .from("app_config")
    .select("value")
    .eq("key", "cost_schedule_tag")
    .maybeSingle();

  // A config read that failed is not permission to start charging.
  if (error) {
    console.error("cost_schedule_tag read failed, treating as free", error);
    return 0;
  }
  const v = data?.value;
  return typeof v === "number" && v > 0 ? Math.round(v) : 0;
}

function buildSchedulePrompt(title: string, content: unknown): string {
  const c = (content ?? {}) as { angle?: string; format?: string; est_duration?: string };
  const facts = [
    `Judul: ${title}`,
    c.angle ? `Angle: ${c.angle}` : "",
    c.format ? `Format: ${c.format}` : "",
    c.est_duration ? `Durasi: ${c.est_duration}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `Lo editor konten yang hafal kebiasaan scroll orang Indonesia.

Konten yang siap tayang:
${facts}

Tentuin satu slot posting yang paling masuk buat konten ini.

Aturan:
- schedule_label: frasa singkat bahasa Indonesia, maksimal 3 kata, gaya "Senin pagi", "Weekend santai", "Jam pulang kantor". Bukan tanggal, bukan jam persis.
- reason: satu kalimat, santai, kenapa slot itu yang paling nyambung sama konten ini.
- Jangan pakai emoji, tanda kutip, atau tanda seru.
- Balas JSON aja.`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const cardId: string = typeof body?.card_id === "string" ? body.card_id.trim() : "";
  if (!cardId) {
    return Response.json({ error: "Kartunya gak kekirim. Coba geser ulang." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [cardResult, profileResult] = await Promise.all([
    // Scoped to the owner on top of RLS: this route writes to the row it reads,
    // and a missing filter here would make that write reachable by id alone if
    // a policy ever loosened.
    supabase
      .from("pipeline_cards")
      .select("id, title, content")
      .eq("id", cardId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("is_banned").eq("id", user.id).maybeSingle(),
  ]);

  if (cardResult.error) {
    console.error("schedule: card read failed", cardResult.error);
    return Response.json(
      { error: "Gagal baca kartunya. Coba lagi bentar lagi." },
      { status: 500 },
    );
  }
  if (!cardResult.data) {
    return Response.json({ error: "Kartunya udah gak ada di pipeline lo." }, { status: 404 });
  }
  if (profileResult.data?.is_banned) return new Response("Banned", { status: 403 });

  const card = cardResult.data;

  // Free by default. Calling spendCredits(0) would write a zero-credit ledger
  // row for every card that lands in Siap — noise in the one table that has to
  // stay readable when money is in question.
  const cost = await scheduleTagCost();
  let spendRef: string | null = null;
  if (cost > 0) {
    const spend = await spendCredits(user.id, cost, "pipeline_schedule_tag");
    if (!spend.ok) {
      return Response.json(
        { error: spend.message },
        { status: spend.reason === "insufficient" ? 402 : 500 },
      );
    }
    spendRef = spend.ref;
  }

  try {
    const raw = await generate({
      prompt: buildSchedulePrompt(card.title, card.content),
      // Always the cheap tier: this is two short strings, and spending pro quota
      // on a chip would starve the modules people actually pay for.
      tier: "free",
      model: await getModel("free"),
      schema: SCHEDULE_SCHEMA as unknown as Record<string, unknown>,
    });

    const parsed = parseJson<{ schedule_label?: string; reason?: string }>(raw);
    const label = (parsed?.schedule_label ?? "").trim().slice(0, 40);
    const reason = (parsed?.reason ?? "").trim().slice(0, 240);
    if (!label) throw new Error("model returned an empty schedule_label");

    const { data: updated, error: updateError } = await supabase
      .from("pipeline_cards")
      .update({ schedule_label: label, schedule_reason: reason })
      .eq("id", card.id)
      .eq("user_id", user.id)
      .select("id, schedule_label, schedule_reason")
      .single();

    // `.select().single()` is what makes "matched no rows" distinguishable from
    // success — without it a deleted card would return a confident tag that was
    // never written anywhere.
    if (updateError || !updated) throw updateError ?? new Error("schedule write matched no rows");

    return Response.json({ card: updated });
  } catch (err) {
    console.error("schedule tag failed", err);
    // The user got nothing, so they pay nothing. Idempotent by ref.
    if (spendRef) await refundCredits(user.id, spendRef, "refund_pipeline_schedule_tag");
    return Response.json(
      { error: "Gagal nyariin jam tayangnya. Kartunya tetep di Siap — coba lagi nanti." },
      { status: 502 },
    );
  }
}
