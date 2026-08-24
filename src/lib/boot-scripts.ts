/**
 * Scripts that run before the first paint.
 *
 * NOT a `"use client"` module, and that is the entire point of this file
 * existing separately from the components that use these values.
 *
 * These constants are plain strings evaluated at build time, and the layout
 * inlines them verbatim into `<head>`.
 */

export const THEME_KEY = "malesan-theme";
export const THEME_SEEN_KEY = "malesan-theme-toggle-seen";
export const TEXT_KEY = "malesan-text";

export const THEME_CHROME = { dark: "#080808", soft: "#080808" } as const;

export const THEME_META_MARK = "data-malesan-theme";

/**
 * Ensures dark theme is applied on the first frame.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.add("dark");
  var m = document.createElement("meta");
  m.setAttribute("name","theme-color");
  m.setAttribute(${JSON.stringify(THEME_META_MARK)},"");
  m.setAttribute("content", ${JSON.stringify(THEME_CHROME.dark)});
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

/**
 * Client Console Security Shield Warning.
 * Deterrent banner against console tamper / untrusted script execution.
 */
export const SECURITY_SHIELD_SCRIPT = `
(function(){try{
  if (typeof window !== "undefined" && window.console) {
    console.log("%c🛡️ MALESAN SECURITY SHIELD%c\\nAplikasi ini dilindungi oleh arsitektur server-side zero-leakage RLS. Dilarang menempelkan skrip atau kode tidak tepercaya di sini.", "color:#ff8a3d;font-size:14px;font-weight:bold;", "color:#a3a3a3;font-size:11px;");
  }
}catch(e){}})();
`;
