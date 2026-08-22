import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateDetailed, generateStream, type Tier } from "@/lib/gemini/client";
import type { InlineImage } from "@/lib/gemini/providers";
import { getModel, getUsdToIdr } from "@/lib/config";
import { resolveRoute } from "./router";
import { getFleet, markProviderResult, resolveProviderKey } from "./registry";
import { costIdr } from "./cost";
import type { Candidate, ModelRow } from "./types";

/**
 * The AI engine: one entry point for every generation in the product.
 *
 * Responsibilities, in order of importance:
 *
 *   1. Ask the router which provider+model to use for this feature.
 *   2. Try them in order, falling back when one fails.
 *   3. Record what every attempt cost, per user, per feature, in rupiah.
 *   4. Fall back to the legacy env Gemini path when nothing is configured.
 *
 * ── CHARGE-ONCE ──────────────────────────────────────────────────────────────
 * This module never touches credits. Not once, not even to read them.
 *
 * That is the design, not an omission. Credits are spent by the ROUTE, once,
 * before the engine is called, and reversed by ref only if the engine gives up
 * on every candidate. Provider fallback therefore happens strictly below the
 * credit layer: if Claude fails and GPT answers, the ledger never learns that
 * two providers were involved, so it cannot double-charge for them. The
 * `credits_charged` figure that lands in ai_usage_log is passed in for reporting
 * and is written on the SUCCESSFUL attempt only, so summing that column cannot
 * over-count a fallback either.
 *
 * The rule for every future caller: spend once → runAI() → refund by ref only
 * when runAI() throws. Never spend per attempt.
 */

export type RunArgs = {
  /** A key from AI_FEATURES. Unknown keys are legal and route to the legacy path. */
  feature: string;
  prompt: string;
  schema?: Record<string, unknown>;
  images?: InlineImage[];
  /** For attribution in the cost log. Null for system jobs like the trends cron. */
  userId?: string | null;
  /** The credit spend's ref_id, so cost and revenue can be joined per request. */
  refId?: string | null;
  creditsCharged?: number;
  signal?: AbortSignal;
  tier?: Tier;
  /**
   * The user's own decrypted Gemini key. When present the fleet is bypassed
   * entirely — their quota is theirs to spend, and routing them onto a provider
   * the owner pays for would be billing theft in reverse.
   */
  byokKey?: string;
  /** Overrides the legacy-path model. Used by features that pin the cheap tier. */
  legacyModel?: string;
};

export type Usage = { input: number; output: number };

export type RunResult = {
  text: string;
  providerSlug: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costIdr: number;
  latencyMs: number;
  attempts: number;
  usedFallback: boolean;
};

const NO_USAGE: Usage = { input: 0, output: 0 };
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Write one attempt to the cost log.
 *
 * Best-effort, and deliberately so: accounting must never fail a generation the
 * user has already paid for. Undercounting is recoverable; a failed paid request
 * is not. Same rule recordUsage() follows in the Gemini client.
 */
async function logAttempt(row: {
  feature: string;
  userId?: string | null;
  providerId?: string | null;
  providerSlug: string;
  modelId: string;
  usage: Usage;
  costIdr: number;
  creditsCharged: number;
  latencyMs: number;
  status: "ok" | "error" | "fallback";
  attempt: number;
  errorMessage?: string;
  refId?: string | null;
}): Promise<void> {
  try {
    await createServiceRoleClient()
      .from("ai_usage_log")
      .insert({
        feature: row.feature,
        user_id: row.userId ?? null,
        provider_id: row.providerId ?? null,
        provider_slug: row.providerSlug,
        model_id: row.modelId,
        input_tokens: row.usage.input,
        output_tokens: row.usage.output,
        cost_idr: row.costIdr,
        credits_charged: row.creditsCharged,
        latency_ms: row.latencyMs,
        status: row.status,
        attempt: row.attempt,
        error_message: row.errorMessage?.slice(0, 1000) ?? null,
        ref_id: row.refId ?? null,
      });
  } catch (e) {
    console.error("ai_usage_log write failed", row.feature, e);
  }
}

/**
 * Price for a model id on the legacy path.
 *
 * The env Gemini pool is a registry row like any other, so if the owner sets a
 * price on it, calls that never went through the router still get costed. Nulls
 * out to a zero-priced stub when the model is not registered — unknown cost,
 * which the dashboard reports as unknown rather than as free.
 */
async function priceForModelId(modelId: string): Promise<ModelRow | null> {
  const { models } = await getFleet();
  return models.find((m) => m.model_id === modelId) ?? null;
}

const ZERO_PRICE = {
  input_price_usd_per_mtok: 0,
  output_price_usd_per_mtok: 0,
};

