import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getPool, isCooling } from "./keys";
import { adapterFor } from "./providers";

/**
 * Per-key health for the admin panel.
 *
 * The panel used to render straight from `gemini_pool_used_today()`, which
 * means it could only ever show keys that had already served a request. A key
 * that was configured but never reached — wrong project, revoked, typo'd into
 * the wrong env var — looked exactly like a key that simply had not been used
 * yet: absent. That is the one question an operator actually has about a key
 * pool, and the panel could not answer it.
 *
 * So the roster comes from the environment (`getPool()`), and usage is joined
 * onto it. A configured key with no usage now renders as "belum kepakai"
 * instead of vanishing.
 */

/** Requests a key is assumed to be allowed per day. Same source as the guard. */
export function capPerKey(): number {
  return Number(process.env.GEMINI_DAILY_CAP_PER_KEY ?? 1000);
}

export type KeyHealth =
  /** Configured, no traffic today. Cannot be called healthy — only untested. */
  | "idle"
  /** Serving requests, error rate under a fifth. */
  | "healthy"
  /** Serving, but a fifth or more of today's calls failed. */
  | "degraded"
  /** Rate limited recently; rotation is currently stepping around it. */
  | "cooling"
  /** At or past the assumed daily cap. */
  | "exhausted";

export type KeyReport = {
  slot: number;
  requests: number;
  errors: number;
  tokens: number;
  cap: number;
  /** 0–1. Clamped, because the cap is an assumption and can be overshot. */
  usedRatio: number;
  lastUsedAt: string | null;
  health: KeyHealth;
};

export type PoolReport = {
  keys: KeyReport[];
  capPerKey: number;
  capacity: number;
  used: number;
  remainingRatio: number;
  /** True when free users are being turned away. Mirrors quota.ts. */
  guardEngaged: boolean;
  /** Set when usage could not be read; the roster is still valid. */
  usageError: string | null;
};

export type GeminiPoolQuota = {
  activeKeys: number;
  capPerKey: number;
  capacity: number;
  used: number;
  remaining: number;
  usedRatio: number;
  remainingRatio: number;
  percentUsed: number;
  percentRemaining: number;
  guardEngaged: boolean;

  // Reset timing
  resetScheduleText: string;
  nextResetIso: string;
  hoursUntilReset: number;
  minutesUntilReset: number;
  countdownText: string;

  // Economic Valuation & Savings in Rupiah
  isFreeTier: true;
  realCostIdr: 0;
  usdToIdr: number;
  inputPriceUsdPerMtok: number;
  outputPriceUsdPerMtok: number;
  estimatedCostPerGenerateIdr: number;

  totalTokensToday: number;
  inputTokensToday: number;
  outputTokensToday: number;
  commercialValueSavedTodayIdr: number;

  keys: KeyReport[];
  usageError: string | null;
};

export function getGeminiResetCountdown(now = new Date()) {
  const getPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  const ptFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = ptFmt.formatToParts(now);
  const hour = getPart(parts, "hour");
  const minute = getPart(parts, "minute");
  const second = getPart(parts, "second");

  // Google Gemini daily quota window resets at midnight Pacific Time (00:00 PT)
  const secondsElapsedInPtDay = hour * 3600 + minute * 60 + second;
  const secondsRemaining = 86400 - secondsElapsedInPtDay;
  const nextReset = new Date(now.getTime() + secondsRemaining * 1000);

  const wibFmt = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const hoursUntil = Math.floor(secondsRemaining / 3600);
  const minutesUntil = Math.floor((secondsRemaining % 3600) / 60);
  const timeFormatted = `${wibFmt.format(nextReset).replace(".", ":")} WIB`;

  return {
    nextResetIso: nextReset.toISOString(),
    resetScheduleText: `Setiap ${timeFormatted} (00:00 PT)`,
    hoursUntilReset: hoursUntil,
    minutesUntilReset: minutesUntil,
    countdownText: `${hoursUntil} jam ${minutesUntil} mnt lagi`,
  };
}

