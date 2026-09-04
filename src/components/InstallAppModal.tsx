"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { LATEST_APK_DISPLAY_SIZE, LATEST_ARM32_SIZE } from "@/lib/native/version";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const emptySubscribe = () => () => {};
const getIsInstalledSnapshot = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
};

const getOsSnapshot = (): "android" | "windows" | "ios" | "other" => {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/i.test(ua)) return "android";
  if (/windows/i.test(ua)) return "windows";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "other";
};

export function InstallAppModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const os = useSyncExternalStore(emptySubscribe, getOsSnapshot, () => "other");
  const isInstalled = useSyncExternalStore(emptySubscribe, getIsInstalledSnapshot, () => false);

  useEffect(() => {
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  if (!open) return null;

  const triggerPwaInstall = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstallEvent(null);
        onClose();
      }
    } else {
      alert(
        "Untuk memasang shortcut Malesan:\n1. Buka menu browser (ikon titik tiga ⫶ atau tombol Bagikan di Safari)\n2. Pilih 'Tambahkan ke Layar Utama' (Add to Home Screen / Install App)"
      );
    }
  };

  const isAndroidHero = os === "android";
  const isWindowsHero = os === "windows";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-app-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md select-none touch-pan-y animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto overflow-x-hidden custom-scrollbar rounded-3xl border border-hairline/80 bg-[#0d0d0d] p-4.5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Obsidian-Ember Glow */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute -top-20 -left-20 size-44 rounded-full bg-ember/15 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 size-44 rounded-full bg-ember/10 blur-3xl" />
        </div>

        {/* Modal Header */}
        <div className="relative z-10 flex items-center justify-between pb-3 border-b border-hairline/60">
          <div className="flex items-center gap-3">
            <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl border border-ember/35 bg-ember/15 text-ember shadow-xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4.5 sm:size-5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <h2 id="install-app-title" className="font-display text-sm sm:text-base font-bold text-white tracking-tight">
                Unduh &amp; Pasang Malesan
              </h2>
              <p className="text-[11px] sm:text-xs text-muted">
                {isAndroidHero ? "Aplikasi native 60fps untuk HP Android kamu" : isWindowsHero ? "Aplikasi desktop resmi untuk Windows kamu" : "Pilih format aplikasi yang sesuai perangkat kamu"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-muted hover:border-ember/40 hover:text-white transition-all active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Platform Cards (Re-ordered dynamically based on user device) */}
        <div className="relative z-10 space-y-2.5">
          {/* ============================================================
              1. ANDROID CARD
              ============================================================ */}
          <div
            className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 transition-all ${
              isAndroidHero
                ? "border-ember/50 bg-gradient-to-b from-surface-raised via-surface to-ember/[0.08] shadow-md shadow-ember/10 ring-1 ring-ember/30"
                : "border-hairline/80 bg-surface/60 hover:border-hairline"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`flex size-8 shrink-0 items-center justify-center rounded-xl border ${
                  isAndroidHero
                    ? "border-ember/40 bg-ember/15 text-ember"
                    : "border-hairline bg-surface text-muted"
                }`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4.5">
                    <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.411 13.8561 8 12 8s-3.5902.411-5.1367.9507L4.841 5.4477a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <span className="font-display text-xs sm:text-sm font-bold text-white block truncate">
                    Versi Android (APK)
                  </span>
                  <span className="text-[10px] text-muted block">
                    Android 8.0+ • 60fps Native
                  </span>
                </div>
              </div>

              {isAndroidHero ? (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-ember/40 bg-ember/15 px-2 py-0.5 text-[9.5px] font-bold text-ember uppercase tracking-wider">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-2.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Rekomendasi HP
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[9.5px] font-bold text-muted">
                  HP Android
                </span>
              )}
            </div>

            <p className="text-[11px] text-muted leading-relaxed">
              Akselerasi 60fps tanpa batasan browser, simpan video langsung ke Galeri HP (DCIM/Malesan).
            </p>

            <div className="space-y-1.5 pt-0.5">
              <a
                href="/malesan.apk"
                download="malesan.apk"
                onClick={onClose}
                className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl font-display text-xs font-bold transition-all active:scale-[0.99] ${
                  isAndroidHero
                    ? "bg-gradient-to-r from-ember to-ember-deep text-obsidian shadow-md shadow-ember/20 hover:brightness-105"
                    : "border border-hairline bg-surface hover:border-ember/40 text-white"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Unduh APK Resmi ({LATEST_APK_DISPLAY_SIZE})</span>
              </a>

              <div className="flex justify-center">
                <a
                  href="/malesan-arm32.apk"
                  download="malesan-arm32.apk"
                  onClick={onClose}
                  className="text-[10px] text-muted/70 hover:text-ember transition-colors inline-flex items-center gap-1 py-0.5"
                >
                  <span>HP 32-bit spek lama? Unduh ARM32 ({LATEST_ARM32_SIZE})</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* ============================================================
              2. WINDOWS CARD
              ============================================================ */}
          <div
            className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 transition-all ${
              isWindowsHero
                ? "border-ember/50 bg-gradient-to-b from-surface-raised via-surface to-ember/[0.08] shadow-md shadow-ember/10 ring-1 ring-ember/30"
                : "border-hairline/80 bg-surface/60 hover:border-hairline"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`flex size-8 shrink-0 items-center justify-center rounded-xl border ${
                  isWindowsHero
                    ? "border-ember/40 bg-ember/15 text-ember"
                    : "border-hairline bg-surface text-muted"
                }`}>
                  <svg viewBox="0 0 88 88" fill="currentColor" className="size-3.5">
                    <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.016 45.728zm4.326-39.027L87.914 0v41.527l-47.918.378zm47.918 43.684L40.024 88l-.028-41.728 47.918.291z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <span className="font-display text-xs sm:text-sm font-bold text-white block truncate">
                    Versi Windows (.EXE)
                  </span>
                  <span className="text-[10px] text-muted block">
                    Windows 10 &amp; 11 (64-bit)
                  </span>
                </div>
              </div>

              {isWindowsHero ? (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-ember/40 bg-ember/15 px-2 py-0.5 text-[9.5px] font-bold text-ember uppercase tracking-wider">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-2.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Rekomendasi PC
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[9.5px] font-bold text-muted">
                  PC / Laptop
                </span>
              )}
            </div>

            <p className="text-[11px] text-muted leading-relaxed">
              Performa desktop penuh dengan akselerasi GPU (Nvidia/AMD/Intel) dan mesin video offline.
            </p>

            <a
              href="/Malesan-Setup.exe"
              download="Malesan-Setup.exe"
              onClick={onClose}
              className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl font-display text-xs font-bold transition-all active:scale-[0.99] ${
                isWindowsHero
                  ? "bg-gradient-to-r from-ember to-ember-deep text-obsidian shadow-md shadow-ember/20 hover:brightness-105"
                  : "border border-hairline bg-surface hover:border-ember/40 text-white"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Unduh Installer PC (~226 MB)</span>
            </a>
          </div>

          {/* ============================================================
              3. PWA / WEB APP CARD
              ============================================================ */}
          <div className="rounded-2xl border border-hairline/80 bg-surface/60 p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-muted">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <span className="font-display text-xs sm:text-sm font-bold text-white block truncate">
                    Shortcut Web App (PWA)
                  </span>
                  <span className="text-[10px] text-muted block">
                    Chrome, Safari, Edge, Brave
                  </span>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[9.5px] font-bold text-muted">
                0 MB / Instan
              </span>
            </div>

            <p className="text-[11px] text-muted leading-relaxed">
              Jalankan langsung di browser atau pasang shortcut ke layar utama tanpa makan memori HP/PC.
            </p>

            <button
              type="button"
              onClick={triggerPwaInstall}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-surface hover:border-ember/40 font-display text-xs font-bold text-white transition-all active:scale-[0.99]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{isInstalled ? "Buka di Mode Shortcut" : "Pasang Shortcut ke Layar Utama"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}