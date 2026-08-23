"use client";

import { useState } from "react";

type StoryFrame = {
  id: string;
  stepNumber: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  outputPreview: {
    headline: string;
    details: string[];
    tag: string;
  };
};

const STORY_FRAMES: StoryFrame[] = [
  {
    id: "frame-1",
    stepNumber: "01",
    badge: "KENDALA AWAL",
    title: "Bengong di Depan Layar Kosong",
    subtitle: "1 jam scrolling medsos tapi tetap gak tau mau bikin apa.",
    description: "Kreator paling sering kehabisan energi bukan saat syuting, tapi saat duduk diam mikirin ide pertama.",
    outputPreview: {
      headline: "Keadaan Awal:",
      details: [
        "Kepala buntu, ide terasa berulang-ulang",
        "Waktu habis buat scrolling tanpa arah",
        "Makin males mulai karena overthinking",
      ],
      tag: "Problem #1 Kreator",
    },
  },
  {
    id: "frame-2",
    stepNumber: "02",
    badge: "AI COMPANION HADIR",
    title: "Malesan Nyambung Sama Niche Lo",
    subtitle: "Otomatis merangkum tren lokal dan gaya bicara khas lo.",
    description: "Begitu lo buka Malesan, AI langsung menyiapkan topik yang relate dengan audiens Indonesia tanpa lo perlu nulis prompt rumit.",
    outputPreview: {
      headline: "Konteks Kreator Aktif:",
      details: [
        "Niche & target audiens otomatis terbaca",
        "Data tren Indonesia 2026 langsung diolah",
        "Gaya bahasa santai & personal terjaga",
      ],
      tag: "DNA Persona Siap",
    },
  },
  {
    id: "frame-3",
    stepNumber: "03",
    badge: "PENEMUAN IDE",
    title: "3 Ide Konten Matang Lahir",
    subtitle: "Bukan kalimat mentah, tapi angle konten yang terbukti jalan.",
    description: "Malesan langsung ngasih 3 pilihan angle: edukasi tajam, kontroversial sehat, atau studi kasus praktis.",
    outputPreview: {
      headline: "Pilihan Ide Hari Ini:",
      details: [
        "Angle 1: \"Trik rahasia dapet klien remote tanpa portofolio\"",
        "Angle 2: \"Kenapa 90% kreator gagal monetisasi di tahun pertama\"",
        "Angle 3: \"Bedah workflow AI: 1 jam bikin stok konten seminggu\"",
      ],
      tag: "1 Klik Langsung Dapat",
    },
  },
  {
    id: "frame-4",
    stepNumber: "04",
    badge: "SCRIPT STUDIO",
    title: "Naskah 45 Detik Siap Syuting",
    subtitle: "Lengkap dengan timestamp, arahan visual, dan kalimat CTA.",
    description: "Tinggal baca depan kamera. Ritme percakapan natural dan terstruktur agar penonton bertahan sampai detik akhir.",
    outputPreview: {
      headline: "Struktur Naskah Video:",
      details: [
        "[00:00 - 00:04] Hook: \"Jangan upload video sebelum cek 1 settingan ini...\"",
        "[00:04 - 00:30] Daging Konten: 3 langkah teknis tanpa basa-basi",
        "[00:30 - 00:45] CTA: \"Komen 'WORKFLOW' buat dapet template-nya gratis\"",
      ],
      tag: "Siap Baca Depan Kamera",
    },
  },
  {
    id: "frame-5",
    stepNumber: "05",
    badge: "SIAP TAYANG",
    title: "Video & Subtitle Siap Upload",
    subtitle: "Auto-CC membakar subtitle per kata & format 5 platform.",
    description: "Satu konten selesai langsung diubah ke format TikTok, Reels, Shorts, Threads, dan X. Tinggal posting dan konsisten.",
    outputPreview: {
      headline: "Aset Konten Lengkap:",
      details: [
        "TikTok & Reels: Video 9:16 + Word-level Animated Captions",
        "Threads & X: Utas 5 tweet ringkas & tajam",
        "Shorts & LinkedIn: Deskripsi profesional + hashtag relevan",
      ],
      tag: "Tinggal Upload & Konsisten",
    },
  },
];

export function StorySection() {
  const [activeFrameId, setActiveFrameId] = useState<string>("frame-1");
  const currentFrame = STORY_FRAMES.find((f) => f.id === activeFrameId) || STORY_FRAMES[0];

  return (
    <section id="alur" className="relative scroll-mt-20 border-t border-hairline/60 bg-surface/20 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        
        {/* Section Header */}
        <div className="max-w-2xl">
          <p className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
            Alur Kerja Sinematik
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.85rem,5vw,2.75rem)] font-bold leading-tight tracking-display-md text-ink">
            Kreator bukan kehabisan ide.
            <br />
            <span className="text-gradient-ember">Mereka capek mulai dari nol.</span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">
            Ikuti perjalanan konten lo dari layar kosong sampai aset video siap tayang bersama Malesan.
          </p>
        </div>

        {/* 5 Sequential Story Frames Selector */}
        <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-2.5">
          {STORY_FRAMES.map((frame) => {
            const isActive = activeFrameId === frame.id;
            return (
              <button
                key={frame.id}
                onClick={() => setActiveFrameId(frame.id)}
                className={`flex flex-col items-start rounded-xl border p-3.5 sm:p-4 text-left transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "border-ember bg-surface-raised shadow-[0_0_20px_rgba(255,138,61,0.18)]"
                    : "border-hairline/60 bg-surface/40 hover:border-ember/30 hover:bg-surface"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-xs font-bold text-ember">
                    {frame.stepNumber}
                  </span>
                  <span
                    className={`size-1.5 rounded-full ${
                      isActive ? "bg-ember scale-125" : "bg-muted/30"
                    }`}
                  />
                </div>
                <p className="mt-2 font-display text-xs sm:text-sm font-bold text-ink leading-snug">
                  {frame.title}
                </p>
                <span className="mt-0.5 text-[10px] text-muted truncate w-full">
                  {frame.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Transformation Canvas */}
        <div className="mt-6 rounded-2xl border border-hairline/80 bg-obsidian p-6 sm:p-8 shadow-xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10 items-center">
            
            {/* Left Narrative Frame (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col items-start">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/10 px-3 py-0.5 font-mono text-[10px] font-bold text-ember">
                Tahap {currentFrame.stepNumber} · {currentFrame.badge}
              </div>

              <h3 className="mt-3 font-display text-xl sm:text-2xl font-bold text-ink">
                {currentFrame.title}
              </h3>
              
              <p className="mt-1 text-xs sm:text-sm text-ember-lo font-medium">
                {currentFrame.subtitle}
              </p>

              <p className="mt-3 text-xs sm:text-sm text-muted leading-relaxed">
                {currentFrame.description}
              </p>
            </div>

            {/* Right Live Artifact Card (7 Cols) */}
            <div className="lg:col-span-7">
              <div className="rounded-xl border border-hairline/80 bg-surface/80 p-5 shadow-md">
                <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-ember" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ember">
                      {currentFrame.outputPreview.headline}
                    </span>
                  </div>
                  <span className="rounded-md border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[9px] text-muted">
                    {currentFrame.outputPreview.tag}
                  </span>
                </div>

                <div className="mt-3 space-y-2 font-mono text-xs text-ink/90">
                  {currentFrame.outputPreview.details.map((detail, idx) => (
                    <div key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-ember select-none font-bold">›</span>
                      <span>{detail}</span>
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
