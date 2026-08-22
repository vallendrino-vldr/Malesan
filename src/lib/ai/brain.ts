import "server-only";
import { getAiBrain } from "@/lib/config";
import { getFleet } from "./registry";
import { AI_FEATURES, FEATURE_MAP, type Candidate, type Capability, type ModelRow, type ProviderRow } from "./types";

/**
 * The Global AI Brain.
 *
 * One choice — a primary model plus an ordered backup chain — that every feature
 * inherits unless it has been explicitly overridden. Switching the product from
 * Gemini to DeepSeek is one write here, not one edit per feature.
 *
 * The inheritance is expressed by ABSENCE, not by a flag: a feature with no row
 * in `ai_routes` follows the Brain, and a row means "this one is different".
 * That keeps the routing screen honest — it lists exceptions, not settings — and
 * it means the existing "back to default" button already does the right thing.
 */

export type BrainResolution = {
  candidates: Candidate[];
  /** Why these, in words an owner can read. */
  reason: string;
  configured: boolean;
};

function pairFor(
  model: ModelRow | undefined,
  providers: ProviderRow[],
): Candidate | null {
  if (!model || !model.is_active) return null;
  const provider = providers.find((p) => p.id === model.provider_id);
  return provider?.is_active ? { provider, model } : null;
}

/**
 * A provider that failed repeatedly is temporarily moved behind a healthy one.
 *
 * Temporary matters: dropping it forever would require the owner to notice and
 * press "Tes koneksi" before it could ever recover. After five minutes traffic
 * probes the configured primary again; one success clears the counter, while a
 * new failure starts another cooldown. One random timeout never changes order —
 * the circuit only opens after three consecutive failures.
 */
const PROVIDER_COOLDOWN_MS = 5 * 60_000;

export function providerIsCoolingDown(p: {
  consecutive_failures: number;
  last_checked_at: string | null;
}): boolean {
  if (p.consecutive_failures < 3) return false;
  const last = p.last_checked_at ? new Date(p.last_checked_at).getTime() : NaN;
  // A migrated/manual row can have a counter but no timestamp. Probe it now;
  // without a clock there is no defensible reason to keep it behind forever.
  return Number.isFinite(last) && Date.now() - last < PROVIDER_COOLDOWN_MS;
}

/**
 * The Brain's candidate chain for one feature.
 *
 * Capability requirements still apply. A feature that needs vision cannot run on
 * a text-only Brain, and silently handing it one would produce confident
 * nonsense on a payment receipt — so it drops to the legacy path instead, which
 * is a model we know can see.
 */
export async function resolveBrain(feature: string): Promise<BrainResolution> {
  const brain = await getAiBrain();
  if (!brain.primary) {
    return {
      candidates: [],
      reason: "Otak AI belum diatur — pakai jalur Gemini lama.",
      configured: false,
    };
  }

  const { providers, models } = await getFleet();
  const byId = (id: string) => models.find((m) => m.id === id);

  const required: Capability[] = FEATURE_MAP[feature]?.requires ?? [];
  const capable = (c: Candidate) => required.every((r) => c.model.capabilities.includes(r));

  const configuredChain = [brain.primary, ...brain.fallbacks]
    .map((id) => pairFor(byId(id), providers))
    .filter((c): c is Candidate => c !== null)
    .filter(capable);

  // Brain routes used to skip the circuit breaker that feature overrides use.
  // Three failures could therefore leave a dead primary at the front forever,
  // even with a healthy backup. Keep the owner's order within each group, but
  // let a healthy backup lead while the primary cools down.
  const chain = [
    ...configuredChain.filter((c) => !providerIsCoolingDown(c.provider)),
    ...configuredChain.filter((c) => providerIsCoolingDown(c.provider)),
  ];

  if (chain.length === 0) {
    return {
      candidates: [],
      reason: required.length
        ? `Otak AI-nya gak punya kemampuan ${required.join(", ")} — fitur ini balik ke Gemini lama.`
        : "Model otak AI-nya lagi gak aktif — balik ke Gemini lama.",
      configured: true,
    };
  }

  return {
    candidates: chain,
    reason:
      chain.length > 1
        ? `Otak AI: ${chain[0].model.label ?? chain[0].model.model_id}, cadangan ${chain.length - 1}.`
        : `Otak AI: ${chain[0].model.label ?? chain[0].model.model_id}, tanpa cadangan.`,
    configured: true,
  };
}

/** Traffic-light health, so a gateway's state is legible at a glance. */
export type Health = "healthy" | "warning" | "limit" | "error";

export function healthOf(p: {
  is_active: boolean;
  consecutive_failures: number;
  last_error: string | null;
  last_latency_ms?: number | null;
}): Health {
  if (!p.is_active) return "error";
  if (p.consecutive_failures >= 3) return "error";
  if (p.consecutive_failures > 0) {
    // 429 and quota language mean "come back later", which is a different
    // problem from "this is broken" and deserves a different colour.
    const e = (p.last_error ?? "").toLowerCase();
    return /429|quota|rate limit|limit|exceeded|503|high demand/.test(e)
      ? "limit"
      : "warning";
  }
  if ((p.last_latency_ms ?? 0) > 30_000) return "warning";
  return "healthy";
}

