import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { costIdr, isPriced } from "./cost";
import { FEATURE_MAP, type ModelRow } from "./types";
import { startOfJakartaDay } from "@/lib/time";

/**
 * Cost intelligence: what the AI actually costs, what it earns, and where the
 * money goes.
 *
 * The existing profit panel prices the Gemini pool from two app_config numbers
 * and a token total. That was adequate for one vendor on one model; with a fleet
 * it cannot answer the questions that decide pricing — which feature loses
 * money, which model is worth its premium, what a fallback costs us. All of
 * those need per-request rows, which is what ai_usage_log is.
 *
 * Revenue is derived from what credits actually sell for rather than from a
 * configured constant, so the margin here moves when the owner changes a pack
 * price and cannot drift away from what customers really paid.
 */

export type Money = { costIdr: number; revenueIdr: number; marginIdr: number };

export type FeatureCost = Money & {
  feature: string;
  calls: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  avgLatencyMs: number;
  /** The model that served this feature most often — what a suggestion replaces. */
  byModelId: string | null;
  /** Length of the observed window, so a saving can be scaled to a month. */
  windowDays: number;
};

export type ModelCost = Money & {
  providerSlug: string;
  modelId: string;
  calls: number;
  failures: number;
};

export type CostSummary = {
  days: number;
  rupiahPerCredit: number;
  today: Money & { calls: number; tokens: number };
  window: Money & { calls: number; failures: number; fallbacks: number };
  /** Rolling 30 days. The number an owner budgets against. */
  month: Money & { calls: number };
  byFeature: FeatureCost[];
  byModel: ModelCost[];
  /** Providers that failed in the window, worst first. */
  troubled: { providerSlug: string; failures: number; lastError: string | null }[];
  /** True when no priced model has been configured — the dashboard says so. */
  pricingUnconfigured: boolean;
  /** Requests whose credit was handed back, and therefore earn nothing. */
  refundedCalls: number;
  /** True when the row cap was hit, so the totals are a floor, not a total. */
  truncated: boolean;
};

/**
 * What one credit sells for, in rupiah.
 *
 * Weighted by pack size across the active packs, because a user buying the
 * 1000-credit pack pays a different per-credit rate than one buying 100, and
 * averaging the rates rather than the money would overweight the small pack
 * nobody buys. Falls back to 150 (the 100/Rp15.000 pack) when nothing is active.
 */
export type Quota = {
  /** Tokens the package bought. Null when this model is not prepaid. */
  totalTokens: number | null;
  /** Tokens we have actually spent on it, from our own usage log. */
  usedTokens: number;
  remainingTokens: number | null;
  /** What the package cost, and what has been consumed of it, in rupiah. */
  packagePriceIdr: number | null;
  spentIdr: number;
  expiresAt: string | null;
  expired: boolean;
  /** 0-100. Null when not prepaid. */
  percentUsed: number | null;
};

/**
 * How much of a prepaid package is left.
 *
 * Counted from OUR OWN usage log rather than the gateway's balance endpoint, on
 * purpose. Ipeenk reports `{"total_balance": 99029.9, "currency": "USD"}` for a
 * package sold as "1,000,000 tokens" — a number in a unit that does not match
 * what was bought and cannot be reconciled without guessing. Our log records the
 * exact input and output tokens the provider itself reported on every call, so
 * this is both more trustworthy and realtime.
 *
 * The gateway's own figure is still displayed, labelled as theirs, so a
 * disagreement is visible rather than hidden.
 */
export async function quotaFor(model: ModelRow): Promise<Quota> {
  const isPrepaid = model.pricing_mode === "prepaid_package";
  const total = isPrepaid ? Number(model.package_tokens ?? 0) || null : null;
  const price = isPrepaid ? Number(model.package_price_idr ?? 0) || null : null;

  const { data } = await createServiceRoleClient()
    .from("ai_usage_log")
    .select("input_tokens, output_tokens")
    .eq("provider_id", model.provider_id)
    .eq("model_id", model.model_id)
    .eq("status", "ok");

  const used = (data ?? []).reduce(
    (s, r) =>
      s + Number((r as { input_tokens: number }).input_tokens ?? 0) +
      Number((r as { output_tokens: number }).output_tokens ?? 0),
    0,
  );

  const expiresAt = model.package_expires_at;
  return {
    totalTokens: total,
    usedTokens: used,
    remainingTokens: total !== null ? Math.max(0, total - used) : null,
    packagePriceIdr: price,
    spentIdr: total && price ? (used / total) * price : 0,
    expiresAt,
    expired: Boolean(expiresAt && new Date(expiresAt) < new Date()),
    percentUsed: total ? Math.min(100, (used / total) * 100) : null,
  };
}

