"use client";

import Link from "next/link";

type ComparisonRow = {
  aspect: string;
  generic: string;
  malesan: string;
};

const ROWS: ComparisonRow[] = [
  {
    aspect: "Konteks & Tren Konten",
    generic: "Generik, kaku, dan seringkali mengacu pada tren luar negeri yang tidak relate di Indonesia.",
    malesan: "Paham tren lokal Indonesia dan gaya bahasa santai yang terbukti disukai audiens lokal.",
  },
  {
    aspect: "Konsistensi Gaya Bahasa",
    generic: "Harus mengetik ulang prompt panjang dan contoh gaya bicara setiap kali buka chat baru.",
    malesan: "Otomatis mengingat DNA kreator, niche, target audiens, dan pantangan kata lo.",
  },
  {
    aspect: "Kesiapan Naskah Syuting",
    generic: "Teks narasi panjang membosankan tanpa arahan visual, timestamp, atau struktur hook.",
    malesan: "Script 45 detik terstruktur: timestamp, teks layar, arahan kamera, dan kalimat CTA.",
  },
  {
    aspect: "Distribusi Multi-Platform",
    generic: "Harus minta convert satu per satu dan hasilnya seringkali cuma copy-paste biasa.",
    malesan: "1 klik otomatis berubah jadi format TikTok/Reels, utas Threads/X, dan Shorts.",
  },
  {
    aspect: "Subtitle & Video Captions",
    generic: "Tidak bisa burn subtitle, harus pindah ke aplikasi video editor terpisah.",
    malesan: "Auto-CC otomatis membakar subtitle per kata langsung di browser via Groq Whisper.",
  },
];

export function ComparisonSection() {
  return (
    <section id="beda" className="relative scroll-mt-20 border-t border-hairline/60 bg-surface/15 py-16 sm:py-24 lg:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto">
          <p className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
            Kenapa Beda Dari AI Biasa
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.85rem,5vw,3rem)] font-bold leading-tight tracking-display-md text-ink">
            Bukan sekadar bot teks biasa.
            <br />
            <span className="text-gradient-ember">Ini sistem kerja khusus kreator.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            Malesan dibangun dari alur kerja kreator nyata, bukan sekadar wrapper prompt generic.
          </p>
        </div>

        {/* Comparison Table / Cards */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-hairline/80 bg-obsidian shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-hairline/60">
            {/* Left Column Header (Desktop) */}
            <div className="hidden md:block md:col-span-4 p-6 bg-surface/30">
              <span className="font-mono text-xs font-bold text-muted uppercase tracking-wider">
                Aspek Pembuatan
              </span>
            </div>
            {/* Center Column Header (Generic AI) */}
            <div className="hidden md:block md:col-span-4 p-6 bg-surface/10">
              <span className="font-mono text-xs font-bold text-muted/80 uppercase tracking-wider">
                AI / Chatbot Generic
              </span>
            </div>
            {/* Right Column Header (Malesan) */}
            <div className="hidden md:block md:col-span-4 p-6 bg-ember/10 border-b border-ember/20">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-ember animate-pulse" />
                <span className="font-mono text-xs font-bold text-ember uppercase tracking-wider">
                  Malesan AI Companion
                </span>
              </div>
            </div>
          </div>

          {/* Rows */}
          {ROWS.map((row, idx) => (
            <div
              key={idx}
              className={`grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-hairline/50 border-t border-hairline/60 transition-colors hover:bg-surface/20 ${
                idx % 2 === 0 ? "bg-transparent" : "bg-surface/10"
              }`}
            >
              {/* Aspect */}
              <div className="md:col-span-4 p-5 sm:p-6 flex items-center">
                <span className="font-display text-sm sm:text-base font-bold text-ink">
                  {row.aspect}
                </span>
              </div>

              {/* Generic AI */}
              <div className="md:col-span-4 p-5 sm:p-6 flex flex-col justify-center">
                <span className="md:hidden font-mono text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                  AI Biasa:
                </span>
                <p className="text-xs sm:text-sm text-muted leading-relaxed">
                  {row.generic}
                </p>
              </div>

              {/* Malesan */}
              <div className="md:col-span-4 p-5 sm:p-6 bg-ember/5 flex flex-col justify-center">
                <span className="md:hidden font-mono text-[10px] font-bold text-ember uppercase tracking-wider mb-1">
                  Malesan:
                </span>
                <p className="text-xs sm:text-sm text-ink font-medium leading-relaxed">
                  {row.malesan}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Final Pre-Footer Hero CTA Banner */}
        <div className="mt-16 sm:mt-24 rounded-3xl border border-ember/30 bg-gradient-to-b from-surface-raised/80 via-surface/60 to-obsidian p-8 sm:p-14 text-center shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-72 rounded-full bg-ember/20 blur-3xl" />

          <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/15 px-3 py-1 font-mono text-[11px] font-bold text-ember">
              Mulai Dalam 30 Detik
            </span>

            <h3 className="mt-4 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-tight">
              Siap bikin konten tanpa bengong di depan layar?
            </h3>

            <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">
              Dapatkan 10 kredit gratis setiap hari. Masuk langsung dengan akun Google tanpa perlu kartu kredit atau konfigurasi rumit.
            </p>

            <Link
              href="/masuk"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-ember px-8 py-4 font-display text-base font-bold text-obsidian shadow-sm transition-all duration-200 hover:bg-ember-lo hover:shadow-[0_4px_20px_rgba(255,138,61,0.25)] hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>Mulai bikin konten gratis</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
