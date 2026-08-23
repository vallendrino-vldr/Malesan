"use client";

import { useState } from "react";

type StoryStep = {
  id: "ide" | "script" | "hook" | "ready";
  stepNumber: string;
  badge: string;
  title: string;
  problem: string;
  solution: string;
  preview: {
    title: string;
    sub: string;
    lines: string[];
    tag: string;
  };
};

const STEPS: StoryStep[] = [
  {
    id: "ide",
    stepNumber: "01",
    badge: "Mulai Tanpa Blank",
    title: "Ide Konten Harian",
    problem: "Bengong depan layar putih sambil mikir mau bikin apa hari ini.",
    solution: "Malesan ngasih 3 angle ide matang yang relevan dengan tren lokal dan niche lo tiap hari.",
    preview: {
      title: "Angle: Rahasia Freelancer Pemula Dapet Klien Pertama",
      sub: "Relevan dengan tren remote work Indonesia 2026",
      lines: [
        "Pola: Contrarian viewpoint (Bukan portofolio, tapi outreach)",
        "Target: Fresh graduate & mahasiswa yang butuh side income",
        "Estimasi Retensi: 78% di 15 detik pertama",
      ],
      tag: "1 Klik Langsung Dapat 3 Ide",
    },
  },
  {
    id: "script",
    stepNumber: "02",
    badge: "Naskah Terstruktur",
    title: "Script Studio 45 Detik",
    problem: "Bingung nulis runtutan cerita, timestamp, arahan visual, dan kalimat CTA.",
    solution: "Script lengkap yang langsung siap lo baca depan kamera dengan ritme percakapan natural.",
    preview: {
      title: "Naskah Video 45s: 3 Trik Outreach Tanpa Portofolio",
      sub: "Format TikTok / Reels / Shorts",
      lines: [
        "[00:00 - 00:05] Hook: \"Stop kirim CV kosongan kalau mau dapet kerjaan ini...\"",
        "[00:05 - 00:25] Poin Inti: Kasih solusi audit 1 halaman gratis ke klien target.",
        "[00:25 - 00:45] CTA: \"Komen 'MAU' biar gue kirimkan template DM-nya.\"",
      ],
      tag: "Lengkap Timestamp & Visual",
    },
  },
  {
    id: "hook",
    stepNumber: "03",
    badge: "Anti Skip 3 Detik",
    title: "Hook Intelligence",
    problem: "Penonton langsung skip di 3 detik pertama sebelum denger isi konten.",
    solution: "10 pola pembuka berbasis psikologi perhatian dengan skor kurasi objektif.",
    preview: {
      title: "Kurasi Hook Paling Menjebak:",
      sub: "Berdasarkan analisis 100+ pola konten viral",
      lines: [
        "1. Pola FOMO: \"Jangan upload video sebelum cek 1 settingan ini...\" (Skor 9.5)",
        "2. Pola Penasaran: \"Ternyata ini alasan kenapa video lo selalu mandek di 200 views...\" (Skor 9.2)",
        "3. Pola Kejutan: \"Gue buang 3 bulan bikin konten sia-sia cuma gara-gara ini.\" (Skor 8.9)",
      ],
      tag: "10 Pilihan Hook Berbobot",
    },
  },
  {
    id: "ready",
    stepNumber: "04",
    badge: "Siap Tayang 5 Platform",
    title: "Auto-CC & Repurpose",
    problem: "Ribet ngetik subtitle satu-satu dan nulis ulang caption buat tiap platform.",
    solution: "Subtitle otomatis terbakar ke video client-side dan format otomatis diubah ke 5 platform.",
    preview: {
      title: "Distribusi Konten Siap Upload:",
      sub: "1 Kali Bikin → Langsung Tayang ke Semua Platform",
      lines: [
        "TikTok & Reels: Video vertikal 9:16 + Word-level Animated Captions",
        "Threads & X: Utas 5 postingan dengan ringkasan poin inti",
        "Shorts & LinkedIn: Deskripsi profesional + hashtag relevan",
      ],
      tag: "Ekspor Video & Multi-Platform",
    },
  },
];

