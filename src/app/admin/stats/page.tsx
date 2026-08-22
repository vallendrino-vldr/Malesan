import { createServiceRoleClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ProfitPanel, type ProfitDay } from "@/components/ProfitPanel";
import { isPriced } from "@/lib/ai/cost";
import type { ModelRow } from "@/lib/ai/types";
import { jakartaDayKey, lastJakartaDays, startOfJakartaDay } from "@/lib/time";

/**
 * Analytics.
 *
 * Charts are hand-rolled SVG on purpose: a charting library would be the
 * heaviest dependency in the project for four small plots, and DESIGN.md
 * already rules out heavy client work for mid-range Android. Bars are divs, the
 * trend line is one `<polyline>`.
 *
 * Aggregation happens in JS rather than SQL because the row counts here are in
 * the hundreds. If `generations` ever passes ~50k rows, move these to a
 * `date_trunc` RPC — scanning every row into memory will stop being free.
 */

const DAYS = 14;

type DayBucket = { day: string; gens: number; credits: number };

type UserActivity = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_pro: boolean;
  is_banned: boolean;
  credits_total: number;
  generations: number;
  credits_spent: number;
  modules_used: string[] | null;
  last_active: string | null;
  joined: string;
};

export default async function AdminStatsPage() {
  const supabase = createServiceRoleClient();
  const since = new Date(startOfJakartaDay().getTime() - (DAYS - 1) * 86_400_000);
  const sinceIso = since.toISOString();

  const [gensRes, usageRes, ledgerRes, activityRes, topupRes, modelsRes] = await Promise.all([
    supabase
      .from("generations")
      .select("created_at, module, credits_spent")
      .gte("created_at", sinceIso)
      .limit(5000),
    supabase
      .from("ai_usage_log")
      .select(
        "provider_id, provider_slug, model_id, ref_id, status, created_at, input_tokens, output_tokens, cost_idr",
      )
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("credit_ledger").select("delta, created_at").gte("created_at", sinceIso).limit(5000),
    supabase.rpc("admin_user_activity", { p_days: DAYS }),
    // Revenue is dated by review, not by submission: a top-up only becomes money
    // on the day it was approved.
    supabase
      .from("topups")
      .select("amount_idr, reviewed_at")
      .eq("status", "approved")
      .gte("reviewed_at", sinceIso)
      .limit(5000),
    supabase
      .from("ai_models")
      .select(
        "provider_id, model_id, pricing_mode, input_price_usd_per_mtok, output_price_usd_per_mtok, package_price_idr, package_tokens",
      ),
  ]);

  const gens = (gensRes.data ?? []) as { created_at: string; module: string; credits_spent: number }[];
  const usage = (usageRes.data ?? []) as {
    provider_id: string | null;
    provider_slug: string | null;
    model_id: string | null;
    ref_id: string | null;
    status: string;
    created_at: string;
    input_tokens: number;
    output_tokens: number;
    cost_idr: number;
  }[];
  const ledger = (ledgerRes.data ?? []) as { delta: number; created_at: string }[];
  const activity = (activityRes.data ?? []) as UserActivity[];
  const topups = (topupRes.data ?? []) as { amount_idr: number; reviewed_at: string | null }[];

  const days = lastJakartaDays(DAYS);
  const buckets: Record<string, DayBucket> = Object.fromEntries(
    days.map((d) => [d, { day: d, gens: 0, credits: 0 }]),
  );

  for (const g of gens) {
    const k = jakartaDayKey(g.created_at);
    if (buckets[k]) {
      buckets[k].gens += 1;
      buckets[k].credits += g.credits_spent ?? 0;
    }
  }

  const series = days.map((d) => buckets[d]);
  const maxGens = Math.max(1, ...series.map((s) => s.gens));

  // Per-module split over the window.
  const byModule = gens.reduce<Record<string, number>>((acc, g) => {
    acc[g.module] = (acc[g.module] ?? 0) + 1;
    return acc;
  }, {});
  const moduleRows = Object.entries(byModule).sort((a, b) => b[1] - a[1]);
  const maxModule = Math.max(1, ...moduleRows.map(([, n]) => n));

  // Attempt rows share one ref across fallback. Count the customer's request,
  // not every provider tried, and only call it failed when none answered.
  const requests = new Map<string, { ok: boolean; failed: boolean }>();
  usage.forEach((row, index) => {
    const key = row.ref_id ?? `legacy:${row.created_at}:${index}`;
    const current = requests.get(key) ?? { ok: false, failed: false };
    if (row.status === "ok") current.ok = true;
    if (row.status === "error" || row.status === "fallback") current.failed = true;
    requests.set(key, current);
  });
  const totalReq = requests.size;
  const totalErr = [...requests.values()].filter((request) => !request.ok && request.failed).length;
  const errRate = totalReq ? ((totalErr / totalReq) * 100).toFixed(1) : "0.0";

  const spent = ledger.filter((l) => l.delta < 0).reduce((a, l) => a + Math.abs(l.delta), 0);
  const granted = ledger.filter((l) => l.delta > 0).reduce((a, l) => a + l.delta, 0);

  // Money, per day. Three tables that agree on nothing except the calendar, so
  // they are bucketed separately and joined on the date string.
  const profit: Record<string, ProfitDay> = Object.fromEntries(
    days.map((d) => [d, { day: d, revenue: 0, cost: 0, credits: 0, untracked: false }]),
  );

  const models = (modelsRes.data ?? []) as Pick<
    ModelRow,
    | "provider_id"
    | "model_id"
    | "pricing_mode"
    | "input_price_usd_per_mtok"
    | "output_price_usd_per_mtok"
    | "package_price_idr"
    | "package_tokens"
  >[];
  const byExactModel = new Map(models.map((model) => [`${model.provider_id}:${model.model_id}`, model]));
  const modelCounts = new Map<string, number>();
  models.forEach((model) => modelCounts.set(model.model_id, (modelCounts.get(model.model_id) ?? 0) + 1));
  const byUniqueModel = new Map(
    models.filter((model) => modelCounts.get(model.model_id) === 1).map((model) => [model.model_id, model]),
  );

  for (const u of usage) {
    const k = jakartaDayKey(u.created_at);
    const row = profit[k];
    if (!row) continue;
    const tin = u.input_tokens ?? 0;
    const tout = u.output_tokens ?? 0;
    row.cost += Number(u.cost_idr ?? 0);
    if (u.status !== "ok" || u.provider_slug === "byok") continue;
    const model = u.model_id
      ? (u.provider_id ? byExactModel.get(`${u.provider_id}:${u.model_id}`) : undefined) ??
        byUniqueModel.get(u.model_id)
      : undefined;
    if (tin + tout === 0 || !model || !isPriced(model)) row.untracked = true;
  }

  for (const l of ledger) {
    if (l.delta >= 0) continue;
    const row = profit[jakartaDayKey(l.created_at)];
    if (row) row.credits += Math.abs(l.delta);
  }

  for (const t of topups) {
    if (!t.reviewed_at) continue;
    const row = profit[jakartaDayKey(t.reviewed_at)];
    if (row) row.revenue += t.amount_idr ?? 0;
  }

  const profitDays = days.map((d) => profit[d]);

  // A dropped error here would render as Rp0 across the board, which on a profit
  // panel reads as "no sales" instead of "the query broke". Say which.
  const profitError =
    topupRes.error?.message ??
    usageRes.error?.message ??
    ledgerRes.error?.message ??
    modelsRes.error?.message ??
    null;
  const pricingKnown = !profitDays.some((day) => day.untracked);

  return (
    <div className="space-y-6">
      <LiveRefresh
        tables={["generations", "profiles", "topups"]}
        label="Data baru masuk"
        pollMs={30_000}
      />

      <header>
        <h1 className="font-display text-xl font-bold text-ink">Grafik</h1>
        <p className="mt-1 text-sm text-muted">{DAYS} hari terakhir.</p>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <Kpi label="Generasi" value={gens.length} />
        <Kpi label="Kredit kepakai" value={spent} />
        <Kpi label="Kredit dikasih" value={granted} />
        <Kpi
          label="Error rate"
          value={`${errRate}%`}
          alert={Number(errRate) > 5}
          note={`${totalErr} dari ${totalReq} request`}
        />
      </div>

      <ProfitPanel days={profitDays} pricingKnown={pricingKnown} error={profitError} />

      <section>
        <h2 className="eyebrow mb-2 text-muted">Generasi per hari</h2>
        <div className="rounded-xl border border-hairline bg-surface p-3">
          <div className="flex h-28 items-end gap-[3px]">
            {series.map((s) => (
              <div key={s.day} className="group relative flex-1">
                <div
                  className="w-full rounded-sm bg-ember/80 transition-colors group-hover:bg-ember"
                  style={{ height: `${Math.max(2, (s.gens / maxGens) * 100)}%` }}
                  title={`${s.day}: ${s.gens} generasi`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-micro text-muted">
            <span>{series[0]?.day.slice(5)}</span>
            <span className="font-mono text-ember">puncak {maxGens}</span>
            <span>{series[series.length - 1]?.day.slice(5)}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="eyebrow mb-2 text-muted">Modul paling kepakai</h2>
        {moduleRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-hairline px-4 py-6 text-center text-xs text-muted">
            Belum ada generasi dalam {DAYS} hari terakhir.
          </p>
        ) : (
          <div className="space-y-1.5 rounded-xl border border-hairline bg-surface p-3">
            {moduleRows.map(([m, n]) => (
              <div key={m}>
                <div className="flex items-baseline justify-between text-mini">
                  <span className="text-ink">{m}</span>
                  <span className="font-mono text-muted">{n}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-obsidian">
                  <div
                    className="h-full bg-ember"
                    style={{ width: `${Math.max(3, (n / maxModule) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Who is actually using this, and for what. The panel could show a user
          list and a global generation count but nothing joining the two, so
          there was no way to tell an active user from a dormant one. */}
      <section>
        <h2 className="eyebrow mb-2 text-muted">Aktivitas user · {DAYS} hari</h2>
        {activity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-hairline px-4 py-6 text-center text-xs text-muted">
            Belum ada user.
          </p>
        ) : (
          <div className="space-y-2">
            {activity.map((u) => (
              <div key={u.user_id} className="surface-card rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {u.display_name || u.email}
                    </p>
                    <p className="truncate text-micro text-muted">{u.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm text-ember">{u.generations}</p>
                    <p className="eyebrow text-muted">generate</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {u.role === "admin" && (
                    <span className="rounded bg-ember/15 px-2 py-0.5 text-micro text-ember">
                      Admin
                    </span>
                  )}
                  {u.is_banned && (
                    <span className="rounded bg-danger/10 px-2 py-0.5 text-micro text-danger">
                      Banned
                    </span>
                  )}
                  <span
                    className={`rounded px-2 py-0.5 text-micro ${
                      u.is_pro ? "bg-success/10 text-success" : "bg-surface-raised text-muted"
                    }`}
                  >
                    {u.is_pro ? "Pro" : "Free"}
                  </span>
                  {(u.modules_used ?? []).map((m) => (
                    <span
                      key={m}
                      className="rounded bg-obsidian px-2 py-0.5 text-micro text-muted"
                    >
                      {m}
                    </span>
                  ))}
                </div>

                <p className="mt-2 flex flex-wrap gap-x-3 text-micro text-muted">
                  <span>
                    Kredit kepakai:{" "}
                    <span className="font-mono text-ink">{u.credits_spent}</span>
                  </span>
                  <span>
                    Sisa: <span className="font-mono text-ink">{u.credits_total}</span>
                  </span>
                  <span>
                    Terakhir aktif:{" "}
                    <span className="text-ink">
                      {u.last_active
                        ? new Date(u.last_active).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "belum pernah"}
                    </span>
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-micro leading-relaxed text-muted">
        Dihitung dari maksimal 5.000 baris terakhir per tabel. Kalau angkanya
        udah mentok segitu, pindahin agregasinya ke SQL.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  alert,
  note,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
  note?: string;
}) {
  return (
    <div className={`rounded-xl border bg-surface p-3.5 ${alert ? "border-danger/40" : "border-hairline"}`}>
      <p className="eyebrow text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${alert ? "text-danger" : "text-ink"}`}>
        {value}
      </p>
      {note && <p className="mt-1 text-micro leading-snug text-muted">{note}</p>}
    </div>
  );
}
