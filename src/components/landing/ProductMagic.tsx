"use client";

import { useState } from "react";

type TimelineStage = {
  id: string;
  stepNum: string;
  badge: string;
  title: string;
  situation: string;
  malesanAction: string;
  resultTag: string;
  resultLines: string[];
};

const TIMELINE_STAGES: TimelineStage[] = [
  {
    id: "stage-1",
    stepNum: "01",
    badge: "LAYAR KOSONG",
    title: "Bengong di Depan Layar",
    situation: "Punya niat bikin konten tapi buntu gak tau mau mulai dari topik apa.",
    malesanAction: "Begitu lo buka Malesan, lo gak perlu ngetik prompt rumit.",
    resultTag: "Titik Mulai",
    resultLines: [
      "Bukan mulai dari nol",
      "Langsung klik 1 tombol",
      "Otomatis terhubung ke niche lo",
    ],
  },
  {
    id: "stage-2",
    stepNum: "02",
    badge: "MALESAN BERPIKIR",
    title: "AI Membaca Tren & Audiens",
    situation: "Mencari topik yang sedang hangat di Indonesia dan relevan buat audiens lo.",
    malesanAction: "Menyaring ribuan data tren lokal menjadi konteks konten yang tajam.",
    resultTag: "Proses Cerdas",
    resultLines: [
      "Filter tren lokal Indonesia 2026",
      "Cocokkan dengan target penonton lo",
      "Gaya bahasa santai disiapkan",
    ],
  },
  {
    id: "stage-3",
    stepNum: "03",
    badge: "IDE MUNCUL",
    title: "3 Sudut Pandang Konten Matang",
    situation: "Tersedia 3 pilihan angle: edukatif, kontroversial sehat, atau studi kasus.",
    malesanAction: "Tinggal pilih salah satu yang paling cocok dengan mood kreasi lo hari ini.",
    resultTag: "3 Pilihan Angle",
    resultLines: [
      "Angle 1: Trik dapet klien remote tanpa portofolio",
      "Angle 2: Kenapa 90% kreator pemula gagal di bulan ke-3",
      "Angle 3: Bedah workflow 1 jam bikin stok seminggu",
    ],
  },
  {
    id: "stage-4",
    stepNum: "04",
    badge: "SCRIPT TERBENTUK",
    title: "Naskah 45 Detik Siap Syuting",
    situation: "Struktur naskah rapi dengan arahan visual kamera dan ritme bicara natural.",
    malesanAction: "Lengkap dengan timestamp detik dan kalimat call-to-action yang memikat.",
    resultTag: "Siap Syuting",
    resultLines: [
      "[00:00 - 00:04] Hook: Stop kirim CV kosongan...",
      "[00:04 - 00:30] Daging: 3 langkah audit 1 halaman gratis",
      "[00:30 - 00:45] CTA: Komen 'TEMPLATE' biar gue kirimkan",
    ],
  },
  {
    id: "stage-5",
    stepNum: "05",
    badge: "KONTEN SIAP TAYANG",
    title: "Subtitle Terbakar & Multi-Format",
    situation: "Auto-CC menyinkronkan subtitle kata per kata langsung di browser.",
    malesanAction: "Satu konten selesai langsung diubah ke format TikTok, Reels, Shorts, dan Threads.",
    resultTag: "Siap Upload",
    resultLines: [
      "TikTok & Reels: Video 9:16 + Burnt-in Captions",
      "Threads & X: Utas 5 postingan ringkas",
      "Shorts & LinkedIn: Deskripsi profesional",
    ],
  },
];

export function ProductMagic() {
  const [activeId, setActiveId] = useState<string>("stage-3");
  const current = TIMELINE_STAGES.find((s) => s.id === activeId) || TIMELINE_STAGES[2];

  return (
    <section id="magic" className="relative scroll-mt-16 border-t border-hairline/60 bg-surface/15 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto">
          <p className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
            Transformasi Alur Kerja
          </p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-tight">
            Dari layar kosong, jadi konten siap tayang.
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-muted">
            Klik tiap tahapan untuk melihat bagaimana Malesan nemenin proses kreatif lo.
          </p>
        </div>

        {/* 5-Step Timeline Selector */}
        <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-2.5">
          {TIMELINE_STAGES.map((stage) => {
            const isActive = activeId === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveId(stage.id)}
                className={`flex flex-col items-start rounded-xl border p-3 sm:p-3.5 text-left transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "border-ember bg-surface-raised shadow-[0_0_18px_rgba(255,138,61,0.18)] scale-[1.02]"
                    : "border-hairline/60 bg-surface/40 hover:border-ember/30 hover:bg-surface"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-ember">
                    {stage.stepNum}
                  </span>
                  <span
                    className={`size-1.5 rounded-full ${
                      isActive ? "bg-ember scale-125" : "bg-muted/30"
                    }`}
                  />
                </div>
                <p className="mt-1.5 font-display text-xs sm:text-sm font-bold text-ink leading-snug">
                  {stage.title}
                </p>
                <span className="mt-0.5 text-[9px] text-muted truncate w-full">
                  {stage.badge}
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
                Tahap {current.stepNum} · {current.badge}
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
