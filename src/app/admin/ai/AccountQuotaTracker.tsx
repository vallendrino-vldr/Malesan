"use client";

import { useState, useTransition } from "react";
import type { QuotaTrackerPayload } from "@/lib/gemini/account-quotas";

function formatRp(val: number) {
  return "Rp " + Math.round(val).toLocaleString("id-ID");
}

export function AccountQuotaTracker({
  initialData,
  onRefreshAction,
}: {
  initialData: QuotaTrackerPayload;
  onRefreshAction?: () => Promise<QuotaTrackerPayload>;
}) {
  const [data, setData] = useState<QuotaTrackerPayload>(initialData);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [isFeatureMatrixOpen, setIsFeatureMatrixOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filteredAccounts =
    selectedAccountId === "all"
      ? data.accounts
      : data.accounts.filter((a) => a.id === selectedAccountId);

  const handleRefresh = () => {
    if (!onRefreshAction) {
      window.location.reload();
      return;
    }
    startTransition(async () => {
      try {
        const fresh = await onRefreshAction();
        if (fresh) setData(fresh);
      } catch {
        window.location.reload();
      }
    });
  };

  return (
    <section className="space-y-4">
      {/* ---------- HEADER & CONNECTION SYNC STATUS ---------- */}
      <div className="surface-card rounded-2xl border border-white/[0.08] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0 shadow-[0_0_12px_rgba(52,211,153,0.15)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-base sm:text-lg font-bold text-ink">
                  Quota Tracker & ATM Cuan (4 Akun)
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-micro font-medium text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {data.is9RouterConnected ? "9Router Proxy Live Sync" : "Google Cloud Key Pool"}
                </span>
              </div>
              <p className="text-micro text-muted mt-0.5">
                Amati, Tiru, dan Modifikasi 9Router dengan kalkulator profit kas 100% margin Malesan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface px-3 py-1.5 text-micro font-medium text-ink hover:bg-surface-raised transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                className={`size-3.5 text-muted ${isPending ? "animate-spin text-ember" : ""}`}
              >
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              <span>{isPending ? "Menyinkron..." : "Sinkron Kuota"}</span>
            </button>
          </div>
        </div>

        {/* Top 3 KPI Hero ATM Cuan Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/[0.06]">
          {/* Card 1: Sisa Kuota Kas Total */}
          <div className="rounded-xl bg-surface-raised/60 border border-white/[0.04] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-micro text-muted uppercase tracking-wider font-semibold">
                Sisa Kuota Kas (4 Akun)
              </span>
              <span className="font-mono text-micro font-bold text-emerald-400">
                {data.totalRemainingPercentage}% Tersedia
              </span>
            </div>
            <p className="font-display text-lg sm:text-xl font-bold text-ink">
              {data.totalRemainingToday.toLocaleString("id-ID")}
              <span className="text-xs font-normal text-muted">
                {" "} / {data.totalCapacity.toLocaleString("id-ID")} req
              </span>
            </p>
            {/* Luminous progress bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-obsidian border border-white/5 relative">
              <div
                className="h-full rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(1, data.totalRemainingPercentage))}%` }}
              />
            </div>
            <p className="text-[10px] text-muted flex items-center justify-between pt-0.5">
              <span>Reset 14:00 WIB</span>
              <span className="font-mono text-ember-lo font-semibold">{data.countdownText}</span>
            </p>
          </div>

          {/* Card 2: Modal AI Lo Riil */}
          <div className="rounded-xl bg-surface-raised/60 border border-white/[0.04] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-micro text-muted uppercase tracking-wider font-semibold">
                Modal AI Server Lo
              </span>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-400">
                Free Tier
              </span>
            </div>
            <p className="font-display text-lg sm:text-xl font-bold text-emerald-400">
              Rp 0
            </p>
            <p className="text-micro text-muted">
              Bebas tagihan kartu kredit · Margin 100%
            </p>
            <p className="text-[10px] text-emerald-400/90 pt-1 font-medium">
              Dihemat hari ini: ~{formatRp(data.commercialSavingsTodayIdr)} (vs Google API)
            </p>
          </div>

          {/* Card 3: Potensi Cuan Bersih */}
          <div className="rounded-xl bg-surface-raised/60 border border-white/[0.04] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-micro text-muted uppercase tracking-wider font-semibold">
                Potensi Cuan Bersih Kas
              </span>
              <span className="font-mono text-[10px] text-muted">
                100% Cuan Kas
              </span>
            </div>
            <p className="font-display text-lg sm:text-xl font-bold text-ink">
              {formatRp(data.maxDailyRevenuePotentialIdr)}
              <span className="text-xs font-normal text-muted"> / hari</span>
            </p>
            <p className="text-micro text-muted">
              Kapasitas {formatRp(data.maxMonthlyRevenuePotentialIdr)} / bulan
            </p>
            <p className="text-[10px] text-ember font-medium pt-1">
              Cuan masuk hari ini: {formatRp(data.realizedRevenueTodayIdr)} ({data.realizedGenerationsToday} generate)
            </p>
          </div>
        </div>

        {/* Collapsible Feature Profit Matrix Button */}
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setIsFeatureMatrixOpen((prev) => !prev)}
            className="w-full flex items-center justify-between py-1.5 text-left text-micro font-medium text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span className="font-semibold text-ink">
                Kalkulator Cuan Lo per Sekali Generate Creator (Matrix 6 Modul)
              </span>
            </div>
            <div className="flex items-center gap-1 text-micro text-ember">
              <span>{isFeatureMatrixOpen ? "Tutup Matrix" : "Lihat Rincian Untung"}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={`size-3.5 transition-transform duration-200 ${isFeatureMatrixOpen ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {isFeatureMatrixOpen && (
            <div className="mt-2.5 rounded-xl bg-surface border border-white/[0.04] p-3 overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-white/10 text-micro text-muted uppercase font-semibold">
                    <th className="pb-2">Modul Kreatif</th>
                    <th className="pb-2 text-center">Tarif Kredit</th>
                    <th className="pb-2 text-right">Harga User</th>
                    <th className="pb-2 text-right">Modal AI</th>
                    <th className="pb-2 text-right">Cuan Bersih Lo</th>
                    <th className="pb-2 text-right">Potensi Harian (4k req)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-ink">
                  {data.featureProfitMatrix.map((f) => (
                    <tr key={f.key} className="hover:bg-white/[0.02]">
                      <td className="py-2 font-medium">{f.name}</td>
                      <td className="py-2 text-center font-mono text-muted">{f.credits} kredit</td>
                      <td className="py-2 text-right font-mono">{formatRp(f.userPriceIdr)}</td>
                      <td className="py-2 text-right font-mono text-emerald-400">Rp 0</td>
                      <td className="py-2 text-right font-mono font-bold text-emerald-400">
                        +{formatRp(f.profitIdr)}{" "}
                        <span className="text-[10px] font-normal text-emerald-400/80">(100%)</span>
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-ember">
                        {formatRp(f.dailyPotentialIdr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] text-muted leading-relaxed">
                * Asumsi nilai beli kredit user: Rp 150/kredit (paket standar Rp 15.000 / 100 kredit). Karena lo pakai pool Google Free Tier, 100% uang pembayaran user masuk jadi kas bersih lo tanpa kepotong tagihan API.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---------- ACCOUNT FILTER TABS ---------- */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedAccountId("all")}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            selectedAccountId === "all"
              ? "bg-ember text-obsidian shadow-sm"
              : "border border-white/10 bg-surface text-muted hover:text-ink hover:bg-surface-raised"
          }`}
        >
          Semua Akun (4)
        </button>
        {data.accounts.map((acc, idx) => (
          <button
            key={acc.id}
            type="button"
            onClick={() => setSelectedAccountId(acc.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              selectedAccountId === acc.id
                ? "bg-ember text-obsidian shadow-sm"
                : "border border-white/10 bg-surface text-muted hover:text-ink hover:bg-surface-raised"
            }`}
          >
            Akun {idx + 1} · {acc.email.split("@")[0]}
          </button>
        ))}
      </div>

      {/* ---------- 4 ACCOUNTS 2x2 GRID (AMATI, TIRU 9ROUTER) ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredAccounts.map((acc) => (
          <div
            key={acc.id}
            className="surface-card rounded-2xl border border-white/[0.08] p-4 sm:p-5 space-y-4 hover:border-white/15 transition-all"
          >
            {/* Account Card Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-sm sm:text-base font-bold text-ink truncate">
                    {acc.email}
                  </span>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-micro font-medium text-muted border border-white/10">
                    Prioritas {acc.priority}
                  </span>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-micro font-medium">
                    Antigravity
                  </span>
                </div>
                <p className="text-micro text-muted mt-0.5">
                  Kapasitas harian: {acc.dailyCapacity.toLocaleString("id-ID")} request · Potensi kas: ~{formatRp(acc.cuanPotentialIdr)}/hari
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-micro font-semibold text-emerald-400">Aktif</span>
              </div>
            </div>

            {/* Account Model Quota List (Exact 9Router visual layout) */}
            <div className="space-y-3 pt-1">
              {acc.models.map((m) => (
                <div key={m.id} className="space-y-1.5 rounded-xl bg-surface/80 p-2.5 border border-white/[0.04]">
                  {/* Row 1: Dot + Model Name + Count */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`size-2 rounded-full shrink-0 ${
                          m.status === "healthy"
                            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                            : m.status === "warning"
                              ? "bg-ember shadow-[0_0_6px_rgba(245,158,11,0.8)]"
                              : "bg-danger"
                        }`}
                      />
                      <span className="font-semibold text-ink truncate">
                        {m.name}
                      </span>
                      {m.isPrimary && (
                        <span className="rounded-md bg-ember/15 border border-ember/30 px-1.5 py-0.2 text-[10px] font-bold text-ember shrink-0">
                          Utama
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-ink shrink-0 font-medium">
                      {m.used.toLocaleString("id-ID")} / {m.total.toLocaleString("id-ID")}
                    </span>
                  </div>

                  {/* Row 2: Full-width Emerald Luminous Progress Bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-obsidian border border-white/5 relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        m.status === "healthy"
                          ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                          : m.status === "warning"
                            ? "bg-ember shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                            : "bg-danger"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(1, m.remainingPercentage))}%` }}
                    />
                  </div>

                  {/* Row 3: Remaining % + Reset Countdown */}
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span className="font-mono font-semibold text-emerald-400">
                      {m.remainingPercentage}%
                    </span>
                    <span className="font-mono text-muted">
                      {m.countdownText}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Account Card Footer */}
            <div className="rounded-xl bg-surface-raised/40 border border-white/[0.04] p-2.5 flex items-center justify-between text-micro text-muted">
              <span>Sisa Kuota Akun Ini:</span>
              <span className="font-mono font-bold text-ink">
                {acc.remainingToday.toLocaleString("id-ID")} / {acc.dailyCapacity.toLocaleString("id-ID")} req
                {" "}({acc.remainingPercentage}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
