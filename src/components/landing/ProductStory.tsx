"use client";

import { useState } from "react";

type StoryChapter = {
  id: string;
  chapterNum: string;
  badge: string;
  title: string;
  situation: string;
  malesanAction: string;
  resultTag: string;
  resultLines: string[];
};

const CHAPTERS: StoryChapter[] = [
  {
    id: "bab-1",
    chapterNum: "BAB 01",
    badge: "KONDISI AWAL",
    title: "Layar kosong lagi?",
    situation: "Punya niat bikin konten tapi udah 1 jam bengong depan layar kosong gak tau mau mulai dari mana.",
    malesanAction: "Lo gak perlu ngetik prompt rumit. Cukup buka Malesan dan sebut topik atau niche lo.",
    resultTag: "Titik Mulai",
    resultLines: [
      "Bukan mulai dari nol",
      "Langsung klik 1 tombol",
      "Otomatis membaca niche & audiens lo",
    ],
  },
  {
    id: "bab-2",
    chapterNum: "BAB 02",
    badge: "PROSES AI",
    title: "Malesan lagi cari angle...",
    situation: "Menyaring ribuan tren lokal Indonesia hari ini yang terbukti menarik buat penonton.",
    malesanAction: "Malesan meracik 3 sudut pandang matang: edukatif, kontroversial sehat, atau studi kasus.",
    resultTag: "3 Pilihan Angle",
    resultLines: [
      "Angle 1: Trik dapet klien remote tanpa portofolio",
      "Angle 2: Kenapa 90% kreator pemula gagal di bulan ke-3",
      "Angle 3: Bedah workflow 1 jam bikin stok seminggu",
    ],
  },
  {
    id: "bab-3",
    chapterNum: "BAB 03",
    badge: "HASIL SIAP",
    title: "Udah. Tinggal rekam.",
    situation: "Naskah 45 detik langsung jadi lengkap dengan arahan kamera, teks layar, dan subtitle otomatis.",
    malesanAction: "Lo tinggal baca depan kamera. Auto-CC membakar subtitle per kata langsung di browser.",
    resultTag: "Siap Upload",
    resultLines: [
      "[00:00] Hook: Stop kirim CV kosongan...",
      "TikTok & Reels: Video 9:16 + Burnt-in Captions",
      "Threads & X: Utas 5 tweet ringkas siap posting",
    ],
  },
];

export function ProductStory() {
  const [activeChapterId, setActiveChapterId] = useState<string>("bab-2");
  const current = CHAPTERS.find((c) => c.id === activeChapterId) || CHAPTERS[1];

  return (
    <section id="perjalanan" className="relative scroll-mt-16 border-t border-hairline/60 bg-surface/15 py-12 sm:py-18">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto">
          <p className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
            3 Bab Perjalanan Konten
          </p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-tight">
            Dari bengong sampai video siap upload.
          </h2>
        </div>

        {/* 3 Chapters Selector */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {CHAPTERS.map((ch) => {
            const isActive = activeChapterId === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChapterId(ch.id)}
                className={`flex flex-col items-start rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "border-ember bg-surface-raised shadow-[0_0_20px_rgba(255,138,61,0.2)] scale-[1.01]"
                    : "border-hairline/60 bg-surface/40 hover:border-ember/30 hover:bg-surface"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-ember">
                    {ch.chapterNum}
                  </span>
                  <span
                    className={`size-1.5 rounded-full ${
                      isActive ? "bg-ember scale-125" : "bg-muted/30"
                    }`}
                  />
                </div>
                <p className="mt-2 font-display text-sm font-bold text-ink leading-snug">
                  {ch.title}
                </p>
                <span className="mt-0.5 text-[10px] text-muted">
                  {ch.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Transformation Canvas */}
        <div className="mt-6 rounded-2xl border border-hairline/80 bg-obsidian p-5 sm:p-7 shadow-xl">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-8 items-center">
            
            {/* Left Narrative (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col items-start">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-ember">
                {current.chapterNum} · {current.badge}
              </span>

              <h3 className="mt-2.5 font-display text-lg sm:text-xl font-bold text-ink">
                {current.title}
              </h3>
              
              <div className="mt-3 space-y-2 text-xs sm:text-sm">
                <div className="rounded-lg border border-hairline/60 bg-surface/40 p-2.5">
                  <p className="text-muted leading-relaxed">
                    {current.situation}
                  </p>
                </div>
                <div className="rounded-lg border border-ember/20 bg-ember/5 p-2.5">
                  <p className="text-ink font-medium leading-relaxed">
                    {current.malesanAction}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Live Artifact Output Preview (7 Cols) */}
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
                    {current.resultTag}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 font-mono text-xs text-ink/90">
                  {current.resultLines.map((line, idx) => (
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
