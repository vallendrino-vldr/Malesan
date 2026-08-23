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
 * Provider output often arrives in one burst. The old version filled a percent
 * bar and rotated through "nyusun angle / ngerapiin" based only on elapsed time.
 * Those sounded like observed stages but were guesses. This version only shows
 * facts: a server-emitted status, real characters received, and wall-clock time.
 */

/**
 * Typical wall-clock seconds per module, from real runs. They never drive a
 * percentage; they only decide when "agak lama" is honest to say.
 */
const EXPECTED_SECONDS: Record<string, number> = {
  ide_hari_ini: 9,
  idea: 13,
  hook: 14,
  script: 20,
  repurpose: 15,
  clip: 18,
  thread: 18,
  vibe: 45,
};

export function GenerationProgress({
  moduleKey,
  chars,
  label,
  status,
  compact = false,
}: {
  moduleKey: string;
  /** Characters received so far. Stays 0 with models that flush in one burst. */
  chars: number;
  /** Module-specific verb, e.g. "Lagi nulis script". */
  label?: string;
  /** A real phase emitted by the server at the point that phase begins. */
  status?: string;
  /** Lean version for a Pipeline card that is already inside a surface. */
  compact?: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 250);
    return () => clearInterval(id);
  }, []);

  const expectedS = EXPECTED_SECONDS[moduleKey] ?? 15;
  const streaming = chars > 0;
  const overrun = elapsed > expectedS * 1.5;
  const headline = status || label || "Lagi mikirin buat lo...";
  const detail = streaming
    ? "Jawabannya mulai masuk. Gue tunggu sampai lengkap dulu."
    : overrun
      ? "Lebih lama dari biasanya, tapi request-nya masih jalan."
      : "Request-nya udah jalan. Tombolnya gue kunci biar gak dobel.";

  return (
    <div
      role="status"
      aria-live="polite"
      className={compact ? "rounded-xl border border-hairline bg-obsidian/55 p-3" : "surface-card overflow-hidden rounded-2xl"}
    >
      <div className={`flex items-center ${compact ? "gap-3" : "gap-4 p-4"}`}>
        {!compact && <Mascot working />}

        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-ink">{headline}</p>
          <p className="mt-0.5 text-micro leading-relaxed text-muted">{detail}</p>

          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-obsidian">
            <div
              className={`h-full w-full rounded-full animate-pulse ${overrun ? "bg-muted/55" : "bg-ember/70"}`}
            />
          </div>

          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-micro text-muted">{streaming ? "Jawaban diterima" : "Waktu tunggu"}</span>
            <span className="tabular font-mono text-micro text-muted">
              {streaming
                ? `${chars.toLocaleString("id-ID")} huruf`
                : `${elapsed.toFixed(0)} detik`}
            </span>
          </div>
        </div>
      </div>

      {!compact && (
        <p className="border-t border-hairline px-4 py-2 text-micro leading-relaxed text-muted">
          Tetap di halaman ini sampai hasilnya muncul.
        </p>
      )}
    </div>
  );
}
