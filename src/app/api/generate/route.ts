import { NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { checkPoolAdmission } from "@/lib/gemini/quota";
import { getCost, isModuleEnabled, getModel } from "@/lib/config";
import { generateStream } from "@/lib/gemini/client";
import { processReferral } from "@/app/actions/payments";
import {
  type LearnedNote,
  buildIdeHariIniPrompt,
  buildIdeaEnginePrompt,
  buildHookLabPrompt,
  buildScriptBuilderPrompt,
  buildRepurposePrompt,
  IDE_HARI_INI_SCHEMA,
  IDEA_ENGINE_SCHEMA,
  HOOK_LAB_SCHEMA,
  SCRIPT_BUILDER_SCHEMA,
  REPURPOSE_SCHEMA,
} from "@/lib/prompts";

export const maxDuration = 30; // Max execution time for vercel hobby

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { module, input, platform } = body as {
      module: "ide_hari_ini" | "idea" | "hook" | "script" | "repurpose";
      input?: Record<string, string>;
      platform?: "tiktok" | "instagram" | "youtube" | "x" | "threads";
    };

    if (!module || !["ide_hari_ini", "idea", "hook", "script", "repurpose"].includes(module)) {
      return new Response("Invalid module", { status: 400 });
    }

    if (module === "idea" && (!input?.text || input.text.trim().length === 0)) {
      return new Response("Input is required for Idea Engine", { status: 400 });
    }
    
    if (module === "hook" && (!input?.idea || input.idea.trim().length === 0)) {
      return new Response("Idea input is required for Hook Lab", { status: 400 });
    }

    if (module === "script" && (!input?.idea || !input?.hook || !input?.duration)) {
      return new Response("Idea, hook, and duration inputs are required for Script Builder", { status: 400 });
    }

    if (module === "repurpose" && (!input?.source_content || input.source_content.trim().length === 0)) {
      return new Response("Source content is required for Repurpose", { status: 400 });
    }

    // 1. auth.getUser() - Never getSession()
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Load profile and reject if banned
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_banned, is_pro")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response("Profile not found", { status: 404 });
    }

    if (profile.is_banned) {
      return new Response("Banned", { status: 403 });
    }

    // Check for BYOK key
    const { data: byok } = await supabase
      .from("user_api_keys")
      .select("key_encrypted, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    const hasByok = !!byok;

    // 3. checkPoolAdmission from quota module
    const admission = await checkPoolAdmission({ isPro: profile.is_pro, hasByok });
    if (!admission.allowed) {
      return new Response(JSON.stringify({ error: admission.message }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Load Creator DNA
    const { data: dna } = await supabase
      .from("creator_dna")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // 4. Load active trends via service-role client
    const serviceRole = createServiceRoleClient();
    const { data: trends } = await serviceRole
      .from("trends")
      .select("*")
      .eq("is_active", true)
      .order("captured_at", { ascending: false })
      .limit(5);

    // Feedback loop. Ratings have been collected on every generation since the
    // ledger work and never read back — a survey rather than a loop. Pull this
    // creator's rated history so the prompt can learn from their own results
    // instead of starting cold every time.
    const { data: rated } = await serviceRole
      .from("generations")
      .select("module, output, performance_rating")
      .eq("user_id", user.id)
      .not("performance_rating", "is", null)
      .order("performance_rating", { ascending: false })
      .limit(12);

    const learned: LearnedNote[] = (rated ?? [])
      .map((r) => {
        const o = r.output as Record<string, unknown> | null;
        // Every module shapes its output differently; take whatever reads as a
        // headline and fall back to the raw JSON's first readable string.
        const ideas = o?.ideas as { title?: string }[] | undefined;
        const hooks = o?.hooks as { text?: string }[] | undefined;
        const gist =
          ideas?.[0]?.title ??
          hooks?.[0]?.text ??
          (typeof o?.caption === "string" ? o.caption : "") ??
          "";
        return {
          module: r.module as string,
          rating: r.performance_rating as number,
          gist: String(gist).slice(0, 140),
        };
      })
      .filter((l) => l.gist.trim());
    
    // Cost and availability come from app_config now, so pricing changes and
    // taking a broken module out of service no longer need a deploy. Both fall
    // back to the previous hardcoded values if the table is unreachable.
    if (!(await isModuleEnabled(module))) {
      return new Response(
        JSON.stringify({
          error: "Modul ini lagi dimatiin sementara. Coba lagi nanti ya.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const cost = await getCost(module);

    // Every spend carries a ref so a failed generation can be reversed exactly.
    // Without it a refund has to guess which bucket the credits came from, which
    // is what the previous version did — see refund below.
    const spendRef = crypto.randomUUID();

    try {
      await serviceRole.rpc("spend_credits", {
        p_user: user.id,
        p_amount: cost,
        p_reason: `generate_${module}`,
        p_ref: spendRef,
      });
      // Fire and forget referral processing (idempotent, only does something on first gen)
      processReferral(user.id).catch(console.error);
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes("INSUFFICIENT_CREDITS")) {
        return new Response(
          JSON.stringify({
            error: "Credit abis. Besok refill jam 00:00, atau top up biar gak nunggu.",
          }),
          { status: 402, headers: { "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    // 5. Build prompt
    let promptText = "";
    let schema = {};

    if (module === "ide_hari_ini") {
      promptText = buildIdeHariIniPrompt(dna, trends || [], learned);
      schema = IDE_HARI_INI_SCHEMA;
    } else if (module === "idea") {
      promptText = buildIdeaEnginePrompt(input!.text, dna, trends || [], learned);
      schema = IDEA_ENGINE_SCHEMA;
    } else if (module === "hook") {
      promptText = buildHookLabPrompt(input!.idea, platform || "tiktok", dna, trends || [], learned);
      schema = HOOK_LAB_SCHEMA;
    } else if (module === "script") {
      promptText = buildScriptBuilderPrompt(input!.idea, input!.hook, platform || "tiktok", input!.duration, dna, trends || [], learned);
      schema = SCRIPT_BUILDER_SCHEMA;
    } else if (module === "repurpose") {
      promptText = buildRepurposePrompt(input!.source_content, dna, trends || [], learned);
      schema = REPURPOSE_SCHEMA;
    }

    const encoder = new TextEncoder();

    // Set up SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        let parsed = null;
        let isError = false;

        try {
          // 6. generateStream -> SSE stream
          const generator = generateStream({
            prompt: promptText,
            tier: profile.is_pro ? "pro" : "free",
            model: await getModel(profile.is_pro ? "pro" : "free"),
            schema: schema,
            // byokKey: ... we'd decrypt here, but crypto module isn't fully implemented in this PRD section. Leaving out BYOK key decryption for now.
          });

          for await (const chunk of generator) {
            fullResponse += chunk;
            // Send SSE data frames
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`)
            );
          }

          // Parse strict JSON with repair retry omitted here as we're relying on responseSchema.
          // If parse fails, we'll catch and refund.
          let cleanedResponse = fullResponse.trim();
          if (cleanedResponse.startsWith("```json")) {
            cleanedResponse = cleanedResponse.replace(/^```json\n?/, "").replace(/\n?```$/, "");
          } else if (cleanedResponse.startsWith("```")) {
            cleanedResponse = cleanedResponse.replace(/^```\n?/, "").replace(/\n?```$/, "");
          }
          parsed = JSON.parse(cleanedResponse);

        } catch (err: unknown) {
          isError = true;
          const message = err instanceof Error ? err.message : "Generation failed";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: message,
              })}\n\n`
            )
          );

          // On failure the user must not be charged (PROMPTS.md §1).
          //
          // The previous version reimplemented the same guessing heuristic that
          // was removed from SQL: it assumed the credits came from `free` up to
          // a ceiling of 10 and dumped the rest into `paid`. That can hand back
          // paid credits as free ones — which are wiped at the next daily reset
          // — and it makes the ledger stop reconciling.
          //
          // refund_credits reads the original spend rows by ref and reverses
          // them exactly, bucket for bucket. It is idempotent, so a retry here
          // cannot pay the user twice.
          try {
            await serviceRole.rpc("refund_credits", {
              p_user: user.id,
              p_ref: spendRef,
              p_reason: `refund_${module}_failed`,
            });
          } catch (e) {
            console.error("Refund failed", e);
          }
        }

        if (!isError && parsed) {
          // 7. On success: persist to generations
          try {
            const { data: genRow, error: genError } = await serviceRole
              .from("generations")
              .insert({
                user_id: user.id,
                module: module,
                platform: platform || null,
                input: input || null,
                output: parsed,
                model_used: await getModel(profile.is_pro ? "pro" : "free"),
                credits_spent: cost,
              })
              .select()
              .single();

            if (genError) {
              console.error("Failed to insert generation:", genError);
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ done: true, generation: genRow || { output: parsed } })}\n\n`
              )
            );
          } catch (e: unknown) {
            console.error("Persist failed but user got data:", e);
            // Fallback: send done so UI updates
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ done: true, generation: { output: parsed } })}\n\n`
              )
            );
          }
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(message, {
      status: 500,
    });
  }
}
