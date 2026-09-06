"use client";

import { useState, useTransition } from "react";
import { saveBrain, setAdminMode, quickSwitchPrimaryModel } from "@/app/actions/ai-admin";
import type { BrainView, Health } from "@/lib/ai/brain";
import type { Quota } from "@/lib/ai/analytics";
import type { GeminiPoolQuota } from "@/lib/gemini/pool-report";
import type { AdminMode } from "@/lib/config";
import type { ModelRow, ProviderView } from "@/lib/ai/types";
import { formatIdr } from "@/lib/ai/cost";

/**
 * The Global AI Brain — the one control that matters.
 *
 * This screen answers three questions an owner actually has, in this order:
 * what is my AI right now, is it working, and what happens when it breaks.
 * Everything else in the AI panel is a detail behind that.
 *
 * The status line is deliberately blunt about the one failure that is otherwise
 * invisible: a Brain pointing at a switched-off model does not break the
 * product — routing silently drops to the legacy Gemini path — so without a
 * warning the owner believes they moved to DeepSeek while still paying Google.
 */

const HEALTH: Record<Health, { dot: string; text: string; label: string }> = {
  healthy: { dot: "bg-ember", text: "text-ember-lo", label: "sehat" },
  warning: { dot: "bg-ember/60", text: "text-ember-lo", label: "ada gangguan" },
  limit: { dot: "bg-ember/60", text: "text-ember-lo", label: "kena limit" },
  error: { dot: "bg-danger", text: "text-danger", label: "bermasalah" },
};

