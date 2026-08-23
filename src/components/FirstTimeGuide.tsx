"use client";

import { useState, useSyncExternalStore, useCallback } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem("malesan:first-time-guide-dismissed") === "true";
  } catch {
    return true;
  }
}

function getServerSnapshot(): boolean {
  return true; // hide during SSR to avoid mismatch
}

export function FirstTimeGuide() {
  const isDismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [closed, setClosed] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const handleDismiss = useCallback(() => {
    setClosed(true);
    try {
      localStorage.setItem("malesan:first-time-guide-dismissed", "true");
    } catch {
      // ignore
    }
  }, []);

  if (isDismissed || closed) return null;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-ember/40 bg-gradient-to-r from-ember/15 via-ember/5 to-transparent p-4 sm:p-5 shadow-lg animate-fade-in">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ember/20 text-lg border border-ember/30">
              💡
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="eyebrow text-ember font-bold">Panduan Kilat Pemula</span>
                <span className="rounded-full bg-ember/20 px-2 py-0.2 text-[10px] font-semibold text-ember">
                  3 Langkah Gampang
                </span>
              </div>
              <h3 className="mt-1 font-display text-sm font-bold text-ink sm:text-base">
                Pertama kali buka, harus ngapain?
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Lo gak perlu mikir prompt AI yang ribet. Cukup ikuti 3 langkah gampang ini:
              </p>

              {/* 3 Step Micro-guide */}
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-hairline bg-surface/80 p-2.5 text-micro">
                  <span className="font-bold text-ember">1. Klik Tombol Emas</span>
                  <p className="mt-0.5 text-muted leading-snug">Klik <em>“Kasih 3 Ide Sekarang”</em> di bawah.</p>
                </div>
                <div className="rounded-xl border border-hairline bg-surface/80 p-2.5 text-micro">
                  <span className="font-bold text-ember">2. Pilih Ide Segar</span>
                  <p className="mt-0.5 text-muted leading-snug">Dapet 3 konsep konten lengkap + hook.</p>
                </div>
                <div className="rounded-xl border border-hairline bg-surface/80 p-2.5 text-micro">
                  <span className="font-bold text-ember">3. Jadi Script Siap Post</span>
                  <p className="mt-0.5 text-muted leading-snug">Salin script atau bikin subtitle video.</p>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-lg p-1.5 text-xs text-muted hover:bg-surface-raised hover:text-ink transition-colors"
            title="Tutup panduan"
          >
            ✕
          </button>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-hairline/60 pt-3">
          <button
            type="button"
            onClick={() => setShowVideo(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ember-lo hover:underline"
          >
            <span>▶</span> Tonton Video Tutorial (1 Menit)
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-ember-lo border border-ember/30 hover:border-ember transition-colors"
          >
            Siap, gue paham! 👍
          </button>
        </div>
      </div>

      {/* Video Tutorial Modal Slot */}
      {showVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-hairline bg-surface p-5 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎬</span>
                <h3 className="font-display text-base font-bold text-ink">Tutorial Kilat Malesan</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowVideo(false)}
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-raised hover:text-ink"
              >
                ✕
              </button>
            </div>

            {/* Video Player / Presentation Area */}
            <div className="mt-4 aspect-video w-full rounded-xl border border-hairline bg-obsidian flex flex-col items-center justify-center p-6 text-center">
              <span className="text-4xl mb-2">⚡</span>
              <p className="font-display text-sm font-bold text-ink">Bikin Konten Pertama Dalam 30 Detik</p>
              <p className="mt-1 text-xs text-muted max-w-sm">
                1. Klik &quot;Kasih 3 Ide Sekarang&quot; → 2. Pilih ide terbaik → 3. Jadi script &amp; video siap unggah.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowVideo(false);
                  handleDismiss();
                }}
                className="btn-ember mt-4 inline-flex items-center rounded-xl px-5 py-2.5 text-xs font-bold text-obsidian"
              >
                Mulai Praktik Sekarang 🚀
              </button>
            </div>

            <p className="mt-3 text-center text-micro text-muted">
              Males mikirnya. Bukan bikinnya.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