export function StorySection() {
  const [activeStep, setActiveStep] = useState<StoryStep["id"]>("ide");
  const current = STEPS.find((s) => s.id === activeStep) || STEPS[0];

  return (
    <section id="alur" className="relative scroll-mt-20 border-t border-hairline/60 bg-surface/20 py-16 sm:py-24 lg:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* Section Header */}
        <div className="max-w-2xl">
          <p className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
            Transformasi Kreator
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.85rem,5vw,3rem)] font-bold leading-tight tracking-display-md text-ink">
            Kreator bukan kehabisan ide.
            <br />
            <span className="text-gradient-ember">Mereka capek mulai dari nol.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            Dari satu ide mentah di kepala sampai naskah dan video dengan subtitle
            yang siap di-upload ke 5 platform media sosial.
          </p>
        </div>

        {/* Transformation Pipeline Tabs */}
        <div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {STEPS.map((step) => {
            const isActive = activeStep === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={`group flex flex-col items-start rounded-2xl border p-4 sm:p-5 text-left transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "border-ember bg-surface-raised shadow-[0_0_24px_rgba(255,138,61,0.2)]"
                    : "border-hairline/70 bg-surface/50 hover:border-ember/30 hover:bg-surface"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-xs font-bold text-ember">
                    {step.stepNumber}
                  </span>
                  <span
                    className={`size-2 rounded-full transition-all ${
                      isActive ? "bg-ember scale-125" : "bg-muted/40 group-hover:bg-ember/50"
                    }`}
                  />
                </div>
                <h3 className="mt-3 font-display text-sm sm:text-base font-bold text-ink">
                  {step.title}
                </h3>
                <span className="mt-1 text-micro text-muted">
                  {step.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Transformation Showcase Card */}
        <div className="mt-8 rounded-3xl border border-hairline/80 bg-obsidian p-6 sm:p-10 shadow-2xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 items-center">
            {/* Left Narrative Description (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col items-start">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/10 px-3 py-1 font-mono text-[11px] font-bold text-ember">
                Tahap {current.stepNumber} · {current.badge}
              </span>

              <h4 className="mt-4 font-display text-xl sm:text-2xl font-bold text-ink">
                {current.title}
              </h4>

              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3.5">
                  <p className="font-mono text-[10px] font-bold tracking-wider text-red-400 uppercase">
                    Kendala Biasa:
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-ink/80 leading-relaxed">
                    {current.problem}
                  </p>
                </div>

                <div className="rounded-xl border border-ember/25 bg-ember/5 p-3.5">
                  <p className="font-mono text-[10px] font-bold tracking-wider text-ember uppercase">
                    Solusi Malesan:
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-ink/90 leading-relaxed font-medium">
                    {current.solution}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Live Artifact Output Preview (7 Cols) */}
            <div className="lg:col-span-7">
              <div className="relative rounded-2xl border border-hairline/90 bg-surface/90 p-5 sm:p-7 shadow-lg backdrop-blur-md">
                {/* Card Top Ribbon */}
                <div className="flex items-center justify-between border-b border-hairline/60 pb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-ember" />
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-ember">
                      Hasil Nyata AI Companion
                    </span>
                  </div>
                  <span className="rounded-md border border-hairline bg-surface-raised px-2 py-0.5 font-mono text-[10px] text-muted">
                    {current.preview.tag}
                  </span>
                </div>

                {/* Card Content */}
                <div className="mt-4">
                  <p className="font-display text-base sm:text-lg font-bold text-ink">
                    {current.preview.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {current.preview.sub}
                  </p>

                  <div className="mt-4 space-y-2.5 rounded-xl border border-hairline/60 bg-obsidian/70 p-4 font-mono text-xs text-ink/90">
                    {current.preview.lines.map((line, idx) => (
                      <div key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-ember select-none">›</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
