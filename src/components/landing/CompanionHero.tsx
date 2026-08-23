"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { ThreeCanvas } from "./ThreeCanvas";
import { LivingStudioCanvas, STUDIO_STATES } from "./LivingStudioCanvas";

export function CompanionHero() {
  const [activeIdx, setActiveIdx] = useState(2); // Start at "Ide Ditemukan"
  const [isPaused, setIsPaused] = useState(false);

  // Auto-advance companion states smoothly
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % STUDIO_STATES.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [isPaused]);

  const current = STUDIO_STATES[activeIdx];

  return (
    <section className="relative overflow-hidden pt-4 pb-12 sm:pt-10 sm:pb-18 lg:pt-12 lg:pb-20">
      {/* Purposeful Ambient Backdrop */}
      <ThreeCanvas />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:items-center lg:gap-12">
          
          {/* =========================================================================
              MOBILE ONLY: Living Mascot Workspace on Top (Instant 2-Second Brand Hook)
             ========================================================================= */}
          <div className="flex justify-center mb-6 lg:hidden">
            <div
              className="relative flex w-full max-w-[340px] flex-col rounded-2xl border border-hairline/80 bg-surface/50 p-4 shadow-sm backdrop-blur-md"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <div className="flex items-center gap-3">
                <div className="relative size-14 shrink-0 grid place-items-center">
                  <Mascot working={current.isWorking} className="size-full filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-ember animate-pulse" />
                    <span className="font-mono text-[9px] font-bold text-ember uppercase tracking-wider">
                      {current.badge}
                    </span>
                  </div>
                  <p className="font-display text-xs font-bold text-ink truncate mt-0.5">
                    {current.title}
                  </p>
                  <p className="font-mono text-[10px] text-muted truncate mt-0.5">
                    {current.previewSnippet}
                  </p>
                </div>
              </div>

              {/* Mobile State Progress Indicators */}
              <div className="mt-3 flex items-center justify-between border-t border-hairline/60 pt-2">
                <span className="font-mono text-[9px] text-muted">Tahap {current.stepNum} dari 05</span>
                <div className="flex items-center gap-1">
                  {STUDIO_STATES.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveIdx(idx)}
                      aria-label={`Tahap ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        activeIdx === idx ? "w-4 bg-ember shadow-[0_0_6px_rgba(255,138,61,0.6)]" : "w-1.5 bg-muted/30"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              LEFT COLUMN: Product Headline, Short Value Subtitle, and Clean CTAs (7 Cols)
             ========================================================================= */}
          <div className="flex flex-col items-start lg:col-span-7">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-3 py-1 shadow-xs backdrop-blur-md">
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

            {/* Short Supporting Subtitle (Brand Tone) */}
            <p className="mt-4 max-w-lg text-sm sm:text-base lg:text-lg leading-relaxed text-muted">
              AI Creative Companion yang bantu lo cari ide, buat hook, tulis script, sampai siap tayang.
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
                href="#magic"
                className="inline-flex items-center justify-center rounded-xl border border-hairline/80 bg-surface/60 px-6 py-3.5 font-display text-sm sm:text-base font-semibold text-ink backdrop-blur-md transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ember-lo active:scale-[0.99]"
              >
                Lihat cara kerja
              </a>
            </div>

            {/* Trust Info: 3 Compact Cards on Mobile, Horizontal Strip on Desktop */}
            {/* Desktop Horizontal Strip */}
            <div className="hidden sm:flex mt-7 items-center gap-4 border-t border-hairline/60 pt-4 text-xs text-muted">
              <div className="flex items-center gap-1.5 font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span><strong className="text-ink">10 kredit gratis</strong> tiap hari</span>
              </div>
              <span className="text-hairline">•</span>
              <div className="flex items-center gap-1.5 font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Login Google tanpa password</span>
              </div>
              <span className="text-hairline">•</span>
              <div className="flex items-center gap-1.5 font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Siap dalam 30 detik</span>
              </div>
            </div>

            {/* Mobile 3 Compact Cards */}
            <div className="grid sm:hidden grid-cols-3 gap-2 mt-5 w-full border-t border-hairline/60 pt-3 text-[11px]">
              <div className="flex flex-col items-center justify-center p-2 rounded-xl border border-hairline/70 bg-surface/40 text-center">
                <span className="font-bold text-ink">10 Kredit</span>
                <span className="text-[10px] text-muted">Gratis Tiap Hari</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-xl border border-hairline/70 bg-surface/40 text-center">
                <span className="font-bold text-ink">Google OAuth</span>
                <span className="text-[10px] text-muted">Tanpa Password</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-xl border border-hairline/70 bg-surface/40 text-center">
                <span className="font-bold text-ink">30 Detik</span>
                <span className="text-[10px] text-muted">Siap Pakai</span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              DESKTOP ONLY: Living AI Studio (3D Holographic Workspace) (5 Cols)
             ========================================================================= */}
          <div
            className="hidden lg:flex lg:col-span-5 flex-col items-center justify-center"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <LivingStudioCanvas
              activeIdx={activeIdx}
              onSelectState={(idx) => setActiveIdx(idx)}
            />
          </div>

        </div>
      </div>
    </section>
  );
}
