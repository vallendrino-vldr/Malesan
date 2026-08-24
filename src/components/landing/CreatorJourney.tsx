"use client";

import { useState } from "react";

type JourneyStep = {
  percent: string;
  badge: string;
  title: string;
  story: string;
  malesanRole: string;
  outputTag: string;
  outputPreview: string[];
};

const JOURNEY_STEPS: JourneyStep[] = [
  {
    percent: "0%",
    badge: "Layar Kosong",
    title: "Buntu di Depan Layar",
    story: "Niat bikin konten membara, tapi pas buka kamera langsung overthinking gak tau harus mulai dari mana.",
    malesanRole: "Lo ga perlu mikir rumus prompt rumit. Cukup sebut 1 kata kunci atau biarkan Malesan yang nyari topik sesuai DNA lo.",
    outputTag: "Mulai Tanpa Beban",
    outputPreview: [
      "Bukan mulai dari nol dengan kertas kosong",
      "Tanpa template kaku yang kedengeran robot",
      "Otomatis membaca persona & gaya bicara lo",
    ],
  },
  {
    percent: "33%",
    badge: "Analisis Tren",
    title: "AI Membedah Pola Viral",
    story: "Menyaring ratusan tren video TikTok, Reels, dan X di Indonesia hari ini yang relevan dengan audiens lo.",
    malesanRole: "Malesan menyaring insight lokal dan menyusun hook 3 detik penahan jempol yang bikin penonton berhenti scroll.",
    outputTag: "Riset Tren Lokal",
    outputPreview: [
      "Filter 100+ pola video viral Indonesia 2026",
      "Audit hook pembakar rasa penasaran di 3 detik pertama",
      "Penyesuaian tone bahasa sehari-hari yang natural",
    ],
  },
  {
    percent: "66%",
    badge: "Ide Matang",
    title: "3 Pilihan Sudut Pandang",
    story: "Bukan cuma satu prompt acak, melainkan 3 pilihan sudut pandang matang dengan potensi viral tinggi.",
    malesanRole: "Lo tinggal pilih angle yang paling pas: edukasi taktis, cerita di balik layar, atau kontroversi sehat.",
    outputTag: "3 Pilihan Angle",
    outputPreview: [
      "Angle 1: Bongkar trik tersembunyi yang jarang dibahas",
      "Angle 2: Kesalahan fatal pemula yang bikin rugi jutaan",
      "Angle 3: Step-by-step 1 jam beres stok seminggu",
    ],
  },
  {
    percent: "100%",
    badge: "Siap Tayang",
    title: "Naskah + Subtitle Sinkron Kata",
    story: "Naskah video 45-60 detik lengkap dengan timestamp, teleprompter viewer, dan Auto-CC subtitle sinkron kata.",
    malesanRole: "Tinggal rekam depan kamera. Subtitle terbakar otomatis langsung di browser tanpa watermark.",
    outputTag: "Siap Upload",
    outputPreview: [
      "[00:00] Hook: Stop bayar mahal sebelum cek 3 hal ini...",
      "Video 9:16: Subtitle sinkron kata siap export client-side",
      "Threads & X: Utas 5 postingan ringkas siap share",
    ],
  },
];

