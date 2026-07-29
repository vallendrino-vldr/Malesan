import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { generate, parseJson } from "@/lib/gemini/client";
import {
  buildCreatorDnaAnalysisPrompt,
  CREATOR_DNA_ANALYSIS_SCHEMA,
} from "@/lib/prompts";

export const maxDuration = 30; // Max execution time for vercel hobby

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      niche,
      target_audience,
      tone,
      platforms,
      banned_words,
      brand_notes,
      work_context,
      client_brief,
      industry,
      goals,
      persona_style,
      experience_level,
      content_pillars,
      posting_frequency,
      reference_creators,
      humor_level,
    } = body;

    const WORK_CONTEXTS = ["sendiri", "klien", "brand"];
    const ctx = WORK_CONTEXTS.includes(work_context) ? work_context : "sendiri";
    const humor =
      typeof humor_level === "number" && humor_level >= 0 && humor_level <= 10
        ? Math.round(humor_level)
        : null;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_banned, is_pro")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.is_banned) {
      return NextResponse.json({ error: "Banned" }, { status: 403 });
    }

    // Step 1: Deduct 2 credits via service role
    const serviceRole = createServiceRoleClient();
    const cost = 2;

    // Carry a ref so a failure can be reversed bucket-for-bucket. The old code
    // refunded with grant_credits into "free" — the same guessing heuristic
    // that was removed from SQL. It could hand back paid credits (which never
    // expire) as free ones (wiped at the next daily reset).
    const spendRef = crypto.randomUUID();
    const refund = async (reason: string) => {
      try {
        await serviceRole.rpc("refund_credits", {
          p_user: user.id,
          p_ref: spendRef,
          p_reason: reason,
        });
      } catch (e) {
        console.error("refund failed", reason, e);
      }
    };

    try {
      await serviceRole.rpc("spend_credits", {
        p_user: user.id,
        p_amount: cost,
        p_reason: "creator_dna_analysis",
        p_ref: spendRef,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes("INSUFFICIENT_CREDITS")) {
        return NextResponse.json(
          { error: "Credit kurang. Butuh 2 credit buat analisa DNA." },
          { status: 402 }
        );
      }
      throw err;
    }

    // Step 2: Generate AI Persona Summary
    const promptText = buildCreatorDnaAnalysisPrompt({
      niche,
      target_audience,
      tone,
      platforms,
      banned_words,
      brand_notes,
      work_context: ctx,
      client_brief,
      industry,
      goals,
      persona_style,
      experience_level,
      content_pillars,
      posting_frequency,
      reference_creators,
      humor_level: humor,
    });

    let aiPersonaSummary = null;

    try {
      // For this one, we do a blocking generate (not stream) because we need the final JSON
      // before we insert into the database. It should be fast since it's a short output.
      const rawRes = await generate({
        prompt: promptText,
        tier: profile.is_pro ? "pro" : "free",
        schema: CREATOR_DNA_ANALYSIS_SCHEMA,
      });

      const parsed = parseJson<{ persona_summary: string; signature_formats: string[] }>(rawRes);
      aiPersonaSummary = parsed.persona_summary;
      
    } catch {
      await refund("dna_analysis_failed");
      return NextResponse.json({ error: "AI gagal nganalisa DNA lo. Coba lagi." }, { status: 502 });
    }

    // Step 3: Upsert into creator_dna
    const { error: dnaError } = await serviceRole
      .from("creator_dna")
      .upsert({
        user_id: user.id,
        niche: niche || null,
        target_audience: target_audience || null,
        tone: tone || null,
        platforms: platforms || [],
        banned_words: banned_words || [],
        brand_notes: brand_notes || null,
        work_context: ctx,
        client_brief: ctx === "sendiri" ? null : client_brief || null,
        industry: industry || null,
        goals: goals || null,
        persona_style: persona_style || null,
        experience_level: experience_level || null,
        content_pillars: content_pillars || [],
        posting_frequency: posting_frequency || null,
        reference_creators: reference_creators || null,
        humor_level: humor,
        ai_persona_summary: aiPersonaSummary,
        updated_at: new Date().toISOString(),
      });

    if (dnaError) {
      await refund("dna_save_failed");
      return NextResponse.json({ error: "Gagal nyimpen data." }, { status: 500 });
    }

    // Step 4: Mark onboarding as completed
    await serviceRole
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);

    return NextResponse.json({ success: true, ai_persona_summary: aiPersonaSummary });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
