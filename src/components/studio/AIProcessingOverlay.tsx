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

type OverlayState = "idle" | "processing" | "completing";

export function AIProcessingOverlay({
  busy,
  chars = 0,
  label,
  status,
  onCompleted,
}: AIProcessingOverlayProps) {
  const [overlayState, setOverlayState] = useState<OverlayState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Single Synchronized State Machine
  useEffect(() => {
    if (busy) {
      setOverlayState("processing");
      setElapsed(0);
      setProgress(0);
      startTimeRef.current = Date.now();

      const loop = () => {
        if (!isMountedRef.current) return;
        const now = Date.now();
        const secs = (now - startTimeRef.current) / 1000;
        setElapsed(secs);

        // Natural smooth processing progression curve (0 to ~84%)
        let nextProgress = 0;
        if (secs < 3) {
          nextProgress = (secs / 3) * 25; // 0 - 25%
        } else if (secs < 7) {
          nextProgress = 25 + ((secs - 3) / 4) * 30; // 25 - 55%
        } else {
          // Asymptote towards 84%
          const remainingTime = secs - 7;
          nextProgress = 55 + (1 - Math.exp(-remainingTime / 6)) * 29; // 55 - 84%
        }

        // Boost progress if streaming characters arrive
        if (chars > 0) {
          nextProgress = Math.max(nextProgress, 60 + Math.min(23, chars / 30));
        }

        setProgress(Math.min(84, nextProgress));
        animationRef.current = requestAnimationFrame(loop);
      };

      animationRef.current = requestAnimationFrame(loop);
    } else if (overlayState === "processing") {
      // Clean cancellation of animation loop
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Step to 100% (Final phase complete)
      setOverlayState("completing");
      setProgress(100);

      const closeTimeout = setTimeout(() => {
        if (!isMountedRef.current) return;
        setOverlayState("idle");
        if (onCompleted) onCompleted();
      }, 850);

      return () => clearTimeout(closeTimeout);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [busy, chars, overlayState, onCompleted]);

  const isCompleted = overlayState === "completing";
  const isOpen = overlayState !== "idle";

  // Compute Phase from Progress
  const currentPhase = isCompleted
    ? 4
    : progress < 25
    ? 1
    : progress < 55
    ? 2
    : progress < 85
    ? 3
    : 4;

  // Formatted two-digit HUD tabular timer (e.g. 04s)
  const timerFormatted = `${String(Math.floor(elapsed)).padStart(2, "0")}s`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px",
          }}
        >
          {/* =====================================================================
              1. BACKGROUND DIM MODE (12px blur, 65% opacity dark overlay)
             ===================================================================== */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed inset-0 bg-black/65 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* =====================================================================
              2. FLOATING AI WORKSPACE PROCESSING WINDOW (Perfect Mobile & Desktop Center)
             ===================================================================== */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Malesan sedang memproses"
            initial={{ opacity: 0, scale: 0.94, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-10 w-full max-w-[520px] max-h-[92vh] flex flex-col justify-between rounded-[28px] border border-white/[0.08] bg-[#111111] p-4.5 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_60px_rgba(255,138,61,0.22)] backdrop-blur-2xl transition-all duration-300 ${
              isCompleted
                ? "ring-2 ring-emerald-500/40 shadow-[0_0_70px_rgba(16,185,129,0.3)]"
                : ""
            }`}
          >
            {/* Ambient Internal Radial Ember Glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-80 rounded-full bg-[radial-gradient(circle,rgba(255,138,61,0.22)_0%,transparent_70%)] blur-2xl"
            />

            {/* ===================================================================
                HUD HEADER (Left: Responsive Status, Right: Fixed [ 04s ] Timer)
               =================================================================== */}
            <div className="relative z-10 flex items-center justify-between border-b border-white/[0.06] pb-3">
              {/* Left: Responsive Headline Status */}
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
                  {isCompleted ? (
                    "SIAP DIPAKAI"
                  ) : status ? (
                    status.toUpperCase()
                  ) : (
                    <>
                      <span className="hidden sm:inline">LAGI NYARI JAWABAN TERBAIK...</span>
                      <span className="sm:hidden">LAGI MIKIR...</span>
                    </>
                  )}
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
                CENTER: LIVING AI COMPANION (Mascot + Dynamic Thought Bubble)
               =================================================================== */}
            <div className="relative z-10 my-auto py-1 sm:py-2">
              <LivingProcessingCompanion
                phase={currentPhase}
                progress={progress}
                isCompleted={isCompleted}
              />
            </div>

            {/* ===================================================================
                BOTTOM: NEURAL PROGRESS BAR & STEP TIMELINE
               =================================================================== */}
            <div className="relative z-10 mt-auto rounded-2xl border border-white/[0.06] bg-black/40 p-3 sm:p-4">
              <ProcessingTimeline
                currentPhase={currentPhase}
                progress={progress}
                isCompleted={isCompleted}
              />
            </div>

            {/* Bottom-most status note */}
            <div className="relative z-10 mt-2.5 sm:mt-3.5 text-center">
              <p className="font-mono text-[10px] sm:text-micro text-muted/60">
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
