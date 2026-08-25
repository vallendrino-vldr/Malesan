/**
 * 📳 High-End Multi-Profile Haptic & Sensory Feedback Engine
 *
 * Provides tactile micro-vibrations across Android Chrome, Samsung Internet,
 * and an ultra-subtle synthesized micro-transient acoustic taptic feedback for
 * iOS Safari / WebKit browsers where navigator.vibrate is restricted.
 */

type HapticIntensity = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "tick";

// High-end vibration timing recipes (durations in ms)
const PATTERNS: Record<HapticIntensity, number | number[]> = {
  light: 6,                     // Micro crisp tick (tabs, subtle buttons)
  medium: 12,                   // Clean tactile pop (cards, selections)
  heavy: 20,                    // Firm punch (generate, primary actions)
  success: [10, 35, 14],        // Double luxury pulse (copy, done)
  warning: [18, 40, 18],        // Distinct alert rumble
  error: [22, 45, 22],          // Error thud
  tick: 4,                      // Teleprompter pacing tick
};

let audioCtx: AudioContext | null = null;

function playAcousticTapticTick(intensity: HapticIntensity) {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    const freq = intensity === "heavy" ? 55 : intensity === "success" ? 85 : 70;
    const volume = intensity === "heavy" ? 0.08 : intensity === "light" ? 0.03 : 0.05;
    const duration = intensity === "success" ? 0.025 : 0.015;

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {
    // Graceful silent fallback
  }
}

export function triggerHaptic(type: HapticIntensity = "light") {
  if (typeof window === "undefined") return;

  let vibrated = false;
  if ("vibrate" in navigator && typeof navigator.vibrate === "function") {
    try {
      const pattern = PATTERNS[type] ?? PATTERNS.light;
      vibrated = navigator.vibrate(pattern);
    } catch {
      vibrated = false;
    }
  }

  // If navigator.vibrate is unsupported (e.g. iOS Safari) or failed, trigger acoustic taptic micro-tick
  if (!vibrated) {
    playAcousticTapticTick(type);
  }
}

export const haptic = {
  tap: () => triggerHaptic("light"),
  selection: () => triggerHaptic("medium"),
  impact: () => triggerHaptic("heavy"),
  success: () => triggerHaptic("success"),
  warning: () => triggerHaptic("warning"),
  error: () => triggerHaptic("error"),
  tick: () => triggerHaptic("tick"),
};
