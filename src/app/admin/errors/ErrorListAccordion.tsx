"use client";

import React, { useState, useTransition } from "react";
import { deleteErrorGroup } from "@/app/actions/admin";

export type ErrorRow = {
  id: number;
  scope: string;
  module: string | null;
  key_index: number | null;
  model: string | null;
  status: number | null;
  message: string;
  created_at: string;
};

export type ErrorGroup = {
  rows: ErrorRow[];
  info: {
    masalah: string;
    dampak: string;
    sistemAction: string;
    founderAction: string;
    severity: "low" | "medium" | "high";
  };
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "barusan";
  if (mins < 60) return `${mins}m lalu`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
}

export function ErrorListAccordion({ initialGroups }: { initialGroups: ErrorGroup[] }) {
  const [openIndices, setOpenIndices] = useState<Record<number, boolean>>({ 0: true });
  const [deletingKey, setDeletingKey] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggleAccordion = (index: number) => {
    setOpenIndices((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const areAllOpen = initialGroups.length > 0 && initialGroups.every((_, i) => !!openIndices[i]);

  const toggleAll = () => {
    if (areAllOpen) {
      setOpenIndices({});
    } else {
      const all: Record<number, boolean> = {};
      initialGroups.forEach((_, i) => {
        all[i] = true;
      });
      setOpenIndices(all);
    }
  };

  const handleDelete = (index: number, ids: number[]) => {
    if (!window.confirm(`Hapus issue ini (${ids.length} riwayat kejadian)?`)) return;
    setDeletingKey(index);
    startTransition(async () => {
      try {
        await deleteErrorGroup(ids);
        setToast("Issue berhasil dihapus dari log.");
        setTimeout(() => setToast(null), 3000);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Gagal menghapus issue.");
      } finally {
        setDeletingKey(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-emerald-500/30 bg-surface-raised px-4 py-2.5 text-xs font-semibold text-emerald-400 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-micro text-muted font-mono">
          {initialGroups.length} Jenis Masalah Ditemukan
        </span>
        <button
          type="button"
          onClick={toggleAll}
          className="cursor-pointer rounded-lg border border-white/[0.08] bg-surface px-2.5 py-1 text-micro font-medium text-muted hover:text-ink hover:border-white/20 transition-colors"
        >
          {areAllOpen ? "Ciutkan Semua" : "Buka Semua"}
        </button>
      </div>

      <div className="space-y-3">
        {initialGroups.map((g, i) => {
          const isOpen = !!openIndices[i];
          const latest = g.rows[0];
          const isDeleting = deletingKey === i;

          const severityBg =
            g.info.severity === "high"
              ? "border-danger/40 bg-danger/5"
              : "border-amber-500/30 bg-amber-500/5";

          const badgeColor =
            g.info.severity === "high"
              ? "bg-danger/10 text-danger border-danger/30"
              : "bg-amber-500/10 text-amber-400 border-amber-500/30";

          return (
            <div
              key={i}
              className={`surface-card rounded-2xl border transition-all shadow-xs overflow-hidden ${severityBg}`}
            >
              {/* Accordion Header */}
              <div
                onClick={() => toggleAccordion(i)}
                className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left cursor-pointer hover:bg-white/[0.02] transition-colors gap-3 select-none"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex size-7 items-center justify-center rounded-lg border border-current/30 text-xs shrink-0 mt-0.5">
                    {g.info.severity === "high" ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-danger">
                        <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-amber-400">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-sm sm:text-base font-bold text-ink leading-snug truncate">
                      {g.info.masalah}
                    </h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-micro text-muted font-mono">
                      {latest.status && <span className="text-danger font-semibold">HTTP {latest.status}</span>}
                      {latest.model && <span className="truncate max-w-[150px]">• {latest.model}</span>}
                      <span>• {timeAgo(latest.created_at)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-micro font-bold ${badgeColor}`}
                  >
                    {g.rows.length}×
                  </span>

                  <button
                    type="button"
                    title="Hapus kelompok error ini"
                    disabled={isDeleting}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(i, g.rows.map((r) => r.id));
                    }}
                    className="p-1.5 rounded-lg text-muted/60 hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    )}
                  </button>

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className={`size-4 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Collapsible Content */}
              {isOpen && (
                <div className="p-4 pt-2 space-y-3.5 border-t border-hairline/60 bg-surface/30">
                  {/* 3 Petunjuk Founder */}
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <div className="rounded-xl border border-hairline bg-surface p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 text-muted">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-danger">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                          <span className="eyebrow text-muted">Dampak ke User</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-ink/90">
                          {g.info.dampak}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-hairline bg-surface p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 text-muted">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-ember">
                            <rect x="3" y="11" width="18" height="10" rx="2" />
                            <circle cx="12" cy="5" r="2" />
                            <path d="M12 7v4" />
                            <line x1="8" y1="16" x2="8" y2="16" />
                            <line x1="16" y1="16" x2="16" y2="16" />
                          </svg>
                          <span className="eyebrow text-muted">Aksi Otomatis Sistem</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-ink/90">
                          {g.info.sistemAction}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-ember/30 bg-ember/10 p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 text-ember">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-ember">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                          </svg>
                          <span className="eyebrow text-ember font-bold">Tindakan Founder</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-ember-lo font-medium">
                          {g.info.founderAction}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Technical details */}
                  <details className="group border-t border-hairline/60 pt-2.5">
                    <summary className="cursor-pointer text-micro font-semibold text-muted hover:text-ink select-none flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                        <polyline points="4 17 10 11 4 5" />
                        <line x1="12" y1="19" x2="20" y2="19" />
                      </svg>
                      <span>Lihat Log Teknis Asli</span>
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-hairline bg-obsidian p-3 font-mono text-micro leading-relaxed text-muted">
                      {latest.message}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
