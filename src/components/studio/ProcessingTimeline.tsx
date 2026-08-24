"use client";

import React from "react";

export type TimelinePhase = {
  id: number;
  title: string;
  subtitle: string;
  minProgress: number;
  maxProgress: number;
  label: string;
};

export const TIMELINE_PHASES: TimelinePhase[] = [
  {
    id: 1,
    title: "Membaca ide lo",
    subtitle: "Nyari pola terbaik dari topik yang kamu kasih.",
    minProgress: 0,
    maxProgress: 25,
    label: "0%",
  },
  {
    id: 2,
    title: "Nyaring kemungkinan",
    subtitle: "Milih angle yang paling cocok buat audiens lo.",
    minProgress: 25,
    maxProgress: 55,
    label: "25%",
  },
  {
    id: 3,
    title: "Menyusun naskah",
    subtitle: "Ngebangun hook 3 detik, isi daging, dan CTA.",
    minProgress: 55,
    maxProgress: 85,
    label: "55%",
  },
  {
    id: 4,
    title: "Siap dipakai",
    subtitle: "Konten pertama lo sudah siap.",
    minProgress: 85,
    maxProgress: 100,
    label: "85%",
  },
];

interface ProcessingTimelineProps {
  currentPhase: number; // 1 to 4
  progress: number; // 0 to 100 (Single source of truth)
  isCompleted?: boolean;
}

export function ProcessingTimeline({
  progress,
  isCompleted = false,
}: ProcessingTimelineProps) {
  // Clamped display progress (0 to 100)
  const displayProgress = Math.min(100, Math.max(0, isCompleted ? 100 : progress));

  return (
    <div className="relative w-full space-y-3.5 px-1 sm:px-2">
      {/* =====================================================================
          1. CINEMATIC NEURAL PROGRESS BAR WITH EMBER PARTICLE HEAD
         ===================================================================== */}
      <div className="relative mb-3.5 w-full">
        {/* Track Background */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06] border border-white/[0.04]">
          {/* Active Gradient Fill Bar */}
          <div
            className="h-full rounded-full bg-gradient-to-r from-ember via-[#ff9b4e] to-ember shadow-[0_0_12px_rgba(255,138,61,0.6)] transition-all duration-300 ease-out"
            style={{ width: `${displayProgress}%` }}
          />
        </div>

        {/* Leading Edge Ember Glow Particle Dot */}
        {displayProgress > 2 && displayProgress < 99 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-full bg-[#FFE5CC] border-2 border-ember shadow-[0_0_10px_#ff8a3d,0_0_16px_rgba(255,138,61,0.8)] transition-all duration-300 ease-out"
            style={{ left: `${displayProgress}%` }}
          />
        )}

        {/* 5 Stage Percent Labels on Track (0%, 25%, 55%, 85%, 100%) */}
        <div className="mt-1.5 flex items-center justify-between px-1 font-mono text-[9px] sm:text-[10px]">
          {TIMELINE_PHASES.map((p) => {
            const isPassed = displayProgress >= p.minProgress;
            return (
              <span
                key={p.id}
                className={`transition-colors duration-300 ${
                  isPassed
                    ? "text-ember font-semibold drop-shadow-[0_0_6px_rgba(255,138,61,0.4)]"
                    : "text-muted/40"
                }`}
              >
                {p.label}
              </span>
            );
          })}

          {/* 100% End Marker */}
          <span
            className={`transition-colors duration-300 ${
              displayProgress >= 100
                ? "text-emerald-400 font-semibold drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                : "text-muted/40"
            }`}
          >
            100%
          </span>
        </div>
      </div>

      {/* =====================================================================
          2. 100% CONTINUOUS & MATHEMATICALLY LOCKED VERTICAL TIMELINE
         ===================================================================== */}
      <div className="flex flex-col">
        {TIMELINE_PHASES.map((phase, idx) => {
          const isDone = isCompleted || progress >= phase.maxProgress;
          const isActive = !isCompleted && progress >= phase.minProgress && progress < phase.maxProgress;
          const isLast = idx === TIMELINE_PHASES.length - 1;

          // Compute individual vertical connection line fill percentage (0 to 100%)
          let lineFill = 0;
          if (isDone) {
            lineFill = 100;
          } else if (isActive) {
            const range = phase.maxProgress - phase.minProgress;
            lineFill = Math.min(100, Math.max(0, ((progress - phase.minProgress) / range) * 100));
          }

          return (
            <div
              key={phase.id}
              className={`relative flex items-start gap-3 pb-3.5 last:pb-0 transition-opacity duration-300 ${
                isActive ? "opacity-100" : isDone ? "opacity-95" : "opacity-35"
              }`}
            >
              {/* FIXED 24px COLUMN: Centers BOTH the vertical line AND the node with 0px offset */}
              <div className="relative flex w-6 shrink-0 flex-col items-center">
                {/* Node Circle */}
                <div className="relative z-10 flex size-6 items-center justify-center">
                  {isDone ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-ember text-obsidian shadow-[0_0_12px_rgba(255,138,61,0.5)] transition-all duration-300">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="size-3.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  ) : isActive ? (
                    <span className="relative flex size-6 items-center justify-center">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-ember opacity-50" />
                      <span className="relative flex size-6 items-center justify-center rounded-full border-2 border-ember bg-[#1a130c] shadow-[0_0_14px_rgba(255,138,61,0.7)]">
                        <span className="size-2 rounded-full bg-ember" />
                      </span>
                    </span>
                  ) : (
                    <span className="flex size-6 items-center justify-center rounded-full border border-white/20 bg-surface/50">
                      <span className="size-1.5 rounded-full bg-muted/40" />
                    </span>
                  )}
                </div>

                {/* Continuous Connecting Line to Next Node */}
                {!isLast && (
                  <div
                    aria-hidden="true"
                    className="absolute top-6 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-white/[0.08] pointer-events-none"
                  >
                    {/* Progressively Filled Portion */}
                    <div
                      className="w-full bg-gradient-to-b from-ember to-ember/60 transition-all duration-300 ease-out"
                      style={{ height: `${lineFill}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Step Title, Subtitle, and Status Badge */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`font-display text-xs sm:text-sm font-semibold transition-colors duration-300 ${
                      isActive
                        ? "text-ember font-bold drop-shadow-[0_0_8px_rgba(255,138,61,0.3)]"
                        : isDone
                        ? "text-[#F5F5F5]"
                        : "text-muted/60"
                    }`}
                  >
                    {phase.title}
                  </p>

                  {/* Right Status Badge */}
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[9px] sm:text-[10px] font-semibold transition-all duration-300 ${
                      isDone
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : isActive
                        ? "border border-ember/40 bg-ember/15 text-ember animate-pulse"
                        : "border border-white/[0.06] bg-white/[0.03] text-muted/40"
                    }`}
                  >
                    {isDone ? "Selesai" : isActive ? "Proses..." : "Antre"}
                  </span>
                </div>

                {/* Subtitle helper text */}
                <p
                  className={`mt-0.5 text-micro leading-relaxed transition-colors duration-300 ${
                    isActive ? "text-muted" : isDone ? "text-muted/70" : "text-muted/40"
                  }`}
                >
                  {phase.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
