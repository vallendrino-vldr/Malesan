import { NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { runAI } from "@/lib/ai/engine";
import { parseAIJson } from "@/lib/ai/json";
import { userFacingError } from "@/lib/ai/errors";
import { spendCredits, refundCredits } from "@/lib/credits";
import { aiRateLimit } from "@/lib/rate-limit";
import { getCostContentStrategy, getShadowPrompt } from "@/lib/config";
import {
  build7DayStrategyPrompt,
  STRATEGY_7DAY_SCHEMA,
  type StrategyPlanItem,
} from "@/lib/prompts/brain";
import type { CreatorDna } from "@/lib/supabase/database.types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sesi lo udah habis. Masuk lagi ya." }, { status: 401 });
  }

  // 1. Check profile & credits
  const service = createServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("is_banned, credits_free, credits_paid")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "Profil gak ketemu." }, { status: 404 });
  }
  if (profile.is_banned) {
    return Response.json({ error: "Akun lo lagi dibekuin." }, { status: 403 });
  }

  // 2. Fetch Creator DNA
  const { data: dnaData } = await service
    .from("creator_dna")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // 3. Rate limit (max 6 requests in 5 minutes)
  const limited = await aiRateLimit(user.id, "pipeline_strategy_7d", 6);
  if (limited) return limited;

  // 4. Spend credits
  const cost = await getCostContentStrategy();
  let spendRef: string | null = null;
  if (cost > 0) {
    const totalCredits = (profile.credits_free ?? 0) + (profile.credits_paid ?? 0);
    if (totalCredits < cost) {
      return Response.json(
        {
          error: `Perlu ${cost} kredit buat rancang strategi 7 hari. Saldo lo: ${totalCredits}. Top up dulu ya.`,
          needed: cost,
          balance: totalCredits,
        },
        { status: 402 },
      );
    }
    const spend = await spendCredits(user.id, cost, "pipeline_strategy_7d");
    if (!spend.ok) {
      return Response.json({ error: spend.message || "Gagal potong kredit." }, { status: 402 });
    }
    spendRef = spend.ref;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const platform = typeof body.platform === "string" ? body.platform : "tiktok";
    const goal = typeof body.goal === "string" ? body.goal : undefined;

    // 5. Fetch recent 10 titles to avoid repetition
    const { data: recentCards } = await service
      .from("pipeline_cards")
      .select("title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const recentTitles = (recentCards ?? []).map((c) => c.title).filter(Boolean);
    const shadowPrompt = await getShadowPrompt();
    const prompt = build7DayStrategyPrompt(
      (dnaData as CreatorDna) || null,
      recentTitles,
      platform,
      goal,
      shadowPrompt,
    );

    // 6. Run AI Reasoning with 54s deadline
    const aiResult = await runAI({
      feature: "pipeline_strategy",
      prompt,
      schema: STRATEGY_7DAY_SCHEMA,
      userId: user.id,
      refId: spendRef,
      creditsCharged: cost,
      signal: AbortSignal.timeout(54_000),
      budgetMs: 54_000,
    });

    if (!aiResult.text) {
      throw new Error("AI gak ngembaliin teks.");
    }

    const parsed = parseAIJson<{
      strategy_overview: string;
      plans: StrategyPlanItem[];
    }>(aiResult.text);

    if (!parsed || !Array.isArray(parsed.plans) || parsed.plans.length === 0) {
      throw new Error("Format strategi dari AI gak kebaca.");
    }

    // 7. Calculate target dates (Day 0 = Today, Day 1 = Tomorrow, ...) in Asia/Jakarta (WIB)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const rowsToInsert = parsed.plans.map((plan, index) => {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + (plan.day_offset ?? index));
      const dateStr = formatter.format(targetDate); // YYYY-MM-DD in Asia/Jakarta

      return {
        user_id: user.id,
        title: plan.title,
        status: "ide" as const,
        scheduled_date: dateStr,
        ai_score: plan.ai_score,
        schedule_label: plan.day_name,
        schedule_reason: plan.why_now,
        sort_order: index,
        content: {
          angle: plan.angle,
          why_now: plan.why_now,
          format: plan.format,
          est_duration: plan.est_duration,
          difficulty: plan.difficulty,
          hook_seed: plan.hook_seed,
          content_pillar: plan.content_pillar,
          ai_score: plan.ai_score,
          score_breakdown: plan.score_breakdown,
          score_reason: plan.score_reason,
          platform,
        },
      };
    });

    // 8. Insert all 7 cards into pipeline_cards
    const { data: insertedCards, error: insertError } = await service
      .from("pipeline_cards")
      .insert(rowsToInsert)
      .select();

    if (insertError) {
      throw insertError;
    }

    return Response.json({
      success: true,
      overview: parsed.strategy_overview,
      cards: insertedCards,
      cost,
    });
  } catch (error) {
    console.error("AI 7-Day Strategy error:", error);
    if (spendRef) {
      await refundCredits(user.id, spendRef, "refund_strategy_error");
    }
    const uf = userFacingError(error);
    return Response.json(
      {
        error: uf.message,
      },
      { status: 500 },
    );
  }
}
