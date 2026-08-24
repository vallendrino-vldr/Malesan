"use client";

import React from "react";

export type TimelinePhase = {
  id: number;
  title: string;
  subtitle: string;
};

export const TIMELINE_PHASES: TimelinePhase[] = [
  {
    id: 1,
    title: "Membaca ide lo",
    subtitle: "Nyari pola terbaik dari topik yang kamu kasih.",
  },
  {
    id: 2,
    title: "Nyaring kemungkinan",
    subtitle: "Milih angle yang paling cocok buat audiens lo.",
  },
  {
    id: 3,
    title: "Menyusun naskah",
    subtitle: "Ngebangun hook 3 detik, isi daging, dan CTA.",
  },
  {
    id: 4,
    title: "Siap dipakai",
    subtitle: "Konten pertama lo sudah siap.",
  },
];

interface ProcessingTimelineProps {
  currentPhase: number; // 1 to 4
  isCompleted?: boolean;
}

export function ProcessingTimeline({
  currentPhase,
  isCompleted = false,
}: ProcessingTimelineProps) {
  return (
    <div className="relative w-full space-y-3.5 px-1 sm:px-2">
      {TIMELINE_PHASES.map((phase, idx) => {
        const isDone = isCompleted || currentPhase > phase.id;
        const isActive = !isCompleted && currentPhase === phase.id;
        const isPending = !isCompleted && currentPhase < phase.id;
        const isLast = idx === TIMELINE_PHASES.length - 1;

        return (
          <div key={phase.id} className="relative flex items-start gap-3.5 group">
            {/* Connecting Vertical Track Line */}
            {!isLast && (
              <div
                aria-hidden="true"
                className={`absolute left-[13px] top-[26px] bottom-[-16px] w-[2px] transition-colors duration-500 ${
                  isDone
                    ? "bg-gradient-to-b from-ember to-ember/40"
                    : "bg-white/[0.08]"
                }`}
              />
            )}

            {/* Stepped Node Circle */}
            <div className="relative z-10 flex size-7 shrink-0 items-center justify-center">
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
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-ember opacity-60" />
                  <span className="relative flex size-6 items-center justify-center rounded-full border-2 border-ember bg-[#1a130c] shadow-[0_0_14px_rgba(255,138,61,0.6)]">
                    <span className="size-2 rounded-full bg-ember" />
                  </span>
                </span>
              ) : (
                <span className="flex size-6 items-center justify-center rounded-full border border-white/20 bg-surface/50">
                  <span className="size-1.5 rounded-full bg-muted/40" />
                </span>
              )}
            </div>

            {/* Step Content & Storytelling Text */}
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
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold transition-all duration-300 ${
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
  );
}
