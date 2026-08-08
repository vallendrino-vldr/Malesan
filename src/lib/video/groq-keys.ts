import "server-only";

/**
 * The Groq (Whisper) key pool — same shape as the Gemini pool in
 * src/lib/gemini/keys.ts, and for the same reasons.
 *
 * Groq's free tier is rate-limited per account, so several keys from separate
 * accounts widen real throughput (unlike extra Gemini keys in one GCP project,
 * which share a quota). Rotation spreads load; a key that returns 429 is benched
 * for a cooldown and the next one is tried, so one account hitting its ceiling
 * never surfaces to the user as a failed transcription.
 *
 * server-only: a transcription key must never reach the browser.
 */

export type GroqKey = { index: number; value: string };

const MAX_SLOTS = 10;
const COOLDOWN_MS = 60_000;
const cooldownUntil = new Map<number, number>();

/**
 * Reads GROQ_API_KEY_1..10, and also the unnumbered GROQ_API_KEY as slot 1 for
 * back-compat with the single-key setup this replaced. Gaps are allowed; the
 * index is stable so it could key usage stats later without renumbering.
 */
export function getGroqPool(): GroqKey[] {
  const pool: GroqKey[] = [];
  const single = process.env.GROQ_API_KEY;
  if (single) pool.push({ index: 1, value: single });
  for (let slot = 1; slot <= MAX_SLOTS; slot++) {
    const v = process.env[`GROQ_API_KEY_${slot}`];
    if (v && !pool.some((k) => k.value === v)) pool.push({ index: slot, value: v });
  }
  return pool;
}

export function hasGroq(): boolean {
  return getGroqPool().length > 0;
}

export function markGroqRateLimited(index: number, retryAfterMs?: number) {
  cooldownUntil.set(index, Date.now() + (retryAfterMs ?? COOLDOWN_MS));
}

function isCooling(index: number): boolean {
  const until = cooldownUntil.get(index);
  return until !== undefined && until > Date.now();
}

/**
 * Keys to try, in order, for one transcription. Start offset rotates per call so
 * load spreads instead of always hitting account 1 first; cooling keys go to the
 * back rather than being dropped, so a fully-cooling pool still gets attempted.
 */
export function groqAttempts(): GroqKey[] {
  const pool = getGroqPool();
  if (pool.length === 0) return pool;
  const offset = Math.floor(Date.now() / 1000) % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  const hot = rotated.filter((k) => !isCooling(k.index));
  const cold = rotated.filter((k) => isCooling(k.index));
  return [...hot, ...cold];
}
