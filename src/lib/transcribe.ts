import "server-only";
import { groqAttempts, hasGroq, markGroqRateLimited } from "./video/groq-keys";

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
// Whisper Large V3 is the full 32-layer state-of-the-art model for Indonesian transcription.
const GROQ_MODEL = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3";

const INDONESIAN_CREATOR_PROMPT =
  "Halo teman-teman, hari ini gue mau sharing tips bikin konten video, script, hook, ide menarik, dan workflow santai buat kalian semua.";

const WATERMARK_WORDS = new Set(["broth3rmax", "opensubtitles", "amaraorg"]);

function isHallucinatedWord(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  return WATERMARK_WORDS.has(clean);
}

async function postWithRotation(
  audio: Blob,
  filename: string,
  opts?: { language?: string; prompt?: string; signal?: AbortSignal },
): Promise<Response> {
  const keys = groqAttempts();
  let last: TranscribeError | null = null;

  for (const key of keys) {
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("model", GROQ_MODEL);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("temperature", "0");
    form.append("prompt", opts?.prompt || INDONESIAN_CREATOR_PROMPT);
    if (opts?.language) form.append("language", opts.language);

    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key.value}` },
        body: form,
        signal: opts?.signal,
      });
    } catch (e) {
      last = new TranscribeError(
        `Gagal nyambung ke layanan transkripsi: ${e instanceof Error ? e.message : "network"}`,
        502,
        true,
      );
      continue;
    }

    if (res.ok) return res;

    const body = await res.text().catch(() => "");
    if (res.status === 429) {
      markGroqRateLimited(key.index);
      last = new TranscribeError(`Transkripsi kena limit (429): ${body.slice(0, 120)}`, 429, true);
      continue;
    }
    if (res.status >= 500) {
      last = new TranscribeError(`Server transkripsi bermasalah (${res.status})`, res.status, true);
      continue;
    }
    // 400/401/413 etc. — retrying a different key cannot fix these.
    throw new TranscribeError(`Transkripsi ditolak (${res.status}): ${body.slice(0, 160)}`, res.status, false);
  }

  throw last ?? new TranscribeError("Semua key transkripsi gagal.", 503, true);
}

export async function transcribeAudio(
  audio: Blob,
  filename: string,
  opts?: { language?: string; prompt?: string; signal?: AbortSignal },
): Promise<Transcript> {
  if (!hasGroq()) {
    throw new TranscribeError(
      "Transkripsi belum aktif — belum ada GROQ_API_KEY di server.",
      503,
      false,
    );
  }

  const res = await postWithRotation(audio, filename, opts);

  const json = (await res.json()) as {
    text?: string;
    duration?: number;
    words?: { word?: string; start?: number; end?: number }[];
    segments?: { start?: number; end?: number; text?: string; words?: { word?: string; start?: number; end?: number }[] }[];
  };

  const rawText = (json.text ?? "").trim();

  const rawWords =
    json.words && json.words.length > 0
      ? json.words
      : (json.segments?.flatMap((s) => s.words ?? []) ?? []);

  let words: Word[] = rawWords
    .filter((w) => typeof w.word === "string" && typeof w.start === "number")
    .map((w) => ({
      word: (w.word as string).trim(),
      start: Math.max(0, Number(w.start) || 0),
      end: Math.max(
        Math.max(0, Number(w.start) || 0) + 0.05,
        typeof w.end === "number" ? w.end : (Number(w.start) || 0) + 0.25,
      ),
    }))
    .filter((w) => w.word.length > 0 && !isHallucinatedWord(w.word));

  // Fallback 1: Interpolate from segments if segment words were absent
  if (!words.length && json.segments?.length) {
    for (const seg of json.segments) {
      const segText = (seg.text ?? "").trim();
      if (!segText || typeof seg.start !== "number" || typeof seg.end !== "number") continue;
      const tokens = segText.split(/\s+/).filter(Boolean);
      if (!tokens.length) continue;
      const segDuration = Math.max(0.1, seg.end - seg.start);
      const tokenDur = segDuration / tokens.length;
      tokens.forEach((tok, idx) => {
        const wStart = seg.start! + idx * tokenDur;
        const wEnd = wStart + tokenDur;
        if (!isHallucinatedWord(tok)) {
          words.push({ word: tok, start: wStart, end: wEnd });
        }
      });
    }
  }

  // Fallback 2: Direct raw text tokenization if words & segments were not returned
  if (!words.length && rawText) {
    const tokens = rawText.split(/\s+/).filter(Boolean);
    const audioDur = json.duration ?? 5;
    const durPerTok = Math.max(0.15, audioDur / Math.max(tokens.length, 1));
    tokens.forEach((tok, idx) => {
      const s = idx * durPerTok;
      const e = s + durPerTok;
      if (!isHallucinatedWord(tok)) {
        words.push({ word: tok, start: s, end: e });
      }
    });
  }

  // Ensure words are strictly ordered by start time
  words.sort((a, b) => a.start - b.start);

  // Prefer the model's reported duration; fall back to the last word or segment
  // so the credit charge always has a real number to work from.
  const lastWordEnd = words.length ? words[words.length - 1].end : 0;
  const lastSegEnd = json.segments?.length
    ? (json.segments[json.segments.length - 1].end ?? 0)
    : 0;
  const duration = json.duration ?? Math.max(lastWordEnd, lastSegEnd);

  return { text: rawText, duration, words };
}
