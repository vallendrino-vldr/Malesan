"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { TutorialVideoPlayer } from "@/components/tutorial/TutorialVideoPlayer";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * Tutorial.
 *
 * The product's promise is "males mikirnya" — you should not have to work out
 * what anything does. But five modules, a three-stage pipeline and a credit
 * system are a lot to infer from tiles alone, and nothing on screen ever
 * explained the whole shape of it.
 *
 * Written for someone with no technical background: no jargon, every step in
 * the order they would actually do it, and honest about what costs what.
 * Collapsible sections rather than one wall, because nobody reads a wall.
 *
 * ---
 *
 * The sheet is portalled to `document.body`, and that is load-bearing rather
 * than stylistic.
 *
 * This button lives in the app header, and that header is `backdrop-blur-xl`.
 * A `backdrop-filter` establishes a containing block for `position: fixed`
 * descendants — so `fixed inset-0` was resolving against the *header's* box, a
 * ~56px strip across the top, instead of the viewport. The panel was being
 * asked to lay out a full-height dialog inside a strip, which is why it landed
 * in the wrong place and spilled off-screen with its text unreachable on both
 * phone and desktop. Nothing about the panel's own CSS was wrong; it was being
 * measured against the wrong box.
 *
 * A portal moves it out from under the blurred ancestor, so `fixed` means the
 * viewport again. Any future overlay opened from the header needs the same
 * treatment.
 */

type Section = { q: string; a: React.ReactNode };

const TUTORIAL_VIDEO_URL = process.env.NEXT_PUBLIC_TUTORIAL_VIDEO_URL?.trim();
const TUTORIAL_CAPTIONS_URL = process.env.NEXT_PUBLIC_TUTORIAL_CAPTIONS_URL?.trim();

const QUICK_STEPS_ID = [
  {
    title: "Pilih Ide Hari Ini",
    body: "Kalau kepala masih kosong, mulai dari sini. Gak perlu nulis ide.",
  },
  {
    title: "Pilih tempat dan tujuan",
    body: "TikTok, Threads, jualan, atau cari views — tinggal tap yang paling pas.",
  },
  {
    title: "Salin atau simpan",
    body: "Kontennya langsung siap dipakai. Salin sekarang, atau simpan ke Alur buat dilanjutin.",
  },
] as const;

const QUICK_STEPS_EN = [
  {
    title: "Pick Today's Viral Radar",
    body: "If your mind is blank, start here. No prompt engineering needed.",
  },
  {
    title: "Select platform & goal",
    body: "TikTok, Threads, sales, or viral reach — just tap what fits.",
  },
  {
    title: "Copy or save to pipeline",
    body: "Your content is ready instantly. Copy immediately or save to Pipeline.",
  },
] as const;

