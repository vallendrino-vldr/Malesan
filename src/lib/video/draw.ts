"use client";

import { activeAt, type CaptionStyle, type Line } from "./captions";
import { cropFocusAt, trackedCoverCrop } from "./face-track";
import { coverCrop, type VideoLayout } from "./layout";

export { coverCrop, frameSize } from "./layout";
export type { VideoLayout, VideoFocus, VideoRatio, ClarityFilter } from "./layout";

/**
 * Shared canvas drawing primitives used by both export pipelines. Keeping every
 * pixel operation here guarantees the deterministic WebCodecs path and the
 * MediaRecorder fallback produce the same picture.
 */

export const even = (n: number) => (n % 2 === 0 ? n : n - 1);

/**
 * Honour the chosen preset but never fall below what the resolution needs to look
 * clean. Grain is almost always starvation: ~0.3 bits per pixel per second is the
 * floor that keeps text edges sharp through the codec.
 */
export function bitrateFor(mbps: number, _W?: number, _H?: number, _fps?: number): number {
  void _W;
  void _H;
  void _fps;
  const base = mbps && mbps >= 14 ? mbps : 20.0;
  const targetMbps = Math.max(14.0, Math.min(35.0, base));
  return Math.round(targetMbps * 1_000_000);
}

/** Paint one complete export frame: video, caption, watermark. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: CanvasImageSource,
  lines: Line[],
  t: number,
  style: CaptionStyle,
  W: number,
  H: number,
  watermark: boolean,
  layout: VideoLayout = { ratio: "9:16", focus: "center" },
) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const source = video as CanvasImageSource & {
    videoWidth?: number;
    videoHeight?: number;
    displayWidth?: number;
    displayHeight?: number;
    width?: number;
    height?: number;
  };
  const sw = source.videoWidth || source.displayWidth || source.width || W;
  const sh = source.videoHeight || source.displayHeight || source.height || H;

  ctx.save();
  try {
    const filter = layout.filter ?? "ultra_hd";
    if (filter === "ultra_hd" || filter === "wink_hd") {
      // Studio Ultra-HD: Micro-contrast enhancement + spatial edge definitions + crisp clarity
      ctx.filter = typeof document !== "undefined" && document.getElementById("malesan-ultra-hd")
        ? "url(#malesan-ultra-hd) contrast(1.12) brightness(1.02) saturate(1.12)"
        : "contrast(1.16) brightness(1.02) saturate(1.14)";
    } else if (filter === "fyp_pop") {
      // Viral Color Pop: Vibrant colors, punchy highlights for TikTok/Reels/Shorts
      ctx.filter = "contrast(1.20) brightness(1.03) saturate(1.24)";
    } else if (filter === "clean_denoise" || filter === "soft_clean") {
      // Smooth De-Noise: Suppresses harsh sensor noise and provides subtle smoothing
      ctx.filter = typeof document !== "undefined" && document.getElementById("malesan-clean-denoise")
        ? "url(#malesan-clean-denoise) contrast(1.08) brightness(1.02) saturate(1.05)"
        : "contrast(1.08) brightness(1.02) saturate(1.05)";
    } else {
      ctx.filter = "none";
    }
  } catch {}

  if (layout.ratio === "9:16" && layout.focus === "podcast_split") {
    // 1. Top half: Left speaker / Host (Custom or Auto-Detected Pan)
    const topPanX = layout.splitTopPanX ?? 0.25;
    const topCrop = trackedCoverCrop(sw, sh, W, H / 2, { time: t, x: topPanX, y: 0.45, confidence: 1.0 });
    ctx.drawImage(video, topCrop.sx, topCrop.sy, topCrop.sw, topCrop.sh, 0, 0, W, H / 2);

    // 2. Bottom half: Right speaker / Guest (Custom or Auto-Detected Pan)
    const bottomPanX = layout.splitBottomPanX ?? 0.75;
    const bottomCrop = trackedCoverCrop(sw, sh, W, H / 2, { time: t, x: bottomPanX, y: 0.45, confidence: 1.0 });
    ctx.drawImage(video, bottomCrop.sx, bottomCrop.sy, bottomCrop.sw, bottomCrop.sh, 0, H / 2, W, H / 2);

    // 3. Separator hairline with subtle ambient shadow
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.lineWidth = Math.max(3, Math.round(H * 0.002));
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else {
    const crop = layout.trajectory?.length
      ? trackedCoverCrop(sw, sh, W, H, cropFocusAt(layout.trajectory, t), layout.zoom ?? 1.0)
      : layout.panX !== undefined
      ? trackedCoverCrop(sw, sh, W, H, { time: t, x: layout.panX, y: 0.45, confidence: 1.0 }, layout.zoom ?? 1.0)
      : coverCrop(sw, sh, W, H, layout.focus);
    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, W, H);
  }
  ctx.restore();

  const a = activeAt(lines, t);
  if (a) {
    const effectiveStyle = layout.subtitleY != null ? { ...style, position: layout.subtitleY } : style;
    drawCaption(ctx, a.line, t, effectiveStyle, W, H);
  }
  if (watermark) drawWatermark(ctx, W, H);
}

/**
 * Draw the caption for time `t`.
 *
 * "word" mode shows exactly the word being spoken, one at a time. "line" mode
 * shows the whole caption line at once with the spoken word lit. The preview
 * mirrors this, so what is seen is what is burned.
 */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  line: Line,
  t: number,
  style: CaptionStyle,
  W: number,
  H: number,
) {
  const spokenCount = line.words.filter((w) => w.start <= t + 0.01).length;
  if (!spokenCount) return;
  const currentIdx = spokenCount - 1;
  const activeWord = line.words[currentIdx];

  ctx.save();
  if (style.animation !== "none") {
    const elapsed = Math.max(0, t - activeWord.start);
    const enter = Math.min(1, elapsed / 0.14);
    // Ease-out keeps the movement punchy without a distracting bounce.
    const eased = 1 - Math.pow(1 - enter, 3);
    if (style.animation === "fade") ctx.globalAlpha = eased;
    if (style.animation === "pop") {
      const scale = 0.82 + eased * 0.18;
      ctx.translate(W / 2, H * style.position);
      ctx.scale(scale, scale);
      ctx.translate(-W / 2, -H * style.position);
    }
  }

  const render =
    style.mode === "word"
      ? [{ text: line.words[currentIdx].word, active: true }]
      : line.words.map((w, i) => ({ text: w.word, active: i === currentIdx }));

  const fontPx = Math.round(H * (style.mode === "word" ? 0.048 : 0.038) * style.fontScale);
  ctx.font = `${style.bold ? 800 : 600} ${fontPx}px "${style.fontFamily}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const space = Math.max(fontPx * 0.28, ctx.measureText(" ").width);
  const maxW = W * 0.86;

  const rows: { words: { text: string; idx: number; w: number; scale: number }[]; width: number }[] = [];
  let row: { text: string; idx: number; w: number; scale: number }[] = [];
  let rowW = 0;
  render.forEach((w, i) => {
    const scale = w.active ? style.activeScale : 1;
    const tw = ctx.measureText(w.text).width * scale;
    const add = row.length ? space + tw : tw;
    if (rowW + add > maxW && row.length) {
      rows.push({ words: row, width: rowW });
      row = [];
      rowW = 0;
    }
    row.push({ text: w.text, idx: i, w: tw, scale });
    rowW += row.length === 1 ? tw : space + tw;
  });
  if (row.length) rows.push({ words: row, width: rowW });

  const lineH = Math.round(fontPx * 1.45);
  const totalH = rows.length * lineH;
  const cy0 = H * style.position - totalH / 2 + lineH / 2;

  rows.forEach((r, ri) => {
    const cy = cy0 + ri * lineH;
    let x = W / 2 - r.width / 2;
    if (style.style === "box") {
      const pad = fontPx * 0.32;
      roundRect(ctx, x - pad, cy - lineH * 0.44, r.width + pad * 2, lineH * 0.88, fontPx * 0.24);
      ctx.fillStyle = "rgba(12,10,8,0.72)";
      ctx.fill();
    }
    for (const word of r.words) {
      const cx = x + word.w / 2;
      const active = render[word.idx].active;
      const color = active ? style.highlightColor : style.textColor;
      ctx.font = `${style.bold ? 800 : 700} ${fontPx}px "${style.fontFamily}", sans-serif`;
      if (style.style === "outline") {
        ctx.lineJoin = "round";
        ctx.lineWidth = fontPx * 0.18;
        ctx.strokeStyle = "rgba(0,0,0,0.95)";
        ctx.strokeText(word.text, cx, cy);
      } else if (style.style === "plain") {
        ctx.shadowColor = "rgba(0,0,0,0.95)";
        ctx.shadowBlur = fontPx * 0.35;
      }
      if (active && style.activeGlow) {
        ctx.shadowColor = style.highlightColor;
        ctx.shadowBlur = fontPx * 0.55;
      }
      ctx.fillStyle = color;
      ctx.fillText(word.text, cx, cy);
      ctx.shadowBlur = 0;
      x += word.w + space;
    }
  });
  ctx.restore();
}

/**
 * Ultra-luxury watermark badge — frosted obsidian glass pill with glowing amber sparkle
 * and crisp two-tone brand typography (malesan.my.id).
 */
export function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const px = Math.max(13, Math.round(H * 0.016));
  const brandName = "malesan";
  const brandExt = ".my.id";
  
  ctx.save();
  ctx.font = `800 ${px}px "Poppins", "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const brandW = ctx.measureText(brandName).width;
  ctx.font = `700 ${px}px "Poppins", "Plus Jakarta Sans", system-ui, sans-serif`;
  const extW = ctx.measureText(brandExt).width;

  const iconSize = px * 0.9;
  const gap = px * 0.45;
  const padX = px * 0.9;
  const padY = px * 0.65;
  const pillW = padX * 2 + iconSize + gap + brandW + extW;
  const pillH = px + padY * 2;

  const x = Math.round(W * 0.045);
  const y = Math.round(H * 0.035);
  const cy = y + pillH / 2;

  // 1. Soft ambient shadow
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = px * 0.8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = px * 0.25;

  // 2. Frosted obsidian pill background
  roundRect(ctx, x, y, pillW, pillH, pillH / 2);
  const bgGrad = ctx.createLinearGradient(x, y, x + pillW, y + pillH);
  bgGrad.addColorStop(0, "rgba(20, 16, 13, 0.82)");
  bgGrad.addColorStop(1, "rgba(35, 26, 18, 0.70)");
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Reset shadow for crisp borders & text
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // 3. Luxurious hairline border with ember highlight
  ctx.lineWidth = Math.max(1.2, px * 0.07);
  const borderGrad = ctx.createLinearGradient(x, y, x + pillW, y + pillH);
  borderGrad.addColorStop(0, "rgba(255, 170, 80, 0.40)");
  borderGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.18)");
  borderGrad.addColorStop(1, "rgba(255, 138, 61, 0.25)");
  ctx.strokeStyle = borderGrad;
  ctx.stroke();

  // 4. Draw luxury 4-point Ember sparkle brandmark
  const iconX = x + padX + iconSize / 2;
  const iconY = cy;
  const r = iconSize * 0.48;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(iconX, iconY - r);
  ctx.quadraticCurveTo(iconX, iconY, iconX + r, iconY);
  ctx.quadraticCurveTo(iconX, iconY, iconX, iconY + r);
  ctx.quadraticCurveTo(iconX, iconY, iconX - r, iconY);
  ctx.quadraticCurveTo(iconX, iconY, iconX, iconY - r);
  ctx.closePath();

  const iconGrad = ctx.createLinearGradient(iconX - r, iconY - r, iconX + r, iconY + r);
  iconGrad.addColorStop(0, "#ffb066");
  iconGrad.addColorStop(1, "#ff6b00");
  ctx.fillStyle = iconGrad;
  ctx.shadowColor = "rgba(255, 138, 61, 0.65)";
  ctx.shadowBlur = px * 0.4;
  ctx.fill();
  ctx.restore();

  // 5. Crisp typography ("malesan" in pure white, ".ai" in glowing ember)
  const textStartX = x + padX + iconSize + gap;
  
  ctx.font = `800 ${px}px "Poppins", "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.fillText(brandName, textStartX, cy + px * 0.02);

  ctx.font = `800 ${px}px "Poppins", "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillStyle = "#ff9a47";
  ctx.shadowColor = "rgba(255, 138, 61, 0.4)";
  ctx.shadowBlur = 4;
  ctx.fillText(brandExt, textStartX + brandW, cy + px * 0.02);

  ctx.restore();
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
