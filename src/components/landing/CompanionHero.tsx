"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { ThreeCanvas } from "./ThreeCanvas";

type CompanionState = {
  id: string;
  stepNum: string;
  badge: string;
  title: string;
  desc: string;
  outputTag: string;
  outputPreview: string;
  isWorking: boolean;
};

const COMPANION_STATES: CompanionState[] = [
  {
    id: "idle",
    stepNum: "01",
    badge: "LAYAR KOSONG",
    title: "Malesan siap nemenin lo",
    desc: "Gak perlu bingung mau mulai dari mana. Begitu dibuka, Malesan langsung aktif.",
    outputTag: "Siap Kolaborasi",
    outputPreview: "Menunggu topik atau niche lo...",
    isWorking: false,
  },
  {
    id: "thinking",
    stepNum: "02",
    badge: "LAGI MIKIR...",
    title: "Membaca tren lokal & audiens",
    desc: "Menganalisis topik viral di Indonesia yang relate dengan target audiens lo.",
    outputTag: "Analisis Tren",
    outputPreview: "Menyaring 100+ pola konten viral hari ini...",
    isWorking: true,
  },
  {
    id: "ideas",
    stepNum: "03",
    badge: "IDE DITEMUKAN",
    title: "3 Angle Konten Niche Lo",
    desc: "Bukan prompt mentah, tapi 3 sudut pandang matang siap pilih.",
    outputTag: "3 Angle Siap",
    outputPreview: "Angle: Trik rahasia dapet klien tanpa portofolio",
    isWorking: true,
  },
  {
    id: "script",
    stepNum: "04",
    badge: "NASKAH SELESAI",
    title: "Script 45 Detik Siap Syuting",
    desc: "Lengkap dengan timestamp detik, arahan kamera, dan kalimat CTA.",
    outputTag: "Naskah 45s",
    outputPreview: "[00:00] Hook: Stop kirim CV kosongan...",
    isWorking: true,
  },
  {
    id: "ready",
    stepNum: "05",
    badge: "SIAP TAYANG",
    title: "Subtitle Terbakar & 5 Format",
    desc: "Auto-CC menyinkronkan teks per kata, format otomatis TikTok & Threads.",
    outputTag: "Siap Upload",
    outputPreview: "Video 9:16 + Word-level captions siap export",
    isWorking: false,
  },
];

