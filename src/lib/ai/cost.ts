import type { ModelRow } from "./types";

/**
 * Money. Turning tokens into rupiah, and rupiah into a decision.
 *
 * Pure functions with no database and no `server-only`, so the admin cost
 * simulator can run the exact same arithmetic in the browser that the engine
 * runs when it writes a usage row. Two implementations of a margin calculation
 * is how a dashboard starts disagreeing with the ledger.
 */

/** Vendors publish per-million-token prices; this is the divisor for that. */
const MTOK = 1_000_000;

export type TokenSplit = { input: number; output: number };

/**
 * What one call actually cost us, in rupiah.
 *
 * Input and output are priced separately by every vendor, often at a 4:1 ratio
 * or worse, so a cost built on a single total-token number is wrong by whatever
 * the mix happened to be.
 */
export function costIdr(
  model: Pick<ModelRow, "input_price_usd_per_mtok" | "output_price_usd_per_mtok">,
  tokens: TokenSplit,
  usdToIdr: number,
): number {
  const usd =
    (tokens.input / MTOK) * Number(model.input_price_usd_per_mtok ?? 0) +
    (tokens.output / MTOK) * Number(model.output_price_usd_per_mtok ?? 0);
  return usd * usdToIdr;
}

/**
 * A single number for "how expensive is this model", used to rank candidates.
 *
 * Weighted 1:3 input-to-output because generation output is where the cost
 * lands in this product — a prompt carrying Creator DNA and trends is long, but
 * a script is longer, and output tokens are the ones priced at a premium.
 */
export function blendedUsdPerMtok(
  model: Pick<ModelRow, "input_price_usd_per_mtok" | "output_price_usd_per_mtok">,
): number {
  return (
    (Number(model.input_price_usd_per_mtok ?? 0) +
      3 * Number(model.output_price_usd_per_mtok ?? 0)) /
    4
  );
}

export function formatIdr(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

export type SimulatorInput = {
  users: number;
  generationsPerUserPerDay: number;
  /** Average prompt size. Creator DNA + trends + craft rules is not small. */
  inputTokensPerGeneration: number;
  outputTokensPerGeneration: number;
  /** What the model costs us. */
  inputUsdPerMtok: number;
  outputUsdPerMtok: number;
  /** What we charge, and what a credit sells for. */
  creditsPerGeneration: number;
  rupiahPerCredit: number;
  usdToIdr: number;
};

export type SimulatorOutput = {
  generationsPerDay: number;
  generationsPerMonth: number;
  costPerGenerationIdr: number;
  revenuePerGenerationIdr: number;
  marginPerGenerationIdr: number;
  marginPercent: number;
  dailyCostIdr: number;
  dailyRevenueIdr: number;
  monthlyCostIdr: number;
  monthlyRevenueIdr: number;
  monthlyProfitIdr: number;
  /** True when we lose money on every single call — the number that matters. */
  losesMoneyPerCall: boolean;
};

/**
 * Planning arithmetic for the admin simulator.
 *
 * Answers the only question that decides whether a price is survivable: at this
 * volume, with this model, does a generation make or lose money — and by how
 * much a month.
 *
 * Deliberately assumes every generation is billed. Free daily refills and admin
 * bypasses make the real revenue lower, so this is the optimistic bound; a plan
 * that fails here fails harder in production.
 */
export function simulate(i: SimulatorInput): SimulatorOutput {
  const generationsPerDay = Math.max(0, i.users * i.generationsPerUserPerDay);
  const generationsPerMonth = generationsPerDay * 30;

  const costPerGenerationIdr =
    ((i.inputTokensPerGeneration / MTOK) * i.inputUsdPerMtok +
      (i.outputTokensPerGeneration / MTOK) * i.outputUsdPerMtok) *
    i.usdToIdr;

  const revenuePerGenerationIdr = i.creditsPerGeneration * i.rupiahPerCredit;
  const marginPerGenerationIdr = revenuePerGenerationIdr - costPerGenerationIdr;

  return {
    generationsPerDay,
    generationsPerMonth,
    costPerGenerationIdr,
    revenuePerGenerationIdr,
    marginPerGenerationIdr,
    marginPercent:
      revenuePerGenerationIdr > 0
        ? (marginPerGenerationIdr / revenuePerGenerationIdr) * 100
        : 0,
    dailyCostIdr: costPerGenerationIdr * generationsPerDay,
    dailyRevenueIdr: revenuePerGenerationIdr * generationsPerDay,
    monthlyCostIdr: costPerGenerationIdr * generationsPerMonth,
    monthlyRevenueIdr: revenuePerGenerationIdr * generationsPerMonth,
    monthlyProfitIdr: marginPerGenerationIdr * generationsPerMonth,
    losesMoneyPerCall: marginPerGenerationIdr < 0,
  };
}

/**
 * How long a prepaid balance lasts at the current burn.
 *
 * Needs two readings to mean anything, which is why balances are stored as
 * history rather than as one current-value column.
 */
export function daysRemaining(balance: number, burnPerDay: number): number | null {
  if (!(burnPerDay > 0) || !(balance > 0)) return null;
  return balance / burnPerDay;
}
