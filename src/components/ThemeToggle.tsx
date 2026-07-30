"use client";

import { useEffect, useState } from "react";

/**
 * Switches between the dark ember theme and the light Soft UI theme.
 *
 * The switch writes one attribute — `data-theme` on `<html>` — and the CSS does
 * the rest. No component knows which theme is active, which is why this could be
 * added without touching a single screen.
 *
 * The choice is stored in localStorage and applied by a blocking inline script
 * in the document head (see layout.tsx). Reading it here in an effect instead
 * would paint the wrong theme for one frame on every load, and that flash is
 * more noticeable than the theme itself.
 */

type Theme = "dark" | "soft";
const KEY = "malesan-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // The inline script already applied the stored value; read it back so the
    // button renders in the right state rather than assuming a default.
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "soft" ? "soft" : "dark");
  }, []);

  const flip = () => {
    const next: Theme = theme === "dark" ? "soft" : "dark";
    setTheme(next);
    if (next === "soft") document.documentElement.setAttribute("data-theme", "soft");
    else document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private browsing can refuse storage. The theme still applies for this
      // session; it just will not be remembered.
    }
  };

  const soft = theme === "soft";

  return (
    <button
      onClick={flip}
      role="switch"
      aria-checked={soft}
      aria-label={soft ? "Ganti ke tema gelap" : "Ganti ke tema terang"}
      title={soft ? "Tema gelap" : "Tema terang"}
      className="skeu-press flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-hairline bg-surface-raised text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/45 hover:text-ember"
    >
      {soft ? (
        // Currently light → offer the moon.
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
          <path d="M12 3a9 9 0 1 0 9 9c0-.3 0-.6 0-.9A7 7 0 0 1 12.9 3H12Z" />
        </svg>
      ) : (
        // Currently dark → offer the sun.
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
          <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-13V2m0 20v-2m8-8h2M2 12h2m12.9-5.9 1.4-1.4M5.7 18.3l1.4-1.4m9.8 1.4 1.4 1.4M5.7 5.7 7.1 7.1" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      )}
    </button>
  );
}

/**
 * Applied before first paint to avoid a flash of the wrong theme.
 *
 * Inlined into <head> as a blocking script. It has to run before the body
 * renders, so it cannot be a React effect — and it is written defensively
 * because a throw here would block the whole document.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
  var t = localStorage.getItem(${JSON.stringify(KEY)});
  if (t === "soft") document.documentElement.setAttribute("data-theme","soft");
}catch(e){}})();
`;
