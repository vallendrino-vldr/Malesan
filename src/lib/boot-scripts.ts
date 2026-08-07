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
 * Browser-chrome colour per theme — the iOS status bar and the Android address
 * bar. Must stay equal to `--color-obsidian` for each theme in globals.css.
 */
export const THEME_CHROME = { dark: "#0b0a09", soft: "#e8e0d8" } as const;

/**
 * Attribute marking the one `<meta name="theme-color">` this product owns.
 *
 * It matters that it is *one*, and that it is ours. The `viewport` export in
 * layout.tsx declares a media-scoped pair of theme-color metas, and Next renders
 * those as part of the React tree — React holds fiber references to those exact
 * DOM nodes. Deleting them from JavaScript leaves React pointing at orphans, and
 * the next commit that unmounts one calls `parentNode.removeChild(node)` against
 * a `parentNode` that is now null. That is a hard runtime crash, and it is
 * exactly what a `querySelectorAll('meta[name="theme-color"]').forEach(m =>
 * m.remove())` in the toggle used to cause on /app.
 *
 * So nothing here ever removes a meta. We keep our own, update its `content` in
 * place, and insert it as the head's first child — the browser uses the first
 * theme-color whose `media` matches, and ours carries no `media`, so being first
 * is what lets an explicit choice beat the system preference.
 */
export const THEME_META_MARK = "data-malesan-theme";

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
  var soft = t === "soft";
  if (soft) document.documentElement.setAttribute("data-theme","soft");
  var m = document.createElement("meta");
  m.setAttribute("name","theme-color");
  m.setAttribute(${JSON.stringify(THEME_META_MARK)},"");
  m.setAttribute("content", soft ? ${JSON.stringify(THEME_CHROME.soft)} : ${JSON.stringify(THEME_CHROME.dark)});
  document.head.insertBefore(m, document.head.firstChild);
}catch(e){}})();
`;

/** Same timing, same reason: text must not visibly resize after load. */
export const TEXT_INIT_SCRIPT = `
(function(){try{
  var t = localStorage.getItem(${JSON.stringify(TEXT_KEY)});
  if (t && t !== "md") document.documentElement.setAttribute("data-text", t);
}catch(e){}})();
`;

/**
 * Haptic tap feedback on every button, app-wide.
 *
 * One delegated `pointerdown` listener in the capture phase, attached before
 * hydration for the same reason the theme script is: it must cover the very
 * first tap, including on pages React has not hydrated yet. `pointerdown`
 * (not `click`) is deliberate — the buzz has to land the instant the finger
 * touches, or it feels like lag rather than feedback.
 *
 * `navigator.vibrate` only does anything on Android Chrome; iOS Safari has no
 * web vibration API and silently ignores it, so this is a progressive
 * enhancement, never a dependency. Wrapped in try/catch because a blocked or
 * unsupported call can throw, and a boot script must never break the page.
 *
 * Scope is buttons and button-like controls (`button`, `[role="button"]`,
 * `a[href]`), skipping disabled ones. Opt a non-standard control in with
 * `data-haptic`; opt one out with `data-haptic="off"`.
 */
export const HAPTIC_SCRIPT = `
(function(){try{
  if (!("vibrate" in navigator)) return;
  document.addEventListener("pointerdown", function(e){
    if (!e.isPrimary) return;
    var el = e.target && e.target.closest
      ? e.target.closest('button,[role="button"],a[href],[data-haptic]') : null;
    if (!el) return;
    if (el.getAttribute("data-haptic") === "off") return;
    if (el.disabled || el.getAttribute("aria-disabled") === "true") return;
    try { navigator.vibrate(8); } catch (err) {}
  }, true);
}catch(e){}})();
`;
