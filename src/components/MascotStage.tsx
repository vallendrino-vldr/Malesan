"use client";

import { useEffect, useRef, useState } from "react";
import { AmbientIdle } from "./AmbientIdle";
import { Mascot } from "./Mascot";

/**
 * The dashboard centrepiece, and the one place in the product that rewards
 * poking it.
 *
 * The rings and the mascot are both decorative, so the whole visual stays
 * `aria-hidden` inside AmbientIdle. What is exposed is a real `<button>` — not a
 * div with onClick — so it is keyboard reachable and announces itself, which is
 * the quality floor in DESIGN.md §7 rather than a nicety.
 *
 * It reacts on the first tap and escalates from there. It falls back asleep on
 * its own, because a mascot that stays wide awake forever stops being lazy and
 * the gag only works while it is a surprise.
 */

// Escalates per tap. Later taps answer the fact that the user kept going rather
// than repeating the same line.
const LINES = [
  "Hng? Apaan.",
  "Aduh. Ngapain sih.",
  "Gue lagi mager, seriusan.",
  "Ya udah, gue bangun. Puas?",
  "Lo lebih niat nyolek gue daripada bikin konten.",
];

const AWAKE_MS = 2600;

export function MascotStage({ className = "" }: { className?: string }) {
  const [taps, setTaps] = useState(0);
  const [awake, setAwake] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A tap landing while the previous nap timer is still pending would let the
  // figure fall asleep mid-sentence.
  useEffect(() => () => clearTimeout(timer.current), []);

  const poke = () => {
    const next = taps + 1;
    setTaps(next);

    setAwake(true);
    setLine(LINES[Math.min(next - 1, LINES.length - 1)]);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setAwake(false);
      setLine(null);
    }, AWAKE_MS);
  };

  return (
    <div className={`relative grid place-items-center ${className}`}>
      <button
        type="button"
        onClick={poke}
        aria-label="Colek maskotnya"
        className="grid size-full cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember"
      >
        <AmbientIdle
          className="size-full"
          center={<Mascot awake={awake} className="size-full" />}
        />
      </button>

      {/* Sits over the rings rather than in the flow: appearing and vanishing in
          the layout would shove the greeting down and back up, which is a
          layout shift on a page that currently measures CLS 0. */}
      {line && (
        <div className="pointer-events-none absolute -bottom-2.5 left-1/2 -translate-x-1/2 lg:left-0 lg:translate-x-0 z-30 flex items-center">
          <span
            role="status"
            aria-live="polite"
            className="whitespace-nowrap rounded-full border border-ember/40 bg-surface-raised/95 backdrop-blur-md px-3 py-1 text-micro font-semibold text-ember shadow-lg shadow-black/60 ring-1 ring-ember/25 animate-in fade-in zoom-in-95 duration-150"
          >
            {line}
          </span>
        </div>
      )}
    </div>
  );
}
