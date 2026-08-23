import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { AiHealthCard } from "@/components/AiHealthCard";
import { startOfJakartaDay } from "@/lib/time";

/**
 * Founder Dashboard — Pusat Kendali Owner
 *
 * Dirancang khusus untuk Founder/Owner SaaS:
 * - Finansial real: Pendapatan hari ini, biaya AI riil, margin/keuntungan bersih
 * - Metrik kunci: User aktif, konten dibuat, topup menunggu, error 24 jam
 * - Health check: Kondisi AI Brain & provider
 * - Aktivitas user nyata: Siapa bikin konten apa, di platform mana, berhasil/gagal
 * - Action items: Isu yang butuh tindakan owner segera (topup pending, error)
 */

type AuditRow = {
  id: number;
  action: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type RecentErrorRow = {
  id: number;
  endpoint: string;
  error_type: string;
  message: string;
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

const MODULE_NAMES: Record<string, string> = {
  ide_hari_ini: "Ide Hari Ini",
  idea: "Matengin Ide",
  hook: "Bikin Hook",
  script: "Bikin Script",
  repurpose: "Ubah Format",
  vibe_kit: "Bikin App",
  clip: "Potong Momen",
  thread: "Bikin Thread",
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "barusan";
  if (mins < 60) return `${mins}m lalu`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
}

function formatRp(amount: number) {
  return "Rp " + Math.round(amount).toLocaleString("id-ID");
}

function maskEmail(email: string) {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 3 ? name.slice(0, 3) + "..." : name;
  return `${maskedName}@${domain}`;
}

export const dynamic = "force-dynamic";

function get24HoursAgoIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export default async function AdminDashboardPage() {
  const supabase = createServiceRoleClient();
  const todayIso = startOfJakartaDay().toISOString();
  const last24hIso = get24HoursAgoIso();

  const [
    usersTotalRes,
    usersProRes,
    pendingTopupsRes,
    todayApprovedTopupsRes,
    todayAiUsageRes,
    generationsTotalRes,
    todayGensRes,
    errors24hRes,
    recentErrorsRes,
    auditRes,
    pendingFeedbacksRes,
    recentUsageLogsRes,
  ] = await Promise.all([
    // Total registered users
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    // Pro users count
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_pro", true),
    // Pending top-ups
    supabase.from("topups").select("*", { count: "exact", head: true }).eq("status", "pending"),
    // Today revenue from approved topups (WIB)
    supabase.from("topups").select("amount_idr").eq("status", "approved").gte("reviewed_at", todayIso),
    // Today AI usage & cost (WIB)
    supabase.from("ai_usage_log").select("cost_idr, user_id, status").gte("created_at", todayIso),
    // Total generations
    supabase.from("generations").select("*", { count: "exact", head: true }),
    // Today generations
    supabase.from("generations").select("*", { count: "exact", head: true }).gte("created_at", todayIso),
    // Errors in last 24h
    supabase.from("error_log").select("*", { count: "exact", head: true }).gte("created_at", last24hIso),
    // Recent 5 errors
    supabase
      .from("error_log")
      .select("id, endpoint, error_type, message, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    // Recent 6 admin audits
    supabase
      .from("audit_log")
      .select("id, action, target_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    // Pending user feedbacks
    (supabase.from("user_feedback" as "profiles") as unknown as {
      select: (cols: string, opts: { count: string; head: boolean }) => {
        eq: (col: string, val: string) => Promise<{ count: number | null }>;
      };
    })
      .select("*", { count: "exact", head: true })
      .eq("status", "baru"),
    // Recent 12 AI usage attempts (success and failure logs)
    supabase
      .from("ai_usage_log")
      .select("id, feature, status, error_message, cost_idr, credits_charged, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  // Calculations
  const totalUsers = usersTotalRes.count ?? 0;
  const proUsers = usersProRes.count ?? 0;
  const pendingTopups = pendingTopupsRes.count ?? 0;
  const totalGenerations = generationsTotalRes.count ?? 0;
  const todayGenerations = todayGensRes.count ?? 0;
  const errors24h = errors24hRes.count ?? 0;
  const pendingFeedbacks = pendingFeedbacksRes?.count ?? 0;

  // Financials today
  const todayApprovedTopups = (todayApprovedTopupsRes.data ?? []) as { amount_idr: number }[];
  const todayRevenue = todayApprovedTopups.reduce((acc, t) => acc + (t.amount_idr || 0), 0);

  const todayAiUsage = (todayAiUsageRes.data ?? []) as { cost_idr: number; user_id: string | null; status: string }[];
  const todayAiCost = todayAiUsage.reduce((acc, u) => acc + (u.cost_idr || 0), 0);
  const todayMargin = todayRevenue > 0 ? ((todayRevenue - todayAiCost) / todayRevenue) * 100 : 0;
  const netProfit = todayRevenue - todayAiCost;

  // Success rate today
  const todaySuccesses = todayAiUsage.filter((u) => u.status === "success").length;
  const successRate = todayAiUsage.length > 0 ? Math.round((todaySuccesses / todayAiUsage.length) * 100) : 100;

  // Active users today
  const activeUserSet = new Set<string>();
  for (const u of todayAiUsage) {
    if (u.user_id) activeUserSet.add(u.user_id);
  }
  const activeUsersToday = activeUserSet.size;

  const recentErrors = (recentErrorsRes.data as RecentErrorRow[] | null) ?? [];
  const audit = (auditRes.data as AuditRow[] | null) ?? [];

  const recentUsageLogs = (recentUsageLogsRes.data ?? []) as {
    id: number;
    feature: string;
    status: string;
    error_message: string | null;
    cost_idr: number;
    credits_charged: number;
    user_id: string | null;
    created_at: string;
  }[];

  const usageUserIds = Array.from(new Set(recentUsageLogs.map((u) => u.user_id).filter(Boolean) as string[]));
  const { data: usageProfiles } = usageUserIds.length > 0
    ? await supabase.from("profiles").select("id, display_name, email").in("id", usageUserIds)
    : { data: [] };
  const usageProfileMap = new Map((usageProfiles ?? []).map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["profiles", "generations", "error_log", "topups", "user_feedback"]} label="Ada update aktivitas" />

      {/* Header */}
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">Pusat Kendali Owner</h1>
          <p className="text-xs text-muted sm:text-sm">Pantau performa bisnis, aktivitas creator, dan kesehatan sistem Malesan.</p>
        </div>
        <div className="flex items-center gap-2 pt-1 sm:pt-0">
          <Link
            href="/admin/feedback"
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-raised"
          >
            💬 Feedback {pendingFeedbacks > 0 && <span className="rounded-full bg-ember px-1.5 py-0.2 text-[10px] text-obsidian font-bold">{pendingFeedbacks}</span>}
          </Link>
          <Link
            href="/admin/stats"
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-raised"
          >
            📊 Grafik Lengkap
          </Link>
          <Link
            href="/admin/ai"
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-raised"
          >
            ⚙️ Otak AI
          </Link>
        </div>
      </header>

      {/* 1. KOTAK FINANSIAL HARI INI (Highlight Utama Founder) */}
      <section className="rounded-2xl border border-ember/30 bg-surface/90 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow text-ember">💰 Finansial Hari Ini (WIB)</h2>
          <span className="text-micro text-muted">Reset jam 00:00 WIB</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-hairline/80 bg-surface-raised/60 p-3">
            <p className="text-micro text-muted">Pendapatan Topup</p>
            <p className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">{formatRp(todayRevenue)}</p>
            <p className="text-micro text-muted">{todayApprovedTopups.length} topup selesai</p>
          </div>

          <div className="rounded-xl border border-hairline/80 bg-surface-raised/60 p-3">
            <p className="text-micro text-muted">Biaya AI Server</p>
            <p className="mt-1 font-display text-xl font-bold text-muted sm:text-2xl">{formatRp(todayAiCost)}</p>
            <p className="text-micro text-muted">{todayAiUsage.length} request AI</p>
          </div>

          <div className="rounded-xl border border-hairline/80 bg-surface-raised/60 p-3">
            <p className="text-micro text-muted">Profit Bersih</p>
            <p className={`mt-1 font-display text-xl font-bold sm:text-2xl ${netProfit >= 0 ? "text-success" : "text-danger"}`}>
              {netProfit >= 0 ? `+${formatRp(netProfit)}` : `-${formatRp(Math.abs(netProfit))}`}
            </p>
            <p className="text-micro text-muted">Revenue - Biaya AI</p>
          </div>

          <div className="rounded-xl border border-hairline/80 bg-surface-raised/60 p-3">
            <p className="text-micro text-muted">Margin Keuntungan</p>
            <p className={`mt-1 font-display text-xl font-bold sm:text-2xl ${todayMargin >= 50 ? "text-success" : todayMargin > 0 ? "text-ember" : "text-muted"}`}>
              {todayRevenue > 0 ? `${Math.round(todayMargin)}%` : "—"}
            </p>
            <p className="text-micro text-muted">Target min 60%</p>
          </div>
        </div>
      </section>

      {/* 2. RINGKASAN METRIK KUNCI */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard
          label="User Aktif Hari Ini"
          value={activeUsersToday}
          note={`Dari ${totalUsers} total user (${proUsers} Pro)`}
          href="/admin/users"
        />
        <StatCard
          label="Konten Dibuat Hari Ini"
          value={todayGenerations}
          note={`Sukses: ${successRate}% (Total ${totalGenerations})`}
        />
        <StatCard
          label="Topup Menunggu"
          value={pendingTopups}
          alert={pendingTopups > 0}
          note={pendingTopups > 0 ? "⚠️ Butuh review transferan" : "Semua beres"}
          href="/admin/topups"
        />
        <StatCard
          label="Feedback Baru"
          value={pendingFeedbacks}
          alert={pendingFeedbacks > 0}
          note={pendingFeedbacks > 0 ? "💡 Masukan baru kreator" : "0 feedback baru"}
          href="/admin/feedback"
        />
      </section>

      {/* 3. PERHATIAN SEGERA (ACTION ITEMS) */}
      {(pendingTopups > 0 || pendingFeedbacks > 0 || errors24h > 0) && (
        <section className="rounded-2xl border border-ember/40 bg-ember/5 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <h2 className="font-display text-sm font-bold text-ink sm:text-base">Tindakan Yang Perlu Lo Lakukan Segera</h2>
          </div>
          <div className="mt-3 space-y-2.5">
            {pendingTopups > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-3 text-xs text-ink">
                <span>💳 Ada <strong>{pendingTopups} bukti transfer topup</strong> yang belum lo approve.</span>
                <Link
                  href="/admin/topups"
                  className="btn-ember inline-flex min-h-8 items-center rounded-lg px-3 text-micro font-bold text-obsidian"
                >
                  Review Topup Sekarang →
                </Link>
              </div>
            )}
            {pendingFeedbacks > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-3 text-xs text-ink">
                <span>💬 Ada <strong>{pendingFeedbacks} laporan / masukan baru</strong> dari kreator pengguna.</span>
                <Link
                  href="/admin/feedback"
                  className="inline-flex min-h-8 items-center rounded-lg border border-hairline bg-surface-raised px-3 text-micro font-semibold text-ink hover:border-ember/40"
                >
                  Tinjau Feedback →
                </Link>
              </div>
            )}
            {errors24h > 3 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-3 text-xs text-ink">
                <span>🚨 Tercatat <strong>{errors24h} error</strong> dalam 24 jam terakhir. Cek diagnosa Masalah → Solusi.</span>
                <Link
                  href="/admin/errors"
                  className="inline-flex min-h-8 items-center rounded-lg border border-hairline bg-surface-raised px-3 text-micro font-semibold text-danger hover:bg-danger/10"
                >
                  Buka Error Center →
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. STATUS KESEHATAN AI */}
      <AiHealthCard />

      {/* 5. AKTIVITAS USER NYATA TERBARU (Founder Realtime Feed: Siapa, Melakukan Apa, Kapan, Sukses/Gagal & Kenapa Gagal) */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <div>
            <h2 className="eyebrow text-muted">Aktivitas Nyata Kreator</h2>
            <p className="text-micro text-muted">Siapa, bikin apa, berhasil/gagal, dan alasan jika gagal</p>
          </div>
          <span className="text-micro text-muted">12 aktivitas terakhir</span>
        </div>

        {recentUsageLogs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-hairline px-4 py-8 text-center text-xs text-muted bg-surface">
            Belum ada aktivitas konten tercatat hari ini.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
            <ul className="divide-y divide-hairline">
              {recentUsageLogs.map((log) => {
                const userProfile = log.user_id ? usageProfileMap.get(log.user_id) : null;
                const userName = userProfile?.display_name || (userProfile?.email ? maskEmail(userProfile.email) : "Pengguna Tamu");
                const modName = MODULE_NAMES[log.feature] || log.feature;
                const isSuccess = log.status === "success";

                return (
                  <li key={log.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-raised/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-xs text-ink truncate">{userName}</span>
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-surface-raised border border-hairline text-muted">
                          {modName}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-bold ${
                            isSuccess
                              ? "bg-success/10 text-success border border-success/30"
                              : "bg-danger/10 text-danger border border-danger/30"
                          }`}
                        >
                          {isSuccess ? "Berhasil ✅" : "Gagal ❌"}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-micro text-muted">
                        <span>Biaya AI: {formatRp(log.cost_idr || 0)}</span>
                        <span>• Kredit: {log.credits_charged || 0}</span>
                        {!isSuccess && log.error_message && (
                          <span className="text-danger font-medium line-clamp-1">
                            • Alasan: {log.error_message}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-micro text-muted font-mono">{timeAgo(log.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* 6. MASALAH SISTEM & ERROR TERAKHIR */}
      {recentErrors.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="eyebrow text-muted">Log Kendala Terakhir (Solusi & Dampak)</h2>
            <Link href="/admin/errors" className="text-micro text-ember hover:underline">
              Lihat semua error →
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
            <ul className="divide-y divide-hairline">
              {recentErrors.map((err) => (
                <li key={err.id} className="p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-danger">❌ {err.endpoint}</span>
                    <span className="text-micro text-muted">{timeAgo(err.created_at)}</span>
                  </div>
                  <p className="mt-1 text-ink text-xs line-clamp-2">{err.message}</p>
                  <p className="mt-1 text-micro text-muted">
                    Tipe: {err.error_type} • Tindakan: Sistem otomatis fallback atau refund kredit ke user.
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 7. AKTIVITAS ADMIN (AUDIT LOG) */}
      <section>
        <h2 className="eyebrow mb-2 text-muted">Aktivitas Tim Admin</h2>
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

function StatCard({
  label,
  value,
  alert,
  note,
  href,
}: {
  label: string;
  value: number;
  alert?: boolean;
  note?: string;
  href?: string;
}) {
  const content = (
    <div
      className={`rounded-xl border bg-surface p-3.5 transition-colors ${
        alert ? "border-ember/45 bg-ember/5" : "border-hairline hover:border-hairline/90"
      }`}
    >
      <p className="eyebrow text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${alert ? "text-ember" : "text-ink"}`}>
        {value}
      </p>
      {note && <p className="mt-1 text-micro leading-snug text-muted">{note}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

