"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/Mascot";

export type CompanionStudioState = {
  id: string;
  stepNum: string;
  badge: string;
  title: string;
  detail: string;
  previewTag: string;
  previewSnippet: string;
  isWorking: boolean;
  hologramColor: string;
};

export const STUDIO_STATES: CompanionStudioState[] = [
  {
    id: "empty",
    stepNum: "01",
    badge: "LAYAR KOSONG",
    title: "Malesan siap nemenin lo",
    detail: "Ga perlu bingung mau mulai dari mana. Begitu lo buka, Malesan langsung aktif.",
    previewTag: "Standby",
    previewSnippet: "Nunggu topik atau niche konten lo...",
    isWorking: false,
    hologramColor: "from-ember/20 to-transparent",
  },
  {
    id: "thinking",
    stepNum: "02",
    badge: "LAGI MIKIR...",
    title: "Membaca tren lokal & audiens",
    detail: "Menganalisis topik viral di Indonesia yang relate dengan target audiens lo.",
    previewTag: "Membaca Pola",
    previewSnippet: "Menyaring 100+ pola konten viral hari ini...",
    isWorking: true,
    hologramColor: "from-ember/30 to-ember/5",
  },
  {
    id: "ideas",
    stepNum: "03",
    badge: "IDE DITEMUKAN",
    title: "3 Angle Konten Niche Lo",
    detail: "Bukan prompt mentah, tapi 3 sudut pandang matang siap lo pilih.",
    previewTag: "3 Angle Siap",
    previewSnippet: "Angle 1: Trik rahasia dapet klien tanpa portofolio",
    isWorking: true,
    hologramColor: "from-amber-500/30 to-ember/10",
  },
  {
    id: "script",
    stepNum: "04",
    badge: "NASKAH SELESAI",
    title: "Script 45 Detik Siap Syuting",
    detail: "Lengkap dengan timestamp detik, arahan kamera, dan kalimat CTA.",
    previewTag: "Naskah 45s",
    previewSnippet: "[00:00] Hook: Stop kirim CV kosongan kalau mau...",
    isWorking: true,
    hologramColor: "from-ember/35 to-amber-500/10",
  },
  {
    id: "ready",
    stepNum: "05",
    badge: "SIAP TAYANG",
    title: "Subtitle Terbakar & 5 Format",
    detail: "Auto-CC menyinkronkan teks per kata, format otomatis TikTok & Threads.",
    previewTag: "Siap Upload",
    previewSnippet: "Video 9:16 + Word-level captions siap export",
    isWorking: false,
    hologramColor: "from-emerald-500/25 to-ember/10",
  },
];

export function LivingStudioCanvas({
  activeIdx,
  onSelectState,
}: {
  activeIdx: number;
  onSelectState: (idx: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const current = STUDIO_STATES[activeIdx] || STUDIO_STATES[0];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setMouseOffset({ x: x * 12, y: y * 10 });
    };

    const handleMouseLeave = () => {
      setMouseOffset({ x: 0, y: 0 });
    };

    el.addEventListener("mousemove", handleMouseMove, { passive: true });
    el.addEventListener("mouseleave", handleMouseLeave, { passive: true });

    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex w-full max-w-[440px] min-h-[410px] sm:min-h-[440px] flex-col items-center justify-between rounded-3xl border border-hairline/90 bg-surface/35 p-6 sm:p-7 shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden"
      style={{
        transform: `perspective(1000px) rotateY(${mouseOffset.x * 0.4}deg) rotateX(${-mouseOffset.y * 0.4}deg)`,
      }}
    >
      {/* Volumetric Warm Lighting Beam from Pedestal */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 w-64 h-72 bg-gradient-to-t from-ember/25 via-ember/8 to-transparent blur-2xl rounded-full"
      />

      {/* Hologram Orbit Rings */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-60 rounded-full border border-ember/20 shadow-[0_0_50px_rgba(255,138,61,0.2)]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-72 rounded-full border border-dashed border-ember/15 animate-[spin_45s_linear_infinite]" />

      {/* Workspace Status Bar */}
      <div className="relative z-20 flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-ember animate-ping" />
          <span className="font-mono text-[10px] font-bold text-ember uppercase tracking-wider">
            {current.badge}
          </span>
        </div>

        {/* 5-Step Progress Indicators */}
        <div className="flex items-center gap-1">
          {STUDIO_STATES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => onSelectState(idx)}
              aria-label={`Tahap ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeIdx === idx
                  ? "w-4 bg-ember shadow-[0_0_8px_rgba(255,138,61,0.6)]"
                  : "w-1.5 bg-muted/30 hover:bg-ember/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Central Living Mascot & Holographic Desk Pedestal */}
      <div className="relative z-10 my-auto flex flex-col items-center">
        {/* Holographic Desk Pedestal */}
        <div className="relative flex flex-col items-center">
          {/* Active Mascot with Organic Breathing and Cursor Parallax */}
          <div
            className="relative size-28 sm:size-32 transition-transform duration-200 animate-[bounce-gentle_4s_ease-in-out_infinite]"
            style={{
              transform: `translate(${mouseOffset.x * 0.5}px, ${mouseOffset.y * 0.4}px)`,
            }}
          >
            <Mascot
              working={current.isWorking}
              className="size-full filter drop-shadow-[0_10px_28px_rgba(0,0,0,0.6)]"
            />
          </div>

          {/* Pedestal Glass Base Plate */}
          <div className="mt-1 w-36 h-3 rounded-full bg-gradient-to-r from-transparent via-ember/40 to-transparent blur-[1px]" />
          <div className="w-24 h-1.5 rounded-full bg-ember/60 shadow-[0_0_16px_rgba(255,138,61,0.8)]" />
        </div>
      </div>

      {/* Floating Holographic Display Screen (Morphed per state) */}
      <div
        className="relative z-20 w-full rounded-2xl border border-hairline/90 bg-surface/90 p-4 shadow-lg backdrop-blur-md transition-all duration-300"
        style={{
          transform: `translate(${-mouseOffset.x * 0.3}px, ${-mouseOffset.y * 0.3}px)`,
        }}
      >
        <div className="flex items-center justify-between border-b border-hairline/60 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-ember" />
            <span className="font-mono text-[10px] font-bold text-ember uppercase tracking-wider">
              Tahap {current.stepNum} · {current.previewTag}
            </span>
          </div>
          <span className="font-mono text-[9px] text-muted">Living AI</span>
        </div>

        <p className="mt-2 font-display text-sm font-bold text-ink">
          {current.title}
        </p>
        <p className="mt-0.5 text-micro text-muted leading-relaxed">
          {current.detail}
        </p>

        {/* Live Output Snippet */}
        <div className="mt-2.5 rounded-lg border border-hairline/60 bg-obsidian/80 px-3 py-1.5 font-mono text-[11px] text-ink/90 truncate flex items-center gap-1.5">
          <span className="text-ember font-bold">›</span>
          <span className="truncate">{current.previewSnippet}</span>
        </div>
      </div>
    </div>
  );
}
