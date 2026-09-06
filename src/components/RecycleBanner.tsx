"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageContext";

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

function formatAge(
  iso: string,
  rc: { monthsAgo: (m: number) => string; daysAgo: (d: number) => string }
): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days >= 60) return rc.monthsAgo(Math.floor(days / 30));
  return rc.daysAgo(days);
}

export function RecycleBanner({ cards }: { cards: RecyclableCard[] }) {
  const router = useRouter();
  const { dict } = useLanguage();
  const rc = dict.recycle;

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
        setError(data?.error ?? rc.errFailed);
        return;
      }
      setAngles(data?.angles ?? []);
      router.refresh(); // a credit was spent — keep the header honest
    } catch {
      setError(rc.errConnection);
    } finally {
      setBusy(false);
    }
  };

  const targetTitle = target.title?.trim() || rc.untitled;
  const timeString = formatAge(target.created_at, rc);

  return (
    <section className="surface-card rounded-2xl border border-ember/25 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-ember/15 border border-ember/30 text-ember" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4.5">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold tracking-display-sm text-ink">
            {stale.length > 1
              ? rc.stalePlural(stale.length)
              : rc.staleSingular}
          </h3>
          <p className="mt-0.5 text-mini text-muted">
            {rc.description(targetTitle, timeString)}
          </p>

          {!angles && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => void recycle()}
                disabled={busy}
                className="h-8 sm:h-8.5 cursor-pointer rounded-lg bg-ember px-3.5 font-display text-xs font-bold text-obsidian transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
              >
                {busy ? rc.btnBusy : rc.btnAction}
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="h-8 sm:h-8.5 cursor-pointer rounded-lg border border-hairline bg-surface/60 px-3.5 text-xs font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:text-ink shadow-xs"
              >
                {rc.btnDismiss}
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
                className="h-7.5 cursor-pointer text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                {rc.btnClose}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
