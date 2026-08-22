import "server-only";
import { getRouterFlags } from "@/lib/config";
import { getFleet, getRoute } from "./registry";
import { resolveBrain } from "./brain";
import { blendedUsdPerMtok } from "./cost";
import { FEATURE_MAP, type Candidate, type Capability, type ModelRow, type ProviderRow, type RoutePrefer } from "./types";

/**
 * The router. Decides which provider+model serves a feature, and in what order
 * to fall back when one fails.
 *
 * The single most important behaviour in this file is what happens when nothing
 * is configured: it returns an EMPTY list, and the engine reads that as "use the
 * legacy env Gemini path". That is what makes deploying this layer a no-op — the
 * product keeps working exactly as before until the owner opts a feature in from
 * the dashboard, one at a time. A router that defaulted to something clever would
 * be a rewrite of the AI path disguised as a feature flag.
 */

/**
 * Failures before a provider is pushed to the back of the queue.
 *
 * Pushed, not dropped — the same choice keys.ts makes for a cooling API key. If
 * every provider is unhealthy we still try them all rather than failing without
 * an attempt, because "everything looks broken" is usually one bad metric, and a
 * user waiting on a generation would rather we tried.
 */
const UNHEALTHY_AFTER = 3;

function isUsable(model: ModelRow, provider: ProviderRow | undefined): provider is ProviderRow {
  return Boolean(provider?.is_active && model.is_active);
}

function hasAll(model: ModelRow, required: Capability[]): boolean {
  return required.every((c) => model.capabilities.includes(c));
}

/**
 * Score a model for a preference. Higher wins.
 *
 * Prices are per million tokens and typically span three orders of magnitude
 * between a flash-tier and a frontier model, so cost is scored on a log scale —
 * a linear score would make every non-cheapest model indistinguishable.
 */
function score(model: ModelRow, prefer: RoutePrefer, providerPriority: number): number {
  const usd = blendedUsdPerMtok(model);
  // +1 keeps a free model (0.0) from producing -Infinity.
  const cheapness = -Math.log10(usd + 0.01);
  const fast = model.capabilities.includes("fast") ? 1 : 0;
  const premium =
    (model.capabilities.includes("premium") ? 1 : 0) +
    (model.capabilities.includes("reasoning") ? 1 : 0);

  // Provider priority is the owner's own tie-breaker, so it always contributes.
  const priorityBonus = -providerPriority / 1000;

  switch (prefer) {
    case "cheap":
      return cheapness * 3 + priorityBonus;
    case "fast":
      return fast * 4 + cheapness + priorityBonus;
    case "quality":
      return premium * 4 + Math.log10(usd + 0.01) + priorityBonus;
    case "balanced":
    default:
      return premium * 1.5 + fast + cheapness + priorityBonus;
  }
}

export type RouteDecision = {
  candidates: Candidate[];
  /** Why this list — surfaced in the playground and in the usage log. */
  reason: string;
  /** `brain` = inheriting the global default; manual/smart = an override. */
  mode: "manual" | "smart" | "legacy" | "brain";
};

/**
 * Resolve the ordered list of provider+model pairs to try for one feature.
 *
 * Order is: the chosen primary, then its declared fallbacks, then — only in
 * smart mode — any other qualifying model as a last resort. Unhealthy providers
 * sink to the bottom without being removed.
 */
export async function resolveRoute(feature: string): Promise<RouteDecision> {
  const flags = await getRouterFlags();
  if (!flags.routerEnabled) {
    return { candidates: [], reason: "Router dimatiin — pakai jalur Gemini lama.", mode: "legacy" };
  }

  // No override row means this feature follows the Global AI Brain. Absence is
  // the inheritance mechanism: an ai_routes row exists precisely to say "this
  // one is DIFFERENT", so the routing screen lists exceptions rather than
  // settings, and deleting a row is how a feature rejoins the default.
  const route = await getRoute(feature);
  if (!route) {
    const brain = await resolveBrain(feature);
    return brain.candidates.length > 0
      ? { candidates: brain.candidates, reason: brain.reason, mode: "brain" }
      : { candidates: [], reason: brain.reason, mode: "legacy" };
  }

  const { providers, models } = await getFleet();
  const providerOf = (m: ModelRow) => providers.find((p) => p.id === m.provider_id);

  // A route may demand capabilities on top of what the feature inherently needs
  // (proof_check cannot work without vision, whatever the owner picked).
  const required = Array.from(
    new Set<Capability>([
      ...(FEATURE_MAP[feature]?.requires ?? []),
      ...route.required_capabilities,
    ]),
  );

  const usable = models.filter((m) => {
    const p = providerOf(m);
    return isUsable(m, p) && hasAll(m, required);
  });

  const byId = (id: string | null) => (id ? usable.find((m) => m.id === id) : undefined);

  let ordered: ModelRow[] = [];
  let reason: string;

  if (route.mode === "manual") {
    const primary = byId(route.primary_model_id);
    const fallbacks = route.fallback_model_ids.map(byId).filter(Boolean) as ModelRow[];
    ordered = [primary, ...fallbacks].filter(Boolean) as ModelRow[];
    reason = primary
      ? `Manual: ${primary.label ?? primary.model_id}${fallbacks.length ? ` + ${fallbacks.length} cadangan` : ""}.`
      : "Model utamanya udah gak aktif — jatuh ke cadangan.";
  } else {
    // Smart: rank everything that qualifies, but still honour an explicitly
    // pinned primary by floating it to the front. An owner who pinned a model
    // and then switched to smart did not mean "ignore my choice".
    const ranked = [...usable].sort(
      (a, b) =>
        score(b, route.prefer, providerOf(b)?.priority ?? 100) -
        score(a, route.prefer, providerOf(a)?.priority ?? 100),
    );
    const pinned = byId(route.primary_model_id);
    ordered = pinned ? [pinned, ...ranked.filter((m) => m.id !== pinned.id)] : ranked;
    reason = `Smart (${route.prefer}): ${ordered.length} model memenuhi syarat${
      required.length ? ` [${required.join(", ")}]` : ""
    }.`;
  }

  // Unhealthy providers sink. Stable within each group, so the ranking above
  // survives.
  const healthy: ModelRow[] = [];
  const sick: ModelRow[] = [];
  for (const m of ordered) {
    const p = providerOf(m);
    ((p?.consecutive_failures ?? 0) >= UNHEALTHY_AFTER ? sick : healthy).push(m);
  }

  let finalModels = [...healthy, ...sick];
  if (!flags.fallbackEnabled) {
    finalModels = finalModels.slice(0, 1);
    reason += " Fallback dimatiin.";
  }

  const candidates: Candidate[] = finalModels
    .map((model) => {
      const provider = providerOf(model);
      return provider ? { provider, model } : null;
    })
    .filter(Boolean) as Candidate[];

  if (candidates.length === 0) {
    return {
      candidates: [],
      reason:
        "Gak ada model aktif yang cocok buat fitur ini — balik ke jalur Gemini lama.",
      mode: "legacy",
    };
  }

  return { candidates, reason, mode: route.mode };
}
