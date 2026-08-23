"use client";

type Capability = {
  title: string;
  tag: string;
  desc: string;
  metrics: string;
  icon: React.ReactNode;
  highlights: string[];
};

const CAPABILITIES: Capability[] = [
  {
    title: "AI Idea Engine",
    tag: "PENEMUAN TREN",
    desc: "Otomatis merangkum tren lokal dan topik hangat yang relevan dengan niche lo tiap hari tanpa perlu ngetik ide dari nol.",
    metrics: "3 Ide Baru / Hari",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    highlights: ["Sesuai tren Indonesia", "Langsung dapat 3 angle", "Tanpa prompt engineering"],
  },
  {
    title: "Script Studio",
    tag: "NASKAH VIDEO LENGKAP",
    desc: "Naskah video terstruktur rapi dengan timestamp detik, arahan visual kamera, teks layar, dan ritme bicara natural.",
    metrics: "45–60 Detik Siap Syuting",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    highlights: ["Arahan visual kamera", "Timestamp per segmen", "Kalimat CTA konversi"],
  },
  {
    title: "Hook Intelligence",
    tag: "PSIKOLOGI 3 DETIK",
    desc: "10 pola pembuka berbasis psikologi perhatian dengan skor kurasi objektif agar penonton berhenti scroll di detik awal.",
    metrics: "10 Pola & Skor Kurasi",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    ),
    highlights: ["Pola kontroversi & FOMO", "Skor kurasi 1–10", "Feedback kritik jujur"],
  },
  {
    title: "Multi-Platform Repurpose",
    tag: "DISTRIBUSI INSTAN",
    desc: "Satu konten matang diubah otomatis ke 5 platform berbeda dengan gaya penulisan spesifik tiap platform, bukan asal copy-paste.",
    metrics: "1 Konten → 5 Platform",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
    highlights: ["TikTok & Reels Vertikal", "Utas Threads & X", "LinkedIn & Shorts"],
  },
  {
    title: "Video Auto-CC Subtitle",
    tag: "BURNT-IN CAPTIONS",
    desc: "Ekstraksi audio cepat dengan ffmpeg.wasm dan transkripsi kata-demi-kata via Groq Whisper yang langsung dibakar ke video di browser.",
    metrics: "Sinkron Audio Per Kata",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <line x1="6" y1="12" x2="10" y2="12" />
        <line x1="14" y1="12" x2="18" y2="12" />
        <line x1="6" y1="16" x2="18" y2="16" />
      </svg>
    ),
    highlights: ["Rendering di browser", "Animasi highlight kata", "Export video MP4"],
  },
  {
    title: "Otak Kedua & Voice Persona",
    tag: "ADAPTASI GAYA KREATIF",
    desc: "Menyimpan referensi DNA konten lo — target audiens, gaya bahasa khas, dan kata pantangan, agar hasil AI selalu terasa seperti lo.",
    metrics: "100% Karakter Asli Lo",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    highlights: ["Tone of voice kustom", "Database referensi ide", "Anti kalimat klise AI"],
  },
];

export function CapabilitiesSection() {
  return (
    <section id="kemampuan" className="relative scroll-mt-20 border-t border-hairline/60 bg-obsidian py-16 sm:py-24 lg:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* Section Header */}
        <div className="max-w-2xl">
          <p className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
            Kemampuan AI Malesan
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.85rem,5vw,3rem)] font-bold leading-tight tracking-display-md text-ink">
            Bukan sekadar dashboard.
            <br />
            <span className="text-gradient-ember">Ini partner kreasi konten harian lo.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            Setiap fitur dirancang khusus untuk memangkas waktu bengong dan menghasilkan konten yang siap diproduksi dalam hitungan detik.
          </p>
        </div>

        {/* Capabilities Grid (6 Cards) */}
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <article
              key={cap.title}
              className="group flex flex-col justify-between rounded-2xl border border-hairline/80 bg-surface/45 p-6 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:shadow-[0_8px_30px_rgba(255,138,61,0.12)]"
            >
              <div>
                {/* Header Icon + Tag */}
                <div className="flex items-center justify-between">
                  <div className="grid size-10 place-items-center rounded-xl border border-ember/30 bg-ember/10 text-ember transition-transform duration-200 group-hover:scale-110">
                    {cap.icon}
                  </div>
                  <span className="font-mono text-[10px] font-bold tracking-wider text-ember uppercase">
                    {cap.tag}
                  </span>
                </div>

                {/* Title & Desc */}
                <h3 className="mt-5 font-display text-lg font-bold text-ink">
                  {cap.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted">
                  {cap.desc}
                </p>

                {/* Feature Highlights */}
                <ul className="mt-4 space-y-1.5 border-t border-hairline/60 pt-3.5 text-micro text-ink/80">
                  {cap.highlights.map((h, i) => (
                    <li key={i} className="flex items-center gap-1.5 font-medium">
                      <span className="size-1 rounded-full bg-ember" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Bottom Metric Pill */}
              <div className="mt-6 flex items-center justify-between border-t border-hairline/60 pt-3">
                <span className="font-mono text-micro font-bold text-muted">Output:</span>
                <span className="font-mono text-micro font-bold text-ember">
                  {cap.metrics}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
