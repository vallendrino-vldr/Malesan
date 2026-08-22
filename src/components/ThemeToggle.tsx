"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  THEME_KEY as KEY,
  THEME_SEEN_KEY as SEEN_KEY,
  THEME_CHROME,
  THEME_META_MARK,
} from "@/lib/boot-scripts";

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
 * more noticeable than the theme itself. Default with nothing stored is dark —
 * the init script only ever sets the attribute, never removes it.
 *
 * First version was a flat 32px icon in a row of near-identical icon buttons —
 * nothing marked it as new or interactive, and `title` (hover-only, invisible
 * on touch) was the entire explanation. This is a real switch: a track, a
 * sliding thumb, sun and moon glyphs at each end so the two states are legible
 * without reading anything, and a breathing glow that runs only until the first
 * tap — after that the user knows what it does, and a control that keeps
 * animating forever reads as broken rather than inviting.
 */

type Theme = "dark" | "soft";
const THEME_EVENT = "malesan:theme-change";

const subscribe = (notify: () => void) => {
  window.addEventListener(THEME_EVENT, notify);
  return () => window.removeEventListener(THEME_EVENT, notify);
};

const currentTheme = (): Theme =>
  document.documentElement.getAttribute("data-theme") === "soft" ? "soft" : "dark";

const shouldHint = () => {
  if (document.documentElement.hasAttribute("data-theme-seen")) return false;
  try {
    return !localStorage.getItem(SEEN_KEY);
  } catch {
    return true;
  }
};

/**
 * Repaints the iOS status bar and the Android address bar to match the theme.
 *
 * The `theme-color` pair in the layout is keyed on `prefers-color-scheme`, which
 * is the *system* setting — it cannot know about this toggle. Someone on a dark
 * phone who picks the light theme would otherwise get a black status bar above a
 * near-white page.
 *
 * This used to delete every theme-color meta and append a fresh one. Two of
 * those metas are rendered by Next from the `viewport` export, so React owns
 * them: removing them left React holding orphaned nodes, and the next commit
 * that unmounted one crashed with "Cannot read properties of null (reading
 * 'removeChild')". Nothing is removed now — we own exactly one meta, marked with
 * an attribute, and update it in place. Being the head's first child is what
 * makes it win: the browser takes the first theme-color whose `media` matches,
 * and ours has no `media`.
 */
function setChromeColor(next: Theme) {
  let meta = document.head.querySelector<HTMLMetaElement>(
    `meta[name="theme-color"][${THEME_META_MARK}]`,
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.setAttribute(THEME_META_MARK, "");
    document.head.insertBefore(meta, document.head.firstChild);
  }
  meta.content = THEME_CHROME[next];
}