export type BrainView = {
  primary: {
    modelId: string;
    label: string;
    provider: string;
    active: boolean;
    providerId: string;
    health: Health;
  } | null;
  fallbacks: {
    modelId: string;
    label: string;
    provider: string;
    active: boolean;
    providerId: string;
    health: Health;
  }[];
  /** Features running on the Brain vs. explicitly overridden. */
  followingCount: number;
  overriddenCount: number;
  /** True when the Brain is set and its primary is actually usable right now. */
  healthy: boolean;
  /** Plain-language status for the owner. */
  status: string;
};

/**
 * Everything the Simple-Mode screen needs, in one call.
 *
 * Deliberately reports whether the configured Brain is USABLE, not merely set. A
 * primary pointing at a model whose gateway was deactivated is the failure this
 * screen exists to make visible — the product keeps working (it drops to the
 * legacy path) but the owner believes they are running something they are not.
 */
export async function brainOverview(overriddenFeatures: string[]): Promise<BrainView> {
  const brain = await getAiBrain();
  const { providers, models } = await getFleet();

  const describe = (id: string) => {
    const m = models.find((x) => x.id === id);
    if (!m) return null;
    const p = providers.find((x) => x.id === m.provider_id);
    return {
      modelId: m.id,
      label: m.label ?? m.model_id,
      provider: p?.label ?? "?",
      providerId: p?.id ?? "",
      active: Boolean(m.is_active && p?.is_active),
      health: p
        ? healthOf(p)
        : ("error" as Health),
    };
  };

  const primary = brain.primary ? describe(brain.primary) : null;
  const fallbacks = brain.fallbacks
    .map(describe)
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const overridden = new Set(overriddenFeatures);
  const overriddenCount = AI_FEATURES.filter((f) => overridden.has(f.key)).length;
  const followingCount = AI_FEATURES.length - overriddenCount;

  const healthy = Boolean(primary?.active && primary.health !== "error");
  const liveFallbacks = fallbacks.filter((f) => f.active).length;

  // "No backup" and "a backup that is switched off" look identical on a
  // dashboard and are completely different problems. The second one is worse,
  // because the owner believes they are covered — so it gets said out loud.
  const status = !primary
    ? "Belum diatur — semua fitur masih pakai Gemini bawaan."
    : !primary.active
      ? liveFallbacks > 0
        ? "AI utama lagi mati. Cadangan dipakai otomatis sementara."
        : "AI utama lagi mati dan belum ada cadangan yang siap."
      : primary.health === "error"
        ? liveFallbacks > 0
          ? "AI utama lagi bermasalah. Cadangan dipakai otomatis sementara."
          : "AI utama lagi bermasalah dan belum ada cadangan yang siap."
        : primary.health === "limit"
          ? liveFallbacks > 0
            ? "AI utama lagi kena limit. Cadangan dipakai otomatis sementara."
            : "AI utama lagi kena limit dan belum ada cadangan yang siap."
      : liveFallbacks > 0
        ? `Aktif, dengan ${liveFallbacks} cadangan siap.`
        : fallbacks.length > 0
          ? "Aktif, TAPI cadangannya mati semua. Kalau AI utama ngambek, generate bakal gagal."
          : "Aktif, tapi belum ada cadangan. Kalau AI utama ngambek, generate bakal gagal.";

  return { primary, fallbacks, followingCount, overriddenCount, healthy, status };
}

/**
 * How many features actually run on each model right now.
 *
 * This is the number that makes a model toggle safe to touch: "dipakai 12 fitur"
 * and "dipakai 0 fitur" are completely different decisions, and the old checkbox
 * gave no hint which one you were about to make.
 *
 * A model counts once for every feature that would reach it FIRST — the Brain's
 * primary counts for every non-overridden feature, an override's primary counts
 * for its own feature. Backups are not counted: a chain that never fires is not
 * "in use", and inflating the number would make every model look load-bearing.
 */
export async function modelUsageCounts(
  overrides: { feature: string; primaryModelId: string | null }[],
): Promise<Record<string, number>> {
  const brain = await getAiBrain();
  const counts: Record<string, number> = {};
  const bump = (id: string | null | undefined) => {
    if (!id) return;
    counts[id] = (counts[id] ?? 0) + 1;
  };

  const overriddenKeys = new Set(overrides.map((o) => o.feature));
  for (const o of overrides) bump(o.primaryModelId);

  const following = AI_FEATURES.filter((f) => !overriddenKeys.has(f.key)).length;
  if (brain.primary && following > 0) {
    counts[brain.primary] = (counts[brain.primary] ?? 0) + following;
  }

  return counts;
}
