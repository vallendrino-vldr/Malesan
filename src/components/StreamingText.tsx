"use client";

import { useEffect, useState } from "react";

/**
 * Renders text character by character for a streaming effect.
 * If prefers-reduced-motion is true, renders instantly.
 */
export function StreamingText({ text, speedMs = 15 }: { text: string; speedMs?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefersReducedMotion(mediaQuery.matches);
    
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayed(text);
      return;
    }

    if (displayed.length >= text.length) {
      // If we already have the full text (e.g. streaming finished), just update it
      // if it changed suddenly, but usually it grows monotonically.
      setDisplayed(text);
      return;
    }

    // Only stream the newly added characters
    const timeout = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speedMs);

    return () => clearTimeout(timeout);
  }, [text, displayed.length, prefersReducedMotion, speedMs]);

  return <span>{displayed}</span>;
}