const SECTIONS_ID: Section[] = [
  {
    q: "Aplikasi ini buat apa sih?",
    a: (
      <>
        Bantu lo bikin konten tanpa mikir dari nol. Lo cerita dikit — atau bahkan
        gak ngomong apa-apa — dan lo dapet ide, kalimat pembuka, sampai script
        lengkap yang siap dibaca depan kamera.
      </>
    ),
  },
  {
    q: "Kredit itu apa? Kenapa kepotong?",
    a: (
      <>
        Tiap kali Malesan mikir buat lo, itu makan biaya. Kredit cara ngukurnya.
        <br />
        <br />
        Lo dapet <span className="text-ink">kredit gratis tiap hari</span>, reset
        otomatis jam 00:00 WIB. Kredit gratis yang gak kepakai hangus saat reset.
        Kredit yang lo beli <span className="text-ink">gak pernah hangus</span>.
        <br />
        <br />
        Kalau prosesnya gagal karena sistem, kredit lo balik otomatis.
      </>
    ),
  },
  {
    q: "Mulai dari mana kalau baru pertama kali?",
    a: (
      <>
        Tap <span className="text-ember">Ide Hari Ini</span> di tab Studio. Lo gak
        perlu ngetik apa-apa — langsung keluar 3 ide buat hari ini.
        <br />
        <br />
        Kalau udah ada ide di kepala tapi masih mentah, pakai{" "}
        <span className="text-ember">Matengin Ide</span>: lempar idenya, balik jadi
        5 yang udah mateng.
      </>
    ),
  },
  {
    q: "Pilihan di Studio itu bedanya apa?",
    a: (
      <ul className="space-y-2">
        <li>
          <span className="text-ink">Ide Hari Ini</span> — gak usah ngetik, dapet
          3 ide segar.
        </li>
        <li>
          <span className="text-ink">Matengin Ide</span> — punya ide mentah, dibikin
          mateng.
        </li>
        <li>
          <span className="text-ink">Bikin Hook</span> — 3 detik pertama video. Ini
          yang nentuin orang lanjut nonton atau scroll.
        </li>
        <li>
          <span className="text-ink">Bikin Script</span> — script lengkap per scene,
          lengkap sama teks di layar dan footage yang perlu diambil.
        </li>
        <li>
          <span className="text-ink">Ubah Format</span> — satu konten jadi 5 versi
          buat 5 platform. Bukan copy-paste, tiap platform beda gaya.
        </li>
      </ul>
    ),
  },
  {
    q: "Alur konten itu buat apa?",
    a: (
      <>
        Tempat ide lo jalan dari mentah sampai tayang, biar gak ada yang kelupaan.
        <br />
        <br />
        Urutannya: <span className="text-ink">Ide</span> →{" "}
        <span className="text-ink">Draft</span> (udah ada hook) →{" "}
        <span className="text-ink">Siap</span> (script kelar) →{" "}
        <span className="text-ink">Tayang</span>.
        <br />
        <br />
        Gak usah hafal urutannya. Tiap kartu bilang sendiri langkah berikutnya
        apa.
      </>
    ),
  },
  {
    q: "Kenapa hasilnya kadang kurang nyambung sama gue?",
    a: (
      <>
        Karena profil lo belum lengkap. Isi{" "}
        <span className="text-ember">Profil konten utama</span> di tab Profil — niche,
        gaya bahasa, target audiens, dan yang paling ngaruh:{" "}
        <span className="text-ink">kontennya buat siapa</span> (diri sendiri,
        klien, atau brand tempat lo kerja).
        <br />
        <br />
        Makin lengkap, makin nyambung. Dan tiap hasil yang lo{" "}
        <span className="text-ink">kasih bintang</span> di Riwayat kepake — yang
        bagus jadi contoh, yang jelek dihindarin di hasil berikutnya.
      </>
    ),
  },
  {
    q: "Bikin App itu buat apa? Gue bukan programmer.",
    a: (
      <>
        Buat yang mau bikin aplikasi pakai AI (Claude, Cursor, dan sejenisnya).
        Lo ceritain mau bikin apa, ini bikinin 6 dokumen yang AI-nya baca duluan
        sebelum nulis kode.
        <br />
        <br />
        Kalau lo gak ada rencana bikin aplikasi, tab ini bisa lo lewatin aja.
      </>
    ),
  },
  {
    q: "Hasilnya boleh gue pakai buat jualan?",
    a: (
      <>
        Boleh, hasilnya milik lo. Tapi AI bisa salah — cek dulu fakta, angka, dan
        klaim sebelum diposting.
      </>
    ),
  },
];

