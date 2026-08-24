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
    badge: "ANALISIS TREN",
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
    badge: "IDE MATANG",
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
    badge: "SIAP TAYANG",
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
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const current = JOURNEY_STEPS[activeIdx];

  return (
    <section
      id="journey"
      ref={sectionRef}
      className="relative scroll-mt-16 py-8 sm:py-14"
    >
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        
        {/* Subtle Vertical Connector Node */}
        <div className="mx-auto mb-6 flex flex-col items-center">
          <div className="h-6 w-[1px] bg-gradient-to-b from-transparent to-ember/40" />
          <div className="size-2 rounded-full bg-ember/60 shadow-[0_0_8px_rgba(255,138,61,0.6)]" />
        </div>

        {/* Section Header */}
        <div
          className="text-center max-w-xl mx-auto transition-all duration-700"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/10 px-3 py-0.5 text-micro font-bold tracking-wider text-ember uppercase">
            <span>Alur Perjalanan Kreator</span>
          </div>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-tight">
            Dari layar kosong, jadi konten siap tayang.
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-muted">
            Lihat bagaimana Malesan menemani setiap detik proses kreatif lo.
          </p>
        </div>

        {/* 4 Step Clickable Buttons */}
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
                    ? "border-ember bg-surface-raised/90 shadow-[0_0_24px_rgba(255,138,61,0.25)] scale-[1.02]"
                    : "border-hairline/70 bg-surface/40 hover:border-ember/30 hover:bg-surface-raised/60"
                }`}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(16px)",
                  transition: `opacity 0.5s ease-out ${0.15 + idx * 0.08}s, transform 0.5s ease-out ${0.15 + idx * 0.08}s, border-color 0.2s, background-color 0.2s, box-shadow 0.2s`,
                }}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-xs font-bold text-ember">
                    {step.percent}
                  </span>
                  <span
                    className={`size-2 rounded-full transition-all duration-300 ${
                      isActive ? "bg-ember animate-pulse shadow-[0_0_8px_rgba(255,138,61,0.8)]" : "bg-muted/30"
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

        {/* Live Transformation Stage Card */}
        <div
          className="mt-5 rounded-3xl border border-hairline/80 bg-surface/50 p-5 sm:p-7 shadow-2xl backdrop-blur-xl transition-all duration-500"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
            transitionDelay: "0.35s",
          }}
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-8 items-center">
            
            {/* Left Narrative (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col items-start">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-ember uppercase">
                Tahap {activeIdx + 1} · {current.badge}
              </span>

              <h3 className="mt-2.5 font-display text-lg sm:text-xl font-bold text-ink">
                {current.title}
              </h3>
              
              <div className="mt-3 space-y-2 text-xs sm:text-sm w-full">
                <div className="rounded-xl border border-hairline/60 bg-surface-raised/40 p-3">
                  <p className="text-muted leading-relaxed">
                    {current.story}
                  </p>
                </div>
                <div className="rounded-xl border border-ember/25 bg-ember/10 p-3">
                  <p className="text-ink font-medium leading-relaxed">
                    {current.malesanRole}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Live Output Preview (7 Cols) */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-hairline/80 bg-obsidian/85 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-hairline/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-ember animate-pulse" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ember">
                      Hasil Nyata Malesan
                    </span>
                  </div>
                  <span className="rounded-md border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[9px] text-muted font-semibold">
                    {current.outputTag}
                  </span>
                </div>

                <div className="mt-3.5 space-y-2 font-mono text-xs text-ink/90">
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