export async function getGeminiPoolQuota(providedUsdToIdr?: number): Promise<GeminiPoolQuota> {
  const report = await getPoolReport();
  const usdToIdr = providedUsdToIdr ?? 16_500;

  let inputTokensToday = 0;
  let outputTokensToday = 0;
  let totalTokensToday = report.keys.reduce((s, k) => s + k.tokens, 0);

  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("gemini_usage")
      .select("input_tokens, output_tokens, token_count")
      .eq("usage_date", new Date().toISOString().slice(0, 10));

    if (data && data.length > 0) {
      let sumIn = 0;
      let sumOut = 0;
      let sumAll = 0;
      for (const row of data) {
        sumIn += Number(row.input_tokens ?? 0);
        sumOut += Number(row.output_tokens ?? 0);
        sumAll += Number(row.token_count ?? 0);
      }
      if (sumIn > 0 || sumOut > 0) {
        inputTokensToday = sumIn;
        outputTokensToday = sumOut;
      }
      if (sumAll > totalTokensToday) {
        totalTokensToday = sumAll;
      }
    }
  } catch {
    // Non-critical fallback
  }

  // If token splits are zero but total tokens > 0, estimate 2:1 input:output split
  if (inputTokensToday === 0 && outputTokensToday === 0 && totalTokensToday > 0) {
    inputTokensToday = Math.round(totalTokensToday * (2 / 3));
    outputTokensToday = Math.round(totalTokensToday * (1 / 3));
  }

  // Official Google Gemini standard commercial rates ($0.15 input / $0.60 output per 1M)
  const inputPriceUsdPerMtok = 0.15;
  const outputPriceUsdPerMtok = 0.60;

  // Commercial valuation saved today
  const commercialUsd =
    (inputTokensToday / 1_000_000) * inputPriceUsdPerMtok +
    (outputTokensToday / 1_000_000) * outputPriceUsdPerMtok;
  const commercialValueSavedTodayIdr = Math.round(commercialUsd * usdToIdr);

  // Typical generation estimate (~1,000 input + 500 output tokens)
  const avgGenUsd =
    (1000 / 1_000_000) * inputPriceUsdPerMtok + (500 / 1_000_000) * outputPriceUsdPerMtok;
  const estimatedCostPerGenerateIdr = Math.max(8, Math.round(avgGenUsd * usdToIdr));

  const timing = getGeminiResetCountdown();

  const remaining = Math.max(0, report.capacity - report.used);
  const percentUsed = report.capacity > 0 ? (report.used / report.capacity) * 100 : 0;
  const percentRemaining = report.capacity > 0 ? (remaining / report.capacity) * 100 : 0;

  return {
    activeKeys: report.keys.length,
    capPerKey: report.capPerKey,
    capacity: report.capacity,
    used: report.used,
    remaining,
    usedRatio: report.capacity > 0 ? report.used / report.capacity : 0,
    remainingRatio: report.remainingRatio,
    percentUsed,
    percentRemaining,
    guardEngaged: report.guardEngaged,

    resetScheduleText: timing.resetScheduleText,
    nextResetIso: timing.nextResetIso,
    hoursUntilReset: timing.hoursUntilReset,
    minutesUntilReset: timing.minutesUntilReset,
    countdownText: timing.countdownText,

    isFreeTier: true,
    realCostIdr: 0,
    usdToIdr,
    inputPriceUsdPerMtok,
    outputPriceUsdPerMtok,
    estimatedCostPerGenerateIdr,

    totalTokensToday,
    inputTokensToday,
    outputTokensToday,
    commercialValueSavedTodayIdr,

    keys: report.keys,
    usageError: report.usageError,
  };
}

type Row = {
  key_index: number;
  requests: number;
  errors: number;
  tokens: number;
  last_used_at: string | null;
};

const GUARD_THRESHOLD = 0.2;

