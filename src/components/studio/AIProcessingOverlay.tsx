"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LivingProcessingCompanion } from "./LivingProcessingCompanion";
import { ProcessingTimeline } from "./ProcessingTimeline";

type OverlayData = {
  isOpen: boolean;
  isCompleted: boolean;
  moduleKey?: string;
  chars: number;
  label?: string;
  status?: string;
};

type Listener = (data: OverlayData) => void;

let currentData: OverlayData = {
  isOpen: false,
  isCompleted: false,
  chars: 0,
};

const listeners = new Set<Listener>();

function emit() {
  const snapshot = { ...currentData };
  listeners.forEach((l) => l(snapshot));
}

export function startStudioProcessing(opts: {
  moduleKey?: string;
  label?: string;
  status?: string;
}) {
  currentData = {
    isOpen: true,
    isCompleted: false,
    moduleKey: opts.moduleKey,
    label: opts.label,
    status: opts.status,
    chars: 0,
  };
  emit();
}

export function updateStudioChars(chars: number) {
  if (!currentData.isOpen) return;
  currentData.chars = chars;
  emit();
}

export function completeStudioProcessing() {
  if (!currentData.isOpen) return;
  currentData.isCompleted = true;
  emit();
}

export function closeStudioProcessing() {
  currentData = {
    isOpen: false,
    isCompleted: false,
    chars: 0,
  };
  emit();
}

