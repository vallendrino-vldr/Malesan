import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spendCredits, refundCredits } from "@/lib/credits";
import { getRecycleCost, getModel } from "@/lib/config";
import { parseJson, GeminiError } from "@/lib/gemini/client";
import { runAI } from "@/lib/ai/engine";

/**
 * Smart Content Recycle.
 *
 * A piece the creator posted more than a month ago is dead weight sitting in the
 * pipeline. This takes one such card and asks Gemini to turn it into three fresh
 * angles worth posting again — reasoning + long context, so it is a Gemini job,
 * not a Groq one.
 *
 * The card is loaded scoped to the caller (RLS + an explicit user_id filter), so
 * a tampered id cannot pull someone else's content. Charged through spend_credits,
 * refunded if the model fails.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type Angle = { angle: string; hook: string; kenapa: string };

const ANGLES_SCHEMA = {
  type: "OBJECT",
  properties: {
    angles: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          angle: { type: "STRING" },
          hook: { type: "STRING" },
          kenapa: { type: "STRING" },
        },
        required: ["angle", "hook", "kenapa"],
      },
    },
  },
  required: ["angles"],
} as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned")
    .eq("id", user.id)
    .single();
  if (!profile) return json({ error: "Profil gak ketemu." }, 404);
  if (profile.is_banned) return json({ error: "Akun lo lagi dibekuin." }, 403);

  let body: { cardId?: string } | null;
  try {
    body = (await req.json()) as { cardId?: string };
  } catch {
    return json({ error: "Body gak kebaca." }, 400);
  }
  const cardId = (body?.cardId ?? "").toString();
  if (!cardId) return json({ error: "Konten mana yang mau didaur ulang?" }, 400);

  const { data: card } = await supabase
    .from("pipeline_cards")
    .select("id, title, content, status, created_at")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!card) return json({ error: "Kontennya gak ketemu." }, 404);
  if (card.status !== "posted") return json({ error: "Cuma konten yang udah 'Posted' yang bisa didaur ulang." }, 400);
  if (Date.now() - new Date(card.created_at).getTime() < THIRTY_DAYS_MS) {
    return json({ error: "Konten ini belum cukup lama buat didaur ulang." }, 400);
  }

  const cost = await getRecycleCost();
  let ref: string | null = null;
  if (cost > 0) {
    const spend = await spendCredits(user.id, cost, "content_recycle");
    if (!spend.ok) return json({ error: spend.message }, spend.reason === "insufficient" ? 402 : 500);
    ref = spend.ref;
  }

  const oldContent = typeof card.content === "string" ? card.content : JSON.stringify(card.content ?? "");
  const prompt = buildPrompt(card.title ?? "", oldContent.slice(0, 4000));

  try {
    const model = await getModel("pro");
    const { text: raw } = await runAI({
      feature: "recycle",
      prompt,
      legacyModel: model,
      schema: ANGLES_SCHEMA as unknown as Record<string, unknown>,
      userId: user.id,
      refId: ref,
      creditsCharged: cost,
      signal: AbortSignal.timeout(45_000),
    });
    const parsed = parseJson<{ angles?: Angle[] }>(raw);
    const angles = (parsed.angles ?? [])
      .filter((a) => a && a.angle && a.hook)
      .slice(0, 3);
    if (!angles.length) throw new GeminiError("Gak ada angle kebentuk.", 502, false);
    return json({ angles, creditsSpent: cost }, 200);
  } catch (e) {
    if (ref) await refundCredits(user.id, ref, "content_recycle_failed");
    const status = e instanceof GeminiError ? e.status : 502;
    const message =
      e instanceof GeminiError ? "AI-nya lagi mentok. Coba lagi bentar." : "Gagal daur ulang. Coba lagi.";
    return json({ error: message }, status >= 400 && status < 600 ? status : 502);
  }
}

function buildPrompt(title: string, content: string): string {
  return `Konten ini udah pernah diposting lebih dari sebulan lalu. Tugas lo: daur ulang jadi 3 angle SEGAR yang beda sudut, biar bisa diposting lagi tanpa berasa ngulang.

Konten lama:
Judul: ${title || "(tanpa judul)"}
Isi: ${content || "(kosong)"}

Untuk tiap angle kasih:
- angle: sudut/framing baru (misal: dari sisi kegagalan, kontroversi, tutorial, storytime, mitos vs fakta, before-after)
- hook: 1 kalimat pembuka yang bikin berhenti scroll
- kenapa: kenapa angle ini bakal jalan — kaitkan ke cara kerja platform (retensi, rasa penasaran, relatability), bukan klaim kosong

Bahasa Indonesia, gaul, spesifik ke kontennya. Balas JSON: {"angles":[{"angle":"...","hook":"...","kenapa":"..."}]} tepat 3 item.`;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
