"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { ThreeCanvas } from "./ThreeCanvas";

type CompanionActivity = {
  id: string;
  badge: string;
  title: string;
  detail: string;
  status: string;
  icon: React.ReactNode;
};

const ACTIVITIES: CompanionActivity[] = [
  {
    id: "ide",
    badge: "IDE HARIAN DITEMUKAN",
    title: "3 Angle Konten Niche Lo",
    detail: "Tren lokal Indonesia dirangkum otomatis tanpa lo harus mikir topik.",
    status: "Siap dieksekusi",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id: "hook",
    badge: "HOOK 3 DETIK TERUJI",
    title: "Stop scrolling, tonton ini!",
    detail: "10 pola pembuka anti-skip dengan skor kurasi psikologi audiens.",
    status: "Skor 9.4 / 10",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    id: "script",
    badge: "SCRIPT STUDIO SELESAI",
    title: "Naskah 45s Siap Syuting",
    detail: "Lengkap dengan arahan visual, timestamp detik, dan kalimat CTA.",
    status: "Format percakapan natural",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    id: "autocc",
    badge: "VIDEO AUTO-CC TERBAKAR",
    title: "Subtitle Audio Otomatis",
    detail: "Transkripsi Groq Whisper sinkron kata per kata langsung di browser.",
    status: "Rendering selesai",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <line x1="6" y1="12" x2="10" y2="12" />
        <line x1="14" y1="12" x2="18" y2="12" />
      </svg>
    ),
  },
];