export type Suggestion = {
  feature: string;
  featureLabel: string;
  currentModel: string;
  suggestedModel: string;
  suggestedProvider: string;
  suggestedModelRowId: string;
  savingsPercent: number;
  monthlySavingIdr: number;
};

/**
 * "DeepSeek would save 60% on Script" — computed, not guessed.
 *
 * Uses this product's OWN measured token shape per feature, because the ratio is
 * what decides the answer: Script is output-heavy and output is where the price
 * premium lives, so a model that looks cheap on input can still lose. A
 * recommendation built on list prices alone would be wrong for exactly the
 * features that cost the most.
 *
 * Only suggests models that (a) are active, (b) have a price set — an unpriced
 * model looks free and would win every comparison dishonestly — and (c) carry
 * every capability the feature requires.
 *
 * The 20% floor exists so the screen stays quiet. A dashboard that always has a
 * suggestion is a dashboard nobody reads.
 */
const MIN_SAVING_PERCENT = 20;

export async function savingsSuggestions(
  byFeature: FeatureCost[],
  models: ModelRow[],
  usdToIdr: number,
): Promise<Suggestion[]> {
  // Free quota is a fallback capacity, not a scalable unit cost. Calling it
  // "100% cheaper" encourages the owner to route production traffic onto a
  // quota that can disappear without warning, so recommendations compare only
  // models with a real paid price/package.
  const priced = models.filter(
    (m) => m.is_active && m.pricing_mode !== "free_quota" && isPriced(m),
  );
  if (priced.length === 0) return [];

  const out: Suggestion[] = [];

  for (const f of byFeature) {
    if (f.calls === 0 || f.costIdr <= 0) continue;
    const spec = FEATURE_MAP[f.feature];
    const required = spec?.requires ?? [];

    // The real average shape of this feature's traffic.
    const avgIn = f.inputTokens / f.calls;
    const avgOut = f.outputTokens / f.calls;
    if (avgIn + avgOut === 0) continue;

    const currentPerCall = f.costIdr / f.calls;

    const eligible = priced.filter((m) =>
      required.every((r) => m.capabilities.includes(r)),
    );
    if (eligible.length === 0) continue;

    let best: { model: ModelRow; perCall: number } | null = null;
    for (const m of eligible) {
      const perCall = costIdr(m, { input: avgIn, output: avgOut }, usdToIdr);
      if (!best || perCall < best.perCall) best = { model: m, perCall };
    }
    if (!best || best.perCall >= currentPerCall) continue;

    const savingsPercent = ((currentPerCall - best.perCall) / currentPerCall) * 100;
    if (savingsPercent < MIN_SAVING_PERCENT) continue;

    // Do not suggest what is already running.
    if (best.model.model_id === f.byModelId) continue;

    out.push({
      feature: f.feature,
      featureLabel: spec?.label ?? f.feature,
      currentModel:
        models.find((model) => model.model_id === f.byModelId)?.label ?? f.byModelId ?? "?",
      suggestedModel: best.model.label ?? best.model.model_id,
      suggestedProvider: best.model.provider_id,
      suggestedModelRowId: best.model.id,
      savingsPercent,
      // Extrapolated from the observed window to 30 days.
      monthlySavingIdr:
        (currentPerCall - best.perCall) * f.calls * (30 / Math.max(1, f.windowDays)),
    });
  }

  return out.sort((a, b) => b.monthlySavingIdr - a.monthlySavingIdr).slice(0, 3);
}

async function rupiahPerCredit(): Promise<number> {
  const { data } = await createServiceRoleClient()
    .from("credit_packs")
    .select("credits, price_idr")
    .eq("is_active", true);

  const packs = data ?? [];
  const credits = packs.reduce((s, p) => s + Number(p.credits ?? 0), 0);
  const rupiah = packs.reduce((s, p) => s + Number(p.price_idr ?? 0), 0);
  return credits > 0 ? rupiah / credits : 150;
}

type Row = {
  feature: string;
  provider_id: string | null;
  provider_slug: string | null;
  model_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_idr: number;
  credits_charged: number;
  latency_ms: number | null;
  status: string;
  created_at: string;
  /** Joins credit_ledger, so a refund can cancel this row's revenue. */
  ref_id: string | null;
};

const ROW_CAP = 5000;

