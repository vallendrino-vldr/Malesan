"use client";

import Link from "next/link";
import { ThreeCanvas } from "./ThreeCanvas";
import { LivingStudioCanvas } from "./LivingStudioCanvas";

export function CompanionHero() {
  return (
    <section className="relative overflow-hidden pt-4 pb-12 sm:pt-10 sm:pb-18 lg:pt-12 lg:pb-20">
      {/* Purposeful Ambient Depth Background */}
      <ThreeCanvas />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:items-center lg:gap-12">
          
          {/* =========================================================================
              MOBILE ONLY: Living AI Scene on Top (Immediate Emotional Hook)
             ========================================================================= */}
          <div className="flex justify-center mb-6 lg:hidden">
            <LivingStudioCanvas />
          </div>

          {/* =========================================================================
              LEFT COLUMN: Product Headline, Casual Brand Subtitle, and CTAs (7 Cols)
             ========================================================================= */}
          <div className="flex flex-col items-start lg:col-span-7">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-3.5 py-1 shadow-xs backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-ember animate-pulse" />
              <span className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
                AI Creative Companion
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-4 font-display text-[clamp(2.3rem,6.5vw,4.25rem)] font-extrabold leading-[1.04] tracking-display-lg text-ink">
              Males mikirnya.
              <br />
              <span className="text-gradient-ember">Bukan bikinnya.</span>
            </h1>

            {/* Casual Brand Subtitle */}
            <p className="mt-4 max-w-lg text-sm sm:text-base lg:text-lg leading-relaxed text-muted">
              AI Creative Companion yang nemenin lo cari ide, bikin hook, tulis script, sampai siap tayang.
            </p>

            {/* Clean Solid CTA Buttons */}
            <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link
                href="/masuk"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-ember px-7 py-3.5 font-display text-sm sm:text-base font-bold text-obsidian shadow-sm transition-all duration-200 hover:bg-ember-lo hover:shadow-[0_4px_20px_rgba(255,138,61,0.25)] hover:scale-[1.01] active:scale-[0.99]"
              >
                <span>Mulai bikin konten</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>

              <a
                href="#journey"
                className="inline-flex items-center justify-center rounded-xl border border-hairline/80 bg-surface/60 px-6 py-3.5 font-display text-sm sm:text-base font-semibold text-ink backdrop-blur-md transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ember-lo active:scale-[0.99]"
              >
                Lihat cara kerja
              </a>
            </div>

            {/* Trust Badges: Compact Premium Pills */}
            {/* Desktop Horizontal Badges */}
            <div className="hidden sm:flex mt-7 items-center gap-3 border-t border-hairline/60 pt-4 text-xs text-muted">
              <div className="flex items-center gap-1.5 rounded-full border border-hairline/70 bg-surface/40 px-3 py-1 font-medium">
                <span className="text-ember font-bold">✓</span>
                <span><strong className="text-ink">10 kredit gratis</strong> tiap hari</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-hairline/70 bg-surface/40 px-3 py-1 font-medium">
                <span className="text-ember font-bold">✓</span>
                <span>Login Google tanpa ribet</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-hairline/70 bg-surface/40 px-3 py-1 font-medium">
                <span className="text-ember font-bold">✓</span>
                <span>Ide pertama &lt;30 detik</span>
              </div>
            </div>

            {/* Mobile 3 Compact Badges */}
            <div className="grid sm:hidden grid-cols-3 gap-2 mt-5 w-full border-t border-hairline/60 pt-3 text-[11px]">
              <div className="flex flex-col items-center justify-center p-2 rounded-xl border border-hairline/70 bg-surface/40 text-center">
                <span className="font-bold text-ink">10 Kredit</span>
                <span className="text-[10px] text-muted">Gratis Tiap Hari</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-xl border border-hairline/70 bg-surface/40 text-center">
                <span className="font-bold text-ink">Google Login</span>
                <span className="text-[10px] text-muted">Tanpa Ribet</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-xl border border-hairline/70 bg-surface/40 text-center">
                <span className="font-bold text-ink">&lt;30 Detik</span>
                <span className="text-[10px] text-muted">Ide Pertama</span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              DESKTOP ONLY: Living AI Studio Canvas (5 Cols)
             ========================================================================= */}
          <div className="hidden lg:flex lg:col-span-5 flex-col items-center justify-center">
            <LivingStudioCanvas />
          </div>

        </div>
      </div>
    </section>
  );
}
