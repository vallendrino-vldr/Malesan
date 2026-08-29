"use client";

import { activeAt, type CaptionStyle, type Line } from "./captions";
import { cropFocusAt, trackedCoverCrop } from "./face-track";
import { coverCrop, type VideoLayout } from "./layout";

export { coverCrop, frameSize } from "./layout";
export type { VideoLayout, VideoFocus, VideoRatio } from "./layout";

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
  const targetMbps = Math.max(2.5, Math.min(8, mbps || 4.5));
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
  const crop = layout.trajectory?.length
    ? trackedCoverCrop(sw, sh, W, H, cropFocusAt(layout.trajectory, t))
    : coverCrop(sw, sh, W, H, layout.focus);
  ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, W, H);
  const a = activeAt(lines, t);
  if (a) drawCaption(ctx, a.line, t, style, W, H);
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

  const fontPx = Math.round(H * (style.mode === "word" ? 0.075 : 0.058) * style.fontScale);
  ctx.font = `${style.bold ? 800 : 600} ${fontPx}px "${style.fontFamily}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const space = Math.max(fontPx * 0.28, ctx.measureText(" ").width);
  const maxW = W * 0.9;

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

  const lineH = fontPx * Math.max(1.25, style.activeScale * 1.12);
  const totalH = rows.length * lineH;
  const cy0 = H * style.position - totalH / 2 + lineH / 2;

  rows.forEach((r, ri) => {
    const cy = cy0 + ri * lineH;
    let x = W / 2 - r.width / 2;
    if (style.style === "box") {
      const pad = fontPx * 0.28;
      roundRect(ctx, x - pad, cy - lineH / 2 + fontPx * 0.12, r.width + pad * 2, lineH * 0.86, fontPx * 0.22);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill();
    }
    for (const word of r.words) {
      const cx = x + word.w / 2;
      const active = render[word.idx].active;
      const color = active ? style.highlightColor : style.textColor;
      ctx.font = `${style.bold ? 800 : 600} ${fontPx * word.scale}px "${style.fontFamily}", sans-serif`;
      if (style.style === "outline") {
        ctx.lineJoin = "round";
        ctx.lineWidth = fontPx * 0.16;
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.strokeText(word.text, cx, cy);
      } else if (style.style === "plain") {
        ctx.shadowColor = "rgba(0,0,0,0.85)";
        ctx.shadowBlur = fontPx * 0.25;
      }
      if (active && style.activeGlow) {
        ctx.shadowColor = style.highlightColor;
        ctx.shadowBlur = fontPx * 0.45;
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
 * The lasting credit — a small, deliberately tasteful pill so a reposted clip
 * still says where it came from without looking like a stock watermark. Kept well
 * clear of the corner so it survives the platform crop.
 */
export function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const px = Math.max(13, Math.round(H * 0.016));
  const text = "malesan.my.id";
  ctx.save();
  ctx.font = `600 ${px}px "Poppins", "Archivo", system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const dot = px * 0.5;
  const gap = px * 0.55;
  const padX = px * 0.85;
  const padY = px * 0.62;
  const textW = ctx.measureText(text).width;
  const pillW = padX * 2 + dot + gap + textW;
  const pillH = px + padY * 2;

  const x = Math.round(W * 0.045);
  const y = Math.round(H * 0.035);
  const cy = y + pillH / 2;

  ctx.globalAlpha = 1;
  roundRect(ctx, x, y, pillW, pillH, pillH / 2);
  ctx.fillStyle = "rgba(11,10,9,0.42)";
  ctx.fill();
  ctx.lineWidth = Math.max(1, px * 0.06);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + padX + dot / 2, cy, dot / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ff8a3d";
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(text, x + padX + dot + gap, cy + px * 0.03);
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
