"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  // Determine speech bubble text based on stage and completion
  let text = "";
  if (isCompleted || progress >= 100) {
    text = "Siap! Konten lo udah beres.";
  } else if (progress < 25) {
    text = PHASE_MESSAGES[1];
  } else if (progress < 55) {
    text = PHASE_MESSAGES[2];
  } else if (progress < 85) {
    text = PHASE_MESSAGES[3];
  } else {
    text = PHASE_MESSAGES[4];
  }

  // Determine mascot mood based on processing phase
  const mascotMood = isCompleted || progress >= 100
    ? "ready"
    : progress < 25
    ? "thinking"
    : progress < 55
    ? "ideas"
    : "script";

  return (
    <div className="relative flex flex-col items-center justify-center py-1 sm:py-2">
      {/* Floating AI Speech Thought Bubble with Smooth Framer Motion AnimatePresence */}
      <div
        className={`relative z-20 mb-3 min-h-[44px] max-w-[280px] sm:max-w-xs flex items-center justify-center rounded-2xl border px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 ${
          isCompleted || progress >= 100
            ? "border-emerald-500/40 bg-[#121a15]/95 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
            : "border-ember/30 bg-[#161616]/95"
        }`}
      >
        <AnimatePresence mode="wait">
          <motion.p
            key={text}
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`text-center font-display text-xs sm:text-sm font-medium leading-snug ${
              isCompleted || progress >= 100 ? "text-emerald-300 font-semibold" : "text-[#F5F5F5]"
            }`}
          >
            {isCompleted || progress >= 100 ? `✨ ${text}` : `“${text}”`}
          </motion.p>
        </AnimatePresence>

        {/* Beak pointer to mascot */}
        <div
          aria-hidden="true"
          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-0 border-x-[6px] border-x-transparent border-t-[6px] transition-colors duration-300 ${
            isCompleted || progress >= 100 ? "border-t-[#121a15]" : "border-t-[#161616]"
          }`}
        />
      </div>

      {/* Living Mascot Stage with Animated Concentric Orbit Rings & Glowing Pedestal */}
      <div className="relative flex size-28 sm:size-32 items-center justify-center">
        {/* Outer Orbit Ring with Continuous Smooth Rotation */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-28 sm:size-32 rounded-full border border-dashed border-ember/20 animate-[spin_30s_linear_infinite]"
        />

        {/* Inner Orbit Ring with Counter-Rotation */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-20 sm:size-24 rounded-full border border-ember/30 animate-[spin_18s_linear_infinite_reverse]"
        />

        {/* Mascot Centerpiece with Dynamic Floating Bobbing Physics & Visor Motion */}
        <motion.div
          animate={{
            y: [-4, 4, -4],
            rotate: [-1, 1, -1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative z-10 size-20 sm:size-24 drop-shadow-[0_8px_24px_rgba(255,138,61,0.35)]"
        >
          <Mascot working={!isCompleted} mood={mascotMood} className="size-full" />
        </motion.div>

        {/* Glowing Pedestal Base with Breathing Pulse */}
        <motion.div
          animate={{
            scale: [0.95, 1.1, 0.95],
            opacity: [0.75, 1, 0.75],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          aria-hidden="true"
          className={`absolute -bottom-1 h-2.5 w-20 sm:w-24 rounded-full blur-[2px] transition-colors duration-500 ${
            isCompleted || progress >= 100
              ? "bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.95)_0%,transparent_75%)]"
              : "bg-[radial-gradient(ellipse_at_center,rgba(255,138,61,0.9)_0%,transparent_75%)]"
          }`}
        />
      </div>
    </div>
  );
}