export function CompanionHero() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Intelligent companion activity rotation (every 3.8s)
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ACTIVITIES.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [isPaused]);

  const current = ACTIVITIES[currentIndex];

  return (
    <section className="relative overflow-hidden pt-4 pb-12 sm:pt-10 sm:pb-20 lg:pt-14 lg:pb-24">
      {/* Contained Hero-only Ambient Particle Field */}
      <ThreeCanvas className="z-0 opacity-60" />

      {/* Subtle Warm Glow Behind Hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 size-[480px] sm:size-[680px] rounded-full bg-radial from-ember/15 via-ember/4 to-transparent blur-3xl"
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:items-center lg:gap-10">
          
          {/* MOBILE ONLY: Mascot Stage on Top for Instant 2-Second Brand Recognition */}
          <div className="flex justify-center mb-6 lg:hidden">
            <div
              className="relative flex w-full max-w-[340px] items-center justify-between rounded-2xl border border-hairline/80 bg-surface/40 p-3.5 shadow-sm backdrop-blur-md"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Compact Mascot with Active Visor */}
              <div className="flex items-center gap-3">
                <div className="relative size-14 shrink-0 grid place-items-center">
                  <Mascot working={true} className="size-full filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-ember animate-pulse" />
                    <span className="font-mono text-[9px] font-bold text-ember uppercase tracking-wider">
                      {current.badge}
                    </span>
                  </div>
                  <p className="font-display text-xs font-bold text-ink truncate mt-0.5">
                    {current.title}
                  </p>
                </div>
              </div>

              {/* Progress Dots */}
              <div className="flex flex-col gap-1 pl-2">
                {ACTIVITIES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Lihat aktivitas ${idx + 1}`}
                    className={`size-1.5 rounded-full transition-all cursor-pointer ${
                      currentIndex === idx ? "bg-ember scale-125" : "bg-muted/30 hover:bg-ember/40"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* LEFT COLUMN: Main Headline, Supporting Copy, and Refined CTAs (7 Cols) */}
          <div className="flex flex-col items-start lg:col-span-7">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-3.5 py-1 shadow-xs backdrop-blur-md">
              <span className="size-2 rounded-full bg-ember animate-pulse" />
              <span className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
                AI Creative Companion
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-4 font-display text-[clamp(2.2rem,6.5vw,4.25rem)] font-extrabold leading-[1.04] tracking-display-lg text-ink">
              Males mikirnya.
              <br />
              <span className="text-gradient-ember">Bukan bikinnya.</span>
            </h1>

            {/* Supporting Copy */}
            <p className="mt-5 max-w-lg text-sm sm:text-base lg:text-lg leading-relaxed text-muted">
              AI Creative Companion yang bantu lo cari ide, bikin script, sampai siap tayang.
            </p>

            {/* Refined CTA Actions (Solid, Clean, Non-Gaming) */}
            <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link
                href="/masuk"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-ember px-7 py-3.5 font-display text-sm sm:text-base font-bold text-obsidian shadow-sm transition-all duration-200 hover:bg-ember-lo hover:shadow-[0_4px_20px_rgba(255,138,61,0.25)] hover:scale-[1.01] active:scale-[0.99]"
              >
                <span>Mulai bikin konten</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>

              <a
                href="#alur"
                className="inline-flex items-center justify-center rounded-xl border border-hairline/80 bg-surface/60 px-6 py-3.5 font-display text-sm sm:text-base font-semibold text-ink backdrop-blur-md transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ember-lo active:scale-[0.99]"
              >
                Lihat cara kerja
              </a>
            </div>

            {/* Trust Benefits Strip */}
            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline/60 pt-4 text-micro sm:text-xs text-muted">
              <div className="flex items-center gap-1.5 font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span><strong className="text-ink">10 kredit gratis</strong> tiap hari</span>
              </div>
              <span className="text-hairline">•</span>
              <div className="flex items-center gap-1.5 font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Google OAuth · Tanpa Password</span>
              </div>
              <span className="text-hairline">•</span>
              <div className="flex items-center gap-1.5 font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Siap dalam 30 detik</span>
              </div>
            </div>
          </div>

          {/* DESKTOP ONLY: 3D Holographic Companion Stage (5 Cols) */}
          <div className="hidden lg:flex lg:col-span-5 flex-col items-center justify-center">
            <div
              className="relative flex w-full max-w-[420px] min-h-[380px] flex-col items-center justify-between rounded-3xl border border-hairline/80 bg-surface/30 p-7 shadow-xl backdrop-blur-xl transition-all duration-300"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Ambient Circular Glow */}
              <div className="pointer-events-none absolute size-52 rounded-full border border-ember/20 bg-gradient-to-b from-ember/12 via-ember/4 to-transparent shadow-[0_0_50px_-10px_rgba(255,138,61,0.25)]" />
              <div className="pointer-events-none absolute size-64 rounded-full border border-dashed border-ember/15 animate-[spin_32s_linear_infinite]" />

              {/* Stage Top Status Header */}
              <div className="relative z-10 flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-ember animate-ping" />
                  <span className="font-mono text-[10px] font-bold text-ember uppercase tracking-wider">
                    Partner Kreatif Aktif
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {ACTIVITIES.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      aria-label={`Aktivitas ${idx + 1}`}
                      className={`size-2 rounded-full transition-all cursor-pointer ${
                        currentIndex === idx ? "bg-ember scale-125" : "bg-muted/30 hover:bg-ember/50"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Mascot Center Stage with Smooth Floating Breathing */}
              <div className="relative z-10 my-auto flex flex-col items-center">
                <div className="relative size-28 transition-transform duration-300 hover:scale-105 animate-[bounce-gentle_4s_ease-in-out_infinite]">
                  <Mascot working={true} className="size-full filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]" />
                </div>
              </div>

              {/* Single Intelligent Contextual Activity Card (Transitions Smoothly) */}
              <div className="relative z-10 w-full rounded-2xl border border-hairline/80 bg-surface/90 p-4 shadow-md backdrop-blur-md transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="grid size-6 place-items-center rounded-lg bg-ember/15">
                      {current.icon}
                    </div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ember">
                      {current.badge}
                    </span>
                  </div>
                  <span className="rounded-md border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[9px] text-muted">
                    {current.status}
                  </span>
                </div>

                <p className="mt-2.5 font-display text-sm font-bold text-ink">
                  {current.title}
                </p>
                <p className="mt-1 text-micro text-muted leading-relaxed">
                  {current.detail}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
