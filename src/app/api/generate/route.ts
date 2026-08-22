import { NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { checkPoolAdmission } from "@/lib/gemini/quota";
import { getCost, isModuleEnabled, getModel, getShadowPrompt } from "@/lib/config";
import { runAIStream, type StreamMeta } from "@/lib/ai/engine";
import { decryptSecret } from "@/lib/gemini/crypto";
import { processReferral } from "@/app/actions/payments";
import { spendCredits, refundCredits } from "@/lib/credits";
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
  type PromptExtras,
} from "@/lib/prompts";
import {
  buildClipEnginePrompt,
  buildThreadEnginePrompt,
  CLIP_ENGINE_SCHEMA,
  THREAD_ENGINE_SCHEMA,
} from "@/lib/prompts/engines";

export const maxDuration = 60; // Vercel Hobby max. Script gen + key backoff passed 30s and hard-timed-out (which also skips the refund below), so raised to the real cap.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { module, input, platform } = body as {
      module: "ide_hari_ini" | "idea" | "hook" | "script" | "repurpose" | "clip" | "thread";
      input?: Record<string, string>;
      platform?: "tiktok" | "instagram" | "youtube" | "x" | "threads";
    };

    const MODULES = ["ide_hari_ini", "idea", "hook", "script", "repurpose", "clip", "thread"];
    if (!module || !MODULES.includes(module)) {
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

    if (module === "clip" && (!input?.moment || input.moment.trim().length === 0)) {
      return new Response("Moment description is required for Clip Engine", { status: 400 });
    }

    if (module === "thread" && (!input?.bullets || input.bullets.trim().length === 0)) {
      return new Response("Bullet points are required for Thread Engine", { status: 400 });
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

    /**
     * BYOK, decrypted.
     *
     * This route used to load the row, set `hasByok` from its mere existence,
     * and then never decrypt or use the key — the call below carried a
     * commented-out `byokKey` with a note that crypto was unimplemented. It is
     * implemented, and /api/vibe has been using it. The effect of the gap was
     * backwards: a BYOK user was waved past the pool guard (because `hasByok`
     * was true) and then served from the shared pool anyway, spending the
     * owner's quota instead of their own.
     *
     * `hasByok` is now derived from a key that actually decrypted, so a corrupt
     * or unreadable key can no longer buy a guard bypass it cannot honour.
     */
    let byokKey: string | undefined;
    const { data: byok } = await supabase
      .from("user_api_keys")
      .select("key_encrypted, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (byok?.is_active && byok.key_encrypted) {
      try {
        byokKey = decryptSecret(byok.key_encrypted);
      } catch {
        // Undecryptable is the same as absent: fall back to the pool rather
        // than failing a request the user is paying for.
        byokKey = undefined;
      }
    }

    const hasByok = Boolean(byokKey);

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
    
    /**
     * Everything injected on top of the creator's own profile.
     *
     * Assembled here rather than inside the prompt builders because all three
     * sources are requests: the owner's house rule from app_config, the picked
     * voice from `personas`, and the creator's link from `creator_dna`. A prompt
     * builder that reaches into the database stops being testable.
     *
     * The reference material is passed straight through from the request body —
     * it is the user's own text, fenced and labelled as data inside the prompt.
     */
    let persona: { name: string; voice: string } | null = null;
    if (input?.persona_id) {
      // Scoped by user_id as well as id: RLS already enforces it, and a second
      // filter means a guessed uuid cannot even probe for existence.
      const { data: p } = await supabase
        .from("personas")
        .select("name, voice")
        .eq("id", input.persona_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (p) persona = { name: p.name as string, voice: p.voice as string };
    }

    const dnaRow = dna as (typeof dna & {
      cta_enabled?: boolean | null;
      cta_url?: string | null;
      cta_label?: string | null;
    }) | null;

    const extras: PromptExtras = {
      shadowPrompt: await getShadowPrompt(),
      reference: typeof input?.reference === "string" ? input.reference : undefined,
      persona,
      cta:
        dnaRow?.cta_enabled && dnaRow?.cta_url
          ? { url: dnaRow.cta_url, label: dnaRow.cta_label ?? null }
          : null,
    };

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

    // Spend through the helper. The old inline `try/catch` around `.rpc()` never
    // fired, because `.rpc()` resolves with `{ error }` instead of rejecting —
    // so a user at zero credits generated for free.
    const spend = await spendCredits(user.id, cost, `generate_${module}`);
    if (!spend.ok) {
      return new Response(JSON.stringify({ error: spend.message }), {
        status: spend.reason === "insufficient" ? 402 : 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    const spendRef = spend.ref;

    // Fire and forget referral processing (idempotent, only does something on first gen)
    processReferral(user.id).catch(console.error);

    // 5. Build prompt
    let promptText = "";
    let schema = {};

    if (module === "ide_hari_ini") {
      promptText = buildIdeHariIniPrompt(dna, trends || [], learned, extras);
      schema = IDE_HARI_INI_SCHEMA;
    } else if (module === "idea") {
      promptText = buildIdeaEnginePrompt(input!.text, dna, trends || [], learned, extras);
      schema = IDEA_ENGINE_SCHEMA;
    } else if (module === "hook") {
      promptText = buildHookLabPrompt(input!.idea, platform || "tiktok", dna, trends || [], learned, extras);
      schema = HOOK_LAB_SCHEMA;
    } else if (module === "script") {
      promptText = buildScriptBuilderPrompt(input!.idea, input!.hook, platform || "tiktok", input!.duration, dna, trends || [], learned, extras);
      schema = SCRIPT_BUILDER_SCHEMA;
    } else if (module === "repurpose") {
      promptText = buildRepurposePrompt(input!.source_content, dna, trends || [], learned, extras);
      schema = REPURPOSE_SCHEMA;
    } else if (module === "clip") {
      promptText = buildClipEnginePrompt(
        input!.moment,
        platform || "tiktok",
        input!.duration || "30-60 detik",
        dna,
        trends || [],
        learned,
        extras,
      );
      schema = CLIP_ENGINE_SCHEMA;
    } else if (module === "thread") {
      promptText = buildThreadEnginePrompt(
        input!.bullets,
        platform || "x",
        dna,
        trends || [],
        learned,
        extras,
      );
      schema = THREAD_ENGINE_SCHEMA;
    }

    const encoder = new TextEncoder();

    // Set up SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        let parsed = null;
        let isError = false;
        // Which provider and model actually answered. Filled by the engine, and
        // used below so `generations.model_used` records what ran rather than
        // what we intended to run — those differ the moment a fallback fires.
        let meta: StreamMeta | null = null;

        try {
          // 6. Route through the provider layer -> SSE stream.
          //
          // With no route configured for this module the engine uses the exact
          // legacy path this line used to call directly, so behaviour is
          // unchanged until the owner opts the module in from /admin/ai.
          const generator = runAIStream(
            {
              feature: module,
              prompt: promptText,
              schema: schema,
              tier: profile.is_pro ? "pro" : "free",
              legacyModel: await getModel(profile.is_pro ? "pro" : "free"),
              userId: user.id,
              refId: spendRef,
              creditsCharged: cost,
              byokKey,
              // Give up ~8s before the 60s hard timeout so the catch below runs and the
              // credit is refunded, rather than the function being killed mid-stream.
              signal: AbortSignal.timeout(52_000),
            },
            (m) => {
              meta = m;
            },
          );

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
          // Same trap as the spend: this used to be a bare try/catch around
          // `.rpc()`, which cannot catch anything. The helper inspects `error`.
          await refundCredits(user.id, spendRef, `refund_${module}_failed`);
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
                model_used:
                  (meta as StreamMeta | null)?.modelId ??
                  (await getModel(profile.is_pro ? "pro" : "free")),
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
