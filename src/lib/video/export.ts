"use client";

import { activeAt, type CaptionStyle, type Line } from "./captions";

/**
 * Burn captions into a video in the browser, for real, by drawing every frame.
 *
 * The first version used ffmpeg's `ass` subtitle filter, which silently did
 * nothing: the default ffmpeg.wasm core ships without libass and without a font,
 * so the filter was a no-op and the exported file was the untouched original.
 * That is the bug this replaces.
 *
 * This path cannot no-op: it paints each video frame onto a canvas, draws the
 * caption on top with the browser's own text engine (so any loaded font, any
 * colour, per-word reveal all just work), and records the canvas with
 * MediaRecorder. The pixels are the caption. It also means we are not at the
 * mercy of what the wasm core was compiled with.
 *
 * Cost: recording is real-time — a 60s clip takes ~60s — because MediaRecorder
 * captures a live stream. That is the honest price of a burn-in that actually
 * happens, and the progress bar tracks it.
 */

export type ExportOpts = {
  file: File;
  lines: Line[];
  style: CaptionStyle;
  width: number;
  height: number;
  /** Target video bitrate in Mbps — the "compress" control. */
  bitrateMbps: number;
  onProgress: (ratio: number) => void;
};

export async function exportBurnedVideo(
  opts: ExportOpts,
): Promise<{ blob: Blob; ext: string }> {
  const { file, lines, style, width: W, height: H, bitrateMbps, onProgress } = opts;

  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.playsInline = true;
  // Keep audio flowing into the capture; a muted element yields a silent track
  // in some engines. Volume low so the export does not blast the room.
  video.volume = 0.001;
  await once(video, "loadedmetadata");

  // Make sure the chosen font is actually ready before we draw a single frame,
  // or the first seconds render in a fallback face.
  try {
    await document.fonts.load(`${style.bold ? 800 : 600} ${Math.round(H * 0.055)}px "${style.fontFamily}"`);
    await document.fonts.ready;
  } catch {
    /* fonts are a nicety here, not a reason to fail the export */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas gak kebentuk di browser ini.");

  const canvasStream = canvas.captureStream(30);
  const vStream = getStream(video);
  if (vStream) for (const t of vStream.getAudioTracks()) canvasStream.addTrack(t);

  const mime = pickMime();
  const rec = new MediaRecorder(canvasStream, {
    mimeType: mime,
    videoBitsPerSecond: Math.round(bitrateMbps * 1_000_000),
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((res) => (rec.onstop = () => res()));

  let raf = 0;
  const render = () => {
    ctx.drawImage(video, 0, 0, W, H);
    const a = activeAt(lines, video.currentTime);
    if (a) drawCaption(ctx, a.line, video.currentTime, style, W, H);
    drawWatermark(ctx, W, H);
    onProgress(Math.min(0.999, video.currentTime / (video.duration || 1)));
    if (!video.ended) raf = requestAnimationFrame(render);
  };

  rec.start();
  await video.play();
  render();
  await once(video, "ended");
  cancelAnimationFrame(raf);
  // One last frame so the final word is not clipped, then flush.
  ctx.drawImage(video, 0, 0, W, H);
  drawWatermark(ctx, W, H);
  rec.stop();
  await stopped;
  URL.revokeObjectURL(video.src);

  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  onProgress(1);
  return { blob: new Blob(chunks, { type: mime }), ext };
}

/** mp4 straight out of MediaRecorder when the browser can (recent Chromium),
 *  else webm. No ffmpeg transcode — the wasm core cannot be relied on to carry
 *  an H.264 encoder, and a real webm beats a broken mp4. */
function pickMime(): string {
  const S = (t: string) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t);
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((t) => S(t)) ?? "video/webm";
}

function getStream(v: HTMLVideoElement): MediaStream | null {
  const el = v as HTMLVideoElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  try {
    if (el.captureStream) return el.captureStream();
    if (el.mozCaptureStream) return el.mozCaptureStream();
  } catch {
    /* audio-less export is still a valid export */
  }
  return null;
}

function once(el: HTMLElement, ev: string): Promise<void> {
  return new Promise((res, rej) => {
    const ok = () => {
      cleanup();
      res();
    };
    const bad = () => {
      cleanup();
      rej(new Error(`${ev} gagal`));
    };
    const cleanup = () => {
      el.removeEventListener(ev, ok);
      el.removeEventListener("error", bad);
    };
    el.addEventListener(ev, ok, { once: true });
    el.addEventListener("error", bad, { once: true });
  });
}

/** Per-word reveal: only words already spoken are shown, the latest one lit. */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  line: Line,
  t: number,
  style: CaptionStyle,
  W: number,
  H: number,
) {
  const revealed = line.words.filter((w) => w.start <= t + 0.01);
  if (!revealed.length) return;
  const activeIdx = revealed.length - 1;

  const fontPx = Math.round(H * 0.058);
  ctx.font = `${style.bold ? 800 : 600} ${fontPx}px "${style.fontFamily}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const space = ctx.measureText(" ").width;
  const maxW = W * 0.9;

  // Wrap revealed words into lines that fit.
  const rows: { words: { text: string; idx: number; w: number }[]; width: number }[] = [];
  let row: { text: string; idx: number; w: number }[] = [];
  let rowW = 0;
  revealed.forEach((w, i) => {
    const tw = ctx.measureText(w.word).width;
    const add = row.length ? space + tw : tw;
    if (rowW + add > maxW && row.length) {
      rows.push({ words: row, width: rowW });
      row = [];
      rowW = 0;
    }
    row.push({ text: w.word, idx: i, w: tw });
    rowW += row.length === 1 ? tw : space + tw;
  });
  if (row.length) rows.push({ words: row, width: rowW });

  const lineH = fontPx * 1.25;
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
      const color = word.idx === activeIdx ? style.highlightColor : style.textColor;
      if (style.style === "outline") {
        ctx.lineJoin = "round";
        ctx.lineWidth = fontPx * 0.16;
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.strokeText(word.text, cx, cy);
      } else if (style.style === "plain") {
        ctx.shadowColor = "rgba(0,0,0,0.85)";
        ctx.shadowBlur = fontPx * 0.25;
      }
      ctx.fillStyle = color;
      ctx.fillText(word.text, cx, cy);
      ctx.shadowBlur = 0;
      x += word.w + space;
    }
  });
}

/** The lasting credit: a small mark so a reposted clip still says where it came
 *  from. Subtle enough not to fight the content, always there. */
function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const px = Math.max(14, Math.round(H * 0.022));
  ctx.save();
  ctx.font = `700 ${px}px "Archivo", system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = px * 0.3;
  ctx.fillText("malesan.my.id", W - px * 0.8, H - px * 0.8);
  ctx.restore();
}

function roundRect(
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
