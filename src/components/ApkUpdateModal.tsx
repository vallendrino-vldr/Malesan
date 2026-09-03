"use client";

import { useState, useEffect } from "react";
import {
  triggerNativeApkUpdate,
  triggerDesktopUpdate,
  installDesktopUpdate,
  subscribeNativeResponses,
} from "@/lib/native/bridge";
import type { ApkUpdateInfo } from "@/lib/native/version";

export function ApkUpdateModal({
  open,
  onClose,
  updateInfo,
  isNativeApk,
  isDesktop = false,
}: {
  open: boolean;
  onClose: () => void;
  updateInfo: ApkUpdateInfo | null;
  isNativeApk: boolean;
  isDesktop?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [readyToInstall, setReadyToInstall] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = () => {
    setDownloading(false);
    setDownloadProgress(0);
    setReadyToInstall(false);
    setDownloadSuccess(false);
    setErrorMessage(null);
    onClose();
  };

  useEffect(() => {
    if (!open) return;

    // Subscribe to Electron / Android native progress events
    const unsubscribe = subscribeNativeResponses((res) => {
      if (res.type === "DESKTOP_UPDATE_PROGRESS" && typeof res.progress === "number") {
        setDownloading(true);
        setDownloadProgress(res.progress);
      } else if (res.type === "DESKTOP_UPDATE_READY") {
        setDownloading(false);
        setDownloadProgress(100);
        setReadyToInstall(true);
      } else if (res.type === "NATIVE_ERROR") {
        setDownloading(false);
        setErrorMessage(res.message || "Gagal mengunduh pembaruan.");
      }
    });

    return unsubscribe;
  }, [open]);

  if (!open || !updateInfo) return null;

  const handleUpdate = async () => {
    setErrorMessage(null);
    setDownloading(true);

    if (isDesktop) {
      const started = await triggerDesktopUpdate(
        updateInfo.downloadUrl,
        updateInfo.latestVersion,
      );
      if (!started) {
        // Fallback: direct browser download
        window.open(updateInfo.downloadUrl, "_blank");
        setDownloadSuccess(true);
        setDownloading(false);
      }
      return;
    }

    if (isNativeApk) {
      const started = await triggerNativeApkUpdate(
        updateInfo.downloadUrl,
        updateInfo.latestVersion,
      );
      if (started) {
        setDownloadSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 2500);
        return;
      }
    }

    // Fallback: direct browser download
    const link = document.createElement("a");
    link.href = updateInfo.downloadUrl;
    link.download = isDesktop
      ? `Malesan-Setup-v${updateInfo.latestVersion}.exe`
      : `malesan-v${updateInfo.latestVersion}.apk`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => {
      handleClose();
    }, 2000);
  };

  const handleInstallAndRestart = async () => {
    await installDesktopUpdate();
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
                  {isDesktop ? "Pembaruan Studio Desktop" : "Pembaruan Sistem Siap"}
                </h2>
                <span className="rounded-full border border-ember/40 bg-ember/15 px-2 py-0.5 font-mono text-[10px] font-bold text-ember">
                  v{updateInfo.latestVersion}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {isDesktop
                  ? `Malesan Studio Windows (${updateInfo.displaySize || "226 MB"})`
                  : `Malesan Android APK (${updateInfo.displaySize})`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
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
          <ul className="space-y-2 text-xs text-muted leading-relaxed max-h-48 overflow-y-auto pr-1">
            {updateInfo.changelog.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="size-1.5 rounded-full bg-ember shrink-0 mt-1.5" />
                <span className="text-mist">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Progress Bar (Desktop downloading) */}
        {downloading && (
          <div className="relative z-10 space-y-2 rounded-2xl border border-ember/30 bg-ember/5 p-3.5">
            <div className="flex items-center justify-between text-xs font-semibold text-ember">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-ember animate-ping" />
                <span>Mengunduh Pembaruan...</span>
              </span>
              <span className="font-mono">{downloadProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-obsidian/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-ember to-amber-400 transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-muted text-center">
              Aplikasi tetap bisa dipakai seperti biasa selama unduhan berjalan.
            </p>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="relative z-10 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            {errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="relative z-10 space-y-2 pt-1">
          {readyToInstall ? (
            <button
              type="button"
              onClick={handleInstallAndRestart}
              className="btn-ember flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl font-display text-xs font-bold text-obsidian shadow-md transition-all active:scale-[0.99] hover:brightness-105"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Pasang & Restart Malesan Studio Sekarang</span>
            </button>
          ) : downloadSuccess ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4 shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                {isNativeApk
                  ? "Unduhan berjalan di latar belakang! Cek panel notifikasi HP kamu."
                  : "File installer sedang diunduh..."}
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
                  <span>Mengunduh di Latar Belakang...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>
                    {isDesktop
                      ? `Perbarui Otomatis (${updateInfo.displaySize || "226 MB"})`
                      : `Perbarui Sekarang (${updateInfo.displaySize})`}
                  </span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-full cursor-pointer items-center justify-center rounded-xl text-xs font-semibold text-muted hover:text-ink transition-colors"
          >
            {readyToInstall ? "Nanti Saja Saat Keluar" : "Nanti Saja"}
          </button>
        </div>
      </div>
    </div>
  );
}

