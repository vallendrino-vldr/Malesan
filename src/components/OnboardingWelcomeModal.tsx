"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

const emptySubscribe = () => () => {};

export function OnboardingWelcomeModal({ show }: { show: boolean }) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const [dismissed, setDismissed] = useState(false);

  if (!isClient || !show || dismissed) return null;

  const isLocallyDismissed =
    typeof window !== "undefined" &&
    localStorage.getItem("malesan_onboarding_welcome_dismissed") === "1";

  if (isLocallyDismissed) return null;

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("malesan_onboarding_welcome_dismissed", "1");
    }
    setDismissed(true);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Dark backdrop with blur */}
      <div
        className="fixed inset-0 bg-obsidian/85 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={handleDismiss}
      />

      {/* Modal Dialog Content */}
      <div className="relative w-full max-w-lg rounded-3xl border border-white/[0.12] bg-gradient-to-b from-surface-raised via-[#101014] to-[#0a0a0d] p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-2xl transition-all animate-in zoom-in-95 duration-200">
        {/* Top Glow & Close Button */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/15 px-3 py-1 text-micro font-bold uppercase tracking-wider text-ember">
            <span className="size-1.5 rounded-full bg-ember animate-pulse" />
            <span>Saran Setup Awal (1 Menit)</span>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Tutup"
            className="flex size-8 items-center justify-center rounded-full border border-white/[0.1] bg-surface text-muted transition-all hover:border-white/[0.2] hover:text-ink cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Headline & Body */}
        <div className="mt-4">
          <h2 id="welcome-modal-title" className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink">
            Kenalan Dulu Biar Hasilnya Maksimal! 👋
          </h2>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted">
            Biar ide, hook, dan skrip yang dibikin AI langsung meniru gaya bahasa &amp; niche lo (bukan kayak robot kaku), yuk luangkan waktu 1 menit untuk atur profil konten lo.
          </p>
        </div>

        {/* 3 Core Value Benefits */}
        <div className="mt-5 space-y-2.5 rounded-2xl border border-white/[0.08] bg-[#09090b] p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-ember/15 text-ember text-xs font-bold">
              1
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Niche &amp; Target Audiens Terkunci</p>
              <p className="text-micro text-muted">AI paham persis siapa penonton lo dan apa masalah yang mereka hadapi.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-ember/15 text-ember text-xs font-bold">
              2
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Gaya Bahasa Khas Lo</p>
              <p className="text-micro text-muted">Pilih karakter santai, blak-blakan, atau rapi tanpa perlu kasih prompt manual lagi.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-ember/15 text-ember text-xs font-bold">
              3
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Eksekusi Instan &amp; Praktis</p>
              <p className="text-micro text-muted">Setiap generate ide &amp; skrip di Studio langsung siap pakai ke media sosial.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
          <Link
            href="/app/onboarding"
            onClick={handleDismiss}
            className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ember px-5 font-display text-xs sm:text-sm font-bold text-obsidian shadow-md transition-all hover:bg-ember-lo active:scale-[0.98] cursor-pointer"
          >
            <span>Atur Profil Karakter Sekarang ➔</span>
          </Link>

          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.12] bg-surface px-4 text-xs font-semibold text-muted hover:text-ink active:scale-[0.98] cursor-pointer"
          >
            <span>Nanti Saja</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
