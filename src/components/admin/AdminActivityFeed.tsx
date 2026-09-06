"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { clearAiUsageLogs, deleteAiUsageLog, clearAuditLogs, clearErrorLogs } from "@/app/actions/admin";

export type UsageLogItem = {
  id: number;
  feature: string;
  status: string;
  error_message: string | null;
  cost_idr: number;
  credits_charged: number;
  user_id: string | null;
  created_at: string;
  userName: string;
  modName: string;
};

export type AuditLogItem = {
  id: number;
  action: string;
  actionLabel: string;
  target_id: string | null;
  detail: string;
  created_at: string;
};

export type RecentErrorItem = {
  id: number;
  endpoint: string;
  error_type: string;
  message: string;
  created_at: string;
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

function ChevronDownIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function TrashIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

export function AdminActivityFeed({
  initialLogs,
  initialAudit,
  initialErrors,
}: {
  initialLogs: UsageLogItem[];
  initialAudit: AuditLogItem[];
  initialErrors: RecentErrorItem[];
}) {
  const [logs, setLogs] = useState<UsageLogItem[]>(initialLogs);
  const [audit, setAudit] = useState<AuditLogItem[]>(initialAudit);
  const [errors, setErrors] = useState<RecentErrorItem[]>(initialErrors);

  // Accordion open/close states
  const [isLogsOpen, setIsLogsOpen] = useState(true);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isErrorsOpen, setIsErrorsOpen] = useState(false);

  // Expand full vs limit 3
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [showAllAudit, setShowAllAudit] = useState(false);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const showToast = (text: string) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Clear all usage logs
  const handleClearLogs = () => {
    if (!window.confirm("Yakin ingin membersihkan seluruh riwayat aktivitas nyata kreator?")) return;
    setBusyAction("clearLogs");
    startTransition(async () => {
      try {
        await clearAiUsageLogs();
        setLogs([]);
        showToast("Riwayat aktivitas konten berhasil dibersihkan!");
      } catch (e) {
        alert(e instanceof Error ? e.message : "Gagal membersihkan riwayat.");
      } finally {
        setBusyAction(null);
      }
    });
  };

  // Delete single usage log
  const handleDeleteLog = (id: number) => {
    setBusyAction(`delete-${id}`);
    startTransition(async () => {
      try {
        await deleteAiUsageLog(id);
        setLogs((prev) => prev.filter((l) => l.id !== id));
        showToast("Log aktivitas berhasil dihapus!");
      } catch (e) {
        alert(e instanceof Error ? e.message : "Gagal menghapus log.");
      } finally {
        setBusyAction(null);
      }
    });
  };

  // Clear all audit logs
  const handleClearAudit = () => {
    if (!window.confirm("Yakin ingin membersihkan riwayat log aktivitas admin?")) return;
    setBusyAction("clearAudit");
    startTransition(async () => {
      try {
        await clearAuditLogs();
        setAudit([]);
        showToast("Riwayat aktivitas admin berhasil dibersihkan!");
      } catch (e) {
        alert(e instanceof Error ? e.message : "Gagal membersihkan audit log.");
      } finally {
        setBusyAction(null);
      }
    });
  };

  // Clear all error logs
  const handleClearErrors = () => {
    if (!window.confirm("Yakin ingin membersihkan riwayat log error?")) return;
    setBusyAction("clearErrors");
    startTransition(async () => {
      try {
        await clearErrorLogs();
        setErrors([]);
        showToast("Semua log error berhasil dibersihkan!");
      } catch (e) {
        alert(e instanceof Error ? e.message : "Gagal membersihkan error log.");
      } finally {
        setBusyAction(null);
      }
    });
  };

  const displayedLogs = showAllLogs ? logs : logs.slice(0, 3);
  const displayedAudit = showAllAudit ? audit : audit.slice(0, 3);

  return (
    <div className="space-y-4">
      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-ember/40 bg-obsidian/95 px-4 py-2 text-xs font-semibold text-ember shadow-lg backdrop-blur-md">
          {toastMsg}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. ACCORDION: AKTIVITAS NYATA KREATOR                                     */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-hairline bg-surface overflow-hidden transition-all shadow-xs">
        {/* Accordion Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 bg-surface-raised/40 gap-2">
          <button
            type="button"
            onClick={() => setIsLogsOpen(!isLogsOpen)}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-ember/30 bg-ember/10 text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xs sm:text-sm font-bold text-ink group-hover:text-ember transition-colors truncate">
                  Aktivitas Nyata Kreator
                </h2>
                <span className="rounded-full bg-obsidian border border-hairline px-2 py-0.2 font-mono text-[10px] font-bold text-muted shrink-0">
                  {logs.length}
                </span>
              </div>
              <p className="text-micro text-muted truncate">
                {isLogsOpen ? "Timeline interaksi real-time kreator" : `${logs.length} riwayat · tap untuk membuka`}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {logs.length > 0 && (
              <button
                type="button"
                disabled={busyAction === "clearLogs"}
                onClick={handleClearLogs}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/[0.08] bg-surface px-2.5 text-[11px] font-semibold text-muted hover:border-danger/40 hover:text-danger active:scale-95 transition-all disabled:opacity-50"
                title="Bersihkan seluruh riwayat aktivitas kreator"
              >
                <TrashIcon className="size-3" />
                <span className="hidden xs:inline">Bersihkan</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsLogsOpen(!isLogsOpen)}
              className="flex size-8 items-center justify-center rounded-lg border border-hairline bg-surface text-muted hover:text-ink transition-transform"
              aria-label={isLogsOpen ? "Ciutkan aktivitas kreator" : "Buka aktivitas kreator"}
            >
              <ChevronDownIcon className={`size-4 transition-transform duration-200 ${isLogsOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* Accordion Body */}
        {isLogsOpen && (
          <div className="border-t border-hairline/80">
            {logs.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-muted">Belum ada aktivitas konten tercatat atau riwayat telah dibersihkan.</p>
              </div>
            ) : (
              <div>
                <ul className="divide-y divide-hairline">
                  {displayedLogs.map((log) => {
                    const isSuccess = log.status === "success";
                    return (
                      <li key={log.id} className="p-3.5 sm:p-4 hover:bg-surface-raised/30 transition-colors space-y-1.5 group">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                            <span className="font-display text-xs font-bold text-ink truncate max-w-[140px] sm:max-w-none">
                              {log.userName}
                            </span>
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-surface-raised border border-white/[0.06] text-ink">
                              Membuat {log.modName}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-bold ${
                                isSuccess
                                  ? "bg-success/10 text-success border border-success/30"
                                  : "bg-danger/10 text-danger border border-danger/30"
                              }`}
                            >
                              {isSuccess ? "Berhasil" : "Gagal"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-micro text-muted">{timeAgo(log.created_at)}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteLog(log.id)}
                              disabled={busyAction === `delete-${log.id}`}
                              className="opacity-60 group-hover:opacity-100 hover:text-danger p-1 rounded transition-opacity"
                              title="Hapus baris log ini"
                            >
                              <TrashIcon className="size-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 text-micro text-muted font-mono">
                          <span>Biaya AI: {formatRp(log.cost_idr || 0)}</span>
                          <span>• Kredit: -{log.credits_charged || 1}</span>
                          {!isSuccess && (
                            <span className="text-danger/90">
                              (Kredit otomatis di-refund ke pengguna)
                            </span>
                          )}
                        </div>

                        {!isSuccess && log.error_message && (
                          <details className="mt-1 pt-1 text-xs">
                            <summary className="cursor-pointer text-[11px] text-muted hover:text-ink select-none">
                              Lihat detail kendala teknis
                            </summary>
                            <p className="mt-1 font-mono text-[10px] text-muted whitespace-pre-wrap bg-obsidian/60 p-2.5 rounded-lg border border-hairline">
                              {log.error_message}
                            </p>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {logs.length > 3 && (
                  <div className="p-2.5 bg-surface-raised/30 border-t border-hairline text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllLogs(!showAllLogs)}
                      className="text-xs font-semibold text-ember hover:underline cursor-pointer py-1 px-3"
                    >
                      {showAllLogs ? "Ciutkan Tampilan (Tampilkan 3 Saja)" : `Buka Semua (${logs.length} Riwayat) ↓`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 2. ACCORDION: LOG KENDALA TERAKHIR                                        */}
      {/* ========================================================================= */}
      {errors.length > 0 && (
        <section className="rounded-2xl border border-hairline bg-surface overflow-hidden transition-all shadow-xs">
          <div className="flex items-center justify-between p-3.5 sm:p-4 bg-surface-raised/40 gap-2">
            <button
              type="button"
              onClick={() => setIsErrorsOpen(!isErrorsOpen)}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-danger/30 bg-danger/10 text-danger">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                  <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xs sm:text-sm font-bold text-ink group-hover:text-ember transition-colors truncate">
                    Log Kendala Terakhir
                  </h2>
                  <span className="rounded-full bg-obsidian border border-hairline px-2 py-0.2 font-mono text-[10px] font-bold text-danger shrink-0">
                    {errors.length}
                  </span>
                </div>
                <p className="text-micro text-muted truncate">
                  {isErrorsOpen ? "Dampak kendala ke sistem & user" : `${errors.length} error tercatat · tap untuk melihat`}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={busyAction === "clearErrors"}
                onClick={handleClearErrors}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/[0.08] bg-surface px-2.5 text-[11px] font-semibold text-muted hover:border-danger/40 hover:text-danger active:scale-95 transition-all disabled:opacity-50"
                title="Bersihkan seluruh log error"
              >
                <TrashIcon className="size-3" />
                <span className="hidden xs:inline">Bersihkan</span>
              </button>

              <button
                type="button"
                onClick={() => setIsErrorsOpen(!isErrorsOpen)}
                className="flex size-8 items-center justify-center rounded-lg border border-hairline bg-surface text-muted hover:text-ink transition-transform"
                aria-label={isErrorsOpen ? "Ciutkan log error" : "Buka log error"}
              >
                <ChevronDownIcon className={`size-4 transition-transform duration-200 ${isErrorsOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>

          {isErrorsOpen && (
            <div className="border-t border-hairline/80">
              <ul className="divide-y divide-hairline">
                {errors.map((err) => (
                  <li key={err.id} className="p-3 sm:p-3.5 text-xs hover:bg-surface-raised/30 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-danger font-mono">{err.endpoint}</span>
                      <span className="text-micro text-muted">{timeAgo(err.created_at)}</span>
                    </div>
                    <p className="mt-1 text-ink text-xs line-clamp-2">{err.message}</p>
                    <p className="mt-1 text-micro text-muted">
                      Tipe: {err.error_type} • Tindakan: Sistem otomatis fallback atau refund kredit ke user.
                    </p>
                  </li>
                ))}
              </ul>
              <div className="p-2 bg-surface-raised/30 border-t border-hairline text-center">
                <Link href="/admin/errors" className="text-xs font-semibold text-ember hover:underline">
                  Buka Pusat Diagnostik Error Lengkap →
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. ACCORDION: AKTIVITAS TIM ADMIN (AUDIT LOG)                              */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-hairline bg-surface overflow-hidden transition-all shadow-xs">
        <div className="flex items-center justify-between p-3.5 sm:p-4 bg-surface-raised/40 gap-2">
          <button
            type="button"
            onClick={() => setIsAuditOpen(!isAuditOpen)}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xs sm:text-sm font-bold text-ink group-hover:text-ember transition-colors truncate">
                  Aktivitas Tim Admin
                </h2>
                <span className="rounded-full bg-obsidian border border-hairline px-2 py-0.2 font-mono text-[10px] font-bold text-muted shrink-0">
                  {audit.length}
                </span>
              </div>
              <p className="text-micro text-muted truncate">
                {isAuditOpen ? "Jejak riwayat operasional & perubahan sistem" : `${audit.length} aksi tercatat · tap untuk melihat`}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {audit.length > 0 && (
              <button
                type="button"
                disabled={busyAction === "clearAudit"}
                onClick={handleClearAudit}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/[0.08] bg-surface px-2.5 text-[11px] font-semibold text-muted hover:border-danger/40 hover:text-danger active:scale-95 transition-all disabled:opacity-50"
                title="Bersihkan riwayat log aktivitas admin"
              >
                <TrashIcon className="size-3" />
                <span className="hidden xs:inline">Bersihkan</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsAuditOpen(!isAuditOpen)}
              className="flex size-8 items-center justify-center rounded-lg border border-hairline bg-surface text-muted hover:text-ink transition-transform"
              aria-label={isAuditOpen ? "Ciutkan aktivitas admin" : "Buka aktivitas admin"}
            >
              <ChevronDownIcon className={`size-4 transition-transform duration-200 ${isAuditOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {isAuditOpen && (
          <div className="border-t border-hairline/80">
            {audit.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-muted">Belum ada aksi admin tercatat atau riwayat telah dibersihkan.</p>
              </div>
            ) : (
              <div>
                <ol className="divide-y divide-hairline">
                  {displayedAudit.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 p-3 sm:p-3.5 hover:bg-surface-raised/30 transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink">
                          {a.actionLabel}
                        </p>
                        <p className="truncate text-micro text-muted font-mono">
                          {a.detail}
                        </p>
                      </div>
                      <span className="shrink-0 text-micro text-muted">{timeAgo(a.created_at)}</span>
                    </li>
                  ))}
                </ol>

                {audit.length > 3 && (
                  <div className="p-2.5 bg-surface-raised/30 border-t border-hairline text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllAudit(!showAllAudit)}
                      className="text-xs font-semibold text-ember hover:underline cursor-pointer py-1 px-3"
                    >
                      {showAllAudit ? "Ciutkan Tampilan (Tampilkan 3 Saja)" : `Buka Semua (${audit.length} Riwayat) ↓`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
