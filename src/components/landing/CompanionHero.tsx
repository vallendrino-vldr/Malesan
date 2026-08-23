"use client";

import { useState } from "react";
import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { ThreeCanvas } from "./ThreeCanvas";

type CreativeNode = {
  id: "idea" | "hook" | "script" | "autocc";
  tag: string;
  title: string;
  desc: string;
  metric?: string;
};

const CREATIVE_NODES: CreativeNode[] = [
  {
    id: "idea",
    tag: "IDE HARI INI",
    title: "3 Angle Konten Niche Lo",
    desc: "Tren lokal otomatis dirangkum tanpa lo harus mikir topik.",
    metric: "100% Relevan",
  },
  {
    id: "hook",
    tag: "HOOK 3 DETIK",
    title: "Stop scrolling, tonton ini!",
    desc: "10 pola pembuka berdaya cengkeram tinggi dengan skor kurasi.",
    metric: "Skor 9.4/10",
  },
  {
    id: "script",
    tag: "SCRIPT STUDIO",
    title: "Naskah 45s Siap Syuting",
    desc: "Lengkap dengan arahan visual, timestamp, dan kalimat CTA.",
    metric: "Ritme Pas",
  },
  {
    id: "autocc",
    tag: "VIDEO AUTO-CC",
    title: "Subtitle Otomatis Terbakar",
    desc: "Sinkron audio per kata, rendering langsung di browser.",
    metric: "Groq Whisper",
  },
];