export function CreatorJourney() {
  const [activeIdx, setActiveIdx] = useState(2); // Default to "66% 3 Sudut Pandang"
  const current = JOURNEY_STEPS[activeIdx];

  const handleScrollToJourney = () => {
    const el = document.getElementById("journey-content");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="journey" className="relative scroll-mt-12 pt-4 pb-12 sm:pt-6 sm:pb-18">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        
        {/* =========================================================================
            KONSEP A: THE ENERGY CONDUIT & SONAR BEACON (60 FPS INTERACTIVE SCROLL)
           ========================================================================= */}
        <div className="mx-auto mb-10 flex flex-col items-center">
          {/* Vertical Energy Conduit Rail with Photon Stream */}
          <div className="relative h-20 w-8 flex justify-center">
            {/* Base Wire Track */}
            <div className="h-full w-[2px] rounded-full bg-gradient-to-b from-transparent via-white/15 to-ember/50" />
            
            {/* Flowing Photon Bullet */}
            <div
              className="absolute top-0 w-1.5 h-6 rounded-full bg-gradient-to-b from-ember-lo via-ember to-transparent"
              style={{
                animation: "stream-down 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
          </div>

          {/* Sonar Beacon Button with Multi-Ring Pulse */}
          <button
            type="button"
            onClick={handleScrollToJourney}
            aria-label="Jelajahi alur perjalanan kreator"
            className="group relative flex items-center justify-center size-10 rounded-full border border-ember/50 bg-surface-raised shadow-md cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95"
          >
            {/* Outer Sonar Wave 1 */}
            <span
              className="absolute inset-0 rounded-full border border-ember/40 pointer-events-none"
              style={{
                animation: "ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite",
              }}
            />

            {/* Outer Sonar Wave 2 (Staggered) */}
            <span
              className="absolute inset-0 rounded-full border border-ember/25 pointer-events-none"
              style={{
                animation: "ping 2.4s cubic-bezier(0, 0, 0.2, 1) 0.8s infinite",
              }}
            />

            {/* Inner Glowing Core & Interactive Arrow */}
            <div className="relative z-10 flex items-center justify-center size-8 rounded-full bg-obsidian border border-ember/60 transition-colors group-hover:bg-ember/20">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 text-ember transition-transform duration-300 group-hover:translate-y-0.5"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {/* Interactive Micro Guide Label */}
          <button
            type="button"
            onClick={handleScrollToJourney}
            className="mt-3 inline-flex items-center gap-1.5 font-display text-xs font-semibold text-muted/80 transition-colors hover:text-ember cursor-pointer"
          >
            <span>Telusuri Alur Kreator</span>
            <span className="text-ember font-bold">↓</span>
          </button>
        </div>

        {/* Section Header */}
        <div id="journey-content" className="text-center max-w-xl mx-auto scroll-mt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-4 py-1.5 text-xs font-semibold text-ember">
            <span>Alur Perjalanan Kreator</span>
          </div>
          <h2 className="mt-3 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-tight">
            Dari layar kosong, jadi konten siap tayang.
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-muted">
            Lihat bagaimana Malesan menemani setiap detik proses kreatif lo.
          </p>
        </div>

        {/* 4 Step Selector Buttons */}
        <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {JOURNEY_STEPS.map((step, idx) => {
            const isActive = activeIdx === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`flex flex-col items-start rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "border-ember/60 bg-surface-raised text-ink shadow-xs scale-[1.01]"
                    : "border-white/[0.08] bg-surface/40 text-muted hover:border-ember/30 hover:bg-surface-raised/60 hover:text-ink"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-display text-xs font-bold text-ember">
                    {step.percent}
                  </span>
                  <span
                    className={`size-2 rounded-full transition-all duration-300 ${
                      isActive ? "bg-ember animate-pulse" : "bg-muted/30"
                    }`}
                  />
                </div>
                <p className="mt-2 font-display text-xs sm:text-sm font-bold text-ink truncate w-full">
                  {step.title}
                </p>
                <span className="mt-0.5 font-display text-xs text-muted truncate w-full font-medium">
                  {step.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* FLATTENED BESPOKE EDITORIAL STAGE */}
        <div className="mt-5 rounded-3xl border border-white/[0.08] bg-surface/50 p-5 sm:p-7 backdrop-blur-xl transition-all duration-300">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8 items-center">
            
            {/* Left Editorial Narrative (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col items-start space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/10 px-3 py-1 font-display text-xs font-bold text-ember">
                Tahap {activeIdx + 1} · {current.badge}
              </span>

              <h3 className="font-display text-lg sm:text-xl font-bold text-ink">
                {current.title}
              </h3>
              
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                {current.story}
              </p>

              <p className="text-xs sm:text-sm font-medium text-ink/90 border-l-2 border-ember pl-3 py-0.5 leading-relaxed">
                {current.malesanRole}
              </p>
            </div>

            {/* Right Single-Surface Preview Stage (7 Cols) */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-white/[0.08] bg-obsidian/90 p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-ember animate-pulse" />
                    <span className="font-display text-xs font-semibold text-ember">
                      Hasil Nyata Malesan
                    </span>
                  </div>
                  <span className="rounded-md border border-white/[0.08] bg-surface-raised px-2.5 py-0.5 font-display text-xs text-muted font-semibold">
                    {current.outputTag}
                  </span>
                </div>

                <div className="mt-3.5 space-y-2 text-xs text-ink/90">
                  {current.outputPreview.map((line, idx) => (
                    <div key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-ember select-none font-bold">›</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
