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

export function InstallAppModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-app-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-x-hidden overflow-y-auto select-none touch-pan-y overscroll-none animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden custom-scrollbar rounded-3xl border border-ember/30 bg-[#12100e] p-5 sm:p-6 shadow-2xl ring-1 ring-white/10 space-y-4 animate-in zoom-in-95 duration-200 text-ink overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Constrained Glow Accents */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute -top-24 -left-24 size-48 rounded-full bg-ember/15 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 size-48 rounded-full bg-ember/10 blur-3xl" />
        </div>

        {/* Modal Header */}
        <div className="relative z-10 flex items-start justify-between pb-1 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-ember/40 bg-ember/15 text-ember shadow-md shadow-ember/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <h2 id="install-app-title" className="font-display text-base sm:text-lg font-bold text-white">
                Unduh &amp; Pasang Malesan
              </h2>
              <p className="text-xs text-mist">
                Pilih versi aplikasi yang sesuai dengan perangkat kamu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-mist transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 3 Platform Cards */}
        <div className="relative z-10 space-y-3">
          {/* Card 1: Versi Android (Official Android SVG Logo) */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-surface-raised/40 p-3.5 sm:p-4 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#3ddc84]/15 border border-[#3ddc84]/30 text-[#3ddc84]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
                    <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.411 13.8561 8 12 8s-3.5902.411-5.1367.9507L4.841 5.4477a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
                  </svg>
                </div>
                <div>
                  <span className="font-display text-sm font-bold text-white block">Versi Android (APK)</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Android 8.0 ke atas • 60fps Native</span>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                HP Android
              </span>
            </div>

            <p className="text-[11px] text-mist leading-relaxed">
              Akselerasi hardware 60fps, olah video panjang tanpa lag, dan simpan otomatis ke Galeri (DCIM/Malesan).
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <a
                href="/malesan.apk"
                download="malesan.apk"
                onClick={onClose}
                className="flex h-9.5 w-full flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 font-display text-xs font-bold text-emerald-200 shadow-sm transition-all active:scale-[0.99]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Unduh APK ({LATEST_APK_DISPLAY_SIZE})</span>
              </a>

              <a
                href="/malesan-arm32.apk"
                download="malesan-arm32.apk"
                onClick={onClose}
                className="flex h-9.5 w-full sm:w-auto px-3 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 font-display text-[11px] font-medium text-mist hover:text-white transition-all whitespace-nowrap"
              >
                <span>ARM32 ({LATEST_ARM32_SIZE})</span>
              </a>
            </div>
          </div>

          {/* Card 2: Versi Windows (Official Windows SVG Logo) */}
          <div className="rounded-2xl border border-ember/50 bg-gradient-to-b from-ember/[0.12] to-surface-raised/60 p-3.5 sm:p-4 space-y-2.5 shadow-lg shadow-ember/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#00adef]/15 border border-[#00adef]/30 text-[#00adef]">
                  <svg viewBox="0 0 88 88" fill="currentColor" className="size-4.5">
                    <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.016 45.728zm4.326-39.027L87.914 0v41.527l-47.918.378zm47.918 43.684L40.024 88l-.028-41.728 47.918.291z" />
                  </svg>
                </div>
                <div>
                  <span className="font-display text-sm font-bold text-white block">Versi Windows (.EXE)</span>
                  <span className="text-[10px] text-amber-400 font-semibold">Windows 10 &amp; 11 (64-bit)</span>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-ember/40 bg-ember/20 px-2 py-0.5 text-[10px] font-bold text-ember">
                ★ Rekomendasi PC
              </span>
            </div>

            <p className="text-[11px] text-mist leading-relaxed">
              <strong>Zero Bridge</strong>: yt-dlp &amp; FFmpeg sudah tertanam. Akselerasi GPU (AMD Vega/Radeon, Intel, NVIDIA) &amp; simpan ke Videos/Malesan.
            </p>

            <a
              href="/Malesan-Setup.exe"
              download="Malesan-Setup.exe"
              onClick={onClose}
              className="btn-ember flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl font-display text-xs font-bold text-obsidian shadow-md shadow-ember/20 transition-all active:scale-[0.99] hover:brightness-105"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Unduh Malesan-Setup.exe (~226 MB)</span>
            </a>
          </div>

          {/* Card 3: Versi Web PWA (Screen/Browser Icon) */}
          <div className="rounded-2xl border border-white/10 bg-surface-raised/30 p-3.5 sm:p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/15 text-mist">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5">
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <div>
                  <span className="font-display text-sm font-bold text-white block">Versi Web App (PWA)</span>
                  <span className="text-[10px] text-mist">Chrome, Edge, Safari, Brave</span>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-mist">
                Instan &amp; Ringan
              </span>
            </div>

            <p className="text-[11px] text-mist leading-relaxed">
              Jalankan langsung di browser atau pasang shortcut ke layar utama tanpa download file besar.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={triggerPwaInstall}
                className="flex h-9 w-full flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 font-display text-xs font-bold text-white hover:bg-white/10 transition-all active:scale-[0.99]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{isInstalled ? "Buka di Mode PWA" : "Pasang Shortcut PWA"}</span>
              </button>

              <a
                href="/malesan-bridge.zip"
                download="malesan-bridge.zip"
                onClick={onClose}
                className="flex h-9 w-full sm:w-auto px-3 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/40 hover:bg-white/5 font-display text-[11px] font-medium text-mist hover:text-white transition-all whitespace-nowrap"
              >
                <span>Bridge Browser (.zip)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}