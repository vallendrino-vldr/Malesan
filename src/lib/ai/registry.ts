import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/gemini/crypto";
import type {
  Capability,
  ModelRow,
  ProviderRow,
  Protocol,
  RouteMode,
  RoutePrefer,
  RouteRow,
} from "./types";

/**
 * The provider/model/route registry.
 *
 * Reads the three configuration tables and hands the engine typed, decrypted
 * rows. Cached with the same short TTL and the same shape as src/lib/config.ts,
 * for the same reason: these are read on every generation and change a few times
 * a month. Deliberately a separate cache from `config.ts` so invalidating one
 * does not throw away the other.
 *
 * `server-only`: this module decrypts provider API keys. Importing it from a
 * client component must be a build error, not a code-review question — exactly
 * the guarantee src/lib/gemini/keys.ts already relies on.
 */

const TTL_MS = 30_000;

type Snapshot = {
  at: number;
  providers: ProviderRow[];
  models: ModelRow[];
  routes: RouteRow[];
};

let cache: Snapshot | null = null;

/** Call after any admin write so the next request does not serve a stale fleet. */
export function invalidateAiCache() {
  cache = null;
}

function asProvider(r: Record<string, unknown>): ProviderRow {
  return {
    ...(r as unknown as ProviderRow),
    // The DB stores these as plain text with a CHECK constraint; narrow here so
    // the rest of the codebase gets a union instead of a string.
    protocol: r.protocol as Protocol,
    key_source: r.key_source as ProviderRow["key_source"],
  };
}

function asModel(r: Record<string, unknown>): ModelRow {
  return {
    ...(r as unknown as ModelRow),
    capabilities: ((r.capabilities as string[] | null) ?? []) as Capability[],
  };
}

function asRoute(r: Record<string, unknown>): RouteRow {
  return {
    ...(r as unknown as RouteRow),
    mode: r.mode as RouteMode,
    prefer: r.prefer as RoutePrefer,
    required_capabilities: ((r.required_capabilities as string[] | null) ?? []) as Capability[],
    fallback_model_ids: (r.fallback_model_ids as string[] | null) ?? [],
  };
}

/**
 * Load the whole fleet in one pass.
 *
 * Three queries rather than a join: the tables are tiny (tens of rows), the
 * engine needs all three on almost every call anyway, and a flat cache is far
 * easier to reason about than a nested one when a route points at a model whose
 * provider was just deactivated.
 *
 * On failure it returns the previous snapshot if there is one, and empty lists
 * otherwise. Empty means "no routes configured", which the engine treats as
 * "use the legacy path" — so a database blip degrades to the pre-existing
 * behaviour instead of taking generation down.
 */
async function load(): Promise<Snapshot> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;

  try {
    const db = createServiceRoleClient();
    const [providers, models, routes] = await Promise.all([
      db.from("ai_providers").select("*").order("priority", { ascending: true }),
      db.from("ai_models").select("*"),
      db.from("ai_routes").select("*"),
    ]);

    const snap: Snapshot = {
      at: Date.now(),
      providers: (providers.data ?? []).map((r) => asProvider(r as Record<string, unknown>)),
      models: (models.data ?? []).map((r) => asModel(r as Record<string, unknown>)),
      routes: (routes.data ?? []).map((r) => asRoute(r as Record<string, unknown>)),
    };
    cache = snap;
    return snap;
  } catch (e) {
    console.error("ai registry read failed, falling back", e);
    return cache ?? { at: 0, providers: [], models: [], routes: [] };
  }
}

export async function getFleet(): Promise<Snapshot> {
  return load();
}

export async function getActiveProviders(): Promise<ProviderRow[]> {
  return (await load()).providers.filter((p) => p.is_active);
}

export async function getRoute(feature: string): Promise<RouteRow | null> {
  const { routes } = await load();
  return routes.find((r) => r.feature === feature && r.is_active) ?? null;
}

export async function getModelById(id: string): Promise<ModelRow | null> {
  return (await load()).models.find((m) => m.id === id) ?? null;
}

export async function getProviderById(id: string): Promise<ProviderRow | null> {
  return (await load()).providers.find((p) => p.id === id) ?? null;
}

/**
 * The API key to call this provider with.
 *
 * Returns `undefined` for the legacy env pool, and that is the whole trick: the
 * Gemini client already treats "no explicit key" as "rotate across
 * GEMINI_API_KEY_1..10". So the pool keeps its rotation, its 429 cooldown and
 * its quota-guard accounting while still being just another row in the fleet.
 *
 * Throws rather than returning a bad value when a `db` provider has no usable
 * key: calling a paid endpoint with an empty Authorization header burns a
 * request to get back a 401 that reads like an outage.
 */
export function resolveProviderKey(provider: ProviderRow): string | undefined {
  if (provider.key_source === "env_gemini_pool") return undefined;

  if (!provider.api_key_encrypted) {
    throw new Error(
      `Provider "${provider.label}" belum ada API key-nya. Isi dulu di /admin/ai.`,
    );
  }

  try {
    return decryptSecret(provider.api_key_encrypted);
  } catch {
    // A key encrypted under a rotated ENCRYPTION_KEY is undecryptable by design
    // (see crypto.ts). Say so plainly — the fix is to paste the key again.
    throw new Error(
      `API key provider "${provider.label}" gak bisa dibuka. Masukin ulang key-nya di /admin/ai.`,
    );
  }
}

/**
 * Circuit-breaker bookkeeping, written straight through rather than cached.
 *
 * Best-effort on purpose: health accounting must never fail a generation the
 * user has already paid for — the same rule recordUsage() follows.
 */
export async function markProviderResult(
  providerId: string,
  ok: boolean,
  detail: { latencyMs?: number; error?: string } = {},
): Promise<void> {
  try {
    const db = createServiceRoleClient();
    const now = new Date().toISOString();

    if (ok) {
      await db
        .from("ai_providers")
        .update({
          last_checked_at: now,
          last_ok_at: now,
          last_error: null,
          last_latency_ms: detail.latencyMs ?? null,
          consecutive_failures: 0,
          updated_at: now,
        })
        .eq("id", providerId);
    } else {
      // Read-then-write rather than an atomic increment: this counter drives a
      // "skip this provider for now" hint, not money, so a lost increment under
      // concurrency costs nothing and is not worth an RPC.
      const { data } = await db
        .from("ai_providers")
        .select("consecutive_failures")
        .eq("id", providerId)
        .maybeSingle();

      await db
        .from("ai_providers")
        .update({
          last_checked_at: now,
          last_error: (detail.error ?? "unknown error").slice(0, 500),
          last_latency_ms: detail.latencyMs ?? null,
          consecutive_failures: ((data?.consecutive_failures as number | undefined) ?? 0) + 1,
          updated_at: now,
        })
        .eq("id", providerId);
    }
    invalidateAiCache();
  } catch (e) {
    console.error("provider health write failed", providerId, e);
  }
}