export function GlobalStudioProcessingOverlay() {
  const [data, setData] = useState<OverlayData>(currentData);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visualCompleted, setVisualCompleted] = useState(false);

  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const progressRef = useRef<number>(0);
  const isCompletingRef = useRef<boolean>(false);

  // Subscribe to Global Store
  useEffect(() => {
    const listener: Listener = (nextData) => {
      setData(nextData);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Sync progressRef with progress state
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Main Processing & Smooth Completion Animation Engine
  useEffect(() => {
    if (data.isOpen && !data.isCompleted) {
      // RESET for new run
      isCompletingRef.current = false;
      setVisualCompleted(false);
      startTimeRef.current = Date.now();
      setProgress(0);
      setElapsed(0);

      const loop = () => {
        const now = Date.now();
        const secs = (now - startTimeRef.current) / 1000;
        setElapsed(secs);

        // Smooth continuous 4-phase progress curve (0 to 89%)
        let nextProgress = 0;
        if (secs < 3) {
          nextProgress = (secs / 3) * 25; // 0-25%
        } else if (secs < 7) {
          nextProgress = 25 + ((secs - 3) / 4) * 30; // 25-55%
        } else if (secs < 13) {
          nextProgress = 55 + ((secs - 7) / 6) * 30; // 55-85%
        } else {
          const remainingTime = secs - 13;
          nextProgress = 85 + (1 - Math.exp(-remainingTime / 8)) * 4; // 85-89%
        }

        if (data.chars > 0) {
          nextProgress = Math.max(nextProgress, 70 + Math.min(18, data.chars / 30));
        }

        const clamped = Math.min(89, Math.max(progressRef.current, nextProgress));
        setProgress(clamped);
        animationRef.current = requestAnimationFrame(loop);
      };

      animationRef.current = requestAnimationFrame(loop);
    } else if (data.isOpen && data.isCompleted && !isCompletingRef.current) {
      // SMOOTH 100% COMPLETION SEQUENCE
      isCompletingRef.current = true;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      const startProgress = progressRef.current;
      const targetProgress = 100;
      const durationMs = 450; // Smooth continuous glide to 100%
      const startTweenTime = Date.now();

      const tweenLoop = () => {
        const elapsedMs = Date.now() - startTweenTime;
        const t = Math.min(1, elapsedMs / durationMs);
        // easeOutCubic
        const ease = 1 - Math.pow(1 - t, 3);
        const currentVal = startProgress + (targetProgress - startProgress) * ease;
        setProgress(currentVal);

        if (t < 1) {
          animationRef.current = requestAnimationFrame(tweenLoop);
        } else {
          setProgress(100);
          setVisualCompleted(true);

          // Hold the 100% celebratory completion state for 850ms, then smoothly exit
          const exitTimer = setTimeout(() => {
            closeStudioProcessing();
            isCompletingRef.current = false;
          }, 850);

          return () => clearTimeout(exitTimer);
        }
      };

      animationRef.current = requestAnimationFrame(tweenLoop);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [data.isOpen, data.isCompleted, data.chars]);

  const isCompleted = visualCompleted || progress >= 100;
  const currentPhase = isCompleted
    ? 4
    : progress < 25
    ? 1
    : progress < 55
    ? 2
    : progress < 85
    ? 3
    : 4;

  const timerFormatted = `${String(Math.floor(elapsed)).padStart(2, "0")}s`;

  return (
    <AnimatePresence>
      {data.isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px",
          }}
        >
          {/* Background Dim Mode with Butter-Smooth Exit */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 bg-black/65 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Floating AI Workspace Window with Cinematic Spring Exit */}
          <motion.div
            key="modal-window"
            role="dialog"
            aria-modal="true"
            aria-label="Malesan sedang memproses"
            initial={{ opacity: 0, scale: 0.93, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.94,
              y: 16,
              transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
            }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-10 w-full max-w-[520px] max-h-[92vh] flex flex-col justify-between rounded-[28px] border border-white/[0.08] bg-[#111111] p-4.5 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_60px_rgba(255,138,61,0.22)] backdrop-blur-2xl transition-all duration-300 ${
              isCompleted
                ? "ring-2 ring-emerald-500/50 shadow-[0_0_80px_rgba(16,185,129,0.35)]"
                : ""
            }`}
          >
            {/* Ambient Internal Radial Glow */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-80 rounded-full blur-2xl transition-all duration-500 ${
                isCompleted
                  ? "bg-[radial-gradient(circle,rgba(16,185,129,0.25)_0%,transparent_70%)]"
                  : "bg-[radial-gradient(circle,rgba(255,138,61,0.22)_0%,transparent_70%)]"
              }`}
            />

            {/* HUD Header */}
            <div className="relative z-10 flex items-center justify-between border-b border-white/[0.06] pb-3">
              {/* Left: Headline Status */}
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
                <span
                  className={`truncate font-mono text-xs font-bold tracking-wider uppercase transition-colors duration-200 ${
                    isCompleted ? "text-emerald-400" : "text-ember"
                  }`}
                >
                  {isCompleted ? (
                    "✨ SIAP DIPAKAI"
                  ) : data.status ? (
                    data.status.toUpperCase()
                  ) : (
                    <>
                      <span className="hidden sm:inline">LAGI NYARI JAWABAN TERBAIK...</span>
                      <span className="sm:hidden">LAGI MIKIR...</span>
                    </>
                  )}
                </span>
              </div>

              {/* Right: Fixed-width HUD Timer [ 04s ] */}
              <div className="flex w-16 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#161616] py-1 font-mono text-xs font-semibold text-[#F5F5F5] shadow-inner">
                <span className="tabular font-mono tracking-tight">
                  {timerFormatted}
                </span>
              </div>
            </div>

            {/* Center: Living Mascot Companion */}
            <div className="relative z-10 my-auto py-1 sm:py-2">
              <LivingProcessingCompanion
                phase={currentPhase}
                progress={progress}
                isCompleted={isCompleted}
              />
            </div>

            {/* Bottom: Neural Progress Bar & Step Timeline */}
            <div className="relative z-10 mt-auto rounded-2xl border border-white/[0.06] bg-black/40 p-3 sm:p-4">
              <ProcessingTimeline
                currentPhase={currentPhase}
                progress={progress}
                isCompleted={isCompleted}
              />
            </div>

            {/* Bottom-most Status Strip */}
            <div className="relative z-10 mt-2.5 sm:mt-3.5 text-center">
              <p
                className={`font-mono text-[10px] sm:text-micro transition-colors duration-200 ${
                  isCompleted ? "text-emerald-400 font-semibold" : "text-muted/60"
                }`}
              >
                {isCompleted
                  ? "Konten siap di workspace lo!"
                  : "Tetap di halaman ini sampai hasilnya muncul."}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Backward compatibility export
export const AIProcessingOverlay = GlobalStudioProcessingOverlay;
