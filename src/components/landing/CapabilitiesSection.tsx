"use client";

type CapabilityStory = {
  moment: string;
  problem: string;
  action: string;
  result: string;
  icon: React.ReactNode;
};

const CAPABILITY_STORIES: CapabilityStory[] = [
  {
    moment: "Ketika lo kehabisan ide",
    problem: "Layar kosong, tren di kepala udah basi, bingung mau ngomongin apa.",
    action: "Malesan menarik tren lokal Indonesia hari ini dan mencocokkannya dengan niche lo.",
    result: "3 angle ide konten matang langsung siap dieksekusi tanpa mikir dari nol.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    moment: "Ketika bingung nulis naskah",
    problem: "Punya poin mentah tapi berantakan, durasi kepanjangan, dan alurnya gak jelas.",
    action: "Script Studio menyusun naskah 45 detik dengan ritme percakapan natural.",
    result: "Naskah lengkap dengan arahan visual kamera, teks layar, dan timestamp.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    moment: "Ketika video lo sering di-skip",
    problem: "Penonton langsung scroll pergi di 3 detik pertama sebelum denger isi konten.",
    action: "Hook Intelligence meramu 10 variasi pembuka berbasis psikologi perhatian.",
    result: "10 pilihan hook anti-skip lengkap dengan skor kurasi dan kritik objektif.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    ),
  },
  {
    moment: "Ketika males ngetik subtitle",
    problem: "Harus ngetik manual per kata atau bayar aplikasi video editing tambahan.",
    action: "Auto-CC mengekstrak audio via ffmpeg.wasm & mentranskripsi dengan Groq Whisper.",
    result: "Word-level animated captions terbakar langsung ke video di browser lo.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <line x1="6" y1="12" x2="10" y2="12" />
        <line x1="14" y1="12" x2="18" y2="12" />
      </svg>
    ),
  },
  {
    moment: "Ketika gak sempat bikin konten tiap platform",
    problem: "Satu platform aja capek, gimana mau aktif di TikTok, Reels, Shorts, dan Threads.",
    action: "Repurpose Engine menulis ulang konten ke gaya penulisan spesifik tiap platform.",
    result: "1 materi langsung berubah jadi video vertikal, utas Threads, tweet X, dan Shorts.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    moment: "Ketika hasil AI terasa generik dan kaku",
    problem: "Tulisan AI biasa kebaca kaku, sok pintar, dan gak mencerminkan karakter asli lo.",
    action: "Otak Kedua & Voice Persona mengingat preferensi, gaya ngomong, dan kata pantangan lo.",
    result: "Hasil tulisan terasa 100% natural seperti lo sendiri yang nulis santai.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      </svg>
    ),
  },
];

export function CapabilitiesSection() {
  return (
    <section id="kemampuan" className="relative scroll-mt-20 border-t border-hairline/60 bg-obsidian py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        
        {/* Section Header */}
        <div className="max-w-2xl">
          <p className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
            Kemampuan AI Companion
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.85rem,5vw,2.75rem)] font-bold leading-tight tracking-display-md text-ink">
            Bukan sekadar fitur.
            <br />
            <span className="text-gradient-ember">Ini solusi di setiap momen kebuntuan lo.</span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">
            Malesan bekerja di saat-saat paling melelahkan dalam proses kreatif lo.
          </p>
        </div>

        {/* 6 Problem-Action-Result Cards */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_STORIES.map((cap, idx) => (
            <article
              key={idx}
              className="flex flex-col justify-between rounded-2xl border border-hairline/70 bg-surface/40 p-5 sm:p-6 shadow-xs backdrop-blur-md transition-all duration-200 hover:border-ember/35 hover:bg-surface-raised"
            >
              <div>
                {/* Header Icon + Moment Title */}
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-xl border border-ember/30 bg-ember/10 text-ember shrink-0">
                    {cap.icon}
                  </div>
                  <h3 className="font-display text-base font-bold text-ink leading-snug">
                    {cap.moment}
                  </h3>
                </div>

                {/* Problem */}
                <div className="mt-4 rounded-xl border border-hairline/60 bg-obsidian/60 p-3">
                  <p className="font-mono text-[9px] font-bold text-muted uppercase tracking-wider">
                    Masalah Kreator:
                  </p>
                  <p className="mt-0.5 text-xs text-muted/90 leading-relaxed">
                    {cap.problem}
                  </p>
                </div>

                {/* AI Action */}
                <div className="mt-2.5 rounded-xl border border-ember/20 bg-ember/5 p-3">
                  <p className="font-mono text-[9px] font-bold text-ember uppercase tracking-wider">
                    Aksi Malesan:
                  </p>
                  <p className="mt-0.5 text-xs text-ink/90 font-medium leading-relaxed">
                    {cap.action}
                  </p>
                </div>
              </div>

              {/* Result Footer */}
              <div className="mt-4 border-t border-hairline/60 pt-3">
                <p className="font-mono text-[9px] font-bold text-muted uppercase tracking-wider">
                  Hasil Siap Pakai:
                </p>
                <p className="mt-0.5 text-xs font-semibold text-ember-lo leading-snug">
                  {cap.result}
                </p>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}
