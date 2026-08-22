import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spendCredits, refundCredits } from "@/lib/credits";
import { getReactionCost } from "@/lib/config";
import { parseAIJson } from "@/lib/ai/json";
import { runAI } from "@/lib/ai/engine";
import { userFacingError } from "@/lib/ai/errors";

/**
 * Instant reactions to a draft, powered by Groq (Llama) so they come back in
 * about a second:
 *   - "netizen": five simulated comments from different Indonesian audience
 *     personas, as JSON, rendered as a comment column.
 *   - "roast": a blunt senior-editor take, to find the weak spots before posting.
 *
 * Both charge a small credit through spend_credits like every other AI feature,
 * and refund it if the model call fails — a failure never costs money.
 */

export const runtime = "nodejs";
/**
 * 60s: these route through the Brain now, and the configured gateway measures
 * 16-20s per call. A 30s ceiling would abort the primary before a fallback could
 * be tried — the failure mode that took down the schedule endpoint.
 */
export const maxDuration = 60;

const MAX_CHARS = 6000;

type Kind = "netizen" | "roast";

type NetizenComment = {
  username: string;
  persona: string;
  sentiment: "positif" | "netral" | "julid";
  comment: string;
};

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

  let body: { kind?: string; text?: string } | null;
  try {
    body = (await req.json()) as { kind?: string; text?: string };
  } catch {
    return json({ error: "Body gak kebaca." }, 400);
  }

  const kind = body?.kind as Kind;
  const text = (body?.text ?? "").toString().trim();
  if (kind !== "netizen" && kind !== "roast") return json({ error: "Jenis reaksi gak valid." }, 400);
  if (!text) return json({ error: "Draftnya masih kosong. Tulis dulu ya." }, 400);

  const draft = text.slice(0, MAX_CHARS);

  const cost = await getReactionCost(kind);
  let ref: string | null = null;
  if (cost > 0) {
    const spend = await spendCredits(user.id, cost, `react_${kind}`);
    if (!spend.ok) return json({ error: spend.message }, spend.reason === "insufficient" ? 402 : 500);
    ref = spend.ref;
  }

  try {
    if (kind === "netizen") {
      // Through the engine like every other AI call, so this obeys the Brain,
      // falls back, and records its cost. It used to talk to Groq directly,
      // which meant switching the product's AI left these two features behind —
      // the same class of bug as the nine routes fixed before it.
      const { text: raw } = await runAI({
        feature: "react_netizen",
        prompt: `${NETIZEN_SYSTEM}\n\nDraft konten:\n\n"""${draft}"""\n\nBalas dengan JSON persis format yang diminta.`,
        userId: user.id,
        refId: ref,
        creditsCharged: cost,
        signal: AbortSignal.timeout(45_000),
        budgetMs: 43_000,
      });
      const parsed = parseAIJson<{ comments?: NetizenComment[] }>(raw);
      const comments = (parsed.comments ?? [])
        .filter((c) => c && typeof c.comment === "string" && c.comment.trim())
        .slice(0, 5);
      if (!comments.length) throw new Error("Gak ada komentar kebentuk.");
      return json({ kind, comments, creditsSpent: cost }, 200);
    }

    const { text: roast } = await runAI({
      feature: "react_roast",
      prompt: `${ROAST_SYSTEM}\n\nDraft yang mau di-roast:\n\n"""${draft}"""`,
      userId: user.id,
      refId: ref,
      creditsCharged: cost,
      signal: AbortSignal.timeout(45_000),
      budgetMs: 43_000,
    });
    return json({ kind, roast: roast.trim(), creditsSpent: cost }, 200);
  } catch (e) {
    // The AI failed after we charged — hand the credit back.
    if (ref) await refundCredits(user.id, ref, `react_${kind}_failed`);
    console.error(`react:${kind} failed`, e);
    const friendly = userFacingError(e);
    return json({ error: friendly.message }, friendly.retryable ? 503 : 502);
  }
}

const NETIZEN_SYSTEM = `Lo simulator kolom komentar sosmed Indonesia (TikTok/IG/Threads). Dikasih draft konten, bikin TEPAT 5 komentar netizen yang realistis, macem-macem persona dan sentimen — jangan semua muji.

Persona harus variatif, pilih 5 yang paling pas sama drafnya dari: fans garis keras, hater julid, yang skeptis/nanya validitas, newbie yang baru ngeh, yang relate personal, yang nyinyir soal typo/delivery, komedian receh.

Aturan:
- Bahasa Indonesia sosmed asli: singkat, ada slang, typo wajar, emoji secukupnya (jangan lebay).
- Tiap komentar harus nyambung sama isi draft, bukan template generik.
- username gaya sosmed (huruf kecil, angka, underscore).
- Jujur: draft lemah boleh disindir, draft kuat boleh dipuji.
- JANGAN kasih saran editor — ini murni reaksi penonton.

Balas HANYA JSON valid, tanpa markdown:
{"comments":[{"username":"...","persona":"fans|hater|skeptis|newbie|relate|nyinyir|komedian","sentiment":"positif|netral|julid","comment":"..."}]}`;

const ROAST_SYSTEM = `Lo editor konten senior Indonesia yang galak, tajam, tapi jujur demi hasil bagus. Bukan nyari-nyari salah — tapi lo gak bakal ngasih pujian kosong. Gaya lo blak-blakan, gaul, sedikit sarkas, dan tiap kritik selalu ada alasan kenapa itu bikin penonton scroll pergi.

Dikasih draft konten, roast dia:
- Bongkar hook-nya: 2 detik pertama bikin orang stay atau kabur?
- Tunjuk bagian yang generic/ketebak/bisa ditulis ChatGPT siapa aja.
- Bagian yang bertele-tele atau gak ada gunanya.
- Tutup dengan SATU perbaikan paling penting yang paling ngangkat konten ini kalau dibenerin.

Aturan:
- Bahasa Indonesia gaul, galak tapi gak menghina personal — serang tulisannya, bukan orangnya.
- Maksimal ~180 kata, padat, gak muter-muter.
- Kalau emang udah bagus, akui — tapi tetap tunjuk 1 hal yang bisa lebih tajam.
- Plain text, boleh baris baru sama emoji dikit. Jangan JSON.`;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