export async function getPoolReport(): Promise<PoolReport> {
  const cap = capPerKey();

  // The roster is the environment, not the database. This is the whole point:
  // an unused key must still appear.
  let slots: number[] = [];
  try {
    slots = getPool().map((k) => k.index);
  } catch {
    // No keys configured at all. getPool throws by design; the panel should
    // render that state rather than crash the admin overview.
    slots = [];
  }

  let rows: Row[] = [];
  let usageError: string | null = null;
  try {
    const { data, error } = await createServiceRoleClient().rpc("gemini_pool_report_today");
    // Reading the error is not optional here. A discarded `error` is what made
    // the top-up queue render "empty" with money sitting in it (HANDOFF §4);
    // the same shape of bug would render a busy pool as an idle one.
    if (error) throw error;
    rows = (data ?? []) as Row[];
  } catch (e) {
    usageError = e instanceof Error ? e.message : "Gagal baca pemakaian";
  }

  const byIndex = new Map(rows.map((r) => [r.key_index, r]));

  const keys: KeyReport[] = slots.map((slot) => {
    const r = byIndex.get(slot);
    const requests = Number(r?.requests ?? 0);
    const errors = Number(r?.errors ?? 0);
    const tokens = Number(r?.tokens ?? 0);
    const usedRatio = cap > 0 ? Math.min(1, requests / cap) : 0;

    let health: KeyHealth;
    if (isCooling(slot)) health = "cooling";
    else if (requests === 0) health = "idle";
    else if (requests >= cap) health = "exhausted";
    else if (errors / requests >= 0.2) health = "degraded";
    else health = "healthy";

    return {
      slot,
      requests,
      errors,
      tokens,
      cap,
      usedRatio,
      lastUsedAt: r?.last_used_at ?? null,
      health,
    };
  });

  // Usage from keys no longer configured still counts against nothing, so it is
  // deliberately excluded from `used`: capacity and usage must describe the same
  // set of keys or the ratio is meaningless.
  const used = keys.reduce((s, k) => s + k.requests, 0);
  const capacity = keys.length * cap;
  const remainingRatio = capacity > 0 ? Math.max(0, (capacity - used) / capacity) : 0;

  return {
    keys,
    capPerKey: cap,
    capacity,
    used,
    remainingRatio,
    guardEngaged: capacity > 0 && remainingRatio < GUARD_THRESHOLD,
    usageError,
  };
}

export type ProbeResult = {
  slot: number;
  ok: boolean;
  status: number | null;
  ms: number;
  /** Provider's own message on failure. Never contains the key. */
  message: string | null;
};

/**
 * Calls each configured key once, for real.
 *
 * Usage counters answer "has this key worked recently". They cannot answer "is
 * this key valid right now", which is the question after adding one. Nothing
 * short of a live call distinguishes a brand-new working key from a revoked
 * one — both have zero rows.
 *
 * Deliberately NOT recorded through `recordUsage`: a diagnostic that pollutes
 * the counter it is diagnosing makes the next reading harder to trust. The
 * request does still consume real upstream quota, and the panel says so.
 */
export async function probePool(): Promise<ProbeResult[]> {
  const model = process.env.GEMINI_MODEL_FREE;
  if (!model) {
    return [{ slot: 0, ok: false, status: null, ms: 0, message: "GEMINI_MODEL_FREE belum diset" }];
  }

  let pool: { index: number; value: string }[];
  try {
    pool = getPool();
  } catch (e) {
    return [
      { slot: 0, ok: false, status: null, ms: 0, message: e instanceof Error ? e.message : "No keys" },
    ];
  }

  const adapter = adapterFor("gemini");

  return Promise.all(
    pool.map(async ({ index, value }): Promise<ProbeResult> => {
      const started = Date.now();
      try {
        // Built through the adapter so the probe exercises the same URL, auth
        // header and body shape the product uses. A probe that talks to the
        // provider its own way can pass while the product fails.
        const req = adapter.buildRequest({
          apiKey: value,
          model,
          prompt: "Balas satu kata: oke",
          stream: false,
        });
        const res = await fetch(req.url, {
          method: "POST",
          headers: req.headers,
          body: req.body,
          signal: AbortSignal.timeout(15_000),
        });
        const ms = Date.now() - started;

        if (res.ok) return { slot: index, ok: true, status: res.status, ms, message: null };

        const raw = await res.text().catch(() => "");
        let message = raw.slice(0, 200);
        try {
          message = (JSON.parse(raw) as { error?: { message?: string } })?.error?.message ?? message;
        } catch {
          // Not JSON. The truncated body is still the most useful thing we have.
        }
        return { slot: index, ok: false, status: res.status, ms, message: message.slice(0, 200) };
      } catch (e) {
        return {
          slot: index,
          ok: false,
          status: null,
          ms: Date.now() - started,
          message: e instanceof Error ? e.message : "Gagal konek",
        };
      }
    }),
  );
}
