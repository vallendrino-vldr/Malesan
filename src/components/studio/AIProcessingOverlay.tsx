"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LivingProcessingCompanion } from "./LivingProcessingCompanion";
import { ProcessingTimeline, TimelinePhase, DEFAULT_TIMELINE_PHASES } from "./ProcessingTimeline";

export type ModuleTimelineConfig = {
  headerTitleDesktop: string;
  headerTitleMobile: string;
  phases: TimelinePhase[];
  messages: Record<number, string>;
};

export const MODULE_TIMELINE_CONFIGS: Record<string, ModuleTimelineConfig> = {
  // 1. Ide Hari Ini / Brainstorm
  ide: {
    headerTitleDesktop: "LAGI NYARI IDE & POLA TERBAIK...",
    headerTitleMobile: "LAGI MIKIRIN IDE...",
    phases: [
      {
        id: 1,
        title: "Membaca topik lo",
        subtitle: "Nyari pola terbaik dari topik yang kamu kasih.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Riset sudut pandang",
        subtitle: "Milih angle yang paling cocok buat audiens lo.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Kurasi 3 ide terbaik",
        subtitle: "Nyiapin judul, format hook, dan inti konten.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Siap dipakai",
        subtitle: "3 ide konten pertama lo sudah siap.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue baca dulu topik lo...",
      2: "Lagi cari angle yang bikin orang berhenti scroll...",
      3: "Oke, gue kurasi 3 ide paling potensial...",
      4: "Hampir selesai. Tinggal gue rapihin...",
      5: "Siap! 3 ide udah beres.",
    },
  },

  // 2. Hook Lab / Bikin Hook
  hook: {
    headerTitleDesktop: "LAGI MERACIK HOOK 3 DETIK PERTAMA...",
    headerTitleMobile: "LAGI BIKIN HOOK...",
    phases: [
      {
        id: 1,
        title: "Bedah inti cerita",
        subtitle: "Identifikasi rasa penasaran & problem audiens.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Racik 3 detik pertama",
        subtitle: "Bikin pola kalimat pembuka yang bikin stay.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Uji daya pikat retensi",
        subtitle: "Kombinasi emosi, visual trigger, dan rasa kepo.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Hook siap dipilih",
        subtitle: "Opsi hook terbaik siap lo pilih.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue bedah dulu poin paling nendang...",
      2: "Lagi racik hook 3 detik pertama yang brutal...",
      3: "Oke, gue uji formula retensinya...",
      4: "Tinggal finishing variasi hook...",
      5: "Siap! Hook terbaik udah jadi.",
    },
  },

  // 3. Script Engine / Bikin Script
  script: {
    headerTitleDesktop: "LAGI MENYUSUN NASKAH LENGKAP...",
    headerTitleMobile: "LAGI NULIS NASKAH...",
    phases: [
      {
        id: 1,
        title: "Analisis hook terpilih",
        subtitle: "Kunci fondasi pembuka naskah.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Bangun alur retensi",
        subtitle: "Struktur pacing, jembatan ide, dan isi daging.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Tulis VO & visual footage",
        subtitle: "Pecah scene, arahan visual, dan teks layar.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Naskah lengkap siap",
        subtitle: "Script siap untuk syuting dan voiceover.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue kunci hook yang lo pilih...",
      2: "Lagi susun alur biar ga ada bagian yang ngebosenin...",
      3: "Oke, gue tulis arahan visual dan voice over-nya...",
      4: "Hampir beres. Tinggal poles CTA...",
      5: "Siap! Naskah lengkap udah beres.",
    },
  },

  // 4. Vibe Coding
  vibe: {
    headerTitleDesktop: "LAGI MERANCANG & MEMBANGUN APP...",
    headerTitleMobile: "LAGI BIKIN KODE...",
    phases: [
      {
        id: 1,
        title: "Analisis instruksi",
        subtitle: "Membaca spesifikasi fitur & interaksi.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Rancang arsitektur UI",
        subtitle: "Struktur layout, state, dan alur komponen.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Generate kode & logic",
        subtitle: "Build logic interaktif dan styling tailwind.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "App siap dicoba",
        subtitle: "Aplikasi langsung bisa lo preview.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue pelajari kebutuhan fiturnya...",
      2: "Lagi rancang struktur komponen dan state-nya...",
      3: "Oke, gue susun kode interaktifnya...",
      4: "Hampir selesai. Tinggal testing preview...",
      5: "Siap! App udah bisa dicoba.",
    },
  },

  // 5. Repurpose
  repurpose: {
    headerTitleDesktop: "LAGI MERACIK ULANG KONTEN MULTI-PLATFORM...",
    headerTitleMobile: "LAGI REPURPOSE...",
    phases: [
      {
        id: 1,
        title: "Membaca transkrip",
        subtitle: "Ekstraksi wawasan utama dari konten asal.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Format ulang media",
        subtitle: "Sesuaikan pola konsumsi tiap platform target.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Optimasi tone & CTA",
        subtitle: "Poles gaya penyampaian dan call-to-action.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Konten siap sebar",
        subtitle: "Versi multi-platform sudah siap diposting.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue baca dan petakan inti konten lo...",
      2: "Lagi sesuaikan format buat tiap medsos...",
      3: "Oke, gue poles tone dan hook per platform...",
      4: "Tinggal rapikan hasil akhirnya...",
      5: "Siap! Konten multi-platform selesai.",
    },
  },

  // 6. Clip Engine
  clip: {
    headerTitleDesktop: "LAGI MEMBEDAH POTONGAN KLIP VIRAL...",
    headerTitleMobile: "LAGI CARI KLIP...",
    phases: [
      {
        id: 1,
        title: "Pindai transkrip video",
        subtitle: "Cari momen paling padat wawasan & emosi.",
        minProgress: 0,
        maxProgress: 25,
        label: "0%",
      },
      {
        id: 2,
        title: "Tentukan timestamp",
        subtitle: "Kunci durasi optimal 30-60 detik.",
        minProgress: 25,
        maxProgress: 55,
        label: "25%",
      },
      {
        id: 3,
        title: "Racik judul & framing",
        subtitle: "Bikin headline pembuka yang mengundang klik.",
        minProgress: 55,
        maxProgress: 85,
        label: "55%",
      },
      {
        id: 4,
        title: "Klip siap dipotong",
        subtitle: "Daftar timestamp & naskah klip sudah siap.",
        minProgress: 85,
        maxProgress: 100,
        label: "85%",
      },
    ],
    messages: {
      1: "Gue dengerin dan scan transkrip videonya...",
      2: "Lagi tandai golden moment 30-60 detik...",
      3: "Oke, gue racik headline dan framing visualnya...",
      4: "Tinggal verifikasi timing tiap klip...",
      5: "Siap! Daftar klip viral udah jadi.",
    },
  },
};

function resolveConfig(moduleKey?: string): ModuleTimelineConfig {
  if (!moduleKey) return MODULE_TIMELINE_CONFIGS.ide;
  const key = moduleKey.toLowerCase();
  if (key.includes("hook")) return MODULE_TIMELINE_CONFIGS.hook;
  if (key.includes("script")) return MODULE_TIMELINE_CONFIGS.script;
  if (key.includes("vibe") || key.includes("app")) return MODULE_TIMELINE_CONFIGS.vibe;
  if (key.includes("repurpose") || key.includes("recycle")) return MODULE_TIMELINE_CONFIGS.repurpose;
  if (key.includes("clip")) return MODULE_TIMELINE_CONFIGS.clip;
  return MODULE_TIMELINE_CONFIGS.ide;
}

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

export function updateStudioStatus(status?: string) {
  if (!currentData.isOpen) return;
  currentData.status = status;
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

        // Smooth continuous 4-phase progress curve (0 to 89.5%)
        let nextProgress = 0;
        if (secs < 2.5) {
          nextProgress = (secs / 2.5) * 25; // 0 - 25% (Phase 1)
        } else if (secs < 6.0) {
          nextProgress = 25 + ((secs - 2.5) / 3.5) * 30; // 25 - 55% (Phase 2)
        } else if (secs < 11.0) {
          nextProgress = 55 + ((secs - 6.0) / 5.0) * 30; // 55 - 85% (Phase 3)
        } else {
          const remainingTime = secs - 11.0;
          nextProgress = 85 + (1 - Math.exp(-remainingTime / 6)) * 4.5; // 85 - 89.5% (Phase 4)
        }

        // Chars provide only a subtle organic pacing nudge (max +2%) without skipping phases
        if (data.chars > 0) {
          const charBonus = Math.min(2.5, data.chars / 400);
          nextProgress = Math.min(89.5, nextProgress + charBonus);
        }

        const clamped = Math.min(89.5, Math.max(progressRef.current, nextProgress));
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

  const config = resolveConfig(data.moduleKey);
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
                      <span className="hidden sm:inline">{config.headerTitleDesktop}</span>
                      <span className="sm:hidden">{config.headerTitleMobile}</span>
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

            {/* Center: Living Mascot Companion with Contextual Speech */}
            <div className="relative z-10 my-auto py-1 sm:py-2">
              <LivingProcessingCompanion
                phase={currentPhase}
                progress={progress}
                messages={config.messages}
                isCompleted={isCompleted}
              />
            </div>

            {/* Bottom: Neural Progress Bar & Contextual Step Timeline */}
            <div className="relative z-10 mt-auto rounded-2xl border border-white/[0.06] bg-black/40 p-3 sm:p-4">
              <ProcessingTimeline
                currentPhase={currentPhase}
                progress={progress}
                phases={config.phases}
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
