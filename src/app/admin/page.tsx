import { createServiceRoleClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { GeminiPoolPanel } from "@/components/GeminiPoolPanel";
import { getPoolReport } from "@/lib/gemini/pool-report";

/**
 * Admin overview.
 *
 * Was three full-width stat cards stacked down a phone with `text-4xl` numbers,
 * so the whole viewport carried three integers and you scrolled to reach the
 * quota table — which was itself a `<table>` with `divide-zinc-800`, a cool grey
 * on a warm palette that DESIGN.md rules out.
 *
 * Density is the point on an overview: four stats fit in one glance as a 2×2,
 * quota reads better as bars than as numbers in a row, and the activity feed
 * gives `audit_log` its first surface.
 */

type AuditRow = {
  id: number;
  action: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  "user.ban": "Ban user",
  "user.unban": "Buka ban",
  "user.promote_pro": "Naikin ke Pro",
  "user.demote_free": "Turunin ke Free",
  "user.grant_admin": "Jadiin admin",
  "user.revoke_admin": "Cabut admin",
  "user.delete": "Hapus user",
  "credits.grant": "Tambah kredit",
  "gemini.probe_keys": "Tes key Gemini",
  "voucher.create": "Bikin voucher",
  "voucher.delete": "Hapus voucher",
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "barusan";
  if (mins < 60) return `${mins} menit lalu`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

export default async function AdminDashboardPage() {
  const supabase = createServiceRoleClient();

  const [users, pendingTopups, generations, trends, poolReport, auditRes] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("topups").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("generations").select("*", { count: "exact", head: true }),
    supabase.from("trends").select("*", { count: "exact", head: true }).eq("is_active", true),
    // Roster comes from the environment, usage is joined onto it — so a key
    // that has never been called still gets a row. The old panel rendered
    // straight from the usage table and a configured-but-dead key was simply
    // absent, which is the one thing an operator needs to be able to see.
    getPoolReport(),
    supabase
      .from("audit_log")
      .select("id, action, target_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const audit = (auditRes.data as AuditRow[] | null) ?? [];

  return (
    <div className="space-y-6">
      {/* `topups` is watched by the admin shell, which announces it there — a
          second watcher here would toast the same event twice. */}
      <LiveRefresh tables={["profiles", "generations", "error_log"]} label="Ada aktivitas baru" />

      <header>
        <h1 className="font-display text-xl font-bold text-ink">Ringkasan</h1>
        <p className="mt-1 text-sm text-muted">Kondisi platform hari ini.</p>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="User" value={users.count ?? 0} />
        <Stat label="Topup nunggu" value={pendingTopups.count ?? 0} alert={(pendingTopups.count ?? 0) > 0} />
        <Stat label="Generasi" value={generations.count ?? 0} />
        <Stat
          label="Tren aktif"
          value={trends.count ?? 0}
          alert={(trends.count ?? 0) === 0}
          note={(trends.count ?? 0) === 0 ? "Prompt jalan tanpa konteks tren" : undefined}
        />
      </div>

      <GeminiPoolPanel report={poolReport} />

      <section>
        <h2 className="eyebrow mb-2 text-muted">Aktivitas admin</h2>
        {audit.length === 0 ? (
          <p className="rounded-xl border border-dashed border-hairline px-4 py-6 text-center text-xs text-muted">
            Belum ada aksi admin yang tercatat.
          </p>
        ) : (
          <ol className="overflow-hidden rounded-xl border border-hairline bg-surface">
            {audit.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 border-b border-hairline px-3.5 py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink">
                    {ACTION_LABEL[a.action] ?? a.action}
                  </p>
                  <p className="truncate text-micro text-muted">
                    {typeof a.metadata?.reason === "string"
                      ? String(a.metadata.reason)
                      : typeof a.metadata?.email === "string"
                        ? String(a.metadata.email)
                        : (a.target_id ?? "").slice(0, 8)}
                  </p>
                </div>
                <span className="shrink-0 text-micro text-muted">{timeAgo(a.created_at)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
  note,
}: {
  label: string;
  value: number;
  alert?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-surface p-3.5 ${
        alert ? "border-ember/35" : "border-hairline"
      }`}
    >
      <p className="eyebrow text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${alert ? "text-ember" : "text-ink"}`}>
        {value}
      </p>
      {note && <p className="mt-1 text-micro leading-snug text-muted">{note}</p>}
    </div>
  );
}