/** Turn a candidate into the argument shape the existing Gemini client wants. */
function callArgsFor(
  c: Candidate,
  args: RunArgs,
  onUsage?: (u: { input: number; output: number; total: number }) => void,
) {
  return {
    prompt: args.prompt,
    schema: args.schema,
    images: args.images,
    signal: args.signal,
    provider: c.provider.protocol,
    baseUrl: c.provider.base_url ?? undefined,
    model: c.model.model_id,
    // undefined for the env pool, which is what makes the client rotate across
    // GEMINI_API_KEY_1..10 exactly as it does today.
    byokKey: resolveProviderKey(c.provider),
    onUsage,
  };
}

/**
 * One-shot generation with routing, fallback and cost accounting.
 *
 * Throws only when every candidate has failed. The caller refunds on that throw.
 */
export async function runAI(args: RunArgs): Promise<RunResult> {
  const usdToIdr = await getUsdToIdr();
  const tier = args.tier ?? "free";

  // ── BYOK: their key, their quota, zero rupiah recorded against the owner ──
  if (args.byokKey) {
    const model = args.legacyModel ?? (await getModel(tier));
    const started = Date.now();
    const res = await generateDetailed({
      prompt: args.prompt,
      schema: args.schema,
      images: args.images,
      signal: args.signal,
      provider: "gemini",
      byokKey: args.byokKey,
      model,
    });
    const latencyMs = Date.now() - started;
    const usage = { input: res.inputTokens, output: res.outputTokens };

    await logAttempt({
      feature: args.feature,
      userId: args.userId,
      providerSlug: "byok",
      modelId: model,
      usage,
      costIdr: 0,
      creditsCharged: args.creditsCharged ?? 0,
      latencyMs,
      status: "ok",
      attempt: 1,
      refId: args.refId,
    });

    return {
      text: res.text,
      providerSlug: "byok",
      modelId: model,
      inputTokens: usage.input,
      outputTokens: usage.output,
      costIdr: 0,
      latencyMs,
      attempts: 1,
      usedFallback: false,
    };
  }

  const { candidates } = await resolveRoute(args.feature);

  // ── Nothing configured: the legacy path, byte for byte what the product does
  // today. This is the branch that makes deploying the layer a no-op. ──
  if (candidates.length === 0) {
    const model = args.legacyModel ?? (await getModel(tier));
    const started = Date.now();
    try {
      const res = await generateDetailed({
        prompt: args.prompt,
        schema: args.schema,
        images: args.images,
        signal: args.signal,
        tier,
        model,
      });
      const latencyMs = Date.now() - started;
      const usage = { input: res.inputTokens, output: res.outputTokens };
      const priced = await priceForModelId(model);
      const cost = costIdr(priced ?? ZERO_PRICE, usage, usdToIdr);

      await logAttempt({
        feature: args.feature,
        userId: args.userId,
        providerSlug: "gemini-pool",
        modelId: model,
        usage,
        costIdr: cost,
        creditsCharged: args.creditsCharged ?? 0,
        latencyMs,
        status: "ok",
        attempt: 1,
        refId: args.refId,
      });

      return {
        text: res.text,
        providerSlug: "gemini-pool",
        modelId: model,
        inputTokens: usage.input,
        outputTokens: usage.output,
        costIdr: cost,
        latencyMs,
        attempts: 1,
        usedFallback: false,
      };
    } catch (e) {
      await logAttempt({
        feature: args.feature,
        userId: args.userId,
        providerSlug: "gemini-pool",
        modelId: model,
        usage: NO_USAGE,
        costIdr: 0,
        creditsCharged: 0,
        latencyMs: Date.now() - started,
        status: "error",
        attempt: 1,
        errorMessage: errText(e),
        refId: args.refId,
      });
      throw e;
    }
  }

  // ── The fleet ──
  let lastError: unknown = new Error("Gak ada provider yang bisa dipakai.");

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const started = Date.now();
    const isLast = i === candidates.length - 1;

    try {
      const res = await generateDetailed(callArgsFor(c, args));
      const latencyMs = Date.now() - started;
      const usage = { input: res.inputTokens, output: res.outputTokens };
      const cost = costIdr(c.model, usage, usdToIdr);

      await Promise.all([
        logAttempt({
          feature: args.feature,
          userId: args.userId,
          providerId: c.provider.id,
          providerSlug: c.provider.slug,
          modelId: c.model.model_id,
          usage,
          costIdr: cost,
          creditsCharged: args.creditsCharged ?? 0,
          latencyMs,
          status: "ok",
          attempt: i + 1,
          refId: args.refId,
        }),
        markProviderResult(c.provider.id, true, { latencyMs }),
      ]);

      return {
        text: res.text,
        providerSlug: c.provider.slug,
        modelId: c.model.model_id,
        inputTokens: usage.input,
        outputTokens: usage.output,
        costIdr: cost,
        latencyMs,
        attempts: i + 1,
        usedFallback: i > 0,
      };
    } catch (e) {
      lastError = e;
      const latencyMs = Date.now() - started;
      await Promise.all([
        logAttempt({
          feature: args.feature,
          userId: args.userId,
          providerId: c.provider.id,
          providerSlug: c.provider.slug,
          modelId: c.model.model_id,
          usage: NO_USAGE,
          costIdr: 0,
          creditsCharged: 0,
          latencyMs,
          // "fallback" means another provider is about to be tried; "error"
          // means this was the end of the line. The distinction is what makes a
          // provider that quietly fails half the time visible in the dashboard
          // instead of averaged away.
          status: isLast ? "error" : "fallback",
          attempt: i + 1,
          errorMessage: errText(e),
          refId: args.refId,
        }),
        markProviderResult(c.provider.id, false, { latencyMs, error: errText(e) }),
      ]);
    }
  }

  throw lastError;
}

