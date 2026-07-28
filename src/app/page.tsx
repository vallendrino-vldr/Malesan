import { Reveal } from "@/components/Reveal";

const MODULES = [
  {
    name: "Ide Hari Ini",
    cost: 1,
    body: "Buka aplikasi, gak usah ngetik apa-apa. Langsung dapet 3 ide yang nyambung sama niche lo dan tren hari ini.",
    tag: "Tanpa input",
  },
  {
    name: "Idea Engine",
    cost: 1,
    body: "Punya ide mentah yang masih setengah jadi? Lempar aja. Balik jadi 5 ide yang udah mateng dan siap difilmin.",
    tag: "Mentah → mateng",
  },
  {
    name: "Hook Lab",
    cost: 2,
    body: "10 hook, 10 pola beda, tiap satu dikasih skor jujur. Yang lemah dibilang lemah — bukan dikasih 9 semua.",
    tag: "10 pola",
  },
  {
    name: "Script Builder",
    cost: 4,
    body: "Naskah lengkap sama timestamp, arahan visual, teks layar, CTA, caption, dan hashtag. Ritmenya nyesuain platform.",
    tag: "Siap syuting",
  },
  {
    name: "Repurpose",
    cost: 1,
    body: "Satu konten, sekali proses, jadi versi TikTok, Reels, Shorts, X, dan Threads. Ditulis ulang, bukan cuma disalin.",
    tag: "5 platform",
  },
] as const;

const DIFFERENTIATORS = [
  {
    title: "Kenal gaya lo",
    body: "Creator DNA nyimpen niche, audience, tone, sama kata yang lo pantang pakai. Tiap output lewat filter itu dulu.",
  },
  {
    title: "Tau hari ini",
    body: "Tren Indonesia ditarik dan dirangkum tiap hari. Ide yang keluar nyambung sama yang lagi rame, bukan yang rame tahun lalu.",
  },
  {
    title: "Belajar dari hasil lo",
    body: "Habis posting, kasih rating. Lama-lama Malesan tau format mana yang beneran jalan buat akun lo — bukan nebak.",
  },
];

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-x-hidden bg-obsidian">
      {/* Ambient heat. Non-interactive, sits behind everything. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,138,61,0.16),transparent_70%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-6 sm:px-8">
        <span className="font-display text-lg font-extrabold tracking-display-sm text-ink">
          malesan
        </span>
        <span className="rounded-full border border-hairline bg-surface px-3 py-1 font-mono text-[11px] text-muted">
          lagi dibangun
        </span>
      </header>

      <main className="relative z-10 flex-1">
        {/* ---------------- hero ---------------- */}
        <section className="mx-auto w-full max-w-6xl px-5 pt-10 pb-20 sm:px-8 sm:pt-20 sm:pb-28">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ember">
              Buat kreator konten Indonesia
            </p>
          </Reveal>

          <Reveal index={1}>
            <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.25rem,8.5vw,5rem)] font-extrabold leading-[0.98] tracking-display-lg text-ink">
              Males mikirnya.
              <br />
              <span className="text-gradient-ember">Bukan bikinnya.</span>
            </h1>
          </Reveal>

          <Reveal index={2}>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Lo tetap yang syuting, ngedit, dan tampil. Malesan cuma ngebunuh
              satu bagian yang paling bikin mandek — bengong depan layar kosong
              sambil mikir hari ini mau bikin apa.
            </p>
          </Reveal>

          <Reveal index={3}>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#modul"
                className="glow-ember inline-flex items-center justify-center rounded-xl bg-ember px-6 py-3.5 font-display text-[15px] font-bold text-obsidian transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo"
              >
                Males mikir. Kasih ide.
              </a>
              <a
                href="#beda"
                className="inline-flex items-center justify-center rounded-xl border border-hairline bg-surface px-6 py-3.5 font-display text-[15px] font-semibold text-ink transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-surface-raised"
              >
                Emang beda sama ChatGPT?
              </a>
            </div>
          </Reveal>

          <Reveal index={4}>
            <p className="mt-6 font-mono text-xs leading-relaxed text-muted">
              10 credit gratis tiap hari · login pakai Google · gak ada
              email-password
            </p>
          </Reveal>
        </section>

        {/* ---------------- modules ---------------- */}
        <section
          id="modul"
          className="scroll-mt-20 border-t border-hairline bg-obsidian"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <Reveal>
              <h2 className="max-w-2xl font-display text-[clamp(1.75rem,4.5vw,2.75rem)] font-bold leading-tight tracking-display-md text-ink">
                Lima alat. Satu alur.
              </h2>
              <p className="mt-4 max-w-lg text-muted">
                Dari gak punya ide sama sekali, sampai naskah yang tinggal
                dibaca depan kamera.
              </p>
            </Reveal>

            <ul className="mt-12 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m, i) => (
                <li key={m.name} className="h-full">
                  <Reveal index={i} className="h-full">
                    <article className="group flex h-full flex-col rounded-2xl border border-hairline bg-surface p-6 transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-surface-raised">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg font-bold tracking-display-sm text-ink">
                          {m.name}
                        </h3>
                        <span className="tabular shrink-0 rounded-md border border-hairline px-2 py-1 font-mono text-[11px] text-muted">
                          {m.cost} credit
                        </span>
                      </div>
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
                        {m.body}
                      </p>
                      <span className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ember-deep transition-colors duration-[var(--duration-standard)] ease-heat group-hover:text-ember">
                        {m.tag}
                      </span>
                    </article>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------- differentiator ---------------- */}
        <section
          id="beda"
          className="scroll-mt-20 border-t border-hairline bg-surface/40"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <Reveal>
              <h2 className="max-w-2xl font-display text-[clamp(1.75rem,4.5vw,2.75rem)] font-bold leading-tight tracking-display-md text-ink">
                Bedanya sama nge-prompt sendiri
              </h2>
              <p className="mt-4 max-w-xl text-muted">
                ChatGPT gak tau lo siapa, gak tau hari ini lagi rame apa di
                Indonesia, dan gak tau konten lo yang mana yang kemarin jalan.
                Tiap chat mulai dari nol lagi.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-3">
              {DIFFERENTIATORS.map((d, i) => (
                <Reveal key={d.title} index={i} className="h-full">
                  <div className="h-full bg-obsidian p-6 sm:p-7">
                    <span className="tabular font-mono text-xs text-ember">
                      0{i + 1}
                    </span>
                    <h3 className="mt-4 font-display text-lg font-bold tracking-display-sm text-ink">
                      {d.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted">
                      {d.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal index={3}>
              <p className="mt-10 max-w-xl border-l-2 border-ember-deep pl-5 text-sm leading-relaxed text-muted">
                Malesan bukan buat orang yang males bikin konten bagus. Ini buat
                orang yang capek di bagian mikirnya doang.
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-hairline">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-display text-sm font-bold tracking-display-sm text-ink">
            malesan
          </span>
          <span className="font-mono text-xs text-muted">
            Belum dibuka buat umum. Lagi dibangun.
          </span>
        </div>
      </footer>
    </div>
  );
}
