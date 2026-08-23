"use client";

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  avatarBg: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "Gue biasanya habis waktu berjam-jam cuma mikirin ide. Sekarang tinggal pilih angle yang paling cocok.",
    name: "Raka",
    role: "Content Creator",
    avatarBg: "bg-ember/15 text-ember",
  },
  {
    quote: "Gue paling suka bagian hook. Masalah bingung opening 3 detik sekarang beres dalam hitungan detik.",
    name: "Dinda",
    role: "Owner UMKM Fashion",
    avatarBg: "bg-amber-500/15 text-amber-400",
  },
  {
    quote: "Naskah 45 detiknya udah lengkap sama timestamp & arahan visual. Syuting jadi jauh lebih cepet.",
    name: "Kevin",
    role: "Tech & Gadget Reviewer",
    avatarBg: "bg-emerald-500/15 text-emerald-400",
  },
];

export function CreatorTestimonials() {
  return (
    <section className="relative border-t border-hairline/60 bg-surface/10 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        
        <div className="text-center max-w-md mx-auto mb-8">
          <p className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
            Kata Mereka
          </p>
          <h2 className="mt-1.5 font-display text-xl sm:text-2xl font-bold text-ink">
            Kreator yang udah ga pusing mikir ide
          </h2>
        </div>

        {/* 3 Compact Creator Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {TESTIMONIALS.map((t, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-2xl border border-hairline/70 bg-surface/40 p-5 shadow-xs backdrop-blur-sm transition-all duration-200 hover:border-ember/30 hover:bg-surface-raised"
            >
              <p className="text-xs sm:text-sm text-ink/90 leading-relaxed font-normal">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="mt-4 flex items-center gap-2.5 border-t border-hairline/50 pt-3">
                <div className={`grid size-7 place-items-center rounded-full font-display text-xs font-bold ${t.avatarBg}`}>
                  {t.name[0]}
                </div>
                <div>
                  <p className="font-display text-xs font-bold text-ink">
                    {t.name}
                  </p>
                  <p className="font-mono text-[10px] text-muted">
                    {t.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
