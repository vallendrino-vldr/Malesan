import { NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { checkPoolAdmission } from "@/lib/gemini/quota";
import { generate, parseJson } from "@/lib/gemini/client";
import { getCost, isModuleEnabled, getModel, getShadowPrompt } from "@/lib/config";
import { spendCredits, refundCredits } from "@/lib/credits";
import { decryptSecret } from "@/lib/gemini/crypto";
import {
  VIBE_DOC_SPECS,
  VIBE_DOC_SCHEMA,
  VIBE_IDENTITY_SCHEMA,
  buildVibeDocPrompt,
  buildVibeIdentityPrompt,
  formatVibeAnswers,
  type VibeKitOutput,
} from "@/lib/prompts/vibe";

// Six long documents in one call. The default 30s is not enough; streaming keeps
// the connection alive while the model works.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const idea: string = body?.idea?.trim() ?? "";
  const stack: string | undefined = body?.stack?.trim() || undefined;
  const audience: string | undefined = body?.audience?.trim() || undefined;
  // Answers to the clarifying questions, when the user filled any in. Optional
  // by design — the step is skippable and generation must still work without it.
  const answers: { q: string; a: string }[] = Array.isArray(body?.answers)
    ? body.answers
        .filter((x: unknown): x is { q: string; a: string } =>
          !!x && typeof (x as { q?: unknown }).q === "string" && typeof (x as { a?: unknown }).a === "string",
        )
        .slice(0, 5)
    : [];

  if (idea.length < 12) {
    return Response.json(
      { error: "Ceritain dulu mau bikin apa. Satu-dua kalimat aja cukup." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Same missing filter as /app had: `.single()` throws once the table holds
  // more than one readable row, so this returned 404 and the route exited before
  // spending a single credit. That is why Vibe appeared to generate for free —
  // it never actually reached the spend, and there is no `generate_vibe_kit` row
  // anywhere in the ledger to show for it.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return new Response("Profile not found", { status: 404 });
  if (profile.is_banned) return new Response("Banned", { status: 403 });

  const serviceRole = createServiceRoleClient();

  // BYOK: decrypt the user's own key so it never touches the shared pool.
  // The content route left this as a TODO and passed the ciphertext straight to
  // Google, which would have failed every BYOK generation.
  let byokKey: string | undefined;
  const { data: byokRow } = await serviceRole
    .from("user_api_keys")
    .select("key_encrypted, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (byokRow?.is_active && byokRow.key_encrypted) {
    try {
      byokKey = decryptSecret(byokRow.key_encrypted);
    } catch {
      // A key we cannot decrypt is the same as no key. Fall back to the pool
      // rather than failing the request the user is paying for.
      byokKey = undefined;
    }
  }

  const admission = await checkPoolAdmission({
    isPro: profile.is_pro,
    hasByok: Boolean(byokKey),
  });
  if (!("allowed" in admission) || !admission.allowed) {
    return Response.json(
      { error: (admission as { message: string }).message },
      { status: 429 },
    );
  }

  // Cost and availability come from app_config, same as /api/generate, so this
  // module is not the one place pricing still needs a deploy to change.
  if (!(await isModuleEnabled("vibe"))) {
    return Response.json(
      { error: "Vibe Coding lagi dimatiin sementara. Coba lagi nanti ya." },
      { status: 503 },
    );
  }
  const cost = await getCost("vibe");

  // The old inline try/catch around `.rpc()` could never fire — `.rpc()`
  // resolves with `{ error }` rather than rejecting — so this route generated
  // six-document kits for users with no credits at all.
  const spend = await spendCredits(user.id, cost, "generate_vibe_kit");
  if (!spend.ok) {
    return Response.json(
      {
        error:
          spend.reason === "insufficient"
            ? `Vibe Kit butuh ${cost} kredit, punya lo kurang. Besok jam 00:00 direfill, atau top up biar gak nunggu.`
            : spend.message,
      },
      { status: spend.reason === "insufficient" ? 402 : 500 },
    );
  }
  const spendRef = spend.ref;

  // Vibe was the only generator that never read Creator DNA, so every user got
  // identical documents — the "generic AI output" complaint, at its source.
  const { data: dna } = await serviceRole
    .from("creator_dna")
    .select("industry, experience_level, work_context, client_brief, goals, ai_persona_summary, output_language")
    .eq("user_id", user.id)
    .single();

  const encoder = new TextEncoder();
  const dnaLang = dna?.output_language || "id";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        const tier = profile.is_pro ? "pro" : "free";
        const model = await getModel(tier);

        /**
         * The owner's house rule, same as every other module.
         *
         * The admin panel tells the owner this instruction lands on "semua
         * modul", and until now the Vibe kit was the one place it did not — a
         * rule set once and silently ignored by a module listed on that same
         * screen with its own price and kill switch. Same framing string as
         * buildExtras uses in src/lib/prompts/index.ts, deliberately: two
         * wordings for one concept is how they drift apart.
         */
        const shadow = await getShadowPrompt();
        const shadowBlock = shadow
          ? `
ATURAN WAJIB DARI PENGELOLA (paling tinggi, gak bisa ditawar):
${shadow}
`
          : "";

        // One short call to name the project, so all six documents agree on it.
        send({ status: "Mikirin konsepnya...", step: 0, total: 7 });
        const identityRaw = await generate({
          prompt:
            buildVibeIdentityPrompt({ idea, stack, audience }, dnaLang, dna) +
            formatVibeAnswers(answers) +
            shadowBlock,
          tier,
          model,
          schema: VIBE_IDENTITY_SCHEMA as unknown as Record<string, unknown>,
          byokKey,
        });
        const identity = parseJson<{
          project_name: string;
          one_liner: string;
          stack_summary: string;
        }>(identityRaw);

        if (!identity?.project_name) {
          throw new Error("Gagal nentuin konsep project-nya. Coba ceritain idenya lebih jelas.");
        }

        send({
          status: `"${identity.project_name}" — sekarang nulis dokumennya`,
          step: 1,
          total: 7,
          identity,
        });

        // Six concurrent calls. Sequential would blow past the 60s function
        // limit; concurrent costs the slowest single document instead of the
        // sum, and each one reports as it lands so progress is real rather
        // than a character counter.
        let done = 1;
        const results = await Promise.all(
          VIBE_DOC_SPECS.map(async (doc) => {
            const raw = await generate({
              prompt:
                buildVibeDocPrompt({ idea, stack, audience }, doc, identity, dnaLang, dna) +
                formatVibeAnswers(answers) +
                shadowBlock,
              tier,
              model,
              schema: VIBE_DOC_SCHEMA as unknown as Record<string, unknown>,
              byokKey,
            });
            const content = parseJson<{ content: string }>(raw)?.content ?? "";
            done += 1;
            send({
              status: `${doc.file} kelar`,
              step: done,
              total: 7,
              doc: doc.key,
              chars: content.length,
            });
            return { key: doc.key, content };
          }),
        );

        const docs = Object.fromEntries(results.map((r) => [r.key, r.content])) as
          VibeKitOutput["docs"];

        const empty = VIBE_DOC_SPECS.filter((d) => !docs[d.key]?.trim());
        if (empty.length) {
          throw new Error(
            `Dokumen ini gagal dibikin: ${empty.map((d) => d.file).join(", ")}. Kredit lo balik.`,
          );
        }

        const parsed: VibeKitOutput = { ...identity, docs };

        const { data: genRow } = await serviceRole
          .from("generations")
          .insert({
            user_id: user.id,
            module: "vibe_kit",
            input: { idea, stack, audience, answers },
            output: parsed as unknown as Json,
            credits_spent: cost,
            model_used: await getModel(profile.is_pro ? "pro" : "free"),
          })
          .select("id")
          .single();

        const { data: projectRow } = await serviceRole
          .from("vibe_projects")
          .insert({
            user_id: user.id,
            generation_id: genRow?.id ?? null,
            name: parsed.project_name,
            one_liner: parsed.one_liner,
            stack: parsed.stack_summary,
            docs: parsed.docs,
          })
          .select("id")
          .single();

        send({ done: true, project_id: projectRow?.id ?? null, kit: parsed });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Gagal bikin kit-nya.";

        // Not charged for a failure. Exact reversal by ref, idempotent.
        await refundCredits(user.id, spendRef, "refund_vibe_kit_failed");

        send({
          error: `Gagal bikin kit-nya: ${message}. Credit lo udah dibalikin — coba lagi.`,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
