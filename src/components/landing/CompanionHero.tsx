"use client";

import { useState } from "react";
import { TransitionButton } from "./TransitionButton";
import { ThreeCanvas } from "./ThreeCanvas";
import { LivingStudioCanvas, TOPIC_PRESETS } from "./LivingStudioCanvas";

export function CompanionHero() {
  const [selectedTopicId, setSelectedTopicId] = useState("bengkel");

  return (
    <section className="relative overflow-hidden pt-3 pb-8 sm:pt-6 sm:pb-14 lg:pt-10 lg:pb-18">
      {/* Purposeful Ambient Depth Background */}
      <ThreeCanvas />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:items-center lg:gap-12">
          
          {/* =========================================================================
              LEFT COLUMN: Product Headline, 2x2 Magic Bar, and Fast CTAs (7 Cols)
             ========================================================================= */}
          <div className="flex flex-col items-start lg:col-span-7">
            {/* Status Pill with comfortable optical padding */}
            <div className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-4 py-1.5 shadow-xs backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-ember animate-pulse" />
              <span className="font-display text-xs font-semibold tracking-wider text-ember">
                Teman Kreatif AI
              </span>
            </div>

            {/* Main Headline — Instant Render, No 1s Lag */}
            <h1 className="mt-3.5 font-display text-[clamp(2.2rem,6vw,4rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
              <span>Males mikirnya.</span>
              <br />
              <span className="text-gradient-ember">Bukan bikinnya.</span>
            </h1>

            {/* Casual Brand Subtitle */}
            <p className="mt-3.5 max-w-lg text-sm sm:text-base lg:text-lg leading-relaxed text-muted">
              Teman kreatif AI yang nemenin lo cari ide, bikin hook pembakar penasaran, tulis script, sampai video siap tayang.
            </p>

            {/* Interactive Magic Topic Bar: 2x2 Symmetric Grid on Mobile */}
            <div className="mt-5 w-full flex flex-col gap-2.5 rounded-2xl border border-white/[0.08] bg-surface/50 p-4 shadow-sm backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-semibold text-ember">
                  Coba Pilih Ide Contoh:
                </span>
                <span className="font-display text-xs text-muted font-medium">
                  Simulasi Live Studio
                </span>
              </div>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full">
                {TOPIC_PRESETS.map((preset) => {
                  const isSelected = selectedTopicId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedTopicId(preset.id)}
                      className={`group flex items-center justify-center sm:justify-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-ember/60 bg-ember/15 text-ember shadow-xs scale-[1.01]"
                          : "border-white/[0.08] bg-surface-raised/70 text-muted hover:border-ember/40 hover:text-ink hover:bg-surface-raised"
                      }`}
                    >
                      <span className={`size-2 rounded-full shrink-0 transition-colors ${isSelected ? "bg-ember" : "bg-muted/40 group-hover:bg-ember/50"}`} />
                      <span className="truncate">{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MOBILE ONLY: Living AI Scene */}
            <div className="flex justify-center my-5 lg:hidden w-full">
              <LivingStudioCanvas
                activePresetId={selectedTopicId}
                onSelectPreset={(id) => setSelectedTopicId(id)}
              />
            </div>

            {/* Clean Solid CTA Buttons */}
            <div className="mt-2 sm:mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <TransitionButton
                href="/masuk"
                variant="primary"
                className="group"
              >
                <span>Mulai bikin konten</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </TransitionButton>

              <a
                href="#journey"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-surface/60 px-6 py-3.5 font-display text-sm sm:text-base font-semibold text-ink backdrop-blur-md transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ember active:scale-[0.99]"
              >
                <span>Lihat cara kerja</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 text-muted transition-transform duration-200 group-hover:translate-y-0.5 group-hover:text-ember"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </a>
            </div>

            {/* Trust Badges */}
            {/* Desktop Horizontal Badges */}
            <div className="hidden sm:flex mt-7 items-center gap-3 border-t border-white/[0.06] pt-4 text-xs text-muted">
              <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-surface/40 px-3.5 py-1.5 font-medium">
                <span className="text-ember font-bold">✓</span>
                <span><strong className="text-ink">10 kredit gratis</strong> tiap hari</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-surface/40 px-3.5 py-1.5 font-medium">
                <span className="text-ember font-bold">✓</span>
                <span>Login Google tanpa ribet</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-surface/40 px-3.5 py-1.5 font-medium">
                <span className="text-ember font-bold">✓</span>
                <span>Ide pertama &lt;30 detik</span>
              </div>
            </div>

            {/* Mobile 3 Compact Badges */}
            <div className="grid sm:hidden grid-cols-3 gap-2 mt-4 w-full border-t border-white/[0.06] pt-3 text-xs">
              <div className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-white/[0.08] bg-surface/40 text-center">
                <span className="font-bold text-ink">10 Kredit</span>
                <span className="text-xs text-muted">Gratis Harian</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-white/[0.08] bg-surface/40 text-center">
                <span className="font-bold text-ink">Login Google</span>
                <span className="text-xs text-muted">Tanpa Ribet</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-white/[0.08] bg-surface/40 text-center">
                <span className="font-bold text-ink">&lt;30 Detik</span>
                <span className="text-xs text-muted">Ide Pertama</span>
              </div>
            </div>
          </div>

          {/* DESKTOP ONLY: Living AI Studio Canvas */}
          <div className="hidden lg:flex lg:col-span-5 flex-col items-center justify-center">
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
