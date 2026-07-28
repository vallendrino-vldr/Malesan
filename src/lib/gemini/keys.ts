import "server-only";

/**
 * The Gemini key pool.
 *
 * AGENTS.md rule 1: no AI provider key ever reaches the browser. `server-only`
 * makes that a build error rather than a code review question — importing this
 * from a client component fails the build.
 *
 * Free-tier quota is enforced per Google Cloud **project**, not per key. Two
 * keys only widen the pool if they come from two separate projects; two keys in
 * one project share one quota and this rotation buys nothing. See DECISIONS.md.
 */

export type PoolKey = {
  /** 1-based. Matches gemini_usage.key_index. */
  index: number;
  value: string;
};

/** A key that returned 429 is rested rather than retried into the same wall. */
const COOLDOWN_MS = 60_000;
const cooldownUntil = new Map<number, number>();

export function getPool(): PoolKey[] {
  const pool: PoolKey[] = [];
  if (process.env.GEMINI_API_KEY_1) {
    pool.push({ index: 1, value: process.env.GEMINI_API_KEY_1 });
  }
  if (process.env.GEMINI_API_KEY_2) {
    pool.push({ index: 2, value: process.env.GEMINI_API_KEY_2 });
  }
  if (pool.length === 0) {
    throw new Error(
      "No Gemini keys configured. Set GEMINI_API_KEY_1 (and ideally GEMINI_API_KEY_2, from a different Google Cloud project) in .env.local.",
    );
  }
  return pool;
}

/** Marks a key as rate-limited so the next call reaches for a different one. */
export function markRateLimited(index: number, retryAfterMs?: number) {
  cooldownUntil.set(index, Date.now() + (retryAfterMs ?? COOLDOWN_MS));
}

export function isCooling(index: number): boolean {
  const until = cooldownUntil.get(index);
  return until !== undefined && until > Date.now();
}

/**
 * Keys to try, in order, for one logical request.
 *
 * Cooling keys are moved to the back rather than dropped: if every key is
 * cooling we still try them all instead of failing without an attempt. The
 * starting offset rotates per call so load spreads across the pool instead of
 * always hammering key 1 first.
 *
 * The cooldown map is per-process. On serverless each instance keeps its own,
 * which is imprecise but harmless — the worst case is one wasted 429 per cold
 * instance. The durable count that the quota guard reads lives in Postgres.
 */
export function orderedAttempts(): PoolKey[] {
  const pool = getPool();
  const offset = Math.floor(Date.now() / 1000) % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  const hot = rotated.filter((k) => !isCooling(k.index));
  const cold = rotated.filter((k) => isCooling(k.index));
  return [...hot, ...cold];
}
