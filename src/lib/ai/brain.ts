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

  const chain = [brain.primary, ...brain.fallbacks]
    .map((id) => pairFor(byId(id), providers))
    .filter((c): c is Candidate => c !== null)
    .filter(capable);

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

export type BrainView = {
  primary: { modelId: string; label: string; provider: string; active: boolean } | null;
  fallbacks: { modelId: string; label: string; provider: string; active: boolean }[];
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
      active: Boolean(m.is_active && p?.is_active),
    };
  };

  const primary = brain.primary ? describe(brain.primary) : null;
  const fallbacks = brain.fallbacks
    .map(describe)
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const overridden = new Set(overriddenFeatures);
  const overriddenCount = AI_FEATURES.filter((f) => overridden.has(f.key)).length;
  const followingCount = AI_FEATURES.length - overriddenCount;

  const healthy = Boolean(primary?.active);
  const status = !primary
    ? "Belum diatur — semua fitur masih pakai Gemini bawaan."
    : !primary.active
      ? "Model utamanya lagi mati. Fitur otomatis balik ke Gemini bawaan."
      : fallbacks.some((f) => f.active)
        ? "Aktif, dengan cadangan."
        : "Aktif, tapi belum ada cadangan.";

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
