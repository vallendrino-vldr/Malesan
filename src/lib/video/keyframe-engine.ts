"use client";

import type { CropKeyframe } from "./face-track";

export type ManualKeyframe = {
  id: string;
  time: number; // in seconds
  panX: number; // 0 (far left) to 1 (far right), 0.5 is center
  panY: number; // 0 (top) to 1 (bottom), 0.45 is standard eye-level
  zoom: number; // 1.0 (default) to 1.8 (close-up)
  label?: string;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

/**
 * Interpolate manual keyframes across time with cinematic smoothstep easing.
 */
export function interpolateKeyframes(
  keyframes: readonly ManualKeyframe[],
  time: number,
  defaultPanX = 0.5,
  defaultPanY = 0.45,
  defaultZoom = 1.0,
): { panX: number; panY: number; zoom: number } {
  if (!keyframes.length) {
    return { panX: defaultPanX, panY: defaultPanY, zoom: defaultZoom };
  }

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  if (time <= sorted[0].time) {
    return { panX: sorted[0].panX, panY: sorted[0].panY, zoom: sorted[0].zoom };
  }

  if (time >= sorted[sorted.length - 1].time) {
    const last = sorted[sorted.length - 1];
    return { panX: last.panX, panY: last.panY, zoom: last.zoom };
  }

  let low = 0;
  let high = sorted.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (sorted[mid].time <= time) low = mid;
    else high = mid;
  }

  const a = sorted[low];
  const b = sorted[high];
  const delta = Math.max(0.001, b.time - a.time);
  const rawMix = clamp((time - a.time) / delta, 0, 1);
  // Smoothstep S-curve for organic camera glide without abrupt acceleration
  const mix = rawMix * rawMix * (3 - 2 * rawMix);

  return {
    panX: a.panX + (b.panX - a.panX) * mix,
    panY: a.panY + (b.panY - a.panY) * mix,
    zoom: a.zoom + (b.zoom - a.zoom) * mix,
  };
}

/**
 * Convert manual keyframes into standard CropKeyframe trajectory sampled across duration.
 */
export function manualKeyframesToTrajectory(
  keyframes: readonly ManualKeyframe[],
  duration: number = 60,
  step = 0.25,
): CropKeyframe[] {
  if (!keyframes.length) return [];
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const maxTime = Math.max(duration, sorted[sorted.length - 1].time);
  const trajectory: CropKeyframe[] = [];

  for (let t = 0; t <= maxTime + step; t += step) {
    const roundedTime = Number(t.toFixed(2));
    const { panX, panY } = interpolateKeyframes(sorted, roundedTime);
    trajectory.push({
      time: roundedTime,
      x: clamp(panX),
      y: clamp(panY),
      confidence: 1.0,
    });
  }

  return trajectory;
}
