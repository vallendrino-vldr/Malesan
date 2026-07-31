/**
 * Scripts that run before the first paint.
 *
 * NOT a `"use client"` module, and that is the entire point of this file
 * existing separately from the components that use these values.
 *
 * These two constants used to be exported from `ThemeToggle.tsx` and
 * `TextScale.tsx`, both of which carry `"use client"`. When a Server Component
 * imports a value out of a client module, Next replaces it with a client
 * reference — so what the root layout actually inlined into `<head>` was not
 * this code at all, it was:
 *
 *     function () { throw new Error("Attempted to call THEME_INIT_SCRIPT() from
 *     the server but THEME_INIT_SCRIPT is on the client...") }
 *
 * Verified in the served HTML: no `localStorage.getItem` anywhere in the
 * document head. So neither script had ever run, on any page load, ever.
 *
 * The visible damage was much wider than a flash of the wrong colour:
 *
 *   - The theme reset to dark on every hard load. It survived only while you
 *     stayed inside one client-side session, because `<html>` keeps whatever
 *     the toggle set on it. Open the app, cold-start the PWA, land on
 *     /app/topup as a real navigation, or use Safari's back-forward cache and
 *     you were in dark again with `malesan-theme: "soft"` sitting in storage,
 *     ignored.
 *   - The text-size control had the same problem, so a reader who picked "Gede"
 *     got default text back on every load.
 *
 * Both are plain strings here, evaluated at build time, and the layout inlines
 * them verbatim. The storage keys live here too so the components and the boot
 * scripts cannot drift apart — a rename on one side that missed the other would
 * silently reintroduce exactly this bug.
 */

export const THEME_KEY = "malesan-theme";
export const THEME_SEEN_KEY = "malesan-theme-toggle-seen";
export const TEXT_KEY = "malesan-text";

/**
 * Applies the saved theme before React hydrates.
 *
 * Runs synchronously in `<head>` so the correct theme is painted on the first
 * frame. Anything later and the dark theme paints once before the light one
 * takes over, and that flash is worse than either theme on its own.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
  var t = localStorage.getItem(${JSON.stringify(THEME_KEY)});
  if (t === "soft") document.documentElement.setAttribute("data-theme","soft");
}catch(e){}})();
`;

/** Same timing, same reason: text must not visibly resize after load. */
export const TEXT_INIT_SCRIPT = `
(function(){try{
  var t = localStorage.getItem(${JSON.stringify(TEXT_KEY)});
  if (t && t !== "md") document.documentElement.setAttribute("data-text", t);
}catch(e){}})();
`;
