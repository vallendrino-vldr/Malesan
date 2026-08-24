"use client";

import { useEffect, useRef, useState } from "react";

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
    badge: "LAYAR KOSONG",
    title: "Layar Kosong",
    story: "Mau bikin konten tapi bengong depan layar kosong gak tau mulai dari mana.",
    malesanRole: "Lo ga perlu mikir prompt rumit. Cukup buka Malesan, langsung nemu ruang kerja siap pakai.",
    outputTag: "Mulai Awal",
    outputPreview: [
      "Bukan mulai dari nol",
      "Tanpa template kaku",
      "Otomatis membaca gaya & niche lo",
    ],
  },
  {
    percent: "33%",
    badge: "ANALISIS TREN",
    title: "AI Berpikir",
    story: "Menyaring ratusan tren lokal dan pola video viral di Indonesia hari ini.",
    malesanRole: "Malesan menyaring insight relevan dan mencocokkannya dengan target penonton lo.",
    outputTag: "Riset Tren",
    outputPreview: [
      "Filter 100+ pola konten viral",
      "Audit hook 3 detik pertama",
      "Penyesuaian bahasa sehari-hari",
    ],
  },
  {
    percent: "66%",
    badge: "IDE MATANG",
    title: "Ide Terbentuk",
    story: "Bukan satu prompt acak, melainkan 3 pilihan sudut pandang matang.",
    malesanRole: "Lo tinggal pilih angle yang paling lo suka: edukatif, studi kasus, atau opini tajam.",
    outputTag: "3 Pilihan Angle",
    outputPreview: [
      "Angle 1: Trik dapet klien remote tanpa portofolio",
      "Angle 2: Kesalahan fatal kreator di 30 hari pertama",
      "Angle 3: 1 Jam bikin stok konten seminggu",
    ],
  },
  {
    percent: "100%",
    badge: "SIAP TAYANG",
    title: "Konten Siap",
    story: "Naskah terstruktur lengkap dengan timestamp, visual cues, dan subtitle sinkron kata.",
    malesanRole: "Tinggal rekam depan kamera. Auto-CC membakar subtitle otomatis langsung di browser.",
    outputTag: "Siap Upload",
    outputPreview: [
      "[00:00] Hook: Stop bilang ga ada waktu bikin konten...",
      "Video 9:16: Subtitle terbakar per kata siap export",
      "Threads / X: Utas 5 postingan ringkas siap share",
    ],
  },
];

export function CreatorJourney() {
  const [activeIdx, setActiveIdx] = useState(2); // Start at "66% Ide Terbentuk"
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // IntersectionObserver for scroll-driven reveal
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const current = JOURNEY_STEPS[activeIdx];

  return (
    <section
      id="journey"
      ref={sectionRef}
      className="relative scroll-mt-16 border-t border-hairline/60 bg-surface/15 py-12 sm:py-16"
    >
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        
        {/* Section Header */}
        <div
          className="text-center max-w-xl mx-auto transition-all duration-700"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(24px)",
          }}
        >
          <p className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
            Alur Perjalanan Kreator
          </p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-tight">
            Dari layar kosong, jadi konten siap tayang.
          </h2>
        </div>

        {/* 4 Step Buttons */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {JOURNEY_STEPS.map((step, idx) => {
            const isActive = activeIdx === idx;
            return (
              <button
                key={idx}
                onClick={() => setActiveIdx(idx)}
                className={`flex flex-col items-start rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-300 cursor-pointer ${
                  isActive
                    ? "border-ember bg-surface-raised shadow-[0_0_20px_rgba(255,138,61,0.2)] scale-[1.02]"
                    : "border-hairline/60 bg-surface/40 hover:border-ember/30 hover:bg-surface"
                }`}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 0.5s ease-out ${0.2 + idx * 0.1}s, transform 0.5s ease-out ${0.2 + idx * 0.1}s, border-color 0.3s, background-color 0.3s, box-shadow 0.3s`,
                }}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-xs font-bold text-ember">
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
                <span className="mt-0.5 font-mono text-[9px] text-muted truncate w-full">
                  {step.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Transformation Stage */}
        <div
          className="mt-6 rounded-2xl border border-hairline/80 bg-obsidian p-5 sm:p-7 shadow-xl transition-all duration-700"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(24px)",
            transitionDelay: "0.5s",
          }}
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-8 items-center">
            
            {/* Left Narrative (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col items-start">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-ember">
                Tahap {activeIdx + 1} · {current.badge}
              </span>

              <h3 className="mt-2.5 font-display text-lg sm:text-xl font-bold text-ink">
                {current.title}
              </h3>
              
              <div className="mt-3 space-y-2 text-xs sm:text-sm w-full">
                <div className="rounded-lg border border-hairline/60 bg-surface/40 p-2.5">
                  <p className="text-muted leading-relaxed">
                    {current.story}
                  </p>
                </div>
                <div className="rounded-lg border border-ember/20 bg-ember/5 p-2.5">
                  <p className="text-ink font-medium leading-relaxed">
                    {current.malesanRole}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Live Output Preview (7 Cols) */}
            <div className="lg:col-span-7">
              <div className="rounded-xl border border-hairline/80 bg-surface/90 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-hairline/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-ember animate-pulse" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ember">
                      Hasil Nyata Malesan
                    </span>
                  </div>
                  <span className="rounded-md border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[9px] text-muted">
                    {current.outputTag}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 font-mono text-xs text-ink/90">
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
