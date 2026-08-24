"use client";

import React, { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";

const PHASE_MESSAGES: Record<number, string> = {
  1: "Gue baca dulu ide lo...",
  2: "Lagi cari angle yang bikin orang berhenti scroll...",
  3: "Oke, gue susun alurnya...",
  4: "Hampir selesai. Tinggal gue rapihin...",
};

interface LivingProcessingCompanionProps {
  phase: number; // 1 to 4
  progress: number; // 0 to 100
  isCompleted?: boolean;
}

export function LivingProcessingCompanion({
  phase,
  progress,
  isCompleted = false,
}: LivingProcessingCompanionProps) {
  const [displayedText, setDisplayedText] = useState(PHASE_MESSAGES[1]);
  const [fade, setFade] = useState(true);

  // Transition message smoothly on phase change
  useEffect(() => {
    const targetText = isCompleted
      ? "Siap! Konten lo udah beres."
      : PHASE_MESSAGES[phase] || PHASE_MESSAGES[1];

    if (targetText !== displayedText) {
      setFade(false);
      const timeout = setTimeout(() => {
        setDisplayedText(targetText);
        setFade(true);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [phase, isCompleted, displayedText]);

  // Determine mascot mood based on processing phase
  const mascotMood = isCompleted
    ? "ready"
    : phase === 1
    ? "thinking"
    : phase === 2
    ? "ideas"
    : phase === 3
    ? "script"
    : "ready";

  return (
    <div className="relative flex flex-col items-center justify-center py-1 sm:py-2">
      {/* Floating AI Speech Thought Bubble with Beak */}
      <div
        className={`relative z-20 mb-3 min-h-[42px] max-w-[280px] sm:max-w-xs flex items-center justify-center rounded-2xl border border-ember/30 bg-[#161616]/95 px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-500 ${
          fade
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 -translate-y-2 scale-95"
        }`}
      >
        <p className="text-center font-display text-xs sm:text-sm font-medium text-[#F5F5F5] leading-snug">
          {isCompleted ? `✨ ${displayedText}` : `“${displayedText}”`}
        </p>
        {/* Beak pointer to mascot */}
        <div
          aria-hidden="true"
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-[#161616]"
        />
      </div>

      {/* Living Mascot Stage with Concentric Orbit Rings & Glowing Pedestal */}
      <div className="relative flex size-28 sm:size-32 items-center justify-center">
        {/* Outer Orbit Ring with very slow rotation */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-28 sm:size-32 rounded-full border border-dashed border-ember/20 animate-[spin_40s_linear_infinite]"
        />

        {/* Inner Orbit Ring */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-20 sm:size-24 rounded-full border border-ember/25 animate-[spin_24s_linear_infinite_reverse]"
        />

        {/* Mascot Centerpiece with Continuous Breathing Motion */}
        <div className="relative z-10 size-20 sm:size-24 animate-[bounce-gentle_3s_ease-in-out_infinite] drop-shadow-[0_8px_24px_rgba(255,138,61,0.3)]">
          <Mascot mood={mascotMood} className="size-full" />
        </div>

        {/* Glowing Pedestal Base */}
        <div
          aria-hidden="true"
          className="absolute -bottom-1 h-2 w-20 sm:w-24 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,138,61,0.85)_0%,transparent_75%)] blur-[2px]"
        />
      </div>
    </div>
  );
}