export function CompanionHero() {
  const [activeNode, setActiveNode] = useState<CreativeNode["id"]>("idea");
  const [isHovered, setIsHovered] = useState(false);

  const currentData = CREATIVE_NODES.find((n) => n.id === activeNode) || CREATIVE_NODES[0];

  return (
    <section className="relative overflow-hidden pt-8 pb-16 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-32">
      {/* 3D WebGL Particle Mesh & Ambient Lighting */}
      <ThreeCanvas className="z-0 opacity-70" />

      {/* Radial Warm Heat Aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 size-[650px] sm:size-[850px] rounded-full bg-radial from-ember/18 via-ember/5 to-transparent blur-3xl"
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* LEFT: Hero Copy & Actions (7 Cols) */}
          <div className="flex flex-col items-start lg:col-span-6">
            {/* Status / Category Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-ember/35 bg-ember/10 px-3.5 py-1.5 shadow-xs backdrop-blur-md">
              <span className="size-2 rounded-full bg-ember animate-pulse" />
              <span className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
                AI Creative Companion
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-5 font-display text-[clamp(2.4rem,7vw,4.5rem)] font-extrabold leading-[1.03] tracking-display-lg text-ink">
              Males mikirnya.
              <br />
              <span className="text-gradient-ember">Bukan bikinnya.</span>
            </h1>

            {/* Supporting Copy */}
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg sm:leading-relaxed">
              AI Creative Companion yang nemenin lo dari bengong nyari ide,
              ngeracik hook 3 detik, bikin naskah siap syuting, sampai video siap tayang.
            </p>

            {/* Action CTAs */}
            <div className="mt-8 flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row sm:items-center">
              <Link
                href="/masuk"
                className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-ember-hi via-ember to-ember-deep px-7 py-3.5 font-display text-base font-bold text-obsidian shadow-[0_4px_24px_-4px_rgba(255,138,61,0.45)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_6px_32px_-4px_rgba(255,138,61,0.65)] active:scale-[0.98]"
              >
                <span>Mulai bikin konten</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>

              <a
                href="#alur"
                className="inline-flex items-center justify-center rounded-xl border border-hairline/80 bg-surface/70 px-6 py-3.5 font-display text-base font-semibold text-ink backdrop-blur-md transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ember-lo active:scale-[0.98]"
              >
                Lihat cara kerja
              </a>
            </div>

            {/* Trust Badges / Social Proof */}
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline/60 pt-5 text-xs text-muted">
              <div className="flex items-center gap-1.5 font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span><strong className="text-ink">10 kredit gratis</strong> tiap hari</span>
              </div>
              <span className="text-hairline">•</span>
              <div className="flex items-center gap-1.5 font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Google OAuth · Tanpa Password</span>
              </div>
              <span className="text-hairline">•</span>
              <div className="flex items-center gap-1.5 font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Siap dalam 30 detik</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Interactive 3D Mascot Workspace Stage (6 Cols) */}
          <div className="relative flex flex-col items-center justify-center lg:col-span-6">
            {/* Hologram Stage Platform */}
            <div
              className="relative flex w-full max-w-[480px] min-h-[380px] sm:min-h-[440px] items-center justify-center rounded-3xl border border-hairline/80 bg-surface/35 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* Glowing Aura Rings */}
              <div className="pointer-events-none absolute size-56 sm:size-72 rounded-full border border-ember/25 bg-gradient-to-b from-ember/15 via-ember/5 to-transparent shadow-[0_0_60px_-10px_rgba(255,138,61,0.3)]" />
              <div className="pointer-events-none absolute size-40 sm:size-52 rounded-full border border-surface-raised bg-surface/60" />
              <div className="pointer-events-none absolute size-72 sm:size-96 rounded-full border border-dashed border-ember/20 animate-[spin_32s_linear_infinite]" />

              {/* Status Header Pill on Stage */}
              <div className="absolute top-4 left-5 z-20 flex items-center gap-2">
                <div className="flex size-2 rounded-full bg-ember animate-ping" />
                <span className="font-mono text-[11px] font-bold text-ember uppercase tracking-wider">
                  Partner Kreatif Aktif
                </span>
              </div>

              {/* Mascot Center Stage */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative size-28 sm:size-36 transition-transform duration-300 hover:scale-105">
                  <Mascot
                    working={isHovered}
                    className="size-full filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]"
                  />
                </div>

                {/* Companion Thinking Bubble */}
                <div className="mt-4 flex flex-col items-center text-center max-w-[260px]">
                  <p className="font-display text-sm font-bold text-ink transition-all duration-200">
                    {currentData.title}
                  </p>
                  <p className="mt-1 text-micro text-muted leading-snug">
                    {currentData.desc}
                  </p>
                  <span className="mt-2 inline-flex items-center rounded-full border border-ember/30 bg-ember/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-ember">
                    {currentData.metric}
                  </span>
                </div>
              </div>

              {/* Floating Interactive Creative Node Pills Around Mascot */}
              {/* Top-Left: Idea Engine */}
              <button
                onClick={() => setActiveNode("idea")}
                className={`absolute -top-3 sm:top-2 -left-2 sm:-left-4 z-20 flex items-center gap-2 rounded-xl border p-2.5 shadow-lg backdrop-blur-md transition-all duration-200 cursor-pointer ${
                  activeNode === "idea"
                    ? "border-ember bg-surface-raised text-ink scale-105 shadow-[0_0_20px_rgba(255,138,61,0.25)]"
                    : "border-hairline/80 bg-surface/80 text-muted hover:border-ember/40 hover:text-ink"
                }`}
              >
                <div className="grid size-7 place-items-center rounded-lg bg-ember/15 text-ember">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-mono text-[9px] font-bold uppercase text-ember">Ide Harian</p>
                  <p className="text-xs font-semibold text-ink">3 Angle Niche</p>
                </div>
              </button>

              {/* Top-Right: Hook Lab */}
              <button
                onClick={() => setActiveNode("hook")}
                className={`absolute -top-3 sm:top-2 -right-2 sm:-right-4 z-20 flex items-center gap-2 rounded-xl border p-2.5 shadow-lg backdrop-blur-md transition-all duration-200 cursor-pointer ${
                  activeNode === "hook"
                    ? "border-ember bg-surface-raised text-ink scale-105 shadow-[0_0_20px_rgba(255,138,61,0.25)]"
                    : "border-hairline/80 bg-surface/80 text-muted hover:border-ember/40 hover:text-ink"
                }`}
              >
                <div className="grid size-7 place-items-center rounded-lg bg-ember/15 text-ember">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-mono text-[9px] font-bold uppercase text-ember">Hook Lab</p>
                  <p className="text-xs font-semibold text-ink">Skor 9.4/10</p>
                </div>
              </button>

              {/* Bottom-Left: Script Studio */}
              <button
                onClick={() => setActiveNode("script")}
                className={`absolute -bottom-3 sm:bottom-3 -left-2 sm:-left-4 z-20 flex items-center gap-2 rounded-xl border p-2.5 shadow-lg backdrop-blur-md transition-all duration-200 cursor-pointer ${
                  activeNode === "script"
                    ? "border-ember bg-surface-raised text-ink scale-105 shadow-[0_0_20px_rgba(255,138,61,0.25)]"
                    : "border-hairline/80 bg-surface/80 text-muted hover:border-ember/40 hover:text-ink"
                }`}
              >
                <div className="grid size-7 place-items-center rounded-lg bg-ember/15 text-ember">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-mono text-[9px] font-bold uppercase text-ember">Naskah Video</p>
                  <p className="text-xs font-semibold text-ink">45s Siap Syuting</p>
                </div>
              </button>

              {/* Bottom-Right: Auto-CC */}
              <button
                onClick={() => setActiveNode("autocc")}
                className={`absolute -bottom-3 sm:bottom-3 -right-2 sm:-right-4 z-20 flex items-center gap-2 rounded-xl border p-2.5 shadow-lg backdrop-blur-md transition-all duration-200 cursor-pointer ${
                  activeNode === "autocc"
                    ? "border-ember bg-surface-raised text-ink scale-105 shadow-[0_0_20px_rgba(255,138,61,0.25)]"
                    : "border-hairline/80 bg-surface/80 text-muted hover:border-ember/40 hover:text-ink"
                }`}
              >
                <div className="grid size-7 place-items-center rounded-lg bg-ember/15 text-ember">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                    <line x1="7" y1="15" x2="17" y2="15" />
                    <line x1="7" y1="11" x2="17" y2="11" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-mono text-[9px] font-bold uppercase text-ember">Auto-CC</p>
                  <p className="text-xs font-semibold text-ink">Subtitle Audio</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