const SECTIONS_EN: Section[] = [
  {
    q: "What is this app for?",
    a: (
      <>
        Help you create content without thinking from scratch. Share a brief concept — or even
        nothing at all — and get fresh ideas, viral opening hooks, to complete video scripts
        ready to film in front of the camera.
      </>
    ),
  },
  {
    q: "What are credits? Why are they deducted?",
    a: (
      <>
        Every time Malesan processes AI generations for you, compute resources are consumed. Credits measure that usage.
        <br />
        <br />
        You receive <span className="text-ink">free daily credits</span>, reset
        automatically at 00:00 WIB. Unused daily credits expire at reset.
        Purchased credits <span className="text-ink">never expire</span>.
        <br />
        <br />
        If any generation fails due to a system error, your credits are refunded automatically.
      </>
    ),
  },
  {
    q: "Where do I start as a beginner?",
    a: (
      <>
        Tap <span className="text-ember">Daily Idea</span> in the Studio tab. You don&apos;t
        need to type anything — 3 fresh ideas are generated instantly for today.
        <br />
        <br />
        If you already have a rough idea in mind, use{" "}
        <span className="text-ember">Idea Refiner</span>: input your raw thought, get back
        5 polished, actionable content angles.
      </>
    ),
  },
  {
    q: "What is the difference between Studio modules?",
    a: (
      <ul className="space-y-2">
        <li>
          <span className="text-ink">Daily Idea</span> — no prompt engineering, get
          3 fresh content angles.
        </li>
        <li>
          <span className="text-ink">Idea Refiner</span> — have a rough thought, turn it
          into polished angles.
        </li>
        <li>
          <span className="text-ink">Hook Generator</span> — first 3 seconds of your video. This
          determines whether viewers watch or keep scrolling.
        </li>
        <li>
          <span className="text-ink">Video Script</span> — full scene-by-scene script with
          on-screen text cues and b-roll directions.
        </li>
        <li>
          <span className="text-ink">Adapt Format</span> — one core piece adapted into 5 tailored
          versions for 5 platforms. Each tuned to its unique audience.
        </li>
      </ul>
    ),
  },
  {
    q: "What is the Content Pipeline for?",
    a: (
      <>
        A visual Kanban board where your content moves from raw idea to published, so nothing slips through the cracks.
        <br />
        <br />
        Workflow: <span className="text-ink">Idea</span> →{" "}
        <span className="text-ink">Draft</span> (has hook) →{" "}
        <span className="text-ink">Ready</span> (script completed) →{" "}
        <span className="text-ink">Published</span>.
        <br />
        <br />
        No need to memorize the steps. Each card displays its next recommended action.
      </>
    ),
  },
  {
    q: "Why do outputs sometimes not match my tone?",
    a: (
      <>
        Because your creator profile isn&apos;t fully filled yet. Complete your{" "}
        <span className="text-ember">Content Profile &amp; Voice</span> in the Profile tab — niche,
        speaking style, target audience, and most importantly:{" "}
        <span className="text-ink">who the content is for</span> (yourself,
        client, or your company brand).
        <br />
        <br />
        The more complete it is, the more tailored the outputs become. Plus, every result you{" "}
        <span className="text-ink">rate with stars</span> in History is utilized — high ratings
        serve as examples, while low ratings are avoided in future generations.
      </>
    ),
  },
  {
    q: "What is App Builder for? I'm not a developer.",
    a: (
      <>
        For creators looking to build software applications using modern AI tools (Claude, Cursor, and similar).
        Describe what you want to build, and it generates 6 architectural spec documents that AI reads before writing code.
        <br />
        <br />
        If you don&apos;t plan to build software apps, you can simply skip this tab.
      </>
    ),
  },
  {
    q: "Can I use generated outputs commercially?",
    a: (
      <>
        Yes, all outputs belong to you. However, AI can make factual errors — always verify facts, figures, and claims before publishing.
      </>
    ),
  },
];