export function ThemeToggle({ variant = "switch" }: { variant?: "switch" | "chip" } = {}) {
  const theme = useSyncExternalStore<Theme>(subscribe, currentTheme, () => "dark");
  const hint = useSyncExternalStore(subscribe, shouldHint, () => false);

  useEffect(() => {
    // Re-assert the chrome colour on mount, not only on click. A client-side
    // navigation re-renders the head from the new route's metadata, which drops
    // our override — so after moving between pages the status bar fell back to
    // the system preference while the page stayed on the chosen theme.
    setChromeColor(theme);
  }, [theme]);

  const flip = () => {
    const next: Theme = theme === "dark" ? "soft" : "dark";
    if (next === "soft") document.documentElement.setAttribute("data-theme", "soft");
    else document.documentElement.removeAttribute("data-theme");
    document.documentElement.setAttribute("data-theme-seen", "");

    setChromeColor(next);

    try {
      localStorage.setItem(KEY, next);
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Private browsing can refuse storage. The theme still applies for this
      // session; it just will not be remembered, and the hint may return.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const soft = theme === "soft";

  // On phones the switch moves into the named strip under the header. The
  // label is the point — a 52px pill with two tiny glyphs told nobody that this
  // product has a light theme at all.
  if (variant === "chip") {
    return (
      <button
        onClick={flip}
        role="switch"
        aria-checked={soft}
        className="hchip"
        aria-label={soft ? "Lagi tema terang. Tap buat ganti gelap." : "Lagi tema gelap. Tap buat ganti terang."}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-4 fill-current ${soft ? "text-ember" : ""}`}>
          {soft ? (
            <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-13V2m0 20v-2m8-8h2M2 12h2m12.9-5.9 1.4-1.4M5.7 18.3l1.4-1.4m9.8 1.4 1.4 1.4M5.7 5.7 7.1 7.1" />
          ) : (
            <path d="M12 3a9 9 0 1 0 9 9c0-.3 0-.6 0-.9A7 7 0 0 1 12.9 3H12Z" />
          )}
        </svg>
        <span className="truncate">{soft ? "Tema terang" : "Tema gelap"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={flip}
      role="switch"
      aria-checked={soft}
      aria-label={soft ? "Lagi tema terang. Tap buat ganti gelap." : "Lagi tema gelap. Tap buat ganti terang."}
      title={soft ? "Tema terang" : "Tema gelap"}
      // The button's own box is padded past the visible track so the tap
      // target clears 44px even though the pill itself reads slimmer — a
      // control this small is otherwise the easiest thing on the header to miss.
      className="group relative flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center"
    >
      <span
        aria-hidden="true"
        className={`skeu-inset relative flex h-7 w-[52px] items-center rounded-full border border-hairline px-[3px] transition-colors duration-300 ease-heat ${
          hint ? "theme-toggle-hint" : ""
        }`}
      >
        {/* Track glyphs. Faded when the thumb is over them, full strength on
            the side currently active — the icon reinforces state, not just
            the thumb position, so it reads correctly even color-blind. */}
        <svg
          viewBox="0 0 24 24"
          className={`absolute left-1.5 size-3.5 fill-current transition-opacity duration-300 ${
            soft ? "text-muted opacity-40" : "text-ember opacity-90"
          }`}
        >
          <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-13V2m0 20v-2m8-8h2M2 12h2m12.9-5.9 1.4-1.4M5.7 18.3l1.4-1.4m9.8 1.4 1.4 1.4M5.7 5.7 7.1 7.1" />
          <circle cx="12" cy="12" r="4" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          className={`absolute right-1.5 size-3.5 fill-current transition-opacity duration-300 ${
            soft ? "text-ember-lo opacity-90" : "text-muted opacity-40"
          }`}
        >
          <path d="M12 3a9 9 0 1 0 9 9c0-.3 0-.6 0-.9A7 7 0 0 1 12.9 3H12Z" />
        </svg>

        {/* The thumb. Raised (not inset) so it visibly protrudes off the
            recessed track — that contrast is what reads as "3D" and
            "physically pressable" rather than a flat coloured dot. */}
        <span
          className={`skeu relative z-10 flex size-[22px] items-center justify-center rounded-full border border-hairline bg-surface-raised text-ember transition-transform duration-300 ease-heat group-active:scale-90 ${
            soft ? "translate-x-[24px]" : "translate-x-0"
          }`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3 fill-current">
            {soft ? (
              <path d="M12 3a9 9 0 1 0 9 9c0-.3 0-.6 0-.9A7 7 0 0 1 12.9 3H12Z" />
            ) : (
              <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-13V2m0 20v-2m8-8h2M2 12h2m12.9-5.9 1.4-1.4M5.7 18.3l1.4-1.4m9.8 1.4 1.4 1.4M5.7 5.7 7.1 7.1" />
              </>
            )}
          </svg>
        </span>
      </span>

      {hint && (
        <span
          role="status"
          className="pointer-events-none absolute top-full mt-1.5 whitespace-nowrap rounded-md border border-ember/30 bg-obsidian px-2 py-1 text-micro font-semibold text-ember-lo shadow-lg"
        >
          Coba tema terang →
        </span>
      )}
    </button>
  );
}
