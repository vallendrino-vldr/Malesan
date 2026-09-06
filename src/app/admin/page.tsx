import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { AiHealthCard } from "@/components/AiHealthCard";
import { AdminActivityFeed } from "@/components/admin/AdminActivityFeed";
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
  video_cc: "Auto Subtitle Video",
  affiliate: "Naskah Affiliate",
  carousel: "Carousel Post",
  lancar_bahasa: "Lancar Bahasa",
  lancar_ngoding: "Lancar Ngoding",
  trends_cron: "Pencarian Tren Otomatis",
};


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

function TrendingUpIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function MessageSquareIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function BarChartIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function CpuIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
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
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:pb-0 sm:flex-wrap pt-1 sm:pt-0">
          <Link
            href="/admin/feedback"
            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-raised transition-colors"
          >
            <MessageSquareIcon className="size-3.5 text-muted" />
            <span>Feedback</span>
            {pendingFeedbacks > 0 && <span className="rounded-full bg-ember px-1.5 py-0.2 text-[10px] text-obsidian font-bold">{pendingFeedbacks}</span>}
          </Link>
          <Link
            href="/admin/stats"
            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-raised transition-colors"
          >
            <BarChartIcon className="size-3.5 text-muted" />
            <span>Grafik Lengkap</span>
          </Link>
          <Link
            href="/admin/ai"
            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-raised transition-colors"
          >
            <CpuIcon className="size-3.5 text-ember" />
            <span>Otak AI</span>
          </Link>
        </div>
      </header>

      {/* 1. KOTAK FINANSIAL HARI INI (Highlight Utama Founder) */}
      <section className="rounded-2xl border border-ember/30 bg-surface/90 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUpIcon className="size-4 text-ember" />
            <h2 className="eyebrow text-ember">Finansial Hari Ini (WIB)</h2>
          </div>
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
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 items-stretch">
        <StatCard
          label="User Aktif Hari Ini"
          value={activeUsersToday}
          note={`Dari ${totalUsers} total user (${proUsers} Pro)`}
          href="/admin/users"
        />
        <StatCard
          label="Konten Dibuat"
          value={todayGenerations}
          note={`Sukses: ${successRate}% (Total ${totalGenerations})`}
          href="/admin/stats"
        />
        <StatCard
          label="Topup Menunggu"
          value={pendingTopups}
          alert={pendingTopups > 0}
          note={pendingTopups > 0 ? "Butuh review transferan" : "Semua beres"}
          href="/admin/topups"
        />
        <StatCard
          label="Feedback Baru"
          value={pendingFeedbacks}
          alert={pendingFeedbacks > 0}
          note={pendingFeedbacks > 0 ? "Masukan baru kreator" : "0 feedback baru"}
          href="/admin/feedback"
        />
      </section>

      {/* 3. PERHATIAN SEGERA (ACTION ITEMS) */}
      {(pendingTopups > 0 || pendingFeedbacks > 0 || errors24h > 0) && (
        <section className="rounded-2xl border border-ember/40 bg-ember/5 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="size-4 text-ember shrink-0" />
            <h2 className="font-display text-sm font-bold text-ink sm:text-base">Tindakan Yang Perlu Lo Lakukan Segera</h2>
          </div>
          <div className="mt-3 space-y-2.5">
            {pendingTopups > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-3 text-xs text-ink">
                <span>Ada <strong>{pendingTopups} bukti transfer topup</strong> yang belum lo approve.</span>
                <Link
                  href="/admin/topups"
                  className="btn-ember inline-flex h-9 items-center rounded-lg px-3.5 text-xs font-bold text-obsidian"
                >
                  Review Topup Sekarang →
                </Link>
              </div>
            )}
            {pendingFeedbacks > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-3 text-xs text-ink">
                <span>Ada <strong>{pendingFeedbacks} laporan / masukan baru</strong> dari kreator pengguna.</span>
                <Link
                  href="/admin/feedback"
                  className="inline-flex h-9 items-center rounded-lg border border-hairline bg-surface-raised px-3.5 text-xs font-semibold text-ink hover:border-ember/40"
                >
                  Tinjau Feedback →
                </Link>
              </div>
            )}
            {errors24h > 3 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-3 text-xs text-ink">
                <span>Tercatat <strong>{errors24h} error</strong> dalam 24 jam terakhir. Cek diagnosa Masalah → Solusi.</span>
                <Link
                  href="/admin/errors"
                  className="inline-flex h-9 items-center rounded-lg border border-hairline bg-surface-raised px-3.5 text-xs font-semibold text-danger hover:bg-danger/10"
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

      {/* 5. AKTIVITAS, ERROR, & AUDIT FEED (Interaktif dengan Nested Accordion & Tombol Bersihkan Riwayat) */}
      <AdminActivityFeed
        initialLogs={recentUsageLogs.map((log) => {
          const userProfile = log.user_id ? usageProfileMap.get(log.user_id) : null;
          const userName = userProfile?.display_name || (userProfile?.email ? maskEmail(userProfile.email) : "Pengguna Tamu");
          const modName = MODULE_NAMES[log.feature] || log.feature;
          return {
            id: log.id,
            feature: log.feature,
            status: log.status,
            error_message: log.error_message,
            cost_idr: log.cost_idr,
            credits_charged: log.credits_charged,
            user_id: log.user_id,
            created_at: log.created_at,
            userName,
            modName,
          };
        })}
        initialAudit={audit.map((a) => ({
          id: a.id,
          action: a.action,
          actionLabel: ACTION_LABEL[a.action] ?? a.action,
          target_id: a.target_id,
          detail:
            typeof a.metadata?.reason === "string"
              ? String(a.metadata.reason)
              : typeof a.metadata?.email === "string"
                ? String(a.metadata.email)
                : (a.target_id ?? "").slice(0, 8),
          created_at: a.created_at,
        }))}
        initialErrors={recentErrors.map((err) => ({
          id: err.id,
          endpoint: err.endpoint,
          error_type: err.error_type,
          message: err.message,
          created_at: err.created_at,
        }))}
      />
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
      className={`flex h-full flex-col justify-between rounded-xl border bg-surface p-3.5 transition-colors ${
        alert ? "border-ember/45 bg-ember/5" : "border-hairline hover:border-hairline/90"
      }`}
    >
      <div>
        <p className="eyebrow text-muted truncate">{label}</p>
        <p className={`mt-1 font-display text-2xl font-bold ${alert ? "text-ember" : "text-ink"}`}>
          {value}
        </p>
      </div>
      {note && <p className="mt-2 text-micro leading-snug text-muted truncate">{note}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}