export function TutorialSheet({ variant = "icon" }: { variant?: "icon" | "chip" } = {}) {
  const { t, dict, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(0);
  // A portal cannot render during SSR — there is no document to portal into.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Escape closes it, and the page behind stops scrolling while it is open.
  // Without the lock, scrolling past the end of the sheet on a phone scrolls
  // the app underneath and the sheet appears to drift.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerChip = dict.tutorial?.triggerChip || (language === "en" ? "Tutorial" : "Cara pakai");
  const triggerGuide = dict.tutorial?.triggerGuide || (language === "en" ? "Guide" : "Panduan");
  const modalTitle = dict.tutorial?.title || (language === "en" ? "Tutorial" : "Cara pakai");
  const modalHeading = dict.tutorial?.heading || (language === "en" ? "Simple by design" : "Gak ada yang ribet di sini");
  const quickSteps = language === "en" ? QUICK_STEPS_EN : QUICK_STEPS_ID;
  const quickHeadingEyebrow = language === "en" ? "Fast track" : "Alur tercepat";
  const quickHeadingTitle = language === "en" ? "Master it in 1 minute" : "1 menit langsung ngerti";
  const faqEyebrow = language === "en" ? "Frequently asked questions" : "Kalau masih bingung";
  const sections = language === "en" ? SECTIONS_EN : SECTIONS_ID;
  const footerHelp = language === "en"
    ? "Still have questions? Submit your questions or feedback via the Feedback menu."
    : "Masih bingung? Kirim pertanyaan atau saran melalui menu Laporan di dashboard Malesan.";

  return (
    <>
      {/* WCAG 2.2's minimum comfortable target is 44-48px; the visible glyph
          stays 32px so the header does not bloat, and the button's own box
          absorbs the extra hit area. */}
      {variant === "chip" ? (
        <button
          onClick={() => setOpen(true)}
          className="flex h-7.5 sm:h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-hairline/60 bg-surface/50 px-2.5 text-[11px] font-medium text-muted transition-colors hover:border-ember/30 hover:bg-surface hover:text-ink cursor-pointer shadow-xs"
          aria-label={triggerChip}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1 12h2v2h-2v-2Zm1-9c-1.8 0-3 1.1-3 2.8h2c0-.7.4-1 1-1s1 .3 1 .9c0 .5-.3.8-.9 1.2-.8.5-1.1 1-1.1 2.1h2c0-.6.2-.9.9-1.3.9-.6 1.4-1.2 1.4-2.3C15.2 8.1 13.9 7 12 7Z" />
          </svg>
          <span className="truncate">{triggerChip}</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label={triggerGuide}
          title={triggerGuide}
          className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-hairline/60 bg-surface/40 px-3.5 text-xs font-medium text-muted/80 transition-all duration-200 hover:border-ember/35 hover:bg-surface-raised hover:text-ink"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current text-muted">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1 12h2v2h-2v-2Zm1-9c-1.8 0-3 1.1-3 2.8h2c0-.7.4-1 1-1s1 .3 1 .9c0 .5-.3.8-.9 1.2-.8.5-1.1 1-1.1 2.1h2c0-.6.2-.9.9-1.3.9-.6 1.4-1.2 1.4-2.3C15.2 8.1 13.9 7 12 7Z" />
          </svg>
          <span className="hidden xl:inline">{triggerGuide}</span>
        </button>
      )}

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[60] flex cursor-pointer items-end justify-center bg-obsidian/75 backdrop-blur-sm md:items-center md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={modalTitle}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-hairline bg-surface md:max-h-[80dvh] md:max-w-lg md:rounded-2xl"
          >
            {/* Title and close pinned; only the list scrolls. Previously the
                whole panel was one scroll region, so on a phone the way out
                scrolled off the top and the sheet felt like a trap. */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-5 pb-3.5 pt-5">
              <div className="min-w-0">
                <p className="eyebrow text-ember">{modalTitle}</p>
                <h2 className="mt-1 font-display text-xl font-bold text-ink">
                  {modalHeading}
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label={t("actions.close", "Tutup")}
                className="-mr-2 -mt-2 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:text-ink"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
                  <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3 1.4 1.4Z" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
              <section className="rounded-xl border border-ember/30 bg-ember/5 p-4">
                <p className="eyebrow text-ember">{quickHeadingEyebrow}</p>
                <h3 className="mt-1.5 font-display text-base font-bold text-ink">
                  {quickHeadingTitle}
                </h3>
                <ol className="mt-3 space-y-2.5">
                  {quickSteps.map((step, index) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="tabular grid size-7 shrink-0 place-items-center rounded-full border border-ember/35 bg-obsidian font-mono text-micro font-bold text-ember">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-mini font-semibold text-ink">{step.title}</span>
                        <span className="mt-0.5 block text-micro leading-relaxed text-muted">{step.body}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              {/* Interactive Video Tutorial with +10 Bonus Credits Reward */}
              <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-obsidian">
                <TutorialVideoPlayer
                  videoSrc={TUTORIAL_VIDEO_URL || "/tutorial/tutorial-demo-v2.mp4"}
                  captionsSrc={TUTORIAL_CAPTIONS_URL}
                />
              </section>

              <p className="eyebrow px-1 pt-1 text-muted">{faqEyebrow}</p>
              {sections.map((s, i) => {
                const on = expanded === i;
                return (
                  <div
                    key={i}
                    className={`overflow-hidden rounded-xl border transition-colors ${
                      on ? "border-ember/35 bg-ember/5" : "border-hairline bg-obsidian"
                    }`}
                  >
                    <button
                      onClick={() => setExpanded(on ? null : i)}
                      aria-expanded={on}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-3 text-left"
                    >
                      <span
                        className={`text-sm font-semibold ${on ? "text-ember" : "text-ink"}`}
                      >
                        {s.q}
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className={`size-4 shrink-0 fill-muted transition-transform duration-[var(--duration-standard)] ease-heat ${
                          on ? "rotate-180" : ""
                        }`}
                      >
                        <path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z" />
                      </svg>
                    </button>
                    {on && (
                      <div className="px-3.5 pb-3.5 text-mini leading-relaxed text-muted">
                        {s.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="shrink-0 border-t border-hairline px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-micro leading-relaxed text-muted">
              {footerHelp}
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
