import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * One read of everything an operator would otherwise open seven tabs to see.
 *
 * The admin panel answers "what is the number" per screen. It does not answer
 * "what should I deal with right now", which is the question actually being
 * asked when someone opens it — and answering that means holding the top-up
 * queue, the error log, the quota and the user list in your head at once.
 *
 * This is the shape handed to the assistant. Deliberately small: counts,
 * aggregates and a handful of rows, never full tables. A snapshot that grows
 * with the database would stop fitting in a prompt exactly when the platform
 * gets big enough to need one.
 */

export type Snapshot = {
  takenAt: string;
  users: { total: number; pro: number; banned: number; newLast7d: number };
  topups: {
    pending: number;
    pendingRows: {
      id: string;
      email: string;
      amountIdr: number;
      credits: number;
      verdict: string;
      flags: string[];
      waitingHours: number;
    }[];
    approvedLast30d: number;
    revenueLast30dIdr: number;
  };
  generations: { last7d: number; last24h: number; byModule: Record<string, number> };
  errors: { last24h: number; topMessages: { message: string; count: number }[] };
  quota: { keyIndex: number; requests: number; errors: number }[];
  vouchers: { active: number; redeemed: number };
  trends: { active: number; newestCapturedAt: string | null };
  config: { model: string | null; provider: string | null; bankConfigured: boolean };
};

const hoursSince = (iso: string) =>
  Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 36e5));

export async function buildSnapshot(): Promise<Snapshot> {
  const db = createServiceRoleClient();
  const now = Date.now();
  const since = (days: number) => new Date(now - days * 864e5).toISOString();

  const [
    profiles,
    pendingTopups,
    approvedTopups,
    gens7d,
    gens24h,
    errs,
    quota,
    vouchers,
    trends,
    cfg,
  ] = await Promise.all([
    db.from("profiles").select("id, is_pro, is_banned, created_at"),
    db
      .from("topups")
      .select("id, amount_idr, credits, created_at, check_verdict, check_detail, profiles!topups_user_id_fkey(email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    db.from("topups").select("amount_idr").eq("status", "approved").gte("created_at", since(30)),
    db.from("generations").select("module, created_at").gte("created_at", since(7)),
    db.from("generations").select("id", { count: "exact", head: true }).gte("created_at", since(1)),
    db.from("error_log").select("message, created_at").gte("created_at", since(1)).limit(200),
    db.rpc("gemini_pool_used_today"),
    db.from("vouchers").select("is_redeemed"),
    db.from("trends").select("captured_at, is_active").eq("is_active", true).order("captured_at", { ascending: false }).limit(1),
    db.from("app_config").select("key, value"),
  ]);

  const people = profiles.data ?? [];
  const gens = gens7d.data ?? [];
  const byModule: Record<string, number> = {};
  for (const g of gens) byModule[g.module] = (byModule[g.module] ?? 0) + 1;

  // Group identical error text so one recurring failure reads as one problem
  // rather than as forty.
  const msgCount: Record<string, number> = {};
  for (const e of errs.data ?? []) {
    const key = String(e.message).slice(0, 120);
    msgCount[key] = (msgCount[key] ?? 0) + 1;
  }
  const topMessages = Object.entries(msgCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([message, count]) => ({ message, count }));

  const conf = Object.fromEntries((cfg.data ?? []).map((r) => [r.key, r.value]));
  const vouchersAll = vouchers.data ?? [];

  return {
    takenAt: new Date().toISOString(),
    users: {
      total: people.length,
      pro: people.filter((p) => p.is_pro).length,
      banned: people.filter((p) => p.is_banned).length,
      newLast7d: people.filter((p) => p.created_at >= since(7)).length,
    },
    topups: {
      pending: (pendingTopups.data ?? []).length,
      pendingRows: (pendingTopups.data ?? []).map((t) => {
        const detail = t.check_detail as { flags?: string[] } | null;
        const prof = t.profiles as unknown as { email?: string } | null;
        return {
          id: t.id,
          email: prof?.email ?? "—",
          amountIdr: t.amount_idr,
          credits: t.credits,
          verdict: t.check_verdict ?? "unchecked",
          flags: detail?.flags ?? [],
          waitingHours: hoursSince(t.created_at),
        };
      }),
      approvedLast30d: (approvedTopups.data ?? []).length,
      revenueLast30dIdr: (approvedTopups.data ?? []).reduce((s, r) => s + (r.amount_idr ?? 0), 0),
    },
    generations: { last7d: gens.length, last24h: gens24h.count ?? 0, byModule },
    errors: { last24h: (errs.data ?? []).length, topMessages },
    quota: (quota.data as { key_index: number; requests: number; errors: number }[] | null ?? []).map(
      (q) => ({ keyIndex: q.key_index, requests: q.requests, errors: q.errors }),
    ),
    vouchers: {
      active: vouchersAll.filter((v) => !v.is_redeemed).length,
      redeemed: vouchersAll.filter((v) => v.is_redeemed).length,
    },
    trends: {
      active: (trends.data ?? []).length,
      newestCapturedAt: trends.data?.[0]?.captured_at ?? null,
    },
    config: {
      model: typeof conf.model_pro === "string" ? conf.model_pro : null,
      provider: typeof conf.ai_provider === "string" ? conf.ai_provider : null,
      bankConfigured: Boolean(conf.bank_account_number),
    },
  };
}
