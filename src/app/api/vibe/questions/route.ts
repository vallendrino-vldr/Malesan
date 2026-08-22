import { NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { parseAIJson } from "@/lib/ai/json";
import { runAI } from "@/lib/ai/engine";
import { aiRateLimit } from "@/lib/rate-limit";
import {
  VIBE_QUESTIONS_SCHEMA,
  buildVibeQuestionsPrompt,
  type VibeQuestion,
} from "@/lib/prompts/vibe";

export const maxDuration = 60;

/**
 * Five clarifying questions, generated from the idea.
 *
 * Free, and deliberately so. The answers make the six-credit kit measurably
 * better, so charging for the step that improves what they already paid for
 * would be hostile — and a paywalled question step just gets skipped, which
 * defeats the point.
 *
 * Not free of abuse controls, though: this is an authenticated, rate-limited
 * call. An unauthenticated free Gemini endpoint is somebody else's bill.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const idea: string = body?.idea?.trim() ?? "";

  if (idea.length < 12) {
    return Response.json(
      { error: "Ceritain dulu mau bikin apa, minimal satu kalimat." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro, is_banned")
    .eq("id", user.id)
    .single();
  if (!profile) return new Response("Profile not found", { status: 404 });
  if (profile.is_banned) return new Response("Banned", { status: 403 });

  const limited = await aiRateLimit(user.id, "vibe_questions", 10);
  if (limited) return limited;

  const serviceRole = createServiceRoleClient();
  const { data: dna } = await serviceRole
    .from("creator_dna")
    .select("output_language")
    .eq("user_id", user.id)
    .single();

  try {
    const { text: raw } = await runAI({
      feature: "vibe_questions",
      prompt: buildVibeQuestionsPrompt(idea, dna?.output_language || "id"),
      // Always the cheap tier. This is a short, structured call and does not
      // need the pro model — spending pro quota here would starve the kit.
      tier: "free",
      schema: VIBE_QUESTIONS_SCHEMA as unknown as Record<string, unknown>,
      userId: user.id,
      signal: AbortSignal.timeout(45_000),
      budgetMs: 43_000,
    });

    const parsed = parseAIJson<{ questions: VibeQuestion[] }>(raw);
    const questions = (parsed?.questions ?? [])
      .filter((q) => q?.q?.trim())
      .slice(0, 5)
      .map((q) => ({
        q: q.q,
        why: q.why ?? "",
        // Guard the shape rather than trusting it: a missing array here would
        // crash the client mid-render.
        suggestions: Array.isArray(q.suggestions) ? q.suggestions.filter(Boolean).slice(0, 6) : [],
        multi: q.multi === true,
      }));

    if (!questions.length) throw new Error("empty");

    return Response.json({ questions });
  } catch {
    // Questions are an enhancement, never a gate. If this fails the client is
    // told to carry on straight to generation.
    return Response.json(
      { skip: true, error: "Gagal bikin pertanyaannya. Lanjut generate aja, hasilnya tetep jalan." },
      { status: 200 },
    );
  }
}