export function CompanionHero() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-advance companion states smoothly
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % COMPANION_STATES.length);
    }, 3600);
    return () => clearInterval(interval);
  }, [isHovered]);

  const current = COMPANION_STATES[activeIdx];

  return (
    <section className="relative overflow-hidden pt-4 pb-12 sm:pt-10 sm:pb-18 lg:pt-12 lg:pb-20">
      {/* Purposeful Ambient Backdrop */}
      <ThreeCanvas />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:items-center lg:gap-12">
          
          {/* =========================================================================
              MOBILE ONLY: Living Mascot Workspace on Top (Instant 2-Second Brand Hook)
             ========================================================================= */}
          <div className="flex justify-center mb-6 lg:hidden">
            <div
              className="relative flex w-full max-w-[340px] flex-col rounded-2xl border border-hairline/80 bg-surface/50 p-4 shadow-sm backdrop-blur-md"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div className="flex items-center gap-3">
                <div className="relative size-14 shrink-0 grid place-items-center">
                  <Mascot working={current.isWorking} className="size-full filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-ember animate-pulse" />
                    <span className="font-mono text-[9px] font-bold text-ember uppercase tracking-wider">
                      {current.badge}
                    </span>
                  </div>
                  <p className="font-display text-xs font-bold text-ink truncate mt-0.5">
                    {current.title}
                  </p>
                  <p className="font-mono text-[10px] text-muted truncate mt-0.5">
                    {current.outputPreview}
                  </p>
                </div>
              </div>

              {/* Mobile State Progress Indicators */}
              <div className="mt-3 flex items-center justify-between border-t border-hairline/60 pt-2">
                <span className="font-mono text-[9px] text-muted">Tahap {current.stepNum} dari 05</span>
                <div className="flex items-center gap-1">
                  {COMPANION_STATES.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveIdx(idx)}
                      aria-label={`Tahap ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        activeIdx === idx ? "w-4 bg-ember" : "w-1.5 bg-muted/30"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              LEFT COLUMN: Product Headline, Short Value Subtitle, and Clean CTAs (7 Cols)
             ========================================================================= */}
          <div className="flex flex-col items-start lg:col-span-7">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-3 py-1 shadow-xs backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-ember animate-pulse" />
              <span className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
                AI Creative Companion
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-4 font-display text-[clamp(2.3rem,6.5vw,4.25rem)] font-extrabold leading-[1.04] tracking-display-lg text-ink">
              Males mikirnya.
              <br />
              <span className="text-gradient-ember">Bukan bikinnya.</span>
            </h1>

            {/* Short Supporting Subtitle */}
            <p className="mt-4 max-w-lg text-sm sm:text-base lg:text-lg leading-relaxed text-muted">
              AI Creative Companion yang bantu lo cari ide, buat hook, tulis script, sampai siap tayang.
            </p>

            {/* Clean Solid CTA Buttons */}
            <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
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
                href="#magic"
                className="inline-flex items-center justify-center rounded-xl border border-hairline/80 bg-surface/60 px-6 py-3.5 font-display text-sm sm:text-base font-semibold text-ink backdrop-blur-md transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ember-lo active:scale-[0.99]"
              >
                Lihat cara kerja
              </a>
            </div>

            {/* Trust List: Stacked on Mobile, Horizontal on Desktop */}
            {/* Desktop Trust Strip */}
            <div className="hidden sm:flex mt-7 items-center gap-4 border-t border-hairline/60 pt-4 text-xs text-muted">
              <div className="flex items-center gap-1.5 font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span><strong className="text-ink">10 kredit gratis</strong> tiap hari</span>
              </div>
              <span className="text-hairline">•</span>
              <div className="flex items-center gap-1.5 font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Login Google tanpa password</span>
              </div>
              <span className="text-hairline">•</span>
              <div className="flex items-center gap-1.5 font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Siap dalam 30 detik</span>
              </div>
            </div>

            {/* Mobile Stacked Trust List */}
            <div className="flex sm:hidden flex-col gap-1.5 mt-5 border-t border-hairline/60 pt-3 text-xs text-muted">
              <div className="flex items-center gap-2 font-medium">
                <span className="text-ember font-bold">✓</span>
                <span><strong className="text-ink">10 kredit gratis</strong> tiap hari</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <span className="text-ember font-bold">✓</span>
                <span>Login Google tanpa password</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <span className="text-ember font-bold">✓</span>
                <span>Siap dalam 30 detik</span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              DESKTOP ONLY: Living AI Workspace (Pixar-personality companion stage) (5 Cols)
             ========================================================================= */}
          <div className="hidden lg:flex lg:col-span-5 flex-col items-center justify-center">
            <div
              className="relative flex w-full max-w-[420px] min-h-[390px] flex-col items-center justify-between rounded-3xl border border-hairline/80 bg-surface/30 p-7 shadow-xl backdrop-blur-xl transition-all duration-300"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* Subtle Concentric Stage Rings */}
              <div className="pointer-events-none absolute size-52 rounded-full border border-ember/20 bg-gradient-to-b from-ember/10 via-ember/3 to-transparent shadow-[0_0_40px_-10px_rgba(255,138,61,0.2)]" />
              <div className="pointer-events-none absolute size-64 rounded-full border border-dashed border-ember/15 animate-[spin_40s_linear_infinite]" />

              {/* Workspace Top Status Header */}
              <div className="relative z-10 flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-ember animate-ping" />
                  <span className="font-mono text-[10px] font-bold text-ember uppercase tracking-wider">
                    {current.badge}
                  </span>
                </div>
                {/* 5-Step Mini Indicators */}
                <div className="flex items-center gap-1">
                  {COMPANION_STATES.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveIdx(idx)}
                      aria-label={`Tahap ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        activeIdx === idx ? "w-4 bg-ember" : "w-1.5 bg-muted/30 hover:bg-ember/40"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Living Mascot Center Stage with Organic Breathing & Visor Scan */}
              <div className="relative z-10 my-auto flex flex-col items-center">
                <div className="relative size-32 transition-transform duration-300 hover:scale-105 animate-[bounce-gentle_4s_ease-in-out_infinite]">
                  <Mascot working={current.isWorking} className="size-full filter drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]" />
                </div>
              </div>

              {/* Intelligent Output Hologram Card */}
              <div className="relative z-10 w-full rounded-2xl border border-hairline/80 bg-surface/90 p-4 shadow-md backdrop-blur-md transition-all duration-300">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-ember uppercase tracking-wider">
                    Tahap {current.stepNum} · {current.outputTag}
                  </span>
                  <span className="rounded-md border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[9px] text-muted">
                    Companion Live
                  </span>
                </div>

                <p className="mt-2 font-display text-sm font-bold text-ink">
                  {current.title}
                </p>
                <p className="mt-1 text-micro text-muted leading-relaxed">
                  {current.desc}
                </p>

                {/* Live Output Snippet */}
                <div className="mt-2.5 rounded-lg border border-hairline/60 bg-obsidian/70 px-3 py-1.5 font-mono text-[11px] text-ink/90 truncate">
                  <span className="text-ember font-bold mr-1.5">›</span>
                  {current.outputPreview}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
