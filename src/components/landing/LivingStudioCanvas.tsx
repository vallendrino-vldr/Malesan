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
  mood: "sleepy" | "thinking" | "ideas" | "script" | "ready";
  glowIntensity: number;
  glowHue: string;
  borderColor: string;
};

const TIMELINE_STATES: HeroTimelineState[] = [
  {
    id: "standby",
    stepNum: "01",
    badge: "MENUNGGU TOPIK",
    headline: "Layar kosong lagi?",
    subtext: "Sebut topik atau ide pertama lo.",
    mood: "sleepy",
    glowIntensity: 0.15,
    glowHue: "rgba(255, 138, 61, 0.12)",
    borderColor: "border-hairline/50",
  },
  {
    id: "thinking",
    stepNum: "02",
    badge: "LAGI MIKIRIN ARAH...",
    headline: "Nyaring 100+ Tren Lokal",
    subtext: "Mencari sudut pandang terbaik buat audiens lo.",
    mood: "thinking",
    glowIntensity: 0.55,
    glowHue: "rgba(255, 138, 61, 0.45)",
    borderColor: "border-ember/40",
  },
  {
    id: "ideas",
    stepNum: "03",
    badge: "IDE TERBENTUK",
    headline: "3 Pilihan Sudut Pandang",
    subtext: "Tinggal pilih angle yang paling lo suka.",
    mood: "ideas",
    glowIntensity: 0.7,
    glowHue: "rgba(255, 184, 108, 0.5)",
    borderColor: "border-amber-500/40",
  },
  {
    id: "script",
    stepNum: "04",
    badge: "NASKAH DISUSUN",
    headline: "Alur Video 45 Detik",
    subtext: "Hook, masalah, solusi & CTA siap rekam.",
    mood: "script",
    glowIntensity: 0.8,
    glowHue: "rgba(255, 138, 61, 0.55)",
    borderColor: "border-ember/50",
  },
  {
    id: "ready",
    stepNum: "05",
    badge: "SIAP TAYANG ✓",
    headline: "Tinggal Rekam & Upload!",
    subtext: "Subtitle sinkron otomatis per kata.",
    mood: "ready",
    glowIntensity: 0.65,
    glowHue: "rgba(111, 207, 151, 0.45)",
    borderColor: "border-emerald-500/40",
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
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 18-Second State Machine Loop
  useEffect(() => {
    if (isPaused) return;

    const durations = [3200, 4000, 4000, 4000, 3200];
    const duration = durations[activeStep] || 3500;

    const timer = setTimeout(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveStep((prev) => (prev + 1) % TIMELINE_STATES.length);
        setIsTransitioning(false);
      }, 250);
    }, duration);

    return () => clearTimeout(timer);
  }, [activeStep, isPaused]);

  // Desktop Mouse Parallax
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
  const isWorking = current.mood === "thinking" || current.mood === "script" || current.mood === "ideas";

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
      {/* 3D Volumetric Stage Lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 left-1/2 -translate-x-1/2 w-96 h-[420px] blur-3xl rounded-full transition-all duration-700"
        style={{
          backgroundColor: current.glowHue,
          opacity: current.glowIntensity,
          transform: `scale(${0.8 + current.glowIntensity * 0.4})`,
        }}
      />

      {/* Top celebration glow for ready state */}
      {current.id === "ready" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 w-60 h-60 blur-3xl rounded-full bg-emerald-500/20 transition-opacity duration-700"
        />
      )}

      {/* Concentric Orbit Rings */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-60 rounded-full border shadow-[0_0_50px_rgba(255,138,61,0.2)] transition-all duration-500"
        style={{
          borderColor: isWorking ? "rgba(255,138,61,0.35)" : "rgba(255,138,61,0.15)",
          transform: `translate(-50%, -50%) scale(${isWorking ? 1.05 : 1})`,
        }}
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-80 rounded-full border border-dashed transition-all duration-500"
        style={{
          borderColor: isWorking ? "rgba(255,138,61,0.2)" : "rgba(255,138,61,0.08)",
          animation: isWorking ? "spin 20s linear infinite" : "spin 40s linear infinite",
        }}
      />

      {/* Top Controller with Natural Indonesian Labels */}
      <div className="relative z-20 flex w-full items-center justify-between border-b border-hairline/60 pb-3">
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full transition-colors duration-300"
            style={{
              backgroundColor: current.id === "ready" ? "#6fcf97" : "#ff8a3d",
              boxShadow: isWorking
                ? "0 0 8px rgba(255,138,61,0.9)"
                : current.id === "ready"
                  ? "0 0 8px rgba(111,207,151,0.8)"
                  : "0 0 4px rgba(255,138,61,0.4)",
              animation: isWorking ? "pulse 1s ease-in-out infinite" : "none",
            }}
          />
          <span className="font-mono text-[10px] font-bold text-ember uppercase tracking-wider transition-all duration-300">
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
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                activeStep === idx
                  ? "w-5 bg-ember shadow-[0_0_10px_rgba(255,138,61,0.8)]"
                  : activeStep > idx
                    ? "w-2.5 bg-ember/50"
                    : "w-1.5 bg-muted/30 hover:bg-ember/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Central Living Mascot with Expressive Mood & Posture */}
      <div className="relative z-10 my-auto flex flex-col items-center">
        <div
          className={`relative size-36 sm:size-40 transition-transform duration-300 ${
            current.mood === "ready"
              ? "animate-[bounce-gentle_2s_ease-in-out_infinite]"
              : "animate-[bounce-gentle_3.5s_ease-in-out_infinite]"
          }`}
          style={{
            transform: `translate(${mouseParallax.x * 0.5}px, ${mouseParallax.y * 0.4}px) ${
              current.mood === "thinking"
                ? "rotate(1.5deg)"
                : current.mood === "ideas"
                  ? "rotate(-1.5deg) scale(1.02)"
                  : "rotate(0deg)"
            }`,
          }}
        >
          <Mascot
            mood={current.mood}
            className="size-full filter drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
          />
        </div>

        {/* Workspace Pedestal */}
        <div className="mt-2 flex flex-col items-center">
          <div
            className="w-40 h-3 rounded-full bg-gradient-to-r from-transparent via-ember/40 to-transparent blur-[1px] transition-all duration-500"
            style={{
              opacity: 0.5 + current.glowIntensity * 0.5,
              width: `${9 + current.glowIntensity * 2}rem`,
            }}
          />
          <div
            className="w-28 h-1.5 rounded-full transition-all duration-500"
            style={{
              backgroundColor: current.id === "ready" ? "rgba(111,207,151,0.6)" : "rgba(255,138,61,0.6)",
              boxShadow: current.id === "ready"
                ? "0 0 20px rgba(111,207,151,0.8)"
                : `0 0 ${12 + current.glowIntensity * 12}px rgba(255,138,61,${0.5 + current.glowIntensity * 0.4})`,
            }}
          />
        </div>
      </div>

      {/* Floating Holographic Workspace Window */}
      <div
        className={`relative z-20 w-full rounded-2xl border p-4 shadow-lg backdrop-blur-md transition-all duration-500 ${current.borderColor} ${
          current.id === "ready" ? "bg-emerald-500/10" : current.id === "standby" ? "bg-surface/50" : "bg-ember/10"
        }`}
        style={{
          transform: `translate(${-mouseParallax.x * 0.3}px, ${-mouseParallax.y * 0.3}px)`,
          opacity: isTransitioning ? 0.3 : 1,
        }}
      >
        <div className="flex items-center justify-between border-b border-hairline/60 pb-1.5">
          <span className="font-mono text-[9px] font-bold text-ember uppercase tracking-wider">
            Tahap {current.stepNum} · Ruang Kerja Malesan
          </span>
          <span className="font-mono text-[9px] text-muted">TERSINKRON</span>
        </div>

        <p className="mt-2 font-display text-sm font-bold text-ink">
          {current.headline}
        </p>
        <p className="mt-0.5 text-micro text-muted">
          {current.subtext}
        </p>

        {/* State-Specific Rich Hologram Content */}
        <div
          className="mt-2.5 transition-all duration-300"
          style={{
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? "translateY(6px)" : "translateY(0)",
          }}
        >
          {/* 01: Standby */}
          {current.id === "standby" && (
            <div className="rounded-lg border border-hairline/50 bg-obsidian/60 px-3 py-2 font-mono text-[11px] text-muted flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-muted/40 animate-pulse" />
              <span>Contoh: &ldquo;Trik dapet klien remote tanpa portofolio&rdquo;</span>
            </div>
          )}

          {/* 02: Thinking */}
          {current.id === "thinking" && (
            <div className="space-y-1 rounded-lg border border-ember/30 bg-ember/10 p-2.5 font-mono text-[10px] text-ember">
              <div className="flex items-center justify-between">
                <span>› Memindai pola konten viral Indonesia...</span>
                <span className="size-2 rounded-full bg-ember animate-ping shrink-0" />
              </div>
              <p className="text-muted text-[9px]">
                › Mencocokkan tone natural sehari-hari
              </p>
            </div>
          )}

          {/* 03: Ideas Found */}
          {current.id === "ideas" && (
            <div className="space-y-1 rounded-lg border border-amber-500/30 bg-obsidian/80 p-2 font-mono text-[10px]">
              <div className="flex items-center gap-1.5 text-ember-lo font-semibold">
                <span className="text-ember font-bold">1.</span>
                <span className="truncate">Kesalahan fatal kreator pemula di 30 hari pertama</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted">
                <span>2.</span>
                <span className="truncate">Trik dapet klien remote tanpa portofolio</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted">
                <span>3.</span>
                <span className="truncate">1 Jam bikin stok konten seminggu</span>
              </div>
            </div>
          )}

          {/* 04: Script Timeline (FIX 4: 00:00 HOOK ↓ 00:05 MASALAH ↓ 00:20 SOLUSI ↓ 00:40 CTA) */}
          {current.id === "script" && (
            <div className="rounded-lg border border-ember/40 bg-obsidian/90 p-2 font-mono text-[10px] space-y-1">
              <div className="flex items-center justify-between text-ember font-bold text-[9px] border-b border-hairline/40 pb-1">
                <span>ALUR VIDEO 45 DETIK</span>
                <span>SIAP SYUTING</span>
              </div>
              <div className="space-y-0.5 text-[9px] leading-tight pt-0.5">
                <p className="text-ink/95">
                  <strong className="text-ember">00:00 HOOK:</strong> &ldquo;Stop bilang ga ada waktu bikin konten...&rdquo;
                </p>
                <p className="text-muted">
                  <strong className="text-muted/80">00:05 MASALAH:</strong> Kebanyakan overthinking di ide awal
                </p>
                <p className="text-muted">
                  <strong className="text-muted/80">00:20 SOLUSI:</strong> Pakai 3 rumus angle terbukti ini
                </p>
                <p className="text-ember-lo">
                  <strong className="text-ember">00:40 CTA:</strong> &ldquo;Mulai sekarang, sisanya biar Malesan.&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* 05: Ready / Siap Tayang */}
          {current.id === "ready" && (
            <div className="rounded-lg border border-emerald-500/30 bg-obsidian/90 p-2.5 font-mono text-[10px] space-y-1">
              <div className="flex items-center justify-between text-emerald-400 font-bold text-[9px]">
                <span>✓ KONTEN SELESAI DISIAPKAN</span>
                <span>LANGSUNG TAYANG</span>
              </div>
              <div className="space-y-1 pt-0.5 text-[9px]">
                <p className="text-ink/90">
                  <strong className="text-emerald-400">TikTok & Reels:</strong> Video 9:16 + Subtitle Sinkron Kata
                </p>
                <p className="text-ember-lo">
                  <strong className="text-ember">Threads & X:</strong> Utas 5 Postingan Ringkas Siap Share
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
