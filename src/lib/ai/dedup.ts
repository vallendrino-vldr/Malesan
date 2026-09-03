import "server-only";

type InFlightEntry<T> = {
  promise: Promise<T>;
  timestamp: number;
};

const inFlightMap = new Map<string, InFlightEntry<unknown>>();
const DEDUP_TTL_MS = 4000;

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of inFlightMap.entries()) {
    if (now - entry.timestamp > DEDUP_TTL_MS * 2) {
      inFlightMap.delete(key);
    }
  }
}

/**
 * In-Flight Request Deduplication Engine
 * Collapses concurrent identical AI requests from the same user into a single promise,
 * preventing race-condition double-charges and redundant LLM token burning.
 */
export async function deduplicateInFlight<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = DEDUP_TTL_MS,
): Promise<{ result: T; deduplicated: boolean }> {
  cleanup();
  const existing = inFlightMap.get(key);
  if (existing && Date.now() - existing.timestamp < ttlMs) {
    const result = (await existing.promise) as T;
    return { result, deduplicated: true };
  }

  const promise = fn().finally(() => {
    setTimeout(() => inFlightMap.delete(key), ttlMs);
  });

  inFlightMap.set(key, { promise, timestamp: Date.now() });
  const result = await promise;
  return { result, deduplicated: false };
}

const activeLocks = new Map<string, number>();
const LOCK_TIMEOUT_MS = 25000;

/**
 * Server-Side In-Flight Lock to prevent race-condition double-charges
 * on rapid double-tap / double-clicks before credit deduction.
 */
export function acquireRequestLock(key: string): { acquired: boolean; release: () => void } {
  const now = Date.now();
  const existing = activeLocks.get(key);
  if (existing && now - existing < LOCK_TIMEOUT_MS) {
    return { acquired: false, release: () => {} };
  }

  activeLocks.set(key, now);
  let released = false;

  const release = () => {
    if (!released) {
      released = true;
      activeLocks.delete(key);
    }
  };

  return { acquired: true, release };
}
