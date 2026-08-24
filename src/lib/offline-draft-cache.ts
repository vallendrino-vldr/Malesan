/**
 * Offline Draft & Script Local Cache
 *
 * Provides resilient, zero-loss local storage backup for in-progress scripts
 * and drafts. When a creator edits a scene or draft while on a spotty network,
 * the edit is immediately preserved locally with timestamp and synced to
 * the server when connection is stable.
 */

const STORAGE_PREFIX = "malesan:draft_cache:";

export interface CachedScriptEntry {
  cardId: string;
  script: unknown;
  updatedAt: number;
  synced: boolean;
}

/** Save a script/card edit locally immediately */
export function saveOfflineScriptCache(cardId: string, scriptData: unknown): void {
  if (typeof window === "undefined" || !cardId) return;
  try {
    const entry: CachedScriptEntry = {
      cardId,
      script: scriptData,
      updatedAt: Date.now(),
      synced: false,
    };
    window.localStorage.setItem(`${STORAGE_PREFIX}${cardId}`, JSON.stringify(entry));
  } catch (e) {
    console.warn("Failed to write to local offline draft cache:", e);
  }
}

/** Get cached script if available */
export function getOfflineScriptCache(cardId: string): CachedScriptEntry | null {
  if (typeof window === "undefined" || !cardId) return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${cardId}`);
    if (!raw) return null;
    return JSON.parse(raw) as CachedScriptEntry;
  } catch {
    return null;
  }
}

/** Mark cached script as synced to server */
export function markOfflineScriptSynced(cardId: string): void {
  if (typeof window === "undefined" || !cardId) return;
  try {
    const existing = getOfflineScriptCache(cardId);
    if (existing) {
      existing.synced = true;
      window.localStorage.setItem(`${STORAGE_PREFIX}${cardId}`, JSON.stringify(existing));
    }
  } catch {
    // Ignore storage errors
  }
}

/** Clear cached script once confirmed permanently stored */
export function clearOfflineScriptCache(cardId: string): void {
  if (typeof window === "undefined" || !cardId) return;
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${cardId}`);
  } catch {
    // Ignore
  }
}
