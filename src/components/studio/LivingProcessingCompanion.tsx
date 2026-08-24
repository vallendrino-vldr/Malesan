"use client";

import React, { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";

const PHASE_MESSAGES: Record<number, string> = {
  1: "Gue baca dulu ide lo...",
  2: "Lagi cari angle yang bikin orang berhenti scroll...",
  3: "Oke, gue susun alurnya...",
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

  // Smooth crossfade on message change without flickering
  useEffect(() => {
    let targetText = "";
    if (isCompleted || progress >= 100) {
      targetText = "Siap! Konten lo udah beres.";
    } else if (progress < 30) {
      targetText = PHASE_MESSAGES[1];
    } else if (progress < 65) {
      targetText = PHASE_MESSAGES[2];
    } else {
      targetText = PHASE_MESSAGES[3];
    }

    if (targetText && targetText !== displayedText) {
      setFade(false);
      const timeout = setTimeout(() => {
        setDisplayedText(targetText);
        setFade(true);
      }, 250);
      return () => clearTimeout(timeout);
    }
  }, [progress, isCompleted, displayedText]);

  // Determine mascot mood based on processing phase
  const mascotMood = isCompleted || progress >= 100
    ? "ready"
    : progress < 30
    ? "thinking"
    : progress < 65
    ? "ideas"
    : "script";

  return (
    <div className="relative flex flex-col items-center justify-center py-1 sm:py-2">
      {/* Floating AI Speech Thought Bubble with Beak */}
      <div
        className={`relative z-20 mb-3 min-h-[42px] max-w-[280px] sm:max-w-xs flex items-center justify-center rounded-2xl border px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 ${
          isCompleted || progress >= 100
            ? "border-emerald-500/40 bg-[#121a15]/95 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            : "border-ember/30 bg-[#161616]/95"
        } ${
          fade
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 -translate-y-1.5 scale-95"
        }`}
      >
        <p
          className={`text-center font-display text-xs sm:text-sm font-medium leading-snug transition-colors duration-300 ${
            isCompleted || progress >= 100 ? "text-emerald-300 font-semibold" : "text-[#F5F5F5]"
          }`}
        >
          {isCompleted || progress >= 100 ? `✨ ${displayedText}` : `“${displayedText}”`}
        </p>
        {/* Beak pointer to mascot */}
        <div
          aria-hidden="true"
          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-0 border-x-[6px] border-x-transparent border-t-[6px] transition-colors duration-300 ${
            isCompleted || progress >= 100 ? "border-t-[#121a15]" : "border-t-[#161616]"
          }`}
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
          className={`absolute -bottom-1 h-2 w-20 sm:w-24 rounded-full blur-[2px] transition-all duration-500 ${
            isCompleted || progress >= 100
              ? "bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.9)_0%,transparent_75%)]"
              : "bg-[radial-gradient(ellipse_at_center,rgba(255,138,61,0.85)_0%,transparent_75%)]"
          }`}
        />
      </div>
    </div>
  );
}
