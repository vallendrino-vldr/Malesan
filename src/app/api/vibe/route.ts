import { NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { checkPoolAdmission } from "@/lib/gemini/quota";
import { generateStream, parseJson } from "@/lib/gemini/client";
import { decryptSecret } from "@/lib/gemini/crypto";
import {
  VIBE_KIT_SCHEMA,
  VIBE_KIT_CREDIT_COST,
  buildVibeKitPrompt,
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

  const { data: profile } = await supabase.from("profiles").select("*").single();
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

  // Spend first, with a ref, so a failure can be reversed exactly.
  const spendRef = crypto.randomUUID();
  try {
    await serviceRole.rpc("spend_credits", {
      p_user: user.id,
      p_amount: VIBE_KIT_CREDIT_COST,
      p_reason: "generate_vibe_kit",
      p_ref: spendRef,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("INSUFFICIENT_CREDITS")) {
      return Response.json(
        {
          error: `Vibe Kit butuh ${VIBE_KIT_CREDIT_COST} credit dan punya lo kurang. Besok refill jam 00:00, atau top up biar gak nunggu.`,
        },
        { status: 402 },
      );
    }
    throw err;
  }

  const encoder = new TextEncoder();
  const dnaLang = "id";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      let raw = "";
      try {
        send({ status: "Lagi nyusun spesifikasi buat lo..." });

        for await (const chunk of generateStream({
          prompt: buildVibeKitPrompt({ idea, stack, audience }, dnaLang),
          tier: profile.is_pro ? "pro" : "free",
          schema: VIBE_KIT_SCHEMA as unknown as Record<string, unknown>,
          byokKey,
        })) {
          raw += chunk;
          // Progress only — the payload is one large JSON object and is useless
          // to the client until it is complete, so we report size, not content.
          send({ progress: raw.length });
        }

        const parsed = parseJson<VibeKitOutput>(raw);
        if (!parsed?.docs?.prd || !parsed?.docs?.master_prompt) {
          throw new Error("Model returned an incomplete kit");
        }

        const { data: genRow } = await serviceRole
          .from("generations")
          .insert({
            user_id: user.id,
            module: "vibe_kit",
            input: { idea, stack, audience },
            output: parsed as unknown as Json,
            credits_spent: VIBE_KIT_CREDIT_COST,
            model_used: profile.is_pro
              ? process.env.GEMINI_MODEL_PRO
              : process.env.GEMINI_MODEL_FREE,
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
        try {
          await serviceRole.rpc("refund_credits", {
            p_user: user.id,
            p_ref: spendRef,
            p_reason: "refund_vibe_kit_failed",
          });
        } catch (e) {
          console.error("Vibe kit refund failed", e);
        }

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
