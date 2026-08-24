"use client";

import React, { useState, useEffect } from "react";
import { Mascot } from "@/components/Mascot";

const MASCOT_MESSAGES = [
  "Sebentar, gue cari angle terbaik.",
  "Jangan scroll dulu, gue lagi mikir.",
  "Hampir selesai.",
  "Pola ini bakal dapet perhatian di 3 detik pertama.",
];

interface LivingProcessingCompanionProps {
  phase: number; // 1 to 4
  isCompleted?: boolean;
}

export function LivingProcessingCompanion({
  phase,
  isCompleted = false,
}: LivingProcessingCompanionProps) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [fade, setFade] = useState(true);

  // Cycle mascot messages every 4.5s
  useEffect(() => {
    if (isCompleted) return;

    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setMsgIndex((prev) => (prev + 1) % MASCOT_MESSAGES.length);
        setFade(true);
      }, 300);
    }, 4500);

    return () => clearInterval(interval);
  }, [isCompleted]);

  // Determine mascot mood based on processing phase
  const mascotMood = isCompleted
    ? "ready"
    : phase === 1
    ? "thinking"
    : phase === 2
    ? "ideas"
    : phase === 3
    ? "script"
    : "awake";

  return (
    <div className="relative flex flex-col items-center justify-center py-2 sm:py-3">
      {/* Floating AI Speech Thought Bubble */}
      <div
        className={`relative z-20 mb-3 max-w-[260px] sm:max-w-xs rounded-2xl border border-ember/35 bg-surface/95 px-3.5 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 ${
          fade ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-1.5 scale-95"
        }`}
      >
        <p className="text-center font-display text-xs font-medium text-[#F5F5F5] leading-snug">
          {isCompleted ? "✨ Udah siap! Cek hasilnya di bawah." : `“${MASCOT_MESSAGES[msgIndex]}”`}
        </p>
        {/* Beak pointing down to mascot */}
        <div
          aria-hidden="true"
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-surface"
        />
      </div>

      {/* Living Mascot Studio Stage with Concentric Orbit Rings & Hologram Particles */}
      <div className="relative flex size-28 sm:size-32 items-center justify-center">
        {/* Outer Orbit Ring with dashed rotation */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-28 sm:size-32 rounded-full border border-dashed border-ember/25 animate-[spin_35s_linear_infinite]"
        />

        {/* Inner Orbit Ring */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-20 sm:size-24 rounded-full border border-ember/20 animate-[spin_20s_linear_infinite_reverse]"
        />

        {/* Mascot Centerpiece with Continuous Breathing Motion */}
        <div className="relative z-10 size-20 sm:size-24 animate-[bounce-gentle_2.8s_ease-in-out_infinite] drop-shadow-[0_8px_20px_rgba(255,138,61,0.3)]">
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