export async function costSummary(days = 7): Promise<CostSummary> {
  // One 30-day fetch feeds all three rollups. Three queries for today, the
  // window and the month would triple the cost of the page to answer the same
  // question from the same rows.
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const windowStart = Date.now() - days * 86_400_000;
  const startOfToday = startOfJakartaDay();

  const db = createServiceRoleClient();

  const [{ data }, perCredit, { data: refundRows }, { data: pricingRows }] =
    await Promise.all([
    db
      .from("ai_usage_log")
      .select(
        "feature, provider_id, provider_slug, model_id, input_tokens, output_tokens, cost_idr, credits_charged, latency_ms, status, created_at, ref_id",
      )
      .gte("created_at", monthAgo)
      // A hard ceiling so one busy month cannot pull an unbounded result set
      // into a serverless function's memory. Ordered newest-first so the cap
      // drops the oldest rows, which are the least interesting — and the caller
      // is told when it bit, because a silently truncated total reads as a real
      // one.
      .order("created_at", { ascending: false })
      .limit(ROW_CAP),
    rupiahPerCredit(),
    // Refunds. A positive ledger delta carrying a ref means the credit taken
    // under that ref was handed back, so the request earned nothing.
    //
    // This matters more than it looks. The engine records credits_charged at the
    // moment the model answers, but a route can still reject that answer
    // afterwards — an unparseable JSON body is the common case — and refund. Left
    // uncorrected, every one of those is counted as revenue and the margin on
    // this page is a flattering lie.
    db
      .from("credit_ledger")
      .select("ref_id")
      .gt("delta", 0)
      .not("ref_id", "is", null)
      .gte("created_at", monthAgo)
      .limit(ROW_CAP),
    // Pricing is configuration, not an inference from a zero cost row. A free
    // quota and an unknown price both produce Rp0 and mean opposite things.
    db
      .from("ai_models")
      .select(
        "provider_id, model_id, pricing_mode, input_price_usd_per_mtok, output_price_usd_per_mtok, package_price_idr, package_tokens",
      ),
  ]);

  const rows = (data ?? []) as Row[];
  const pricing = (pricingRows ?? []).map((row) => ({
    providerId: row.provider_id,
    modelId: row.model_id,
    price: {
        pricing_mode: row.pricing_mode as ModelRow["pricing_mode"],
        input_price_usd_per_mtok: Number(row.input_price_usd_per_mtok ?? 0),
        output_price_usd_per_mtok: Number(row.output_price_usd_per_mtok ?? 0),
        package_price_idr:
          row.package_price_idr == null ? null : Number(row.package_price_idr),
        package_tokens: row.package_tokens == null ? null : Number(row.package_tokens),
      },
  }));
  const priceByProviderModel = new Map(
    pricing.map((row) => [`${row.providerId}:${row.modelId}`, row.price]),
  );
  const modelIdCounts = new Map<string, number>();
  for (const row of pricing) {
    modelIdCounts.set(row.modelId, (modelIdCounts.get(row.modelId) ?? 0) + 1);
  }
  // Historical legacy rows did not carry provider_id. They can still be
  // matched safely when only one gateway has that model id; an ambiguous id is
  // deliberately treated as unknown rather than borrowing another gateway's
  // price.
  const uniquePriceByModel = new Map(
    pricing
      .filter((row) => modelIdCounts.get(row.modelId) === 1)
      .map((row) => [row.modelId, row.price]),
  );
  const refunded = new Set(
    (refundRows ?? []).map((r) => (r as { ref_id: string | null }).ref_id).filter(Boolean) as string[],
  );

  let refundedCalls = 0;
  const revenueOf = (credits: number) => credits * perCredit;

  const zero = (): Money => ({ costIdr: 0, revenueIdr: 0, marginIdr: 0 });
  const add = (m: Money, cost: number, credits: number) => {
    m.costIdr += cost;
    m.revenueIdr += revenueOf(credits);
    m.marginIdr = m.revenueIdr - m.costIdr;
  };

  const today = { ...zero(), calls: 0, tokens: 0 };
  const window = { ...zero(), calls: 0, failures: 0, fallbacks: 0 };
  const month = { ...zero(), calls: 0 };
  const features = new Map<
    string,
    FeatureCost & {
      latencySum: number;
      latencyCount: number;
      modelTally: Map<string, number>;
      requestKeys: Set<string>;
    }
  >();
  const modelsMap = new Map<string, ModelCost>();
  const troubled = new Map<string, { failures: number; lastError: string | null }>();
  const todayRequests = new Set<string>();
  const windowRequests = new Set<string>();
  const monthRequests = new Set<string>();
  let legacyRow = 0;

  for (const r of rows) {
    // Fallback attempts, JSON repair calls, and Vibe's parallel document calls
    // share one ref. The business dashboard counts the customer's request once;
    // provider/model breakdowns below still count every paid attempt.
    const requestKey = r.ref_id ?? "legacy:" + r.created_at + ":" + legacyRow++;
    monthRequests.add(requestKey);
    const cost = Number(r.cost_idr ?? 0);
    // A refunded request cost us the tokens but earned nothing. The cost stays,
    // the revenue does not — that asymmetry is the whole point of tracking it.
    const wasRefunded = Boolean(r.ref_id && refunded.has(r.ref_id));
    const credits = wasRefunded ? 0 : Number(r.credits_charged ?? 0);
    if (wasRefunded && Number(r.credits_charged ?? 0) > 0) refundedCalls++;

    const at = new Date(r.created_at).getTime();
    const failed = r.status === "error";
    const fellBack = r.status === "fallback";

    add(month, cost, credits);

    const inWindow = at >= windowStart;
    if (inWindow) {
      windowRequests.add(requestKey);
      add(window, cost, credits);
      if (failed) window.failures++;
      if (fellBack) window.fallbacks++;
    }

    if (at >= startOfToday.getTime()) {
      todayRequests.add(requestKey);
      add(today, cost, credits);
      today.tokens += Number(r.input_tokens ?? 0) + Number(r.output_tokens ?? 0);
    }

    // The per-feature and per-model breakdowns describe the window the page
    // labels, not the 30 days fetched for the monthly total.
    if (!inWindow) continue;

    const fKey = r.feature;
    if (!features.has(fKey)) {
      features.set(fKey, {
        ...zero(),
        feature: fKey,
        calls: 0,
        failures: 0,
        inputTokens: 0,
        outputTokens: 0,
        avgLatencyMs: 0,
        byModelId: null,
        windowDays: days,
        latencySum: 0,
        latencyCount: 0,
        modelTally: new Map(),
        requestKeys: new Set(),
      });
    }
    const f = features.get(fKey)!;
    f.requestKeys.add(requestKey);
    if (r.model_id && r.status === "ok") {
      f.modelTally.set(r.model_id, (f.modelTally.get(r.model_id) ?? 0) + 1);
    }
    add(f, cost, credits);
    if (failed) f.failures++;
    f.inputTokens += Number(r.input_tokens ?? 0);
    f.outputTokens += Number(r.output_tokens ?? 0);
    if (r.latency_ms != null) {
      f.latencySum += r.latency_ms;
      f.latencyCount++;
    }

    const mKey = `${r.provider_slug ?? "?"}::${r.model_id ?? "?"}`;
    if (!modelsMap.has(mKey)) {
      modelsMap.set(mKey, {
        ...zero(),
        providerSlug: r.provider_slug ?? "?",
        modelId: r.model_id ?? "?",
        calls: 0,
        failures: 0,
      });
    }
    const m = modelsMap.get(mKey)!;
    add(m, cost, credits);
    m.calls++;
    if (failed) m.failures++;

    if ((failed || fellBack) && r.provider_slug) {
      const t = troubled.get(r.provider_slug) ?? { failures: 0, lastError: null };
      t.failures++;
      troubled.set(r.provider_slug, t);
    }
  }

  today.calls = todayRequests.size;
  window.calls = windowRequests.size;
  month.calls = monthRequests.size;

  const byFeature = [...features.values()]
    .map(({ latencySum, latencyCount, modelTally, requestKeys, ...f }) => ({
      ...f,
      calls: requestKeys.size,
      avgLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
      byModelId: [...modelTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.costIdr - a.costIdr);

  return {
    days,
    rupiahPerCredit: perCredit,
    today,
    window,
    month,
    refundedCalls,
    truncated: rows.length >= ROW_CAP,
    byFeature,
    byModel: [...modelsMap.values()].sort((a, b) => b.costIdr - a.costIdr),
    troubled: [...troubled.entries()]
      .map(([providerSlug, t]) => ({ providerSlug, ...t }))
      .sort((a, b) => b.failures - a.failures),
    // One unknown-cost success is enough to make the total a partial truth.
    // Deliberately exclude BYOK: that quota belongs to the user, so Rp0 is the
    // owner's real cost even when we do not know what the user pays.
    pricingUnconfigured: rows.some((r) => {
      if (
        r.status !== "ok" ||
        r.provider_slug === "byok" ||
        Number(r.input_tokens ?? 0) + Number(r.output_tokens ?? 0) === 0
      ) {
        return false;
      }
      const price = r.model_id
        ? (r.provider_id
            ? priceByProviderModel.get(`${r.provider_id}:${r.model_id}`)
            : undefined) ?? uniquePriceByModel.get(r.model_id)
        : undefined;
      return !price || !isPriced(price);
    }),
  };
}
