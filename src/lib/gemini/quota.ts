import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getPool } from "./keys";

/**
 * The quota guard.
 *
 * AGENTS.md section 3: when the pool drops below 20% remaining, serve paid and
 * BYOK users only, and show free users a clear message with a top-up path.
 *
 * Gemini does not report remaining quota, so "remaining" is inferred: recorded
 * usage against GEMINI_DAILY_CAP_PER_KEY. That number is an assumption, not a
 * fact — tune it once real 429s are observed in gemini_usage.error_count.
 *
 * Timing gotcha, and it is the reason this guard exists at all: Gemini's daily
 * quota resets at midnight Pacific, roughly 14:00 WIB. Indonesian prime time
 * (19:00-23:00 WIB) therefore always runs on a partly-consumed pool. But
 * gemini_usage.usage_date is a UTC date, so the counter and the real quota
 * window are offset by a few hours. The guard is deliberately conservative
 * rather than exact.
 */

export const GUARD_THRESHOLD = 0.2;

export type PoolStatus = {
  capacity: number;
  used: number;
  remainingRatio: number;
  /** True when free users must be turned away. */
  guardEngaged: boolean;
};

export async function getPoolStatus(): Promise<PoolStatus> {
  const capPerKey = Number(process.env.GEMINI_DAILY_CAP_PER_KEY ?? 1000);
  const capacity = getPool().length * capPerKey;

  let used = 0;
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("gemini_pool_used_today");
    if (error) throw error;
    used = (data ?? []).reduce(
      (sum: number, row: { requests: number }) => sum + Number(row.requests ?? 0),
      0,
    );
  } catch {
    // If the counter is unreadable, do NOT engage the guard. A broken metrics
    // table must not take the product offline for free users; it degrades to
    // the pre-guard behaviour, which is the status quo, not an outage.
    return { capacity, used: 0, remainingRatio: 1, guardEngaged: false };
  }

  const remainingRatio = capacity > 0 ? Math.max(0, (capacity - used) / capacity) : 0;
  return {
    capacity,
    used,
    remainingRatio,
    guardEngaged: remainingRatio < GUARD_THRESHOLD,
  };
}

export type Caller = { isPro: boolean; hasByok: boolean };

/**
 * Whether this caller may use the shared pool right now.
 *
 * BYOK users are never blocked — they are not spending our quota at all.
 */
export async function checkPoolAdmission(
  caller: Caller,
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  if (caller.hasByok) return { allowed: true };

  const status = await getPoolStatus();
  if (!status.guardEngaged || caller.isPro) return { allowed: true };

  // Brand voice: say what broke and what to do. Never apologise. DESIGN.md §6.
  return {
    allowed: false,
    message:
      "Kuota harian lagi menipis, jadi sekarang giliran user berbayar dulu. Balik lagi abis jam 2 siang pas kuota reset, atau top up biar gak kena antrian.",
  };
}

export async function recordUsage(args: {
  keyIndex: number;
  model: string;
  tokens?: number;
  isError?: boolean;
  /** Why it failed. Counted errors with no cause cannot be acted on. */
  errorMessage?: string;
  status?: number;
  module?: string;
}): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    await supabase.rpc("record_gemini_usage", {
      p_key_index: args.keyIndex,
      p_model: args.model,
      p_tokens: args.tokens ?? 0,
      p_is_error: args.isError ?? false,
    });

    if (args.isError) {
      await supabase.from("error_log").insert({
        scope: "gemini",
        module: args.module ?? null,
        key_index: args.keyIndex,
        model: args.model,
        status: args.status ?? null,
        message: (args.errorMessage ?? "unknown Gemini error").slice(0, 2000),
      });
    }
  } catch {
    // Accounting must never fail a generation the user already paid for.
    // Undercounting is recoverable; a failed paid request is not.
  }
}
