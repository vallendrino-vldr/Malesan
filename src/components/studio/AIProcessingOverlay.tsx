"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LivingProcessingCompanion } from "./LivingProcessingCompanion";
import { ProcessingTimeline } from "./ProcessingTimeline";

interface AIProcessingOverlayProps {
  busy: boolean;
  moduleKey?: string;
  chars?: number;
  label?: string;
  status?: string;
  onCompleted?: () => void;
}

export function AIProcessingOverlay({
  busy,
  chars = 0,
  label,
  status,
  onCompleted,
}: AIProcessingOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Compute Phase from Progress (Single Source of Truth)
  const currentPhase = isCompleted
    ? 4
    : progress < 25
    ? 1
    : progress < 55
    ? 2
    : progress < 85
    ? 3
    : 4;

  // Lifecycle & Synchronized Progress Engine
  useEffect(() => {
    if (busy) {
      setIsOpen(true);
      setIsCompleted(false);
      setElapsed(0);
      setProgress(0);
      startTimeRef.current = Date.now();

      const updateProgress = () => {
        const now = Date.now();
        const secs = (now - startTimeRef.current) / 1000;
        setElapsed(secs);

        // Compute simulated natural progress curve (0 to ~85%)
        // 0-3s -> 0-25%
        // 3-7s -> 25-55%
        // 7-14s -> 55-83% (asymptote to 84% until generation finishes)
        let targetProgress = 0;
        if (secs < 3) {
          targetProgress = (secs / 3) * 25;
        } else if (secs < 7) {
          targetProgress = 25 + ((secs - 3) / 4) * 30;
        } else {
          // Asymptote towards 84%
          const remainingTime = secs - 7;
          targetProgress = 55 + (1 - Math.exp(-remainingTime / 6)) * 29;
        }

        // If streaming chars are detected, guarantee at least 60%
        if (chars > 0) {
          targetProgress = Math.max(targetProgress, 60 + Math.min(23, chars / 30));
        }

        setProgress(Math.min(84, targetProgress));
        animationRef.current = requestAnimationFrame(updateProgress);
      };

      animationRef.current = requestAnimationFrame(updateProgress);
    } else if (isOpen && !isCompleted) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);

      // Rapid smooth completion to 100%
      setIsCompleted(true);
      setProgress(100);

      const closeTimer = setTimeout(() => {
        setIsOpen(false);
        if (onCompleted) onCompleted();
      }, 950);

      return () => clearTimeout(closeTimer);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [busy, chars, isOpen, isCompleted, onCompleted]);

  // Dynamic HUD Status Headline in Indonesian
  const hudHeadline = isCompleted
    ? "SIAP DIPAKAI"
    : status
    ? status.toUpperCase()
    : currentPhase === 1
    ? "MEMBACA IDE LO"
    : currentPhase === 2
    ? "NYARING KEMUNGKINAN"
    : currentPhase === 3
    ? "MENYUSUN NASKAH"
    : "LAGI MIKIRIN BUAT LO";

  // Formatted tabular two-digit timer (e.g. 04s)
  const timerFormatted = `${String(Math.floor(elapsed)).padStart(2, "0")}s`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* =====================================================================
              1. BACKGROUND DIM MODE (12px blur, 40% opacity, dark overlay)
             ===================================================================== */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed inset-0 bg-black/65 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* =====================================================================
              2. FLOATING AI WORKSPACE PROCESSING WINDOW (520px / min-h-[560px])
             ===================================================================== */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Malesan sedang memproses"
            initial={{ opacity: 0, scale: 0.94, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-10 w-full max-w-[520px] min-h-[520px] sm:min-h-[560px] flex flex-col justify-between rounded-[28px] border border-white/[0.08] bg-[#111111] p-5 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_60px_rgba(255,138,61,0.22)] backdrop-blur-2xl transition-all duration-300 ${
              isCompleted
                ? "ring-2 ring-emerald-500/40 shadow-[0_0_70px_rgba(16,185,129,0.3)]"
                : ""
            }`}
          >
            {/* Internal Ambient Ember Radial Glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-80 rounded-full bg-[radial-gradient(circle,rgba(255,138,61,0.22)_0%,transparent_70%)] blur-2xl"
            />

            {/* ===================================================================
                HUD HEADER (Fixed alignment: Left status, Right fixed [ 04s ])
               =================================================================== */}
            <div className="relative z-10 flex items-center justify-between border-b border-white/[0.06] pb-3.5">
              {/* Left: Glowing Status Indicator + Uppercase Label */}
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="relative flex size-2.5 shrink-0">
                  <span
                    className={`absolute inline-flex size-full rounded-full opacity-75 ${
                      isCompleted
                        ? "bg-emerald-400 animate-ping"
                        : "bg-ember animate-ping"
                    }`}
                  />
                  <span
                    className={`relative inline-flex size-2.5 rounded-full ${
                      isCompleted ? "bg-emerald-400" : "bg-ember"
                    }`}
                  />
                </span>
                <span className="truncate font-mono text-xs font-bold tracking-wider text-ember uppercase">
                  {hudHeadline}
                </span>
              </div>

              {/* Right: Fixed-width HUD Timer [ 04s ] (Zero text shift) */}
              <div className="flex w-16 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#161616] py-1 font-mono text-xs font-semibold text-[#F5F5F5] shadow-inner">
                <span className="tabular font-mono tracking-tight">
                  {timerFormatted}
                </span>
              </div>
            </div>

            {/* ===================================================================
                CENTER: LIVING AI COMPANION (Mascot + Phase-driven Speech Bubble)
               =================================================================== */}
            <div className="relative z-10 my-auto py-2">
              <LivingProcessingCompanion
                phase={currentPhase}
                progress={progress}
                isCompleted={isCompleted}
              />
            </div>

            {/* ===================================================================
                BOTTOM: NEURAL PROGRESS BAR & STEP TIMELINE
               =================================================================== */}
            <div className="relative z-10 mt-auto rounded-2xl border border-white/[0.06] bg-black/40 p-4">
              <ProcessingTimeline
                currentPhase={currentPhase}
                progress={progress}
                isCompleted={isCompleted}
              />
            </div>

            {/* Bottom-most gentle guidance note */}
            <div className="relative z-10 mt-3.5 text-center">
              <p className="font-mono text-micro text-muted/60">
                {isCompleted
                  ? "Menyiapkan hasil di workspace lo..."
                  : "Tetap di halaman ini sampai hasilnya muncul."}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
