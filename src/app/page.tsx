import Link from "next/link";
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

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-8 sm:py-6">
        {/* The wordmark carries the brand on every screen, so it gets an actual
            treatment: an ember dot that reads as the "heat" in the concept,
            and normal tracking so the letters breathe. */}
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-ember shadow-[0_0_10px_2px_color-mix(in_oklab,var(--color-ember)_60%,transparent)]"
          />
          <span className="font-display text-[17px] font-bold tracking-display-sm text-ink">
            malesan
          </span>
        </span>
        <Link
          href="/masuk"
          className="rounded-full border border-hairline bg-surface/80 px-4 py-2 font-display text-[13px] font-semibold text-ink transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember-lo"
        >
          Masuk
        </Link>
      </header>

      <main className="relative z-10 flex-1">
        {/* ---------------- hero ---------------- */}
        <section className="mx-auto w-full max-w-6xl px-5 pt-8 pb-16 sm:px-8 sm:pt-20 sm:pb-28">
          <Reveal>
            <p className="eyebrow text-ember">Buat kreator konten Indonesia</p>
          </Reveal>

          <Reveal index={1}>
            {/* leading-[1.04] instead of 0.98: at 800 weight the two lines were
                colliding on a phone. Weight drops to 700 — 800 on a narrow face
                at display size is what made this look shouty rather than
                confident. */}
            <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.4rem,8.5vw,5rem)] font-bold leading-[1.04] tracking-display-lg text-ink">
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
              <Link
                href="/masuk"
                className="btn-ember inline-flex items-center justify-center rounded-xl px-6 py-3.5 font-display text-[15px] font-bold text-obsidian"
              >
                Males mikir. Kasih ide.
              </Link>
              <a
                href="#beda"
                className="inline-flex items-center justify-center rounded-xl border border-hairline bg-surface px-6 py-3.5 font-display text-[15px] font-semibold text-ink transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-surface-raised"
              >
                Emang beda sama ChatGPT?
              </a>
            </div>
          </Reveal>

          <Reveal index={4}>
            {/* Mono is reserved for real data. The numeral keeps it; the prose
                around it does not. */}
            <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              <span className="tabular font-mono text-ink">10</span>
              <span>credit gratis tiap hari</span>
              <span aria-hidden="true" className="text-hairline">
                •
              </span>
              <span>login pakai Google, gak pake password</span>
            </p>
          </Reveal>
        </section>

        {/* ---------------- modules ---------------- */}
        <section
          id="modul"
          className="scroll-mt-20 border-t border-hairline bg-obsidian"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
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
                    <article className="surface-card surface-card-interactive group flex h-full flex-col rounded-2xl border border-hairline p-5 sm:p-6">
                      {/* Eyebrow first, then title: the tag is the scanning
                          hook, and burying it at the bottom (as it was) made
                          every card look identical at a glance. */}
                      <span className="eyebrow text-ember-deep transition-colors duration-[var(--duration-standard)] ease-heat group-hover:text-ember">
                        {m.tag}
                      </span>
                      <h3 className="mt-3 font-display text-[19px] font-bold tracking-display-sm text-ink">
                        {m.name}
                      </h3>
                      <p className="mt-2.5 flex-1 text-[13.5px] leading-relaxed text-muted">
                        {m.body}
                      </p>
                      <div className="mt-5 flex items-center gap-1.5 border-t border-hairline/70 pt-4">
                        <span className="tabular font-mono text-sm text-ink">
                          {m.cost}
                        </span>
                        <span className="text-xs text-muted">
                          credit sekali pakai
                        </span>
                      </div>
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
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
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
                    <span
                      aria-hidden="true"
                      className="tabular font-display text-2xl font-bold leading-none text-ember/25"
                    >
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
          <span className="text-xs text-muted">
            Buat kreator Indonesia. Gratis 10 kredit tiap hari.
          </span>
        </div>
      </footer>
    </div>
  );
}
