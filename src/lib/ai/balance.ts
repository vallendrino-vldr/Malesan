import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { authHeaders } from "./discovery";
import { resolveProviderKey } from "./registry";
import { daysRemaining } from "./cost";
import type { ProviderRow } from "./types";
import { assertSafeOutboundUrl } from "@/lib/security/outbound-url";

/**
 * Prepaid balance monitoring.
 *
 * Gateways like SumoPod sell credit up front, and the failure mode when it runs
 * out is the worst one this product has: every generation starts failing at once
 * with an authentication-shaped error, and nothing in the system says why. A
 * balance reading turns that from an outage into a number the owner saw coming.
 *
 * There is no standard for this endpoint — no shared path, no shared field name,
 * not even a shared unit. So the provider row carries both the URL and a dotted
 * path into the response, and neither is guessed.
 */

/**
 * Walk a dotted path into a parsed JSON body. Supports array indices:
 * "data.0.balance". Returns undefined rather than throwing, because a shape
 * that does not match is a configuration problem to report, not a crash.
 */
function pluck(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((acc, part) => {
      if (acc === null || acc === undefined) return undefined;
      if (Array.isArray(acc)) return acc[Number(part)];
      if (typeof acc === "object") return (acc as Record<string, unknown>)[part];
      return undefined;
    }, obj);
}

/**
 * Find a balance in a response whose shape was not configured.
 *
 * A fallback for the common case where the owner pasted a URL and no path. Tries
 * the field names these APIs actually use, at the top level and one level down.
 * Explicitly a convenience — `balance_path` is the correct answer and this is
 * what stops the feature from being useless without it.
 */
const COMMON_KEYS = ["balance", "credits", "credit", "amount", "remaining", "total_credits"];

function guessAmount(body: unknown): number | undefined {
  const tryObj = (o: unknown): number | undefined => {
    if (!o || typeof o !== "object") return undefined;
    for (const k of COMMON_KEYS) {
      const v = (o as Record<string, unknown>)[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && Number.isFinite(Number(v))) return Number(v);
    }
    return undefined;
  };
  return tryObj(body) ?? tryObj((body as { data?: unknown })?.data);
}

export type BalanceReading = {
  amount: number | null;
  currency: string;
  raw: unknown;
  low: boolean;
  checkedAt: string;
};

/**
 * Read one provider's balance and record it.
 *
 * Never throws: a provider without a balance endpoint, or with a broken one,
 * must not break the dashboard it is rendered on. An unreadable balance is
 * reported as `null`, which the UI shows as "gak kebaca" rather than as zero —
 * a balance that silently reads zero would trigger a false alarm every time the
 * endpoint hiccups.
 */
export async function checkBalance(provider: ProviderRow): Promise<BalanceReading | null> {
  if (!provider.balance_url?.trim()) return null;

  const checkedAt = new Date().toISOString();

  try {
    const key = resolveProviderKey(provider);
    // The env pool has no single key; a balance endpoint on it makes no sense
    // anyway, since the free tier has no prepaid balance to read.
    if (!key) return null;

    const balanceUrl = await assertSafeOutboundUrl(provider.balance_url.trim(), "Balance URL");
    const res = await fetch(balanceUrl, {
      method: "GET",
      headers: authHeaders(provider.protocol, key),
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        amount: null,
        currency: provider.balance_currency,
        raw: { error: `${res.status} ${body.slice(0, 200)}` },
        low: false,
        checkedAt,
      };
    }

    const body = await res.json();
    const picked = provider.balance_path?.trim()
      ? pluck(body, provider.balance_path.trim())
      : guessAmount(body);

    const amount =
      typeof picked === "number" && Number.isFinite(picked)
        ? picked
        : typeof picked === "string" && Number.isFinite(Number(picked))
          ? Number(picked)
          : null;

    const reading: BalanceReading = {
      amount,
      currency: provider.balance_currency,
      raw: body,
      low:
        amount !== null &&
        provider.low_balance_threshold !== null &&
        amount <= Number(provider.low_balance_threshold),
      checkedAt,
    };

    // History, not a current value: two readings is the minimum to say anything
    // about burn rate, and burn rate is the only part an owner can act on.
    try {
      await createServiceRoleClient().from("ai_provider_balance").insert({
        provider_id: provider.id,
        amount,
        currency: provider.balance_currency,
        raw: body as never,
        checked_at: checkedAt,
      });
    } catch (e) {
      console.error("balance history write failed", provider.slug, e);
    }

    return reading;
  } catch (e) {
    return {
      amount: null,
      currency: provider.balance_currency,
      raw: { error: e instanceof Error ? e.message : "gagal" },
      low: false,
      checkedAt,
    };
  }
}

export type BalanceTrend = {
  latest: number | null;
  currency: string;
  burnPerDay: number | null;
  daysLeft: number | null;
  checkedAt: string | null;
};

/**
 * Burn rate from the recorded history.
 *
 * Uses the oldest and newest readings inside the window rather than adjacent
 * pairs: top-ups appear as a jump upward, and averaging across them is what
 * keeps one refill from reading as negative burn forever. A window that contains
 * a top-up simply reports no burn rather than a wrong one.
 */
export async function balanceTrend(providerId: string, days = 7): Promise<BalanceTrend> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await createServiceRoleClient()
    .from("ai_provider_balance")
    .select("amount, currency, checked_at")
    .eq("provider_id", providerId)
    .gte("checked_at", since)
    .order("checked_at", { ascending: true });

  const rows = (data ?? []).filter((r) => r.amount !== null) as {
    amount: number;
    currency: string | null;
    checked_at: string;
  }[];

  if (rows.length === 0) {
    return { latest: null, currency: "USD", burnPerDay: null, daysLeft: null, checkedAt: null };
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  const spanDays =
    (new Date(last.checked_at).getTime() - new Date(first.checked_at).getTime()) / 86_400_000;

  const dropped = Number(first.amount) - Number(last.amount);
  const burnPerDay = spanDays > 0.5 && dropped > 0 ? dropped / spanDays : null;

  return {
    latest: Number(last.amount),
    currency: last.currency ?? "USD",
    burnPerDay,
    daysLeft: burnPerDay ? daysRemaining(Number(last.amount), burnPerDay) : null,
    checkedAt: last.checked_at,
  };
}
