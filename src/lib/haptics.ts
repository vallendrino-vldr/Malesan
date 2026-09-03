"use client";

/**
 * Tactile Web Haptics Engine
 * Provides subtle micro-vibrations on mobile touch devices (Android APK, PWA, mobile browser)
 * for a satisfying, premium physical feel on user interactions.
 */

export const haptic = {
  /** Subtle crisp tap (10ms) for buttons, tabs, and switches */
  tap: () => {
    try {
      if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10);
      }
    } catch {}
  },

  /** Gentle tick (6ms) for sliders, segment pickers, and scrubbers */
  tick: () => {
    try {
      if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(6);
      }
    } catch {}
  },

  /** Selection click (8ms) for radio/segment buttons */
  selection: () => {
    try {
      if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(8);
      }
    } catch {}
  },

  /** Impact feedback with strength scaling */
  impact: (style: "light" | "medium" | "heavy" = "medium") => {
    try {
      if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
        const duration = style === "light" ? 8 : style === "heavy" ? 25 : 15;
        navigator.vibrate(duration);
      }
    } catch {}
  },

  /** Double-pulse for successful operations (copy, save, export complete) */
  success: () => {
    try {
      if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([12, 35, 18]);
      }
    } catch {}
  },

  /** Distinct alert pulse for warnings or limits reached */
  warning: () => {
    try {
      if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([25, 40, 25]);
      }
    } catch {}
  },

  /** Error feedback pulse */
  error: () => {
    try {
      if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([30, 50, 30]);
      }
    } catch {}
  },
};
