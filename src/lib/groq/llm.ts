import "server-only";
import { groqAttempts, hasGroq, markGroqRateLimited } from "../video/groq-keys";

/**
 * Text generation on Groq (Llama), for the features that must feel instant —
 * netizen-reaction simulation and script roasting. Groq answers in well under a
 * second, which is why these live here and not on Gemini.
 *
 * This reuses the exact same key pool, rotation and cooldown as the Whisper path
 * (video/groq-keys): one 429 benches that account and the next key is tried, so a
 * single account hitting its ceiling never surfaces to the user as a failure.
 * That is the round-robin + circuit-breaker behaviour the transcription route
 * already relies on, shared rather than reimplemented.
 *
 * server-only: a Groq key must never reach the browser.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Model id in env, never hardcoded — hosted names move. 70b-versatile is the
// smart Llama tier (roasting needs wit); override with GROQ_LLM_MODEL.
const GROQ_MODEL = process.env.GROQ_LLM_MODEL || "llama-3.3-70b-versatile";

export class GroqError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "GroqError";
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type GroqChatOpts = {
  messages: ChatMessage[];
  /** Ask for a strict JSON object back (OpenAI-compatible json_object mode). */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

/**
 * One chat completion, rotating across the Groq key pool.
 *
 * 429 → bench that account and try the next key. 5xx → next key. A 4xx that is
 * not 429 is our bug or a bad request and is not retried. Every key exhausted
 * surfaces the last error.
 */
export async function groqChat(opts: GroqChatOpts): Promise<string> {
  if (!hasGroq()) {
    throw new GroqError("Fitur ini belum aktif — belum ada GROQ_API_KEY di server.", 503, false);
  }

  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.9,
    max_tokens: opts.maxTokens ?? 1024,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  });

  const keys = groqAttempts();
  let last: GroqError | null = null;

  for (const key of keys) {
    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key.value}`,
          "Content-Type": "application/json",
        },
        body,
        signal: opts.signal,
      });
    } catch (e) {
      last = new GroqError(
        `Gagal nyambung ke Groq: ${e instanceof Error ? e.message : "network"}`,
        502,
        true,
      );
      continue;
    }

    if (res.ok) {
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) throw new GroqError("Groq balikin kosong.", 502, false);
      return text;
    }

    const errText = await res.text().catch(() => "");
    if (res.status === 429) {
      markGroqRateLimited(key.index);
      last = new GroqError(`Groq kena limit (429): ${errText.slice(0, 120)}`, 429, true);
      continue;
    }
    if (res.status >= 500) {
      last = new GroqError(`Groq bermasalah (${res.status})`, res.status, true);
      continue;
    }
    throw new GroqError(`Groq nolak (${res.status}): ${errText.slice(0, 160)}`, res.status, false);
  }

  throw last ?? new GroqError("Semua key Groq gagal.", 503, true);
}

/** Parse strict JSON from a model reply, tolerating stray markdown fences. */
export function parseGroqJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const cleaned = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new GroqError("Groq balikin JSON yang gak kebaca.", 502, false);
  }
}
