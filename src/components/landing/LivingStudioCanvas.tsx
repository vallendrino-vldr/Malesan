"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/Mascot";

export type StudioStateId = "standby" | "thinking" | "ideas" | "script" | "ready";

type HeroTimelineState = {
  id: StudioStateId;
  stepNum: string;
  badge: string;
  headline: string;
  subtext: string;
  isWorking: boolean;
  glowColor: string;
  hologramColor: string;
};

const TIMELINE_STATES: HeroTimelineState[] = [
  {
    id: "standby",
    stepNum: "01",
    badge: "STANDBY",
    headline: "Layar kosong lagi?",
    subtext: "Nunggu ide pertama lo.",
    isWorking: false,
    glowColor: "rgba(255, 138, 61, 0.15)",
    hologramColor: "border-hairline/70 bg-surface/50",
  },
  {
    id: "thinking",
    stepNum: "02",
    badge: "LAGI MIKIR...",
    headline: "Lagi cari arah...",
    subtext: "Nyaring tren yang cocok buat lo.",
    isWorking: true,
    glowColor: "rgba(255, 138, 61, 0.35)",
    hologramColor: "border-ember/40 bg-ember/10",
  },
  {
    id: "ideas",
    stepNum: "03",
    badge: "IDE DITEMUKAN",
    headline: "3 Angle Konten Muncul",
    subtext: "Bukan prompt mentah, tapi sudut pandang matang.",
    isWorking: true,
    glowColor: "rgba(255, 184, 108, 0.4)",
    hologramColor: "border-amber-500/40 bg-amber-500/10",
  },
  {
    id: "script",
    stepNum: "04",
    badge: "NASKAH SELESAI",
    headline: "Script 45s Siap Syuting",
    subtext: "Lengkap timestamp, visual cue & kalimat hook.",
    isWorking: true,
    glowColor: "rgba(255, 138, 61, 0.45)",
    hologramColor: "border-ember/50 bg-obsidian/90",
  },
  {
    id: "ready",
    stepNum: "05",
    badge: "SIAP TAYANG",
    headline: "Video & Subtitle Siap!",
    subtext: "Auto-CC menyinkronkan subtitle per kata.",
    isWorking: false,
    glowColor: "rgba(111, 207, 151, 0.35)",
    hologramColor: "border-emerald-500/40 bg-emerald-500/10",
  },
];