function Row({
  role,
  label,
  provider,
  active,
  health,
}: {
  role: string;
  label: string;
  provider: string;
  active: boolean;
  health: Health;
}) {
  const h = HEALTH[active ? health : "error"];
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-micro text-muted">{role}</p>
        <p className="mt-0.5 truncate font-display text-mini font-bold text-ink">{label}</p>
        <p className="text-micro text-muted">{provider}</p>
      </div>
      <span className={`flex shrink-0 items-center gap-1.5 text-micro ${h.text}`}>
        <span aria-hidden="true" className={`size-2 rounded-full ${h.dot}`} />
        {active ? h.label : "mati"}
      </span>
    </div>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-obsidian"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${percent >= 90 ? "bg-danger" : "bg-ember"}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export function BrainPanel({
  brain,
  models,
  providers,
  mode,
  quota,
  geminiQuota,
}: {
  brain: BrainView;
  models: ModelRow[];
  providers: ProviderView[];
  mode: AdminMode;
  /** Prepaid package status for the primary model, when it has one. */
  quota: Quota | null;
  /** Gemini pool and quota status when using Gemini / Free Tier. */
  geminiQuota?: GeminiPoolQuota | null;
}) {
  const active = models.filter((m) => m.is_active);
  const [editing, setEditing] = useState(false);
  const [isQuickSwitchOpen, setIsQuickSwitchOpen] = useState(true);
  const [isFallbackOpen, setIsFallbackOpen] = useState(false);
  const [primary, setPrimary] = useState(brain.primary?.modelId ?? "");
  const [fallbacks, setFallbacks] = useState<string[]>(
    brain.fallbacks.map((f) => f.modelId),
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const providerLabel = (id: string) => providers.find((p) => p.id === id)?.label ?? "?";
  const modelLabel = (m: ModelRow) => `${providerLabel(m.provider_id)} · ${m.label ?? m.model_id}`;

  const commit = () => {
    setErr(null);
    startTransition(async () => {
      try {
        await saveBrain(primary || null, fallbacks);
        setEditing(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Gagal nyimpen.");
      }
    });
  };

  return (
    <section className="space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Otak AI</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Satu setelan buat seluruh aplikasi. Ganti di sini, semua fitur ikut —
            gak perlu atur satu-satu.
          </p>
        </div>
        <button
          onClick={() =>
            startTransition(async () => {
              await setAdminMode(mode === "simple" ? "advanced" : "simple");
            })
          }
          className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-micro text-muted hover:bg-surface hover:text-ink"
        >
          {mode === "simple" ? "Setelan lanjutan" : "Mode simpel"}
        </button>
      </header>

      {/* ---------- 1-Click Quick AI Switcher (Collapsible Accordion) ---------- */}
      <div className="surface-card rounded-2xl border border-white/[0.08] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsQuickSwitchOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-raised/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-7 items-center justify-center rounded-lg bg-ember/10 text-ember border border-ember/20 shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-xs font-bold text-ink">
                  Pilihan Otak AI Utama
                </span>
                <span className="rounded-full border border-white/10 bg-surface px-2 py-0.5 text-micro font-medium text-muted">
                  {active.length} Model Aktif
                </span>
              </div>
              <p className="text-micro text-muted truncate mt-0.5">
                {brain.primary ? `Sedang aktif: ${brain.primary.label}` : "Pilih 1 model untuk seluruh fitur"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-micro text-muted hidden sm:inline">
              {isQuickSwitchOpen ? "Ciutkan" : "Buka Pilihan"}
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`size-4 text-muted transition-transform duration-200 ${isQuickSwitchOpen ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {isQuickSwitchOpen && (
          <div className="p-4 pt-1 space-y-2.5 border-t border-white/[0.06]">
            <p className="text-micro text-muted">
              1-tap langsung aktif dan otomatis sinkron ke seluruh modul kreatif Malesan.
            </p>

            {err && (
              <p className="rounded-lg border border-danger/20 bg-danger/10 p-3 text-xs text-danger">
                {err}
              </p>
            )}

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {active.map((m) => {
                const isPrimary = brain.primary?.modelId === m.id;
                const p = providers.find((x) => x.id === m.provider_id);
                const isGemini =
                  (m.label ?? m.model_id).toLowerCase().includes("gemini") ||
                  p?.slug.includes("gemini");
                const isDeepSeek =
                  (m.label ?? m.model_id).toLowerCase().includes("deepseek") ||
                  p?.slug.includes("ipenk") ||
                  p?.slug.includes("deepseek");

                return (
                  <div
                    key={m.id}
                    className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                      isPrimary
                        ? "border-ember/60 bg-surface-raised shadow-xs ring-1 ring-ember/30"
                        : "border-white/[0.08] bg-surface/50 hover:border-ember/30"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-obsidian px-2.5 py-0.5 font-display text-micro font-bold text-ink">
                          {isGemini ? (
                            <>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-ember"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                              <span>Google Gemini</span>
                            </>
                          ) : isDeepSeek ? (
                            <>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-blue-400"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z"/></svg>
                              <span>DeepSeek</span>
                            </>
                          ) : (
                            <span>{p?.label ?? "AI Gateway"}</span>
                          )}
                        </span>
                        {isPrimary ? (
                          <span className="inline-flex items-center gap-1.5 text-micro font-bold text-ember">
                            <span className="size-2 rounded-full bg-ember animate-pulse" />
                            Sedang Aktif
                          </span>
                        ) : (
                          <span className="text-micro text-muted">Cadangan Siap Pakai</span>
                        )}
                      </div>

                      <p className="mt-2.5 font-display text-sm font-bold text-ink">
                        {m.label ?? m.model_id}
                      </p>
                      <p className="mt-1 text-micro text-muted leading-relaxed">
                        {isGemini
                          ? "Pilihan paling stabil, cepat, dan bahasa Indonesianya sangat luwes."
                          : isDeepSeek
                            ? "Pilihan super hemat biaya dengan kemampuan nalar analitis tinggi."
                            : "Model alternatif berkecepatan tinggi untuk akselerasi performa."}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                      <div className="text-micro text-muted">
                        {m.pricing_mode === "prepaid_package" ? (
                          <span className="text-ember-lo font-medium">Paket Kuota Token</span>
                        ) : (
                          <span>Pay-as-you-go</span>
                        )}
                      </div>

                      {!isPrimary ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setErr(null);
                            startTransition(async () => {
                              try {
                                await quickSwitchPrimaryModel(m.id);
                              } catch (e) {
                                setErr(e instanceof Error ? e.message : "Gagal ganti model.");
                              }
                            });
                          }}
                          className="cursor-pointer rounded-xl border border-ember/40 bg-ember/10 px-3.5 py-1.5 font-display text-xs font-bold text-ember transition-all hover:bg-ember hover:text-obsidian active:scale-95 disabled:opacity-50"
                        >
                          {busy ? "Mengganti..." : "Jadikan Otak Utama"}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-xl border border-ember/30 bg-ember/15 px-3 py-1 text-micro font-bold text-ember">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3"><polyline points="20 6 9 17 4 12"/></svg>
                          <span>Otak Terpilih</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ---------- Status Cadangan & Kuota Detail (Collapsible Accordion) ---------- */}
      <div className="surface-card rounded-2xl border border-white/[0.08] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsFallbackOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-raised/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-7 items-center justify-center rounded-lg bg-surface text-muted border border-white/10 shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-xs font-bold text-ink">
                  Status Cadangan & Kuota
                </span>
                <span className={`rounded-full px-2 py-0.5 text-micro font-medium ${brain.healthy ? "bg-ember/15 text-ember-lo border border-ember/20" : "bg-danger/15 text-danger border border-danger/20"}`}>
                  {brain.healthy ? "Sehat" : "Perlu Cek"}
                </span>
                {geminiQuota && (
                  <span className="rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-micro font-medium">
                    Sisa {geminiQuota.remaining.toLocaleString("id-ID")} req ({geminiQuota.percentRemaining.toFixed(0)}%)
                  </span>
                )}
              </div>
              <p className="text-micro text-muted truncate mt-0.5">
                {brain.status}
                {geminiQuota && ` · Reset limit 14:00 WIB (${geminiQuota.countdownText})`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!editing && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFallbackOpen(true);
                  setEditing(true);
                }}
                role="button"
                tabIndex={0}
                className="shrink-0 rounded-full bg-ember px-3 py-1 text-micro font-bold text-obsidian hover:bg-ember-lo cursor-pointer transition-colors"
              >
                Ganti Kustom
              </span>
            )}
            <span className="text-micro text-muted hidden sm:inline">
              {(isFallbackOpen || editing) ? "Ciutkan" : "Buka Detail"}
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`size-4 text-muted transition-transform duration-200 ${(isFallbackOpen || editing) ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {(isFallbackOpen || editing) && (
          <div className="p-4 pt-2 space-y-3 border-t border-white/[0.06]">
            {!editing ? (
          <>
            {brain.primary ? (
              <div className="space-y-1.5">
                <Row
                  role="AI utama"
                  label={brain.primary.label}
                  provider={brain.primary.provider}
                  active={brain.primary.active}
                  health={brain.primary.health}
                />

                {/* The prepaid package, in the only terms that matter: how much
                    is left, how much of the money is gone, and when it dies. */}
                {quota && quota.totalTokens !== null && (
                  <div className="rounded-lg bg-surface px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-micro text-muted">Sisa token</p>
                      <p className="font-mono text-mini font-bold text-ink">
                        {(quota.remainingTokens ?? 0).toLocaleString("id-ID")}
                        <span className="text-muted">
                          {" "}
                          / {quota.totalTokens.toLocaleString("id-ID")}
                        </span>
                      </p>
                    </div>
                    <div className="mt-2">
                      <Bar percent={quota.percentUsed ?? 0} />
                    </div>
                    <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-micro text-muted">
                      <span>
                        Modal {formatIdr(quota.packagePriceIdr ?? 0)} · kepakai{" "}
                        {formatIdr(quota.spentIdr)}
                      </span>
                      {quota.expiresAt && (
                        <span className={quota.expired ? "text-danger" : ""}>
                          {quota.expired ? "Sudah kedaluwarsa" : `Habis ${quota.expiresAt}`}
                        </span>
                      )}
                    </div>
                    {(quota.percentUsed ?? 0) >= 90 && !quota.expired && (
                      <p className="mt-2 text-micro text-danger">
                        Token tinggal dikit. Isi ulang paketnya sebelum habis, atau
                        pastiin cadangannya nyala.
                      </p>
                    )}
                  </div>
                )}

                {/* Dedicated Gemini Free Tier Pool & Quota Intelligence Card */}
                {geminiQuota && (
                  <div className="rounded-xl border border-white/[0.08] bg-surface/90 p-3.5 sm:p-4 space-y-3.5 my-2">
                    {/* Header & Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                          </svg>
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-display text-xs font-bold text-ink">
                              Kuota Google Gemini (Free Tier)
                            </p>
                            <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                              {geminiQuota.activeKeys} Kunci Aktif
                            </span>
                          </div>
                          <p className="text-micro text-muted">
                            Multi-project Google Cloud · Rotasi otomatis & load balancing
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-start sm:self-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-micro font-medium ${
                          geminiQuota.guardEngaged 
                            ? "bg-danger/15 text-danger border border-danger/30"
                            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        }`}>
                          <span className={`size-1.5 rounded-full ${geminiQuota.guardEngaged ? "bg-danger animate-ping" : "bg-emerald-400"}`} />
                          {geminiQuota.guardEngaged ? "Guard Aktif (<20%)" : "Kapasitas Aman"}
                        </span>
                      </div>
                    </div>

                    {/* Hero Quota Bar */}
                    <div className="rounded-lg bg-surface-raised/60 border border-white/[0.04] p-3 space-y-2">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-micro text-muted">Sisa Kuota Request Hari Ini</p>
                          <p className="font-display text-base sm:text-lg font-bold text-ink">
                            {geminiQuota.remaining.toLocaleString("id-ID")}
                            <span className="text-xs font-normal text-muted">
                              {" "} / {geminiQuota.capacity.toLocaleString("id-ID")} request
                            </span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-emerald-400">
                            {geminiQuota.percentRemaining.toFixed(1)}%
                          </span>
                          <p className="text-micro text-muted">tersedia hari ini</p>
                        </div>
                      </div>

                      {/* Custom visual progress bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-obsidian border border-white/5 relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            geminiQuota.percentUsed > 80 ? "bg-danger" : geminiQuota.percentUsed > 50 ? "bg-ember" : "bg-emerald-400"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(1, geminiQuota.percentUsed))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-micro text-muted pt-0.5">
                        <span>Terpakai: {geminiQuota.used.toLocaleString("id-ID")} request ({geminiQuota.totalTokensToday.toLocaleString("id-ID")} token)</span>
                        <span>Batas Guard: 20% ({Math.round(geminiQuota.capacity * 0.2)} req)</span>
                      </div>
                    </div>

                    {/* Reset Schedule & Timing Banner */}
                    <div className="rounded-lg bg-surface-raised/40 border border-white/[0.04] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember shrink-0">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <div>
                          <p className="text-xs font-semibold text-ink">
                            Reset Harian: {geminiQuota.resetScheduleText}
                          </p>
                          <p className="text-micro text-muted">
                            Sinkron tengah malam 00:00 Pacific Time (PT) Google Cloud
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 self-start sm:self-center">
                        <span className="text-micro text-muted">Refresh limit:</span>
                        <span className="rounded-md bg-ember/15 border border-ember/30 px-2 py-0.5 font-mono text-xs font-bold text-ember">
                          {geminiQuota.countdownText}
                        </span>
                      </div>
                    </div>

                    {/* Financial & Economic Logic (What 1 generation costs in Rupiah) */}
                    <div className="rounded-lg bg-surface-raised/40 border border-white/[0.04] p-3 space-y-2.5">
                      <p className="text-micro font-semibold uppercase tracking-wider text-ember-lo">
                        Logika Finansial & Valuasi Rupiah per Generate
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="rounded-md bg-surface p-2.5 border border-white/[0.04]">
                          <p className="text-micro text-muted">Biaya Kas Riil SaaS</p>
                          <p className="mt-0.5 font-display text-sm font-bold text-emerald-400">
                            Rp 0
                          </p>
                          <p className="text-[10px] text-muted">100% Bebas Biaya Server</p>
                        </div>

                        <div className="rounded-md bg-surface p-2.5 border border-white/[0.04]">
                          <p className="text-micro text-muted">Valuasi Komersial Pasar</p>
                          <p className="mt-0.5 font-display text-sm font-bold text-ink">
                            ~Rp 8 – Rp 15 <span className="text-[11px] font-normal text-muted">/ gen</span>
                          </p>
                          <p className="text-[10px] text-muted">Tarif resmi Google API ($0.15/$0.60)</p>
                        </div>

                        <div className="rounded-md bg-surface p-2.5 border border-white/[0.04]">
                          <p className="text-micro text-muted">Modal Dihemat Hari Ini</p>
                          <p className="mt-0.5 font-display text-sm font-bold text-emerald-400">
                            Hemat {formatIdr(geminiQuota.commercialValueSavedTodayIdr)}
                          </p>
                          <p className="text-[10px] text-muted">Dari {geminiQuota.used} req ({geminiQuota.totalTokensToday.toLocaleString("id-ID")} token)</p>
                        </div>
                      </div>

                      <p className="text-micro text-muted leading-relaxed">
                        <span className="text-ink font-medium">Logika Margins: </span>
                        User membayar via kuota kredit (contoh Script 4 kredit = Rp 600). Karena modal AI server adalah Rp 0 (Google Free Tier), seluruh pembayaran user merupakan <span className="text-emerald-400 font-semibold">100% Gross Cash Margin</span> yang langsung menjadi profit founder.
                      </p>
                    </div>

                    {/* Per Key Status Grid */}
                    <div className="space-y-1.5">
                      <p className="text-micro text-muted">Status 4 Kunci API di Pool:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {geminiQuota.keys.map((k) => (
                          <div key={k.slot} className="rounded-lg bg-surface p-2 border border-white/[0.04] text-micro">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-ink">Kunci #{k.slot}</span>
                              <span className={`size-2 rounded-full ${
                                k.health === "healthy" ? "bg-emerald-400" :
                                k.health === "cooling" ? "bg-ember animate-pulse" :
                                k.health === "idle" ? "bg-white/20" : "bg-danger"
                              }`} />
                            </div>
                            <p className="mt-1 font-mono text-[11px] text-ink font-medium">
                              {k.requests} req
                            </p>
                            <p className="text-[10px] text-muted">
                              {k.tokens.toLocaleString("id-ID")} tkn · {k.health === "healthy" ? "Sehat" : k.health === "idle" ? "Siap" : k.health === "cooling" ? "Cooling" : "Cek"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {brain.fallbacks.map((f, i) => (
                  <Row
                    key={f.modelId}
                    role={`Cadangan ${i + 1}`}
                    label={f.label}
                    provider={f.provider}
                    active={f.active}
                    health={f.health}
                  />
                ))}
                {brain.fallbacks.length === 0 && (
                  <p className="rounded-lg border border-hairline px-3 py-2 text-micro leading-relaxed text-muted">
                    Belum ada cadangan. Kalau AI utamanya lagi ngambek, generate
                    bakal gagal — padahal bisa otomatis pindah ke AI lain.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-hairline px-3 py-6 text-center">
                <p className="text-mini text-muted">
                  Masih pakai Gemini bawaan. Tekan Ganti buat pilih otak AI sendiri.
                </p>
              </div>
            )}

            <p className="text-micro text-muted">
              {brain.followingCount} fitur ngikut otak AI ini
              {brain.overriddenCount > 0 && `, ${brain.overriddenCount} fitur diatur sendiri`}.
            </p>
          </>
        ) : (
          <div className="space-y-3">
            {active.length === 0 && (
              <p className="rounded-lg border border-ember/20 bg-ember/5 px-3 py-2 text-micro leading-relaxed text-ember-lo">
                Belum ada model aktif. Tambah gateway dulu, scan modelnya, terus
                nyalain minimal satu.
              </p>
            )}

            <label className="block">
              <span className="text-micro text-muted">AI utama</span>
              <select
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-mini text-ink"
              >
                <option value="">Gemini bawaan (jalur lama)</option>
                {active.map((m) => (
                  <option key={m.id} value={m.id}>
                    {modelLabel(m)}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-micro text-muted">
                Cadangan kalau yang utama gagal (urut, boleh kosong)
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {active
                  .filter((m) => m.id !== primary)
                  .map((m) => {
                    const picked = fallbacks.includes(m.id);
                    const order = fallbacks.indexOf(m.id) + 1;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setFallbacks(
                            picked
                              ? fallbacks.filter((x) => x !== m.id)
                              : [...fallbacks, m.id],
                          )
                        }
                        className={`rounded-full px-2.5 py-1 text-micro ${
                          picked ? "bg-ember text-obsidian" : "border border-hairline text-muted"
                        }`}
                      >
                        {picked && <span className="font-mono">{order}. </span>}
                        {m.label ?? m.model_id}
                      </button>
                    );
                  })}
              </div>
            </div>

            {err && (
              <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-micro leading-relaxed text-danger">
                {err}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={commit}
                disabled={busy}
                className="rounded-full bg-ember px-4 py-1.5 text-micro font-bold text-obsidian disabled:opacity-50"
              >
                {busy ? "Nyimpen..." : "Simpan"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setErr(null);
                  setPrimary(brain.primary?.modelId ?? "");
                  setFallbacks(brain.fallbacks.map((f) => f.modelId));
                }}
                className="rounded-full border border-hairline px-4 py-1.5 text-micro text-muted"
              >
                Batal
              </button>
            </div>
          </div>
        )}
          </div>
        )}
      </div>
    </section>
  );
}
