import type { CropKeyframe } from "./face-track";

export type VideoRatio = "9:16" | "1:1" | "16:9";
export type VideoFocus = "left" | "center" | "right";
export type VideoLayout = { ratio: VideoRatio; focus: VideoFocus; trajectory?: readonly CropKeyframe[] };

const even = (n: number) => (n % 2 === 0 ? n : n - 1);

export const ratioValue = (ratio: VideoRatio) => {
  if (ratio === "9:16") return 9 / 16;
  if (ratio === "16:9") return 16 / 9;
  return 1;
};

export function frameSize(sw: number, sh: number, ratio: VideoRatio = "9:16"): { W: number; H: number } {
  const short = Math.min(sw, sh);
  const targetShort = Math.max(720, Math.min(1080, short));
  const value = ratioValue(ratio);
  return value <= 1
    ? { W: even(Math.round(targetShort)), H: even(Math.round(targetShort / value)) }
    : { W: even(Math.round(targetShort * value)), H: even(Math.round(targetShort)) };
}

export function coverCrop(
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  focus: VideoFocus,
): { sx: number; sy: number; sw: number; sh: number } {
  const sourceRatio = sw / sh;
  const targetRatio = dw / dh;
  if (sourceRatio > targetRatio) {
    const cropWidth = sh * targetRatio;
    const maxX = sw - cropWidth;
    const sx = focus === "left" ? 0 : focus === "right" ? maxX : maxX / 2;
    return { sx, sy: 0, sw: cropWidth, sh };
  }
  const cropHeight = sw / targetRatio;
  return { sx: 0, sy: (sh - cropHeight) / 2, sw, sh: cropHeight };
}

/** MP4 tracks must begin at timestamp zero even when the browser's first decoded frame does not. */
export function normalizedTimestampUs(mediaTime: number, firstMediaTime: number): number {
  return Math.max(0, Math.round((mediaTime - firstMediaTime) * 1_000_000));
}
