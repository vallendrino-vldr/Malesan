"use client";

import { useState } from "react";
import { rateGeneration } from "@/app/actions/pipeline";

/**
 * Rating, at the only moment anyone will actually do it.
 *
 * The loop already worked end to end: a rating lands on
 * `generations.performance_rating`, `buildLearned()` reads the highs and lows
 * back out, and both reach the next prompt. Scoped per user, enforced twice —
 * the query filters on `user_id` and RLS independently requires
 * `user_id = auth.uid()`, so one creator's taste can never leak into another's
 * output.
 *
 * The problem was never the mechanism, it was the sample. Five ratings out of
 * nineteen generations, because the only places to leave one were a pipeline
 * card that had already been moved to "Posted" and a row in Riwayat — both of
 * which require the creator to come back later, on purpose, to grade homework.
 * Nobody does that.
 *
 * So it sits directly under the result, while they are still looking at it and
 * still have an opinion. Two taps, not five stars: "kepake" or "gak kepake" is
 * the judgement a creator actually has at that moment, and a five-point scale
 * mostly produces 4s from people who do not want to be unkind. The two answers
 * map to 5 and 1, which is exactly what `buildLearned()` splits on.
 */
export function RateResult({
  generationId,
  onRated,
  className = "",
}: {
  /** Absent when the generation failed to persist — then there is nothing to attach a rating to. */
  generationId: string | null;
  /** Fired once the rating lands, so the caller can act on "they liked it". */
  onRated?: (verdict: "good" | "bad") => void;
  className?: string;
}) {
  const [done, setDone] = useState<null | "good" | "bad">(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!generationId) return null;

  const send = async (verdict: "good" | "bad") => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    // Optimistic: the judgement is theirs, and making them wait on a round trip
    // to find out whether their opinion registered is the fastest way to stop
    // them giving one.
    setDone(verdict);
    try {
      await rateGeneration(generationId, verdict === "good" ? 5 : 1);
      onRated?.(verdict);
    } catch {
      setDone(null);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className={`text-micro leading-relaxed text-success ${className}`}>
        {done === "good"
          ? "Noted. Yang model kayak gini bakal lebih sering keluar."
          : "Noted. Pola kayak gini bakal dihindarin lain kali."}
      </p>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="text-micro text-muted">Kepake gak?</span>
        <button
          onClick={() => send("good")}
          disabled={busy}
          aria-label="Hasilnya kepake"
          className="flex h-7.5 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline/80 bg-surface/80 px-2.5 text-xs font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-success/45 hover:text-success disabled:opacity-50 shadow-xs"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
            <path d="M2 21h3V9H2v12Zm19.7-9.8c.2-.2.3-.5.3-.8v-1a2 2 0 0 0-2-2h-5.2l.8-3.8v-.3c0-.4-.2-.8-.4-1L14.2 1 7.6 7.6c-.4.4-.6.9-.6 1.4v9a2 2 0 0 0 2 2h8.5c.8 0 1.5-.5 1.8-1.2l2.4-5.6Z" />
          </svg>
          Kepake
        </button>
        <button
          onClick={() => send("bad")}
          disabled={busy}
          aria-label="Hasilnya gak kepake"
          className="flex h-7.5 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline/80 bg-surface/80 px-2.5 text-xs font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-danger/45 hover:text-danger disabled:opacity-50 shadow-xs"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
            <path d="M22 3h-3v12h3V3ZM2.3 12.8c-.2.2-.3.5-.3.8v1a2 2 0 0 0 2 2h5.2l-.8 3.8v.3c0 .4.2.8.4 1l.9.9 6.6-6.6c.4-.4.6-.9.6-1.4v-9a2 2 0 0 0-2-2H6.4c-.8 0-1.5.5-1.8 1.2L2.3 12.8Z" />
          </svg>
          Enggak
        </button>
      </div>
      {failed && (
        <p className="mt-1 text-micro text-danger">Gagal kekirim. Coba lagi.</p>
      )}
      <p className="mt-1.5 text-micro leading-relaxed text-muted">
        Ini yang bikin hasil berikutnya makin nyambung sama lo. Cuma kepake buat
        akun lo sendiri.
      </p>
    </div>
  );
}
