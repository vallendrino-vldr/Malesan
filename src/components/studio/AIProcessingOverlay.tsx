"use client";

import React, { useState, useEffect } from "react";
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
  const [phase, setPhase] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Handle open / close lifecycle
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (busy) {
      setIsOpen(true);
      setIsCompleted(false);
      setElapsed(0);
      setPhase(1);

      const t0 = Date.now();
      timer = setInterval(() => {
        const secs = (Date.now() - t0) / 1000;
        setElapsed(secs);

        // Phase progression based on elapsed time & streaming characters
        if (chars > 0) {
          setPhase(3); // Currently streaming / writing output
        } else if (secs >= 6) {
          setPhase(3);
        } else if (secs >= 3) {
          setPhase(2);
        } else {
          setPhase(1);
        }
      }, 200);
    } else if (isOpen && !isCompleted) {
      // Transition to completed phase for celebratory flash before closing
      setIsCompleted(true);
      setPhase(4);

      const closeTimer = setTimeout(() => {
        setIsOpen(false);
        if (onCompleted) onCompleted();
      }, 900);

      return () => clearTimeout(closeTimer);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [busy, chars, isOpen, isCompleted, onCompleted]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* =====================================================================
              1. BACKGROUND DIM & BLUR OVERLAY (Background Dim Mode)
             ===================================================================== */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* =====================================================================
              2. FLOATING AI WORKSPACE PROCESSING WINDOW
             ===================================================================== */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Malesan sedang memproses"
            initial={{ opacity: 0, scale: 0.94, y: 36 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-10 w-full max-w-[520px] rounded-[28px] border border-white/[0.1] bg-[#111111] p-5 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_60px_rgba(255,138,61,0.22)] backdrop-blur-2xl transition-all duration-300 ${
              isCompleted
                ? "ring-2 ring-emerald-500/40 shadow-[0_0_70px_rgba(16,185,129,0.3)]"
                : ""
            }`}
          >
            {/* Ambient Internal Radial Glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-72 rounded-full bg-[radial-gradient(circle,rgba(255,138,61,0.25)_0%,transparent_70%)] blur-2xl"
            />

            {/* Top Workspace Header Bar */}
            <div className="relative z-10 flex items-center justify-between border-b border-white/[0.06] pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex size-2.5">
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
                <span className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
                  {isCompleted
                    ? "✨ Selesai"
                    : status || label || "Malesan lagi mikir..."}
                </span>
              </div>

              {/* Dynamic Elapsed / Character Pill */}
              <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface/80 px-2.5 py-0.5 font-mono text-[11px] text-muted">
                {chars > 0 ? (
                  <span>{chars.toLocaleString("id-ID")} huruf</span>
                ) : (
                  <span>{elapsed.toFixed(0)} detik</span>
                )}
              </div>
            </div>

            {/* Center: Living Mascot Companion */}
            <div className="relative z-10 my-2 sm:my-3">
              <LivingProcessingCompanion
                phase={phase}
                isCompleted={isCompleted}
              />
            </div>

            {/* AI Process Storytelling Timeline */}
            <div className="relative z-10 mt-2 rounded-2xl border border-white/[0.06] bg-black/40 p-4">
              <ProcessingTimeline
                currentPhase={phase}
                isCompleted={isCompleted}
              />
            </div>

            {/* Bottom Gentle Status Strip */}
            <div className="relative z-10 mt-4 text-center">
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