/**
 * Call one specific provider+model, with logging but no routing and no fallback.
 *
 * This is what the admin playground needs and what runAI() deliberately is not:
 * the question there is "what does THIS model do", so silently substituting a
 * better-scoring one would make the tester useless — you would be approving a
 * model you never actually ran.
 *
 * Logged under its own feature key so playground spend shows up in the cost
 * dashboard instead of hiding inside a real feature's numbers.
 */
export async function runOnModel(
  candidate: Candidate,
  args: RunArgs,
): Promise<RunResult> {
  const usdToIdr = await getUsdToIdr();
  const started = Date.now();

  try {
    const res = await generateDetailed(callArgsFor(candidate, args));
    const latencyMs = Date.now() - started;
    const usage = { input: res.inputTokens, output: res.outputTokens };
    const cost = costIdr(candidate.model, usage, usdToIdr);

    await logAttempt({
      feature: args.feature,
      userId: args.userId,
      providerId: candidate.provider.id,
      providerSlug: candidate.provider.slug,
      modelId: candidate.model.model_id,
      usage,
      costIdr: cost,
      creditsCharged: args.creditsCharged ?? 0,
      latencyMs,
      status: "ok",
      attempt: 1,
      refId: args.refId,
    });

    return {
      text: res.text,
      providerSlug: candidate.provider.slug,
      modelId: candidate.model.model_id,
      inputTokens: usage.input,
      outputTokens: usage.output,
      costIdr: cost,
      latencyMs,
      attempts: 1,
      usedFallback: false,
    };
  } catch (e) {
    await logAttempt({
      feature: args.feature,
      userId: args.userId,
      providerId: candidate.provider.id,
      providerSlug: candidate.provider.slug,
      modelId: candidate.model.model_id,
      usage: NO_USAGE,
      costIdr: 0,
      creditsCharged: 0,
      latencyMs: Date.now() - started,
      status: "error",
      attempt: 1,
      errorMessage: errText(e),
      refId: args.refId,
    });
    throw e;
  }
}

export type StreamMeta = Omit<RunResult, "text">;

/**
 * Streaming generation with routing and fallback.
 *
 * ── WHERE FALLBACK STOPS ─────────────────────────────────────────────────────
 * A candidate is only replaced if it fails BEFORE its first chunk of text. Once
 * a byte has been handed to the browser, switching providers would mean either
 * discarding what the user is already reading or splicing two different answers
 * together mid-sentence. Both are worse than a clean failure, and the caller
 * already refunds on a mid-stream error.
 *
 * So connection errors, auth errors, 429s and model-not-found all fall back
 * silently, because those surface before the first token. A provider that dies
 * halfway through a script does not.
 */
