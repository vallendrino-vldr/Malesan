import "server-only";
import { markRateLimited, orderedAttempts, type PoolKey } from "./keys";
import { recordUsage } from "./quota";
import {
  adapterFor,
  supportsStreaming,
  type InlineImage,
  type ProviderName,
} from "./providers";
import { getProviderConfig } from "@/lib/config";

/**
 * The only place in the codebase that talks to Gemini.
 *
 * Every call goes through here so that key rotation, 429 backoff and usage
 * accounting cannot be forgotten at a call site. This module is server-only and
 * the API key never leaves it.
 */

/** Exponential backoff on 429 — 1s, 2s, 4s, 8s. */
const BACKOFF_MS = [1_000, 2_000, 4_000]; // dropped the 8s round: on a 60s function budget it risked a hard timeout (credit lost) instead of a clean refunded failure.

export type Tier = "free" | "pro";

export function modelFor(tier: Tier): string {
  const model =
    tier === "pro" ? process.env.GEMINI_MODEL_PRO : process.env.GEMINI_MODEL_FREE;
  if (!model) {
    throw new Error(
      `GEMINI_MODEL_${tier.toUpperCase()} is not set. Model ids live in env, never hardcoded.`,
    );
  }
  return model;
}

export type GenerateArgs = {
  prompt: string;
  tier?: Tier;
  /** A user's own key. When present the shared pool is bypassed entirely. */
  byokKey?: string;
  /** Explicit model id. Overrides the tier lookup — set from app_config. */
  model?: string;
  /** Gemini responseSchema. Supplying one makes the model emit strict JSON. */
  schema?: Record<string, unknown>;
  signal?: AbortSignal;
  /**
   * Which vendor to talk to. Resolved from app_config by the callers below when
   * not supplied, so a route does not have to know or care.
   */
  provider?: ProviderName;
  baseUrl?: string;
  /**
   * Images to reason over. Only used by the payment-proof checker today, but it
   * belongs here rather than in a second client: rotation, backoff and usage
   * accounting must apply to a vision call exactly as they do to a text one.
   */
  images?: InlineImage[];
  /**
   * Reports token usage once the stream has finished.
   *
   * A generator cannot return a value the consumer can reach with `for await`,
   * so the counts a stream accumulates would otherwise be visible only to
   * recordUsage() and lost to the caller — which is exactly what the cost layer
   * needs. Optional, and invoked in a `finally`, so a failed stream still
   * reports whatever it managed to consume.
   */
  onUsage?: (usage: { input: number; output: number; total: number }) => void;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Which keys to try. BYOK is a pool of exactly one — a user's own quota is
 * theirs to exhaust, and rotating them onto our keys would be billing theft in
 * reverse. keyIndex 0 marks "not ours" so it never pollutes gemini_usage.
 */
function attemptsFor(byokKey?: string): PoolKey[] {
  return byokKey ? [{ index: 0, value: byokKey }] : orderedAttempts();
}

async function callOnce(
  key: PoolKey,
  model: string,
  args: GenerateArgs,
  stream: boolean,
): Promise<Response> {
  // The adapter owns URL, auth header and body shape. Rotation, backoff and
  // accounting stay here because none of that is provider-specific.
  const provider = args.provider ?? "gemini";
  const req = adapterFor(provider).buildRequest({
    apiKey: key.value,
    model,
    prompt: args.prompt,
    schema: args.schema,
    baseUrl: args.baseUrl,
    stream: stream && supportsStreaming(provider),
    images: args.images,
  });
  return fetch(req.url, {
    method: "POST",
    headers: req.headers,
    body: req.body,
    signal: args.signal,
  });
}

/**
 * Resolve provider settings once per call.
 *
 * An admin-set key replaces the pool entirely: rotating a user-configured
 * OpenAI key across our Gemini key list would send an OpenAI secret to Google.
 */
async function resolveProvider(args: GenerateArgs): Promise<GenerateArgs> {
  if (args.provider) return args;
  const cfg = await getProviderConfig();
  const provider = cfg.provider;
  const byokKey = args.byokKey ?? (cfg.apiKey ? cfg.apiKey : undefined);
  // A non-Gemini provider MUST bring its own key. Without this guard the call
  // falls through to `attemptsFor(undefined)` → the Gemini key pool, and the
  // OpenAI/Anthropic adapter then sends a Google `AQ.` key to a foreign
  // endpoint. That is exactly the "Incorrect API key" an admin sees after
  // switching the provider in /admin/config without pasting a key for it — and
  // it leaks a real Gemini key to OpenAI in the process. Fail early and clearly.
  if (provider !== "gemini" && !byokKey) {
    throw new GeminiError(
      `Provider "${provider}" dipilih tapi belum ada API key-nya. Isi API key ${provider} di admin (Otak AI), atau balikin provider ke Gemini.`,
      400,
      false,
    );
  }
  return {
    ...args,
    provider,
    baseUrl: cfg.baseUrl || undefined,
    byokKey,
  };
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

/**
 * Try every key, backing off between rounds.
 *
 * Order matters: rotate across keys *first*, then wait. A second key from a
 * different Google Cloud project has its own quota, so trying it costs nothing
 * and may succeed immediately — sleeping first would waste that.
 */
async function withRotation(
  model: string,
  args: GenerateArgs,
  stream: boolean,
): Promise<{ res: Response; key: PoolKey }> {
  const keys = attemptsFor(args.byokKey);
  let last: GeminiError | null = null;

  for (let round = 0; round <= BACKOFF_MS.length; round++) {
    for (const key of keys) {
      const res = await callOnce(key, model, args, stream);

      if (res.ok) return { res, key };

      const text = await res.text().catch(() => "");

      if (res.status === 429) {
        // Only our own keys get cooled; a BYOK user's 429 is their own ceiling.
        if (key.index > 0) markRateLimited(key.index);
        // The message is the point. A count of 429s tells an operator nothing;
        // "quota exceeded for model X" tells them to rotate a key or slow down.
        await recordUsage({
          keyIndex: key.index, model, isError: true, status: 429,
          errorMessage: `rate limited: ${text.slice(0, 500)}`,
        });
        last = new GeminiError(`Gemini rate limited: ${text.slice(0, 200)}`, 429, true);
        continue;
      }

      if (res.status >= 500) {
        await recordUsage({
          keyIndex: key.index, model, isError: true, status: res.status,
          errorMessage: `upstream ${res.status}: ${text.slice(0, 500)}`,
        });
        last = new GeminiError(`Gemini unavailable: ${text.slice(0, 200)}`, res.status, true);
        continue;
      }

      // 400/403/404 are our bug or a bad key — retrying cannot fix them, and a
      // wrong model id returns 404 even when ListModels still advertises it.
      await recordUsage({
        keyIndex: key.index, model, isError: true, status: res.status,
        errorMessage: `rejected ${res.status}: ${text.slice(0, 500)}`,
      });
      throw new GeminiError(`Gemini rejected the request: ${text.slice(0, 300)}`, res.status, false);
    }

    if (round < BACKOFF_MS.length) await sleep(BACKOFF_MS[round]);
  }

  throw last ?? new GeminiError("Gemini exhausted every key and retry", 503, true);
}

/**
 * What a call actually consumed.
 *
 * Zeros mean the provider returned no usage block — "unknown", never "free".
 * The cost layer treats it that way too.
 */
export type GenerateResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

/**
 * One-shot generation, returning the token counts alongside the text.
 *
 * These numbers were previously recorded into gemini_usage and then discarded,
 * which was fine when there was one vendor on a free tier and nothing priced
 * per token. With a provider fleet the caller has to be able to price the call
 * it just made, and a cost dashboard fed by zeros is worse than no dashboard —
 * it reads as pure profit.
 */
export async function generateDetailed(args: GenerateArgs): Promise<GenerateResult> {
  // `args.model` lets app_config drive the choice at runtime; without it we
  // fall back to modelFor(), which reads env. Kept as an override rather than
  // a replacement so this module stays usable with no database.
  const a = await resolveProvider(args);
  const model = a.model ?? modelFor(a.tier ?? "free");
  const { res, key } = await withRotation(model, a, false);
  const json = await res.json();

  const adapter = adapterFor(a.provider ?? "gemini");
  const text = adapter.extractText(json);
  const split = adapter.extractTokenSplit(json);
  const total = adapter.extractTokens(json);
  await recordUsage({
    keyIndex: key.index,
    model,
    tokens: total,
    inputTokens: split.input,
    outputTokens: split.output,
  });

  if (!text) {
    throw new GeminiError(
      `${a.provider ?? "gemini"} returned no text. finishReason=${
        (json as { candidates?: { finishReason?: string }[] })?.candidates?.[0]?.finishReason ??
        (json as { stop_reason?: string })?.stop_reason ??
        "unknown"
      }`,
      502,
      false,
    );
  }
  return { text, inputTokens: split.input, outputTokens: split.output, totalTokens: total };
}

/** One-shot generation. Returns the raw model text. */
export async function generate(args: GenerateArgs): Promise<string> {
  return (await generateDetailed(args)).text;
}

/**
 * Streaming generation, yielding text as it arrives.
 *
 * DESIGN.md section 5: a four-second generation that streams feels instant; the
 * same generation behind a spinner feels broken. Measured first byte on the
 * free-tier model is about 0.8s.
 */
export async function* generateStream(
  args: GenerateArgs,
): AsyncGenerator<string, void, unknown> {
  // `args.model` lets app_config drive the choice at runtime; without it we
  // fall back to modelFor(), which reads env. Kept as an override rather than
  // a replacement so this module stays usable with no database.
  const a = await resolveProvider(args);

  // Only Gemini streams here. OpenAI and Anthropic use different SSE envelopes,
  // and a half-parsed stream is worse than one call that returns the whole
  // answer — so those degrade to a single yield rather than breaking.
  if (!supportsStreaming(a.provider ?? "gemini")) {
    yield await generate(a);
    return;
  }

  const model = a.model ?? modelFor(a.tier ?? "free");
  const { res, key } = await withRotation(model, a, true);

  // The adapter owns the frame envelope; everything below owns the plumbing.
  // Without this the loop decoded Gemini's shape unconditionally, so an
  // OpenAI-compatible provider streamed perfectly and yielded nothing.
  const adapter = adapterFor(a.provider ?? "gemini");

  const reader = res.body?.getReader();
  if (!reader) throw new GeminiError("Gemini returned no stream body", 502, false);

  const decoder = new TextDecoder();
  let buffer = "";
  let tokens = 0;
  // Gemini repeats usageMetadata on later frames with running totals, so the
  // last value seen is the final one — same reason `tokens` is assigned, not
  // accumulated.
  let inTokens = 0;
  let outTokens = 0;

  /**
   * Yields every complete SSE frame in `buffer`, leaving any partial tail
   * behind. `flush` drains that tail once the stream has ended.
   *
   * Draining at the end is not an edge case — it is the common one. A short
   * reply often arrives as a single chunk with no trailing blank line, so
   * without the flush the only frame stays in the buffer and the caller sees an
   * empty stream. That was a real bug here: the first version returned zero
   * chunks for a response curl could see perfectly well.
   */
  const drain = function* (flush: boolean) {
    // Normalise CRLF so frame splitting does not depend on the transport.
    const normalised = buffer.replace(/\r\n/g, "\n");
    const frames = normalised.split("\n\n");
    buffer = flush ? "" : (frames.pop() ?? "");

    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta = adapter.parseStreamFrame?.(json);
          if (!delta) continue;
          // Assigned, not accumulated: both vendors report running or final
          // totals rather than per-frame increments.
          tokens = delta.totalTokens ?? tokens;
          inTokens = delta.inputTokens ?? inTokens;
          outTokens = delta.outputTokens ?? outTokens;
          if (delta.text) yield delta.text;
        } catch {
          // A truncated frame mid-stream is normal; skip rather than abort.
        }
      }
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      yield* drain(false);
    }
    buffer += decoder.decode();
    yield* drain(true);
  } finally {
    await recordUsage({
      keyIndex: key.index,
      model,
      tokens,
      inputTokens: inTokens,
      outputTokens: outTokens,
    });
    a.onUsage?.({ input: inTokens, output: outTokens, total: tokens });
  }
}

/**
 * Parse strict JSON from a model response, with one repair attempt.
 *
 * PROMPTS.md section 1. With a responseSchema this is nearly always redundant —
 * verified working on gemini-3.6-flash — but the fallback stays for prompts
 * that cannot express a schema, and for models that ignore it.
 */
export function parseJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Strip markdown fences the prompt asked the model not to emit.
    const cleaned = raw
      .replace(/^\s*```(?:json)?/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new GeminiError("Gemini returned unparseable JSON", 502, false);
  }
}
