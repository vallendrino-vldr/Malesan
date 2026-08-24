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

  return (
    <section id="journey" className="relative scroll-mt-16 pt-4 pb-12 sm:pt-6 sm:pb-18">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        
        {/* =========================================================================
            LIVING KINETIC NODE: Laser Wire with Downward Photon + Orbital Core Puck
           ========================================================================= */}
        <div className="mx-auto mb-6 flex flex-col items-center select-none">
          {/* Laser Guide Wire with Flowing Photon Pulse */}
          <div className="relative h-12 w-6 flex justify-center overflow-hidden">
            {/* Ambient Background Track */}
            <div className="h-full w-[1.5px] rounded-full bg-gradient-to-b from-transparent via-white/10 to-ember/40" />
            
            {/* Flowing Kinetic Photon Bullet */}
            <div
              className="absolute top-0 w-[2px] h-5 rounded-full bg-gradient-to-b from-transparent via-ember to-ember-lo"
              style={{
                animation: "stream-down 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
          </div>

          {/* Micro Orbital Node Puck */}
          <div className="relative flex items-center justify-center size-7 rounded-full border border-white/[0.12] bg-surface/90 shadow-sm backdrop-blur-md">
            {/* Rotating Micro Orbital Dash Ring */}
            <svg
              viewBox="0 0 28 28"
              fill="none"
              className="absolute inset-0 size-full animate-[spin_8s_linear_infinite]"
            >
              <circle
                cx="14"
                cy="14"
                r="11"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeDasharray="4 6"
                className="text-ember/60"
              />
            </svg>

            {/* Living Breathing Ember Jewel Core */}
            <div className="size-2 rounded-full bg-ember animate-pulse shadow-xs" />
          </div>

          {/* Subtle Bottom Ground Lead */}
          <div className="h-4 w-[1.5px] bg-gradient-to-b from-ember/40 to-transparent" />
        </div>

        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-4 py-1.5 text-xs font-semibold text-ember">
            <span className="size-1.5 rounded-full bg-ember animate-pulse" />
            <span>Alur Perjalanan Kreator</span>
          </div>
          <h2 className="mt-3.5 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-tight">
            Dari layar kosong, jadi konten siap tayang.
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-muted">
            Lihat bagaimana Malesan menemani setiap detik proses kreatif lo.
          </p>
        </div>

        {/* 4 Step Selector Buttons */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
