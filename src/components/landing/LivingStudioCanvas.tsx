"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/Mascot";

export type StudioSequencePhase = "empty" | "scanning" | "hologram" | "ideas" | "script";

type SequenceConfig = {
  id: StudioSequencePhase;
  phaseNum: string;
  badge: string;
  subBadge: string;
  title: string;
  screenSnippet: string;
  isScanning: boolean;
  isWorking: boolean;
  hologramGlow: string;
  screenType: "empty" | "scan" | "hologram" | "ideas" | "script";
};

const SEQUENCE: SequenceConfig[] = [
  {
    id: "empty",
    phaseNum: "01",
    badge: "01 / STANDBY",
    subBadge: "Layar Kosong",
    title: "Nunggu ide dari lo...",
    screenSnippet: "Siap kolaborasi. Tinggal sebut niche lo.",
    isScanning: false,
    isWorking: false,
    hologramGlow: "from-ember/10 to-transparent",
    screenType: "empty",
  },
  {
    id: "scanning",
    phaseNum: "02",
    badge: "02 / LAGI MIKIR",
    subBadge: "Visor Scan Aktif",
    title: "Menganalisis tren lokal Indonesia...",
    screenSnippet: "Menyaring 100+ pola konten viral hari ini...",
    isScanning: true,
    isWorking: true,
    hologramGlow: "from-ember/30 via-ember/15 to-transparent",
    screenType: "scan",
  },
  {
    id: "hologram",
    phaseNum: "03",
    badge: "03 / HOLOGRAM NYALA",
    subBadge: "Proyeksi 3D",
    title: "Menyiapkan sudut pandang konten...",
    screenSnippet: "Menghubungkan tren ke target audiens lo...",
    isScanning: false,
    isWorking: true,
    hologramGlow: "from-ember/40 via-amber-500/20 to-transparent",
    screenType: "hologram",
  },
  {
    id: "ideas",
    phaseNum: "04",
    badge: "04 / IDE DITEMUKAN",
    subBadge: "3 Angle Siap",
    title: "3 Pilihan Angle Matang!",
    screenSnippet: "1. Trik dapet klien tanpa portofolio (Skor 9.4)",
    isScanning: false,
    isWorking: true,
    hologramGlow: "from-amber-500/40 via-ember/25 to-transparent",
    screenType: "ideas",
  },
  {
    id: "script",
    phaseNum: "05",
    badge: "05 / SIAP TAYANG",
    subBadge: "Naskah 45s + Auto-CC",
    title: "Naskah Lengkap & Subtitle Siap!",
    screenSnippet: "[00:00] Hook: Stop kirim CV kosongan...",
    isScanning: false,
    isWorking: false,
    hologramGlow: "from-emerald-500/30 via-ember/20 to-transparent",
    screenType: "script",
  },
];

