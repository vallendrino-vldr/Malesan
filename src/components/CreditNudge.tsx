"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * The offer.
 *
 * Before this there was not a single moment anywhere in the product that
 * mentioned buying credits. The top-up page existed and was reachable only if
 * you went looking for it. Nothing said a balance was running low, nothing
 * appeared when someone was pleased with a result. A product that never asks
 * does not get paid, and that is the actual reason this one was not earning —
 * not the pricing.
 *
 * Two moments, deliberately, and no others:
 *
 *   1. AFTER a result the creator liked. This is the only honest time to ask,
 *      because it is the only time the value is not hypothetical — they are
 *      looking at the thing they came for. Shown once per session and only
 *      when they have just said the output was useful.
 *
 *   2. BEFORE they run out, while they can still finish what they are doing.
 *      A warning at zero is not a warning, it is a wall.
 *
 * What it deliberately does not do: block anything, interrupt work in progress,
 * or appear while a generation is running. Nothing here is a modal. If someone
 * ignores it, it goes away and does not come back that session.
 *
 * Tone is the brief: anak tongkrongan — friendly, level with the reader, no
 * urgency theatre, no fake scarcity, no guilt. It says what the thing costs and
 * what it buys, and then stops talking.
 */

const SESSION_KEY = "malesan-offer-shown";

/** One per session, so a good run of six generations is not six sales pitches. */
function alreadyShown() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
function markShown() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* private mode — worst case it shows once more */
  }
}

/**
 * Shown under a result the creator has just marked as useful.
 *
 * The number is doing the work, not the adjective: at 4 credits a script and
 * 100 credits for Rp15.000, a script costs Rp600. Saying that plainly is more
 * persuasive than any amount of copywriting, and it is checkable — which is the
 * same standard the product holds its own AI output to.
 */
export function OfferAfterWin({ credits }: { credits: number }) {
  const [show, setShow] = useState(() => credits <= 120 && !alreadyShown());

  useEffect(() => {
    if (show) markShown();
  }, [show]);

  if (!show) return null;

  return (
    <div className="rounded-xl border border-ember/30 bg-ember/5 p-4">
      <p className="text-sm leading-relaxed text-ink">
        Nah, yang kayak gini yang dicari. Kalau lo mau lanjut tanpa mikirin sisa
        kredit, seratus kredit itu <span className="font-semibold">Rp15.000</span>{" "}
        — cukup buat sekitar 25 script.
      </p>
      <p className="mt-1.5 text-micro leading-relaxed text-muted">
        Kredit gratis harian tetep jalan. Ini cuma buat hari-hari lo lagi banyak
        maunya. Gak buru-buru.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Link
          href="/app/topup"
          className="btn-ember flex h-8.5 items-center rounded-lg px-3.5 font-display text-xs font-bold text-obsidian shadow-xs"
        >
          Lihat paketnya
        </Link>
        <button
          onClick={() => setShow(false)}
          className="h-8.5 cursor-pointer px-2 text-xs font-semibold text-muted hover:text-ink"
        >
          Nanti aja
        </button>
      </div>
    </div>
  );
}

/**
 * Shown in the studio when the balance is getting thin.
 *
 * The threshold is the cost of the most expensive module, times two — the point
 * where the next thing they try might not go through. Warning at zero is not a
 * warning; by then they have already hit the wall and the message is an
 * apology, not a heads-up.
 */
export function LowCreditNotice({
  credits,
  mostExpensive,
}: {
  credits: number;
  /** Cost of the priciest module, read from app_config by the caller. */
  mostExpensive: number;
}) {
  const [dismissed, setDismissed] = useState(false);
  const threshold = Math.max(mostExpensive * 2, 6);

  if (dismissed || credits > threshold) return null;

  const empty = credits < mostExpensive;

  return (
    <div
      className={`rounded-xl border p-3.5 ${
        empty ? "border-danger/30 bg-danger/5" : "border-hairline bg-surface/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-mini font-semibold text-ink">
            {empty
              ? "Kredit lo abis buat sekarang."
              : `Sisa ${credits} kredit — cukup buat sekali dua kali lagi.`}
          </p>
          <p className="mt-1 text-micro leading-relaxed text-muted">
            {empty
              ? "Besok jam 00:00 WIB dapet jatah gratis lagi. Kalau gak mau nunggu, isi dari Rp15.000."
              : "Jatah gratis reset tiap tengah malam. Isi ulang kalau lagi butuh banyak hari ini."}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Tutup"
          className="-mr-1.5 -mt-1.5 flex h-7.5 w-7.5 shrink-0 cursor-pointer items-center justify-center text-muted hover:text-ink"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
            <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3 1.4 1.4Z" />
          </svg>
        </button>
      </div>
      <Link
        href="/app/topup"
        className={`mt-2.5 inline-flex h-8.5 items-center rounded-lg px-3.5 font-display text-xs font-bold shadow-xs ${
          empty
            ? "btn-ember text-obsidian"
            : "border border-ember/40 bg-ember/10 text-ember"
        }`}
      >
        {empty ? "Isi kredit" : "Lihat paket"}
      </Link>
    </div>
  );
}
