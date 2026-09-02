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
        "Untuk memasang Malesan:\n1. Buka menu browser (ikon titik tiga ⫶ atau tombol Bagikan di Safari)\n2. Pilih 'Tambahkan ke Layar Utama' (Add to Home Screen)"
      );
    }
  };

  const isMobile = typeof window !== "undefined" && (/Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || window.innerWidth < 768);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-app-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-hairline/80 bg-[#12100e] p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-56 rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.18)_0%,transparent_70%)] blur-2xl"
        />

        <div className="relative z-10 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-ember/30 bg-ember/10 text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
                {isMobile ? (
                  <>
                    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </>
                ) : (
                  <>
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </>
                )}
              </svg>
            </div>
            <div>
              <h2 id="install-app-title" className="font-display text-base font-bold text-ink">
                {isMobile ? "Pasang Malesan di HP" : "Pasang Malesan di PC / Laptop"}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {isMobile ? "Pilih metode aplikasi yang kamu inginkan" : "Pilihan aplikasi & integrasi browser komputer"}
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

        <div className="relative z-10 space-y-3.5">
          {/* Card 1: APK Android (for Mobile) or Malesan Desktop (.EXE) (for PC/Laptop) */}
          {isMobile ? (
            <div className="rounded-2xl border border-ember/40 bg-gradient-to-b from-ember/[0.08] to-surface-raised/40 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-ember/15 text-ember">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                  <span className="font-display text-sm font-bold text-ink">APK Android (Native)</span>
                </div>
                <span className="shrink-0 rounded-full border border-ember/30 bg-ember/15 px-2 py-0.5 text-[10px] font-bold text-ember">
                  60fps Hardware
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-muted leading-relaxed">
                <div className="flex items-center gap-2">
                  <span className="size-1 rounded-full bg-ember shrink-0" />
                  <span>Akselerasi hardware 60fps &amp; olah video panjang tanpa lag</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-1 rounded-full bg-ember shrink-0" />
                  <span>Deteksi via tombol Share YouTube &amp; simpan langsung ke Galeri</span>
                </div>
              </div>

              <a
                href="/malesan.apk"
                download="malesan.apk"
                onClick={onClose}
                className="btn-ember flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl font-display text-xs font-bold text-obsidian shadow-md transition-all active:scale-[0.99] hover:brightness-105"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Unduh Malesan APK ({LATEST_APK_DISPLAY_SIZE})</span>
              </a>

              <div className="text-center">
                <a
                  href="/malesan-arm32.apk"
                  download="malesan-arm32.apk"
                  onClick={onClose}
                  className="inline-block text-[10px] font-semibold text-mist hover:text-ember transition-colors"
                >
                  HP lawas (32-bit)? Unduh versi ARM32 ({LATEST_ARM32_SIZE})
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-ember/50 bg-gradient-to-b from-ember/[0.12] to-surface-raised/60 p-4 space-y-3 shadow-lg shadow-ember/10">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-ember/20 text-ember border border-ember/40">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
                      <rect width="20" height="14" x="2" y="3" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-display text-sm font-bold text-white block">Malesan Desktop (.EXE)</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Windows 10 &amp; 11 (64-bit)</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-ember/40 bg-ember/20 px-2.5 py-0.5 text-[10px] font-bold text-ember shadow-sm">
                  ★ Rekomendasi
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-muted leading-relaxed">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-ember shrink-0" />
                  <span><strong>Zero Bridge</strong>: yt-dlp &amp; FFmpeg sudah tertanam, tanpa install Node.js/CMD</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-ember shrink-0" />
                  <span>Akselerasi GPU otomatis (AMD AMF, Intel QSV, NVIDIA NVENC)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-ember shrink-0" />
                  <span>Auto-Update 1-klik &amp; simpan otomatis ke folder Videos/Malesan</span>
                </div>
              </div>

              <a
                href="/Malesan-Setup.exe"
                download="Malesan-Setup.exe"
                onClick={onClose}
                className="btn-ember flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl font-display text-xs font-bold text-obsidian shadow-md shadow-ember/20 transition-all active:scale-[0.99] hover:brightness-105"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Unduh Malesan-Setup.exe (~226 MB)</span>
              </a>

              <div className="text-center pt-0.5">
                <a
                  href="/desktop"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-mist hover:text-ember transition-colors"
                >
                  Lihat halaman resmi &amp; panduan desktop →
                </a>
              </div>
            </div>
          )}

          {/* Card 2: PWA Web App Shortcut (for Mobile) or Web Browser Bridge (for PC) */}
          {isMobile ? (
            <div className="rounded-2xl border border-hairline bg-surface-raised/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/10 text-mist">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                  </div>
                  <span className="font-display text-sm font-bold text-ink">
                    PWA (Layar Utama)
                  </span>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-mist">
                  Instan &amp; Ringan
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-muted leading-relaxed">
                <div className="flex items-center gap-2">
                  <span className="size-1 rounded-full bg-mist shrink-0" />
                  <span>Pasang shortcut langsung ke layar HP tanpa download file</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-1 rounded-full bg-mist shrink-0" />
                  <span>Pembaruan sistem otomatis setiap membuka aplikasi</span>
                </div>
              </div>

              <button
                type="button"
                onClick={triggerPwaInstall}
                className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] font-display text-xs font-semibold text-ink transition-all hover:border-white/20 hover:bg-white/[0.08] active:scale-[0.99]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{isInstalled ? "Buka di Mode PWA" : "Pasang ke Layar Utama"}</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-hairline/80 bg-surface-raised/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-mist" />
                  <span className="text-xs font-semibold text-mist">Alternatif: Jalankan di Web Browser</span>
                </div>
                <button
                  type="button"
                  onClick={triggerPwaInstall}
                  className="text-[11px] font-bold text-ember hover:underline cursor-pointer"
                >
                  Pasang Shortcut PWA
                </button>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Jika ingin tetap memakai browser biasa, unduh{" "}
                <a href="/malesan-bridge.zip" download className="text-ember underline font-medium">
                  Malesan Bridge (.zip)
                </a>{" "}
                untuk mengaktifkan pemotong YouTube di Chrome/Edge.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}