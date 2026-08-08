import "server-only";

/**
 * Speech-to-text with word-level timestamps.
 *
 * Kept out of the Gemini client on purpose: this is a different provider with a
 * different failure surface, and word-level timing is the one thing Gemini does
 * not reliably give. Groq's hosted Whisper (whisper-large-v3-turbo) does, over
 * an OpenAI-compatible endpoint, on a free tier that is fast enough to feel
 * live — which is why the video editor targets it rather than Gemini.
 *
 * No provider key ever reaches the browser: this module is `server-only`, and
 * the audio is uploaded from the client to our route, which calls Groq. The
 * user's video never leaves their machine — only the extracted audio does, and
 * only as far as our server, which forwards it.
 */

export type Word = {
  /** The token as spoken. Trimmed; may include trailing punctuation. */
  word: string;
  /** Seconds from the start of the audio. */
  start: number;
  end: number;
};

export type Transcript = {
  text: string;
  /** Total audio duration in seconds, as reported by the model — the trusted
   *  figure the credit charge is based on, not the client's claim. */
  duration: number;
  words: Word[];
};

export class TranscribeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** True when trying again later might work (network, 5xx, rate limit). */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TranscribeError";
  }
}

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
// Turbo is the fast, cheap tier and still returns word timestamps. The model id
// is an env override for the same reason Gemini's is — hosted model names move.
const GROQ_MODEL = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo";

/**
 * Transcribe one audio file to words + timings.
 *
 * `verbose_json` + `timestamp_granularities[]=word` is what makes Groq return
 * the per-word array; without the granularity parameter it returns segments
 * only, and the per-word highlight has nothing to sync to.
 */
export async function transcribeAudio(
  audio: Blob,
  filename: string,
  opts?: { language?: string; signal?: AbortSignal },
): Promise<Transcript> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new TranscribeError(
      "Transkripsi belum aktif — GROQ_API_KEY belum diisi di server.",
      503,
      false,
    );
  }

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", GROQ_MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  // Indonesian by default, but let a caller override — Whisper autodetects when
  // the field is omitted, which is worse for Indonesian specifically.
  if (opts?.language) form.append("language", opts.language);

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: opts?.signal,
    });
  } catch (e) {
    throw new TranscribeError(
      `Gagal nyambung ke layanan transkripsi: ${e instanceof Error ? e.message : "network"}`,
      502,
      true,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 429 and 5xx are worth a retry; a 400/401 is our bug or a bad key and is not.
    throw new TranscribeError(
      `Transkripsi ditolak (${res.status}): ${body.slice(0, 200)}`,
      res.status,
      res.status === 429 || res.status >= 500,
    );
  }

  const json = (await res.json()) as {
    text?: string;
    duration?: number;
    words?: { word?: string; start?: number; end?: number }[];
    segments?: { start?: number; end?: number }[];
  };

  const words: Word[] = (json.words ?? [])
    .filter((w) => typeof w.word === "string" && typeof w.start === "number")
    .map((w) => ({
      word: (w.word as string).trim(),
      start: w.start as number,
      end: typeof w.end === "number" ? w.end : (w.start as number),
    }))
    .filter((w) => w.word.length > 0);

  // Prefer the model's reported duration; fall back to the last word or segment
  // so the credit charge always has a real number to work from.
  const lastWordEnd = words.length ? words[words.length - 1].end : 0;
  const lastSegEnd = json.segments?.length
    ? (json.segments[json.segments.length - 1].end ?? 0)
    : 0;
  const duration = json.duration ?? Math.max(lastWordEnd, lastSegEnd);

  return { text: (json.text ?? "").trim(), duration, words };
}
