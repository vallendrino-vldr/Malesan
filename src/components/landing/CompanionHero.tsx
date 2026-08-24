"use client";

import { useState } from "react";
import { TransitionButton } from "./TransitionButton";
import { ThreeCanvas } from "./ThreeCanvas";
import { LivingStudioCanvas, TOPIC_PRESETS } from "./LivingStudioCanvas";

export function CompanionHero() {
  const [selectedTopicId, setSelectedTopicId] = useState("bengkel");

  return (
    <section className="relative overflow-hidden pt-4 pb-12 sm:pt-8 sm:pb-16 lg:pt-12 lg:pb-20">
      {/* Purposeful Ambient Depth Background */}
      <ThreeCanvas />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:items-center lg:gap-12">
          
          {/* =========================================================================
              LEFT COLUMN: Product Headline, Magic Topic Bar, and CTAs (7 Cols)
             ========================================================================= */}
          <div className="flex flex-col items-start lg:col-span-7">
            {/* Status Pill — reveals first */}
            <div
              className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-3.5 py-1 shadow-xs backdrop-blur-md opacity-0"
              style={{ animation: "fade-up 0.6s ease-out 0.1s forwards" }}
            >
              <span className="size-1.5 rounded-full bg-ember animate-pulse" />
              <span className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
                Teman Kreatif AI
              </span>
            </div>

            {/* Main Headline — staggered word-by-word blur reveal */}
            <h1 className="mt-3.5 font-display text-[clamp(2.2rem,6vw,4rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
              <span
                className="inline-block opacity-0"
                style={{ animation: "hero-word-reveal 0.5s ease-out 0.25s forwards" }}
              >
                Males mikirnya.
              </span>
              <br />
              <span
                className="inline-block text-gradient-ember opacity-0"
                style={{ animation: "hero-word-reveal 0.5s ease-out 0.45s forwards" }}
              >
                Bukan bikinnya.
              </span>
            </h1>

            {/* Casual Brand Subtitle */}
            <p
              className="mt-3.5 max-w-lg text-sm sm:text-base lg:text-lg leading-relaxed text-muted opacity-0"
              style={{ animation: "fade-up 0.6s ease-out 0.7s forwards" }}
            >
              Teman kreatif AI yang nemenin lo cari ide, bikin hook pembakar penasaran, tulis script, sampai video siap tayang.
            </p>

            {/* Interactive Magic Topic Bar: Instant Live Demonstration */}
            <div
              className="mt-5 w-full flex flex-col gap-2 rounded-2xl border border-hairline/80 bg-surface/40 p-3 shadow-xs backdrop-blur-md opacity-0"
              style={{ animation: "fade-up 0.6s ease-out 0.9s forwards" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-ember uppercase tracking-wider">
                  Coba Pilih Ide Contoh:
                </span>
                <span className="text-[10px] text-muted/80">
                  Simulasi Live Studio
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TOPIC_PRESETS.map((preset) => {
                  const isSelected = selectedTopicId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedTopicId(preset.id)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-ember bg-ember/15 text-ember shadow-xs scale-[1.02]"
                          : "border-hairline bg-surface-raised/70 text-muted hover:border-ember/30 hover:text-ink"
                      }`}
                    >
                      <span className={`size-1.5 rounded-full ${isSelected ? "bg-ember animate-ping" : "bg-muted/40"}`} />
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* =========================================================================
                MOBILE ONLY: Living AI Scene directly under Magic Topic Bar
               ========================================================================= */}
            <div className="flex justify-center my-6 lg:hidden w-full">
              <LivingStudioCanvas
                activePresetId={selectedTopicId}
                onSelectPreset={(id) => setSelectedTopicId(id)}
              />
            </div>

            {/* Clean Solid CTA Buttons */}
            <div
              className="mt-2 sm:mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center opacity-0"
              style={{ animation: "fade-up 0.6s ease-out 1.1s forwards" }}
            >
              <TransitionButton
                href="/masuk"
                variant="primary"
              >
                <span>Mulai bikin konten</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </TransitionButton>

              <a
                href="#journey"
                className="inline-flex items-center justify-center rounded-xl border border-hairline/80 bg-surface/60 px-6 py-3.5 font-display text-sm sm:text-base font-semibold text-ink backdrop-blur-md transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ember-lo active:scale-[0.99]"
              >
                Lihat cara kerja ↓
              </a>
            </div>

            {/* Trust Badges */}
            {/* Desktop Horizontal Badges */}
            <div
              className="hidden sm:flex mt-7 items-center gap-3 border-t border-hairline/60 pt-4 text-xs text-muted opacity-0"
              style={{ animation: "fade-up 0.5s ease-out 1.3s forwards" }}
            >
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
            <div
              className="grid sm:hidden grid-cols-3 gap-2 mt-5 w-full border-t border-hairline/60 pt-3 text-[11px] opacity-0"
              style={{ animation: "fade-up 0.5s ease-out 1.2s forwards" }}
            >
              <div className="flex flex-col items-center justify-center p-2 rounded-xl border border-hairline/70 bg-surface/40 text-center">
                <span className="font-bold text-ink">10 Kredit</span>
                <span className="text-[10px] text-muted">Gratis Tiap Hari</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-xl border border-hairline/70 bg-surface/40 text-center">
                <span className="font-bold text-ink">Login Google</span>
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
          <div
            className="hidden lg:flex lg:col-span-5 flex-col items-center justify-center opacity-0"
            style={{ animation: "scale-in 0.7s ease-out 0.3s forwards" }}
          >
            <LivingStudioCanvas
              activePresetId={selectedTopicId}
              onSelectPreset={(id) => setSelectedTopicId(id)}
            />
          </div>

        </div>
      </div>
    </section>
  );
}