export async function* runAIStream(
  args: RunArgs,
  onMeta?: (meta: StreamMeta) => void,
): AsyncGenerator<string, void, unknown> {
  const usdToIdr = await getUsdToIdr();
  const tier = args.tier ?? "free";

  const legacy = async function* () {
    const model = args.legacyModel ?? (await getModel(tier));
    const started = Date.now();
    const slug = args.byokKey ? "byok" : "gemini-pool";
    const usage: Usage = { input: 0, output: 0 };
    let ok = false;
    // Captured so the log row carries WHY it failed. Logging a failure with an
    // empty message is the exact complaint the error_log work was built to fix:
    // a counted error with no cause cannot be acted on. Verified against a live
    // run where the upstream was returning 503 and the row said nothing.
    let failure: unknown = null;

    try {
      yield* generateStream({
        prompt: args.prompt,
        schema: args.schema,
        images: args.images,
        signal: args.signal,
        tier,
        model,
        byokKey: args.byokKey,
        onUsage: (u) => {
          usage.input = u.input;
          usage.output = u.output;
        },
      });
      ok = true;
    } catch (e) {
      failure = e;
      throw e;
    } finally {
      const latencyMs = Date.now() - started;
      const priced = args.byokKey ? null : await priceForModelId(model);
      const cost = ok ? costIdr(priced ?? ZERO_PRICE, usage, usdToIdr) : 0;

      await logAttempt({
        feature: args.feature,
        userId: args.userId,
        providerSlug: slug,
        modelId: model,
        usage,
        costIdr: cost,
        creditsCharged: ok ? (args.creditsCharged ?? 0) : 0,
        latencyMs,
        status: ok ? "ok" : "error",
        attempt: 1,
        // A consumer that stops early (the browser closing the SSE connection)
        // lands here with no error at all, which is a cancellation rather than a
        // fault — say so instead of leaving it blank.
        errorMessage: ok
          ? undefined
          : failure
            ? errText(failure)
            : "stream ended before completion (client disconnected or aborted)",
        refId: args.refId,
      });

      onMeta?.({
        providerSlug: slug,
        modelId: model,
        inputTokens: usage.input,
        outputTokens: usage.output,
        costIdr: cost,
        latencyMs,
        attempts: 1,
        usedFallback: false,
      });
    }
  };

  // BYOK never touches the fleet, for the same reason as in runAI().
  if (args.byokKey) {
    yield* legacy();
    return;
  }

  const { candidates } = await resolveRoute(args.feature);
  if (candidates.length === 0) {
    yield* legacy();
    return;
  }

  let lastError: unknown = new Error("Gak ada provider yang bisa dipakai.");

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const started = Date.now();
    const isLast = i === candidates.length - 1;
    const usage: Usage = { input: 0, output: 0 };
    const capture = (u: { input: number; output: number }) => {
      usage.input = u.input;
      usage.output = u.output;
    };

    // A model flagged as non-streaming still works — it just answers in one
    // piece, which the caller cannot tell apart from a very fast stream.
    const iterator = c.model.supports_streaming
      ? generateStream(callArgsFor(c, args, capture))[Symbol.asyncIterator]()
      : (async function* () {
          const r = await generateDetailed(callArgsFor(c, args));
          capture({ input: r.inputTokens, output: r.outputTokens });
          yield r.text;
        })()[Symbol.asyncIterator]();

    let first: IteratorResult<string>;
    try {
      // The fallback boundary. Everything up to and including the first chunk is
      // retryable on another provider; nothing after it is.
      first = await iterator.next();
    } catch (e) {
      lastError = e;
      await Promise.all([
        logAttempt({
          feature: args.feature,
          userId: args.userId,
          providerId: c.provider.id,
          providerSlug: c.provider.slug,
          modelId: c.model.model_id,
          usage: NO_USAGE,
          costIdr: 0,
          creditsCharged: 0,
          latencyMs: Date.now() - started,
          status: isLast ? "error" : "fallback",
          attempt: i + 1,
          errorMessage: errText(e),
          refId: args.refId,
        }),
        markProviderResult(c.provider.id, false, { error: errText(e) }),
      ]);
      continue;
    }

    // Past this point the answer belongs to this provider.
    let failed: unknown = null;
    try {
      if (!first.done && first.value) yield first.value;
      for (;;) {
        const next = await iterator.next();
        if (next.done) break;
        if (next.value) yield next.value;
      }
    } catch (e) {
      failed = e;
    }

    const latencyMs = Date.now() - started;
    const cost = failed ? 0 : costIdr(c.model, usage, usdToIdr);

    await Promise.all([
      logAttempt({
        feature: args.feature,
        userId: args.userId,
        providerId: c.provider.id,
        providerSlug: c.provider.slug,
        modelId: c.model.model_id,
        usage,
        costIdr: cost,
        creditsCharged: failed ? 0 : (args.creditsCharged ?? 0),
        latencyMs,
        status: failed ? "error" : "ok",
        attempt: i + 1,
        errorMessage: failed ? errText(failed) : undefined,
        refId: args.refId,
      }),
      markProviderResult(c.provider.id, !failed, {
        latencyMs,
        error: failed ? errText(failed) : undefined,
      }),
    ]);

    onMeta?.({
      providerSlug: c.provider.slug,
      modelId: c.model.model_id,
      inputTokens: usage.input,
      outputTokens: usage.output,
      costIdr: cost,
      latencyMs,
      attempts: i + 1,
      usedFallback: i > 0,
    });

    // A mid-stream failure is the caller's problem to refund, not ours to retry.
    if (failed) throw failed;
    return;
  }

  throw lastError;
}
