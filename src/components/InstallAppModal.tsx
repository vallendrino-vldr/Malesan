"use client";

import { useState, useEffect, useSyncExternalStore } from "react";

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

        <div className="relative z-10 space-y-3">
          {/* Native Engine / APK Pro for Android (PRIMARY HERO CARD) */}
          {isMobile ? (
            <div className="rounded-2xl border-2 border-ember/60 bg-gradient-to-br from-ember/15 via-[#1a1410] to-[#12100e] p-4 space-y-3.5 shadow-xl relative overflow-hidden">
              <div className="pointer-events-none absolute -right-6 -bottom-6 size-28 rounded-full bg-ember/10 blur-xl" />
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/50 bg-ember/25 px-2.5 py-0.5 text-[10px] font-extrabold text-ember uppercase tracking-wider shadow-xs">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="size-3" aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Versi Pro Terbaik (Rekomendasi)
                </span>
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  60fps Hardware
                </span>
              </div>

              <div>
                <p className="font-display text-sm font-bold text-white">Malesan APK Pro (Native Android)</p>
                <div className="mt-2 space-y-1.5 text-xs text-white/90 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="text-ember font-bold shrink-0">⚡</span>
                    <span><strong>Auto Clip 1-Klik dari YouTube:</strong> Tekan <em>Share</em> di aplikasi YouTube langsung terdeteksi &amp; dipotong otomatis.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-ember font-bold shrink-0">💾</span>
                    <span><strong>Simpan Langsung ke Galeri:</strong> Hasil ekspor otomatis tersimpan di folder <em>DCIM/Malesan</em> tanpa download manual.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-ember font-bold shrink-0">🚀</span>
                    <span><strong>Potong Podcast 1-2 Jam:</strong> Akselerasi hardware native tanpa batasan kuota memori browser / crash.</span>
                  </div>
                </div>
              </div>

              <a
                href="/malesan.apk"
                download="malesan.apk"
                onClick={onClose}
                className="btn-ember flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl font-display text-xs font-extrabold text-obsidian shadow-lg transition-all active:scale-[0.99] hover:brightness-110"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="size-4.5" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download APK Pro (52 MB)</span>
              </a>

              <a
                href="/malesan-arm32.apk"
                download="malesan-arm32.apk"
                onClick={onClose}
                className="flex h-7 w-full cursor-pointer items-center justify-center rounded-lg text-[11px] font-semibold text-mist hover:text-white transition-colors"
              >
                HP lawas (32-bit)? Unduh versi ARM32
              </a>
            </div>
          ) : (
            <div className="rounded-2xl border border-hairline/80 bg-surface/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink">Malesan Bridge (PC / Laptop)</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-ember/30 bg-ember/10 px-2 py-0.5 text-[10px] font-mono font-bold text-ember">
                  Windows / Chrome
                </span>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                Diperlukan jika kamu ingin <strong>memotong video YouTube langsung di browser PC</strong> tanpa kuota server. Ekstrak zip lalu jalankan <code>INSTALL_MALESAN_BRIDGE.cmd</code>.
              </p>

              <a
                href="/malesan-bridge.zip"
                download="malesan-bridge.zip"
                onClick={onClose}
                className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] font-display text-xs font-semibold text-ink transition-all hover:border-ember/40 hover:bg-ember/10 hover:text-ember active:scale-[0.99]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Unduh Malesan Bridge (.zip)</span>
              </a>
            </div>
          )}

          {/* PWA App Card (LIGHTWEIGHT SECONDARY OPTION) */}
          <div className="rounded-2xl border border-hairline bg-surface/40 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">Mode PWA ({isMobile ? "Web Ringan" : "Aplikasi Desktop"})</span>
              <span className="text-[10px] font-semibold text-muted">Alternatif Tanpa Download</span>
            </div>

            <p className="text-micro text-muted leading-relaxed">
              Langsung pasang shortcut ke layar utama HP tanpa file APK. Pembaruan otomatis setiap buka aplikasi.
            </p>

            <button
              type="button"
              onClick={triggerPwaInstall}
              className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] font-display text-xs font-semibold text-mist hover:text-white hover:border-white/20 transition-all active:scale-[0.99]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{isInstalled ? "Buka Mode PWA" : isMobile ? "Pasang Shortcut ke Layar Utama" : "Pasang Aplikasi Desktop"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}