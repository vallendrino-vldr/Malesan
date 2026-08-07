"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Reveals text progressively, in a fixed amount of time.
 *
 * The previous version scheduled one `setTimeout` per character at 15ms, which
 * made the reveal as long as the text: a 600-character field took nine seconds
 * of typewriter *after* the 13-20s the model already took, three of them ran at
 * once per card, and the effect tore down and re-created on every single
 * character. Long fields also finished last, so the card settled in a ragged
 * cascade rather than together.
 *
 * One rAF loop, and the duration is fixed rather than per-character — every
 * field lands at the same moment no matter its length, and the browser gets to
 * skip frames under load instead of queueing hundreds of timers.
 *
 * DESIGN.md §5 is why this exists at all: the model returns one burst at ~5.8s
 * (HANDOFF §7), so there is no real token-by-token stream to render. This is a
 * reveal, not a stream — it buys the *feeling* of arrival, and 800ms is enough
 * to read as arriving without becoming a second wait.
 */

const REVEAL_MS = 800;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

// Module scope so the identities are stable across renders — passing fresh
// closures to useSyncExternalStore resubscribes on every render.
const subscribeReduced = (onChange: () => void) => {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const getReduced = () => window.matchMedia(REDUCED_QUERY).matches;
// There is no media query on the server. Assuming "not reduced" matches the
// pre-hydration HTML, which renders nothing revealed either way.
const getReducedOnServer = () => false;

export function StreamingText({ text }: { text: string }) {
  const [shown, setShown] = useState(0);
  // The browser already owns this value and tells us when it changes, which is
  // exactly what useSyncExternalStore is for. Mirroring it into state through an
  // effect was both an extra render and a lint suppression.
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, getReducedOnServer);

  // How far the reveal has got. Written and read only inside the effect, never
  // during render: it exists so a growing `text` resumes from where the last
  // pass stopped, without making `shown` a dependency — depending on `shown`
  // would restart the animation on the very frame it just advanced.
  const progress = useRef(0);

  useEffect(() => {
    // Nothing to animate: the render below shows the whole string directly, so
    // this path never touches state.
    if (reduced) return;

    const from = Math.min(progress.current, text.length);
    const to = text.length;
    if (to <= from) return;

    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / REVEAL_MS);
      const next = from + Math.round((to - from) * p);
      progress.current = next;
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, reduced]);

  return <span>{reduced ? text : text.slice(0, Math.min(shown, text.length))}</span>;
}
