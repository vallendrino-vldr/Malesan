"use client";

import { useState } from "react";

type MagicStep = {
  id: "ide" | "script" | "siap";
  number: string;
  label: string;
  title: string;
  desc: string;
  previewTitle: string;
  previewLines: string[];
};

const MAGIC_STEPS: MagicStep[] = [
  {
    id: "ide",
    number: "01",
    label: "Menemukan Ide",
    title: "Otomatis merangkum tren lokal dan niche lo",
    desc: "Gak perlu ngetik prompt panjang. Malesan langsung menyiapkan 3 sudut pandang konten yang relate dengan audiens Indonesia.",
    previewTitle: "3 Ide Konten Hari Ini",
    previewLines: [
      "Angle 1: \"Trik rahasia dapet klien pertama tanpa portofolio\"",
      "Angle 2: \"Kenapa 90% kreator gagal konsisten di bulan ke-3\"",
      "Angle 3: \"Workflow AI: 1 jam bikin stok naskah seminggu\"",
    ],
  },
  {
    id: "script",
    number: "02",
    label: "Menulis Script",
    title: "Naskah 45 detik lengkap dengan arahan visual",
    desc: "Tinggal baca depan kamera. Sudah termasuk timestamp detik, teks layar, dan kalimat call-to-action yang terstruktur.",
    previewTitle: "Naskah Video Siap Syuting (45s)",
    previewLines: [
      "[00:00 - 00:04] Hook: \"Jangan upload video sebelum cek 1 trik ini...\"",
      "[00:04 - 00:30] Daging: 3 langkah teknis tanpa basa-basi",
      "[00:30 - 00:45] CTA: \"Komen 'WORKFLOW' buat dapet template-nya\"",
    ],
  },
  {
    id: "siap",
    number: "03",
    label: "Konten Siap Dibuat",
    title: "Subtitle otomatis dan format 5 platform",
    desc: "Auto-CC membakar subtitle per kata langsung di browser, dan formatnya otomatis diubah ke TikTok, Reels, Shorts, dan Threads.",
    previewTitle: "Distribusi Multi-Platform",
    previewLines: [
      "TikTok & Reels: Video 9:16 + Word-level Captions",
      "Threads & X: Utas 5 postingan ringkas",
      "Shorts & LinkedIn: Deskripsi profesional + hashtag",
    ],
  },
];

export function ProductMagic() {
  const [activeTab, setActiveTab] = useState<MagicStep["id"]>("ide");
  const current = MAGIC_STEPS.find((s) => s.id === activeTab) || MAGIC_STEPS[0];

  return (
    <section id="magic" className="relative scroll-mt-16 border-t border-hairline/60 bg-surface/15 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto">
          <p className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
            Alur Kerja Malesan
          </p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-tight">
            Dari layar kosong, jadi konten yang siap diproduksi.
          </h2>
        </div>

        {/* 3 Simple Sequential Step Buttons */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full border border-hairline/80 bg-surface/60 p-1 backdrop-blur-md">
            {MAGIC_STEPS.map((step) => {
              const isActive = activeTab === step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveTab(step.id)}
                  className={`flex items-center gap-1.5 rounded-full px-4 sm:px-5 py-2 font-display text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-ember text-obsidian shadow-xs"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-75">{step.number}</span>
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Transformation Card */}
        <div className="mt-8 rounded-2xl border border-hairline/80 bg-obsidian p-6 sm:p-8 shadow-xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8 items-center">
            
            {/* Left Explanation (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col items-start">
              <span className="font-mono text-[10px] font-bold text-ember uppercase tracking-wider">
                Langkah {current.number}
              </span>
              <h3 className="mt-1.5 font-display text-lg sm:text-xl font-bold text-ink">
                {current.title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                {current.desc}
              </p>
            </div>

            {/* Right Output Artifact (7 Cols) */}
            <div className="lg:col-span-7">
              <div className="rounded-xl border border-hairline/70 bg-surface/80 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-hairline/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-ember animate-pulse" />
                    <span className="font-display text-xs font-bold text-ink">
                      {current.previewTitle}
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-muted">Malesan Output</span>
                </div>

                <div className="mt-3 space-y-1.5 font-mono text-xs text-ink/90">
                  {current.previewLines.map((line, idx) => (
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
