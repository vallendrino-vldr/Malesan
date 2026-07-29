import "server-only";
import { markRateLimited, orderedAttempts, type PoolKey } from "./keys";
import { recordUsage } from "./quota";

/**
 * The only place in the codebase that talks to Gemini.
 *
 * Every call goes through here so that key rotation, 429 backoff and usage
 * accounting cannot be forgotten at a call site. AGENTS.md rule 1: this file is
 * server-only and the key never leaves it.
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

/** AGENTS.md section 3: exponential backoff on 429 — 1s, 2s, 4s, 8s. */
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000];

export type Tier = "free" | "pro";

export function modelFor(tier: Tier): string {
  const model =
    tier === "pro" ? process.env.GEMINI_MODEL_PRO : process.env.GEMINI_MODEL_FREE;
  if (!model) {
    throw new Error(
      `GEMINI_MODEL_${tier.toUpperCase()} is not set. Model IDs live in env, never hardcoded (AGENTS.md rule 5).`,
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
};

function body(args: GenerateArgs) {
  return JSON.stringify({
    contents: [{ parts: [{ text: args.prompt }] }],
    generationConfig: args.schema
      ? { responseMimeType: "application/json", responseSchema: args.schema }
      : undefined,
  });
}

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
  const method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
  return fetch(`${API_ROOT}/${model}:${method}`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key.value,
      "Content-Type": "application/json",
    },
    body: body(args),
    signal: args.signal,
  });
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
        await recordUsage({ keyIndex: key.index, model, isError: true });
        last = new GeminiError(`Gemini rate limited: ${text.slice(0, 200)}`, 429, true);
        continue;
      }

      if (res.status >= 500) {
        await recordUsage({ keyIndex: key.index, model, isError: true });
        last = new GeminiError(`Gemini unavailable: ${text.slice(0, 200)}`, res.status, true);
        continue;
      }

      // 400/403/404 are our bug or a bad key — retrying cannot fix them, and a
      // wrong model id returns 404 even when ListModels still advertises it.
      await recordUsage({ keyIndex: key.index, model, isError: true });
      throw new GeminiError(`Gemini rejected the request: ${text.slice(0, 300)}`, res.status, false);
    }

    if (round < BACKOFF_MS.length) await sleep(BACKOFF_MS[round]);
  }

  throw last ?? new GeminiError("Gemini exhausted every key and retry", 503, true);
}

/** One-shot generation. Returns the raw model text. */
export async function generate(args: GenerateArgs): Promise<string> {
  // `args.model` lets app_config drive the choice at runtime; without it we
  // fall back to modelFor(), which reads env. Kept as an override rather than
  // a replacement so this module stays usable with no database.
  const model = args.model ?? modelFor(args.tier ?? "free");
  const { res, key } = await withRotation(model, args, false);
  const json = await res.json();

  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  const tokens: number = json?.usageMetadata?.totalTokenCount ?? 0;
  await recordUsage({ keyIndex: key.index, model, tokens });

  if (typeof text !== "string") {
    throw new GeminiError(
      `Gemini returned no text. finishReason=${json?.candidates?.[0]?.finishReason ?? "unknown"}`,
      502,
      false,
    );
  }
  return text;
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
  const model = args.model ?? modelFor(args.tier ?? "free");
  const { res, key } = await withRotation(model, args, true);

  const reader = res.body?.getReader();
  if (!reader) throw new GeminiError("Gemini returned no stream body", 502, false);

  const decoder = new TextDecoder();
  let buffer = "";
  let tokens = 0;

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
          tokens = json?.usageMetadata?.totalTokenCount ?? tokens;
          const text: string | undefined =
            json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
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
    await recordUsage({ keyIndex: key.index, model, tokens });
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
