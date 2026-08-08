"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Dashboard nudge: the creator has posted content sitting untouched for over a
 * month. One tap turns the oldest piece into three fresh angles via Gemini
 * (/api/recycle). A line on the dashboard is the whole feature — deliberately not
 * a notification system.
 */

export type RecyclableCard = { id: string; title: string; created_at: string };

type Angle = { angle: string; hook: string; kenapa: string };

/** Posted content older than this is offered for recycling. The age cut lives
 *  here (client) so the dashboard server render stays pure — no Date.now(). */
const RECYCLE_MIN_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function monthsAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days >= 60) return `${Math.floor(days / 30)} bulan lalu`;
  return `${days} hari lalu`;
}

export function RecycleBanner({ cards }: { cards: RecyclableCard[] }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [angles, setAngles] = useState<Angle[] | null>(null);

  // Captured once on mount, not read during render, so the purity rule stays
  // satisfied and the age cut does not wobble across re-renders.
  const [nowMs] = useState(() => Date.now());
  const stale = cards.filter(
    (c) => nowMs - new Date(c.created_at).getTime() >= RECYCLE_MIN_AGE_MS,
  );
  if (dismissed || stale.length === 0) return null;
  const target = stale[0];

  const recycle = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/recycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: target.id }),
      });
      const data = (await res.json().catch(() => null)) as
        | { angles?: Angle[]; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? "Gagal daur ulang. Coba lagi.");
        return;
      }
      setAngles(data?.angles ?? []);
      router.refresh(); // a credit was spent — keep the header honest
    } catch {
      setError("Koneksi bermasalah. Coba lagi ya.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface-card rounded-2xl border border-ember/25 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-ember/15 text-lg" aria-hidden="true">
          ♻️
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold tracking-display-sm text-ink">
            {stale.length > 1
              ? `${stale.length} konten lama sayang nganggur`
              : "Ada konten lama yang sayang nganggur"}
          </h3>
          <p className="mt-0.5 text-mini text-muted">
            {`"${target.title?.trim() || "Tanpa judul"}"`} udah lo posting {monthsAgo(target.created_at)}.
            Daur ulang jadi angle baru, gak usah mikir dari nol.
          </p>

          {!angles && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => void recycle()}
                disabled={busy}
                className="min-h-11 cursor-pointer rounded-xl bg-ember px-4 font-display text-mini font-bold text-obsidian transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Lagi nyulap..." : "Daur ulang jadi ide baru"}
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="min-h-11 cursor-pointer rounded-xl border border-hairline px-4 text-mini font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:text-ink"
              >
                Nanti aja
              </button>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          {angles && (
            <div className="mt-3 space-y-2.5">
              {angles.map((a, i) => (
                <div key={i} className="rounded-xl border border-hairline bg-surface p-3">
                  <p className="eyebrow text-ember">{a.angle}</p>
                  <p className="mt-1 text-sm font-semibold leading-snug text-ink">{a.hook}</p>
                  {a.kenapa && <p className="mt-1 text-mini leading-relaxed text-muted">{a.kenapa}</p>}
                </div>
              ))}
              <button
                onClick={() => setDismissed(true)}
                className="min-h-11 cursor-pointer text-mini font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