export function LivingStudioCanvas({
  className = "",
}: {
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [mouseTilt, setMouseTilt] = useState({ x: 0, y: 0 });

  // Timed Sequence Engine:
  // Phase 0: 0-2.5s (Empty)
  // Phase 1: 2.5-5.5s (Scanning)
  // Phase 2: 5.5-8.5s (Hologram Beam)
  // Phase 3: 8.5-12.5s (Ideas Pop)
  // Phase 4: 12.5-16.5s (Script Ready)
  useEffect(() => {
    if (isPaused) return;

    const durations = [2800, 3200, 3000, 3800, 4200];
    const currentDuration = durations[phaseIndex] || 3500;

    const timer = setTimeout(() => {
      setPhaseIndex((prev) => (prev + 1) % SEQUENCE.length);
    }, currentDuration);

    return () => clearTimeout(timer);
  }, [phaseIndex, isPaused]);

  // Smooth mouse parallax
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setMouseTilt({ x: x * 14, y: y * 12 });
    };

    const handleLeave = () => {
      setMouseTilt({ x: 0, y: 0 });
    };

    el.addEventListener("mousemove", handleMove, { passive: true });
    el.addEventListener("mouseleave", handleLeave, { passive: true });

    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  const current = SEQUENCE[phaseIndex];

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`relative flex w-full max-w-[450px] min-h-[420px] sm:min-h-[460px] flex-col items-center justify-between rounded-3xl border border-hairline/90 bg-surface/35 p-6 sm:p-7 shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden select-none ${className}`}
      style={{
        transform: `perspective(1100px) rotateY(${mouseTilt.x * 0.45}deg) rotateX(${-mouseTilt.y * 0.45}deg)`,
      }}
    >
      {/* 3D Volumetric Stage Light Cone */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-16 left-1/2 -translate-x-1/2 w-80 h-96 bg-gradient-to-t ${current.hologramGlow} blur-3xl rounded-full transition-all duration-700`}
      />

      {/* Hologram Rotating Depth Rings */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-64 rounded-full border border-ember/25 shadow-[0_0_50px_rgba(255,138,61,0.2)]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-80 rounded-full border border-dashed border-ember/15 animate-[spin_40s_linear_infinite]" />

      {/* Top Sequence Timeline Bar */}
      <div className="relative z-20 flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-ember animate-ping" />
          <span className="font-mono text-[10px] font-bold text-ember uppercase tracking-wider">
            {current.badge}
          </span>
        </div>

        {/* 5 Step Selectors */}
        <div className="flex items-center gap-1">
          {SEQUENCE.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setPhaseIndex(idx)}
              aria-label={`Lihat sequence ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                phaseIndex === idx
                  ? "w-4 bg-ember shadow-[0_0_8px_rgba(255,138,61,0.8)]"
                  : "w-1.5 bg-muted/30 hover:bg-ember/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Central Living Mascot with Workspace Pedestal */}
      <div className="relative z-10 my-auto flex flex-col items-center">
        {/* Holographic Projection Halo */}
        <div
          className={`pointer-events-none absolute -top-8 size-48 rounded-full bg-gradient-to-b ${current.hologramGlow} blur-xl transition-all duration-500`}
        />

        {/* Mascot Character with Cursor Parallax */}
        <div
          className="relative size-28 sm:size-32 transition-transform duration-200 animate-[bounce-gentle_4s_ease-in-out_infinite]"
          style={{
            transform: `translate(${mouseTilt.x * 0.55}px, ${mouseTilt.y * 0.45}px)`,
          }}
        >
          <Mascot
            working={current.isWorking}
            className="size-full filter drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
          />
        </div>

        {/* Mini 3D Workspace Pedestal */}
        <div className="mt-1.5 flex flex-col items-center">
          <div className="w-36 h-3 rounded-full bg-gradient-to-r from-transparent via-ember/40 to-transparent blur-[1px]" />
          <div className="w-24 h-1.5 rounded-full bg-ember/60 shadow-[0_0_16px_rgba(255,138,61,0.8)]" />
        </div>
      </div>

      {/* Floating Holographic Creative Output Screen */}
      <div
        className="relative z-20 w-full rounded-2xl border border-hairline/90 bg-surface/90 p-4 shadow-lg backdrop-blur-md transition-all duration-300"
        style={{
          transform: `translate(${-mouseTilt.x * 0.35}px, ${-mouseTilt.y * 0.35}px)`,
        }}
      >
        <div className="flex items-center justify-between border-b border-hairline/60 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-ember" />
            <span className="font-mono text-[10px] font-bold text-ember uppercase tracking-wider">
              {current.subBadge}
            </span>
          </div>
          <span className="font-mono text-[9px] text-muted">Living AI Studio</span>
        </div>

        <p className="mt-2 font-display text-sm font-bold text-ink">
          {current.title}
        </p>

        {/* Output Screen Content According to Phase */}
        {current.screenType === "empty" && (
          <div className="mt-2 rounded-lg border border-hairline/50 bg-obsidian/60 px-3 py-2 font-mono text-[11px] text-muted flex items-center gap-2">
            <span className="size-2 rounded-full bg-muted/40 animate-pulse" />
            <span>{current.screenSnippet}</span>
          </div>
        )}

        {current.screenType === "scan" && (
          <div className="mt-2 rounded-lg border border-ember/30 bg-ember/10 px-3 py-2 font-mono text-[11px] text-ember flex items-center justify-between">
            <span className="truncate">{current.screenSnippet}</span>
            <span className="size-2 rounded-full bg-ember animate-ping shrink-0 ml-2" />
          </div>
        )}

        {current.screenType === "hologram" && (
          <div className="mt-2 rounded-lg border border-ember/40 bg-obsidian/80 px-3 py-2 font-mono text-[11px] text-ink/90 space-y-1">
            <div className="flex items-center gap-1.5 text-ember">
              <span>›</span>
              <span>Membaca persona & gaya bicara lo</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted text-[10px]">
              <span>›</span>
              <span>Menyiapkan struktur hook 3 detik</span>
            </div>
          </div>
        )}

        {current.screenType === "ideas" && (
          <div className="mt-2 space-y-1 rounded-lg border border-amber-500/30 bg-obsidian/80 p-2.5 font-mono text-[11px] text-ink/90">
            <div className="flex items-start gap-1.5 text-ember-lo font-semibold">
              <span>1.</span>
              <span className="truncate">Trik rahasia dapet klien tanpa portofolio</span>
            </div>
            <div className="flex items-start gap-1.5 text-muted text-[10px]">
              <span>2.</span>
              <span className="truncate">Kenapa 90% kreator gagal konsisten</span>
            </div>
            <div className="flex items-start gap-1.5 text-muted text-[10px]">
              <span>3.</span>
              <span className="truncate">1 Jam bikin stok konten seminggu</span>
            </div>
          </div>
        )}

        {current.screenType === "script" && (
          <div className="mt-2 rounded-lg border border-emerald-500/30 bg-obsidian/80 p-2.5 font-mono text-[11px] text-ink/90 space-y-1">
            <div className="flex items-center justify-between text-emerald-400 font-bold text-[10px]">
              <span>NASKAH 45 DETIK</span>
              <span>FORMAT TIKTOK / REELS</span>
            </div>
            <p className="text-muted text-[10px] leading-snug">
              [00:00] Hook: Stop kirim CV kosongan...
            </p>
            <p className="text-ember-lo text-[10px] font-semibold">
              ✓ Subtitle Auto-CC sinkron siap export
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
