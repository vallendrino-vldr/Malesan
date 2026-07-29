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
    const { niche, target_audience, tone, platforms, banned_words, brand_notes } = body;

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

    try {
      await serviceRole.rpc("spend_credits", {
        p_user: user.id,
        p_amount: cost,
        p_reason: "creator_dna_analysis",
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
      
    } catch (err: unknown) {
      // Refund if generation fails
      await serviceRole.rpc("grant_credits", {
        p_user: user.id,
        p_amount: cost,
        p_bucket: "free",
        p_reason: "dna_analysis_failed",
      });
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
        ai_persona_summary: aiPersonaSummary,
        updated_at: new Date().toISOString(),
      });

    if (dnaError) {
      // Refund and error
      await serviceRole.rpc("grant_credits", {
        p_user: user.id,
        p_amount: cost,
        p_bucket: "free",
        p_reason: "dna_save_failed",
      });
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
