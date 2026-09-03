import type { CropKeyframe } from "./face-track";
import type { ManualKeyframe } from "./keyframe-engine";

export type VideoRatio = "9:16" | "1:1" | "16:9";
export type VideoFocus = "auto" | "center" | "left" | "right" | "face_track" | "podcast_split" | "manual_keyframe" | "podcast_dynamic";
export type ClarityFilter =
  | "original"
  | "clean_pro"
  | "warm_creator"
  | "cinematic"
  | "ultra_hd"
  | "fyp_pop"
  | "clean_denoise"
  | "wink_hd"
  | "soft_clean";

export type VideoLayout = {
  ratio: VideoRatio;
  focus: VideoFocus;
  filter?: ClarityFilter;
  trajectory?: readonly CropKeyframe[];
  manualKeyframes?: readonly ManualKeyframe[];
  zoom?: number;
  panX?: number;
  splitTopPanX?: number;
  splitBottomPanX?: number;
  subtitleY?: number;
  subtitleX?: number;
};

export const ratioValue = (ratio: VideoRatio) => {
  if (ratio === "9:16") return 9 / 16;
  if (ratio === "16:9") return 16 / 9;
  return 1;
};

export function frameSize(_sw?: number, _sh?: number, ratio: VideoRatio = "9:16"): { W: number; H: number } {
  void _sw;
  void _sh;
  if (ratio === "9:16") return { W: 1080, H: 1920 };
  if (ratio === "1:1") return { W: 1080, H: 1080 };
  return { W: 1920, H: 1080 };
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
