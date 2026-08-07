"use client";

import { useEffect, useState } from "react";
import { Mascot } from "./Mascot";

/**
 * What the app shows while the model is working.
 *
 * Before this, a generation was a button whose label changed to "Lagi
 * mikirin..." and then eight seconds of nothing. That reads as frozen, not
 * busy — and a frozen-looking button gets tapped again, which on a streaming
 * request is a second charge for the same work.
 *
 * The intent was to drive all of it from the stream, and the plumbing for that
 * is here — but measuring the upstream endpoint showed Gemini does not stream
 * incrementally at this size: every frame arrives in one burst at the end. So
 * `chars` is 0 for the whole wait and then complete, which is a boolean, not
 * progress. See the note on EXPECTED_SECONDS for how that is handled honestly,
 * and why the bar stops rather than crawls when a request runs long.
 */

/**
 * Typical wall-clock seconds per module, from real runs.
 *
 * These drive the bar because the intended signal turned out not to exist.
 * `/api/generate` streams, and the client does receive chunks — but measuring
 * the upstream endpoint directly showed Gemini delivering every frame in one
 * burst at the end (3 frames, first and last both at 5.82s). So "characters
 * received" is 0 for the entire wait and then complete, which is not progress,
 * it is a boolean.
 *
 * Elapsed time is therefore the honest basis, with two rules that keep it from
 * becoming the lying kind of progress bar: it never reaches 100 (only the
 * stream ending does that, and then this unmounts), and once it passes the
 * expected duration it STOPS and says so rather than crawling toward a finish
 * line it has no information about. A bar that keeps inching forward during a
 * failure is worse than no bar at all.
 *
 * If a future model does stream incrementally, `chars` takes over automatically
 * — real data beats an estimate whenever it shows up.
 */
const EXPECTED_SECONDS: Record<string, number> = {
  ide_hari_ini: 9,
  idea: 13,
  hook: 14,
  script: 20,
  repurpose: 15,
  vibe: 45,
};

const EXPECTED_CHARS: Record<string, number> = {
  ide_hari_ini: 900,
  idea: 1700,
  hook: 2300,
  script: 2900,
  repurpose: 2100,
  vibe: 6000,
};

type Stage = { at: number; label: string; sub: string };

const STAGES: Stage[] = [
  { at: 0, label: "Baca profil lo", sub: "Niche, gaya bahasa, sama hasil yang pernah lo kasih bintang" },
  { at: 0.06, label: "Nyusun angle", sub: "Nyari sudut yang belum kepakai sama orang lain" },
  { at: 0.3, label: "Nulis", sub: "Nyusun kalimatnya satu-satu" },
  { at: 0.82, label: "Ngerapiin", sub: "Ngecek ulang biar gak ada yang setengah jadi" },
];

export function GenerationProgress({
  moduleKey,
  chars,
  label,
}: {
  moduleKey: string;
  /** Characters received so far. Stays 0 with models that flush in one burst. */
  chars: number;
  /** Module-specific verb, e.g. "Lagi nulis script". */
  label?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 250);
    return () => clearInterval(id);
  }, []);

  const expectedS = EXPECTED_SECONDS[moduleKey] ?? 15;
  const expectedC = EXPECTED_CHARS[moduleKey] ?? 2000;

  // Real data wins when it exists; otherwise fall back to elapsed time.
  const streaming = chars > 0;
  const ratio = streaming
    ? Math.min(chars / expectedC, 1)
    : Math.min(elapsed / expectedS, 1);

  const overrun = !streaming && elapsed > expectedS * 1.25;

  // Capped below 100. Only the stream ending finishes this, and that unmounts
  // the component — so it can never sit at 100% while still waiting.
  const pct = Math.max(4, Math.round(ratio * 94));

  const stage = [...STAGES].reverse().find((s) => ratio >= s.at) ?? STAGES[0];
  const working = streaming || elapsed > 0.8;

  return (
    <div className="surface-card overflow-hidden rounded-2xl">
      <div className="flex items-center gap-4 p-4">
        <Mascot working={working} />

        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-ink">{label ?? stage.label}</p>
          <p className="mt-0.5 text-micro leading-relaxed text-muted">
            {overrun
              ? "Lagi agak lama dari biasanya. Masih jalan kok — jangan ditutup."
              : stage.sub}
          </p>

          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-obsidian">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ease-heat ${
                overrun ? "bg-muted" : "bg-ember"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-micro text-muted">{overrun ? "Masih jalan" : stage.label}</span>
            {/* Seconds, not a percentage dressed up as one. When it overruns the
                bar stops and this keeps counting, which is the honest pairing:
                something is still happening, and we no longer know how long. */}
            <span className="tabular font-mono text-micro text-muted">
              {streaming
                ? `${chars.toLocaleString("id-ID")} huruf`
                : `${elapsed.toFixed(0)} detik`}
            </span>
          </div>
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="border-t border-hairline px-4 py-2 text-micro leading-relaxed text-muted"
      >
        Jangan ditutup dulu. Kalau lo tap tombolnya lagi, kreditnya kepotong dua kali.
      </p>
    </div>
  );
}