export function LivingStudioCanvas({
  className = "",
}: {
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [mouseParallax, setMouseParallax] = useState({ x: 0, y: 0 });

  // 18-Second State Machine Loop:
  // State 1: 0 - 3s (3000ms) -> Standby
  // State 2: 3 - 7s (4000ms) -> Thinking
  // State 3: 7 - 11s (4000ms) -> Ideas Found
  // State 4: 11 - 15s (4000ms) -> Script Ready
  // State 5: 15 - 18s (3000ms) -> Ready
  useEffect(() => {
    if (isPaused) return;

    const durations = [3200, 4000, 4000, 4000, 3200];
    const duration = durations[activeStep] || 3500;

    const timer = setTimeout(() => {
      setActiveStep((prev) => (prev + 1) % TIMELINE_STATES.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [activeStep, isPaused]);

  // Desktop Mouse Parallax (subtle 3D perspective tracking)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setMouseParallax({ x: x * 12, y: y * 10 });
    };

    const onLeave = () => {
      setMouseParallax({ x: 0, y: 0 });
    };

    el.addEventListener("mousemove", onMove, { passive: true });
    el.addEventListener("mouseleave", onLeave, { passive: true });

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const current = TIMELINE_STATES[activeStep];

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`relative flex w-full max-w-[460px] min-h-[430px] sm:min-h-[470px] flex-col items-center justify-between rounded-3xl border border-hairline/90 bg-surface/35 p-6 sm:p-7 shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden select-none ${className}`}
      style={{
        transform: `perspective(1200px) rotateY(${mouseParallax.x * 0.4}deg) rotateX(${-mouseParallax.y * 0.4}deg)`,
      }}
    >
      {/* 3D Volumetric Stage Lighting Bloom */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 left-1/2 -translate-x-1/2 w-80 h-96 blur-3xl rounded-full transition-all duration-700 opacity-75"
        style={{ backgroundColor: current.glowColor }}
      />

      {/* Holographic Concentric Orbit Rings */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-60 rounded-full border border-ember/25 shadow-[0_0_50px_rgba(255,138,61,0.2)]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-80 rounded-full border border-dashed border-ember/15 animate-[spin_40s_linear_infinite]" />

      {/* Top Holographic Sequence Controller */}
      <div className="relative z-20 flex w-full items-center justify-between border-b border-hairline/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-ember animate-ping" />
          <span className="font-mono text-[10px] font-bold text-ember uppercase tracking-wider">
            {current.badge}
          </span>
        </div>

        {/* 5 Step Progress Bars */}
        <div className="flex items-center gap-1.5">
          {TIMELINE_STATES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveStep(idx)}
              aria-label={`Pindah ke status ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeStep === idx
                  ? "w-4 bg-ember shadow-[0_0_8px_rgba(255,138,61,0.8)]"
                  : "w-1.5 bg-muted/30 hover:bg-ember/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Central Living Mascot with Holographic Desk Pedestal */}
      <div className="relative z-10 my-auto flex flex-col items-center">
        {/* Active Mascot with Parallax and Breathing */}
        <div
          className="relative size-28 sm:size-32 transition-transform duration-200 animate-[bounce-gentle_4s_ease-in-out_infinite]"
          style={{
            transform: `translate(${mouseParallax.x * 0.5}px, ${mouseParallax.y * 0.4}px)`,
          }}
        >
          <Mascot
            working={current.isWorking}
            className="size-full filter drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
          />
        </div>

        {/* Mini 3D Workspace Pedestal with Warm Glow */}
        <div className="mt-2 flex flex-col items-center">
          <div className="w-36 h-3 rounded-full bg-gradient-to-r from-transparent via-ember/40 to-transparent blur-[1px]" />
          <div className="w-24 h-1.5 rounded-full bg-ember/60 shadow-[0_0_16px_rgba(255,138,61,0.8)]" />
        </div>
      </div>

      {/* Floating Holographic Output Window (Dynamically Morphs with the State) */}
      <div
        className={`relative z-20 w-full rounded-2xl border p-4 shadow-lg backdrop-blur-md transition-all duration-300 ${current.hologramColor}`}
        style={{
          transform: `translate(${-mouseParallax.x * 0.3}px, ${-mouseParallax.y * 0.3}px)`,
        }}
      >
        <div className="flex items-center justify-between border-b border-hairline/60 pb-1.5">
          <span className="font-mono text-[9px] font-bold text-ember uppercase tracking-wider">
            Tahap {current.stepNum} · Living AI Studio
          </span>
          <span className="font-mono text-[9px] text-muted">Auto Sync</span>
        </div>

        <p className="mt-2 font-display text-sm font-bold text-ink">
          {current.headline}
        </p>
        <p className="mt-0.5 text-micro text-muted">
          {current.subtext}
        </p>

        {/* State-Specific Interactive Output Content */}
        <div className="mt-2.5">
          {current.id === "standby" && (
            <div className="rounded-lg border border-hairline/50 bg-obsidian/60 px-3 py-2 font-mono text-[11px] text-muted flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-muted/40 animate-pulse" />
              <span>Standby. Sebut niche atau topik konten lo.</span>
            </div>
          )}

          {current.id === "thinking" && (
            <div className="rounded-lg border border-ember/30 bg-ember/10 px-3 py-2 font-mono text-[11px] text-ember flex items-center justify-between">
              <span className="truncate">Menyaring 100+ tren viral Indonesia...</span>
              <span className="size-2 rounded-full bg-ember animate-ping shrink-0 ml-2" />
            </div>
          )}

          {current.id === "ideas" && (
            <div className="space-y-1 rounded-lg border border-amber-500/30 bg-obsidian/80 p-2.5 font-mono text-[11px]">
              <div className="flex items-center gap-1.5 text-ember-lo font-semibold">
                <span className="text-ember font-bold">1.</span>
                <span className="truncate">Kesalahan fatal kreator pemula di 30 hari pertama</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted text-[10px]">
                <span>2.</span>
                <span className="truncate">Tren lokal remote work & side income 2026</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted text-[10px]">
                <span>3.</span>
                <span className="truncate">Storytelling 45s: 1 Jam bikin stok seminggu</span>
              </div>
            </div>
          )}

          {current.id === "script" && (
            <div className="space-y-1 rounded-lg border border-ember/40 bg-obsidian/90 p-2.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-ember font-bold text-[10px]">
                <span>NASKAH 45 DETIK</span>
                <span>RITME NATURAL</span>
              </div>
              <p className="text-ink/90 text-[10px] leading-snug">
                [00:00] Hook: &ldquo;Stop bilang ga ada waktu bikin konten kalau masih scroll begini...&rdquo;
              </p>
              <p className="text-muted text-[10px]">
                [00:15] Poin Inti: 3 Trik audit 1 halaman tanpa ribet
              </p>
            </div>
          )}

          {current.id === "ready" && (
            <div className="rounded-lg border border-emerald-500/30 bg-obsidian/90 p-2.5 font-mono text-[11px] space-y-1">
              <div className="flex items-center justify-between text-emerald-400 font-bold text-[10px]">
                <span>✓ KONTEN SIAP TAYANG</span>
                <span>5 PLATFORM</span>
              </div>
              <p className="text-ink/90 text-[10px]">
                TikTok & Reels: Video 9:16 + Word-level Captions
              </p>
              <p className="text-ember-lo text-[10px]">
                Threads & X: Utas 5 postingan ringkas siap share
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
