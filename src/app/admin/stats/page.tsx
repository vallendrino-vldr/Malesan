import { createServiceRoleClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";

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

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default async function AdminStatsPage() {
  const supabase = createServiceRoleClient();
  const since = new Date();
  since.setDate(since.getDate() - DAYS);
  const sinceIso = since.toISOString();

  const [gensRes, usageRes, ledgerRes, activityRes] = await Promise.all([
    supabase
      .from("generations")
      .select("created_at, module, credits_spent")
      .gte("created_at", sinceIso)
      .limit(5000),
    // Column names verified against information_schema before writing this —
    // they are `request_count`/`error_count`/`usage_date`, not the plurals you
    // would guess, and the ledger column is `delta`, not `amount`.
    supabase
      .from("gemini_usage")
      .select("key_index, request_count, error_count, usage_date")
      .gte("usage_date", sinceIso.slice(0, 10)),
    supabase.from("credit_ledger").select("delta, created_at").gte("created_at", sinceIso).limit(5000),
    supabase.rpc("admin_user_activity", { p_days: DAYS }),
  ]);

  const gens = (gensRes.data ?? []) as { created_at: string; module: string; credits_spent: number }[];
  const usage = (usageRes.data ?? []) as {
    key_index: number;
    request_count: number;
    error_count: number;
  }[];
  const ledger = (ledgerRes.data ?? []) as { delta: number; created_at: string }[];
  const activity = (activityRes.data ?? []) as UserActivity[];

  const days = lastNDays(DAYS);
  const buckets: Record<string, DayBucket> = Object.fromEntries(
    days.map((d) => [d, { day: d, gens: 0, credits: 0 }]),
  );

  for (const g of gens) {
    const k = g.created_at.slice(0, 10);
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

  const totalReq = usage.reduce((a, u) => a + (u.request_count ?? 0), 0);
  const totalErr = usage.reduce((a, u) => a + (u.error_count ?? 0), 0);
  const errRate = totalReq ? ((totalErr / totalReq) * 100).toFixed(1) : "0.0";

  const spent = ledger.filter((l) => l.delta < 0).reduce((a, l) => a + Math.abs(l.delta), 0);
  const granted = ledger.filter((l) => l.delta > 0).reduce((a, l) => a + l.delta, 0);

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["generations", "profiles"]} label="Data baru masuk" />

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
          <div className="mt-2 flex justify-between text-[10px] text-muted">
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
                <div className="flex items-baseline justify-between text-[11.5px]">
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
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {u.display_name || u.email}
                    </p>
                    <p className="truncate text-[11px] text-muted">{u.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm text-ember">{u.generations}</p>
                    <p className="eyebrow text-muted">generate</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {u.role === "admin" && (
                    <span className="rounded bg-ember/15 px-2 py-0.5 text-[10px] text-ember">
                      Admin
                    </span>
                  )}
                  {u.is_banned && (
                    <span className="rounded bg-danger/10 px-2 py-0.5 text-[10px] text-danger">
                      Banned
                    </span>
                  )}
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] ${
                      u.is_pro ? "bg-success/10 text-success" : "bg-surface-raised text-muted"
                    }`}
                  >
                    {u.is_pro ? "Pro" : "Free"}
                  </span>
                  {(u.modules_used ?? []).map((m) => (
                    <span
                      key={m}
                      className="rounded bg-obsidian px-2 py-0.5 text-[10px] text-muted"
                    >
                      {m}
                    </span>
                  ))}
                </div>

                <p className="mt-2 flex flex-wrap gap-x-3 text-[10.5px] text-muted">
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

      <p className="text-[11px] leading-relaxed text-muted">
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
      {note && <p className="mt-1 text-[10.5px] leading-snug text-muted">{note}</p>}
    </div>
  );
}
