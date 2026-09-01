"use client";

import { useState } from "react";
import { triggerNativeApkUpdate } from "@/lib/native/bridge";
import type { ApkUpdateInfo } from "@/lib/native/version";

export function ApkUpdateModal({
  open,
  onClose,
  updateInfo,
  isNativeApk,
}: {
  open: boolean;
  onClose: () => void;
  updateInfo: ApkUpdateInfo | null;
  isNativeApk: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!open || !updateInfo) return null;

  const handleUpdate = async () => {
    setDownloading(true);

    if (isNativeApk) {
      const started = await triggerNativeApkUpdate(
        updateInfo.downloadUrl,
        updateInfo.latestVersion,
      );
      if (started) {
        setDownloadSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2500);
        return;
      }
    }

    // Fallback: direct browser download
    const link = document.createElement("a");
    link.href = updateInfo.downloadUrl;
    link.download = `malesan-v${updateInfo.latestVersion}.apk`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="apk-update-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-ember/40 bg-[#12100e] p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-56 rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.22)_0%,transparent_70%)] blur-2xl"
        />

        {/* Header */}
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-ember/40 bg-ember/15 text-ember shadow-inner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="apk-update-title" className="font-display text-base font-bold text-ink">
                  Versi Baru Tersedia
                </h2>
                <span className="rounded-full border border-ember/40 bg-ember/15 px-2 py-0.5 font-mono text-[10px] font-bold text-ember">
                  v{updateInfo.latestVersion}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Pembaruan sistem siap dipasang ({updateInfo.displaySize})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-ink cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Box */}
        <div className="relative z-10 space-y-3 rounded-2xl border border-hairline/80 bg-surface-raised/40 p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-mist">
            Apa yang Baru di Versi Ini:
          </span>
          <ul className="space-y-2 text-xs text-muted leading-relaxed">
            {updateInfo.changelog.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="size-1.5 rounded-full bg-ember shrink-0 mt-1.5" />
                <span className="text-mist">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 space-y-2 pt-1">
          {downloadSuccess ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4 shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                {isNativeApk
                  ? "Unduhan berjalan di latar belakang! Cek panel notifikasi HP kamu."
                  : "File APK sedang diunduh..."}
              </span>
            </div>
          ) : (
            <button
              type="button"
              disabled={downloading}
              onClick={handleUpdate}
              className="btn-ember flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl font-display text-xs font-bold text-obsidian shadow-md transition-all active:scale-[0.99] hover:brightness-105 disabled:opacity-75"
            >
              {downloading ? (
                <>
                  <span className="size-4 rounded-full border-2 border-obsidian/30 border-t-obsidian animate-spin" />
                  <span>Memulai Pengunduhan...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Perbarui Sekarang ({updateInfo.displaySize})</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-full cursor-pointer items-center justify-center rounded-xl text-xs font-semibold text-muted hover:text-ink transition-colors"
          >
            Nanti Saja
          </button>
        </div>
      </div>
    </div>
  );
}
