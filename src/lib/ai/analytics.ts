import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

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
  today: Money & { calls: number };
  window: Money & { calls: number; failures: number; fallbacks: number };
  byFeature: FeatureCost[];
  byModel: ModelCost[];
  /** Providers that failed in the window, worst first. */
  troubled: { providerSlug: string; failures: number; lastError: string | null }[];
  /** True when no priced model has been configured — the dashboard says so. */
  pricingUnconfigured: boolean;
};

/**
 * What one credit sells for, in rupiah.
 *
 * Weighted by pack size across the active packs, because a user buying the
 * 1000-credit pack pays a different per-credit rate than one buying 100, and
 * averaging the rates rather than the money would overweight the small pack
 * nobody buys. Falls back to 150 (the 100/Rp15.000 pack) when nothing is active.
 */
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
  provider_slug: string | null;
  model_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_idr: number;
  credits_charged: number;
  latency_ms: number | null;
  status: string;
  created_at: string;
};

export async function costSummary(days = 7): Promise<CostSummary> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [{ data }, perCredit] = await Promise.all([
    createServiceRoleClient()
      .from("ai_usage_log")
      .select(
        "feature, provider_slug, model_id, input_tokens, output_tokens, cost_idr, credits_charged, latency_ms, status, created_at",
      )
      .gte("created_at", since)
      // A hard ceiling so one busy week cannot pull an unbounded result set into
      // a serverless function's memory. Ordered newest-first so the cap drops
      // the oldest rows, which are the least interesting.
      .order("created_at", { ascending: false })
      .limit(5000),
    rupiahPerCredit(),
  ]);

  const rows = (data ?? []) as Row[];
  const revenueOf = (credits: number) => credits * perCredit;

  const zero = (): Money => ({ costIdr: 0, revenueIdr: 0, marginIdr: 0 });
  const add = (m: Money, cost: number, credits: number) => {
    m.costIdr += cost;
    m.revenueIdr += revenueOf(credits);
    m.marginIdr = m.revenueIdr - m.costIdr;
  };

  const today = { ...zero(), calls: 0 };
  const window = { ...zero(), calls: 0, failures: 0, fallbacks: 0 };
  const features = new Map<string, FeatureCost & { latencySum: number; latencyCount: number }>();
  const modelsMap = new Map<string, ModelCost>();
  const troubled = new Map<string, { failures: number; lastError: string | null }>();

  for (const r of rows) {
    const cost = Number(r.cost_idr ?? 0);
    const credits = Number(r.credits_charged ?? 0);
    const failed = r.status === "error";
    const fellBack = r.status === "fallback";

    add(window, cost, credits);
    window.calls++;
    if (failed) window.failures++;
    if (fellBack) window.fallbacks++;

    if (new Date(r.created_at) >= startOfToday) {
      add(today, cost, credits);
      today.calls++;
    }

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
        latencySum: 0,
        latencyCount: 0,
      });
    }
    const f = features.get(fKey)!;
    add(f, cost, credits);
    f.calls++;
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

  const byFeature = [...features.values()]
    .map((f) => ({
      ...f,
      avgLatencyMs: f.latencyCount > 0 ? Math.round(f.latencySum / f.latencyCount) : 0,
    }))
    .sort((a, b) => b.costIdr - a.costIdr);

  return {
    days,
    rupiahPerCredit: perCredit,
    today,
    window,
    byFeature,
    byModel: [...modelsMap.values()].sort((a, b) => b.costIdr - a.costIdr),
    troubled: [...troubled.entries()]
      .map(([providerSlug, t]) => ({ providerSlug, ...t }))
      .sort((a, b) => b.failures - a.failures),
    // Every row costing exactly zero means no model has a price set, not that
    // the AI is free. Saying "Rp0 spent" in that state is the single most
    // misleading thing this dashboard could do.
    pricingUnconfigured: rows.length > 0 && rows.every((r) => Number(r.cost_idr ?? 0) === 0),
  };
}
