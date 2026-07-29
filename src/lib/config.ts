import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Runtime configuration.
 *
 * Model choice lived in env vars and credit costs were literals inside
 * /api/generate, so changing either meant a redeploy — and a module that
 * started failing could not be pulled out of service at all.
 *
 * Values come from `app_config` with env/literal fallbacks, so a missing or
 * unreachable row degrades to the previous behaviour rather than taking the
 * product down. Cached briefly because these are read on every generation and
 * change a few times a month at most.
 */

export type ModuleKey =
  | "ide_hari_ini"
  | "idea"
  | "hook"
  | "script"
  | "repurpose"
  | "vibe";

const FALLBACK_COST: Record<ModuleKey, number> = {
  ide_hari_ini: 1,
  idea: 1,
  hook: 2,
  script: 4,
  repurpose: 1,
  vibe: 6,
};

const TTL_MS = 30_000;
let cache: { at: number; rows: Record<string, unknown> } | null = null;

async function load(): Promise<Record<string, unknown>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  try {
    const { data } = await createServiceRoleClient().from("app_config").select("key, value");
    const rows: Record<string, unknown> = {};
    for (const r of data ?? []) rows[(r as { key: string }).key] = (r as { value: unknown }).value;
    cache = { at: Date.now(), rows };
    return rows;
  } catch (e) {
    console.error("app_config read failed, using fallbacks", e);
    return cache?.rows ?? {};
  }
}

/** Call after a write so the next read does not serve the old value. */
export function invalidateConfigCache() {
  cache = null;
}

export async function getModel(tier: "free" | "pro"): Promise<string> {
  const rows = await load();
  const v = rows[tier === "pro" ? "model_pro" : "model_free"];
  if (typeof v === "string" && v.trim()) return v;
  return (
    (tier === "pro" ? process.env.GEMINI_MODEL_PRO : process.env.GEMINI_MODEL_FREE) ??
    "gemini-2.5-flash"
  );
}

export async function getCost(module: ModuleKey): Promise<number> {
  const rows = await load();
  const v = rows[`cost_${module}`];
  return typeof v === "number" && v > 0 ? Math.round(v) : FALLBACK_COST[module];
}

/** Unknown modules default to enabled — a missing row must not silently break one. */
export async function isModuleEnabled(module: ModuleKey): Promise<boolean> {
  const rows = await load();
  const map = rows["enabled_modules"];
  if (map && typeof map === "object" && module in (map as Record<string, unknown>)) {
    return (map as Record<string, boolean>)[module] !== false;
  }
  return true;
}

export async function getAllConfig() {
  cache = null;
  return load();
}
