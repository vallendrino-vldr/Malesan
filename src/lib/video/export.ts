"use client";

import { activeAt, type CaptionStyle, type Line } from "./captions";
import { bitrateFor, drawFrame, frameSize } from "./draw";
import { canUseWebCodecs, exportFrameByFrame, UnsupportedEncoder } from "./encode";

/**
 * Burn captions into a video, in the browser, for real.
 *
 * Two paths, in this order:
 *
 * 1. **Deterministic (encode.ts, WebCodecs).** The real one. Walks the video frame
 *    by frame at exact timestamps and encodes each frame with the time it belongs
 *    at, muxing straight to disk. Smooth output, captions locked to the audio, no
 *    dependence on how fast the phone is.
 *
 * 2. **Real-time (below, MediaRecorder).** The old path, kept ONLY for browsers
 *    with no WebCodecs (Firefox today, older Safari). It plays the video and
 *    records the canvas, so on a slow device it drops frames and the captions
 *    drift — which is exactly why it is no longer the default. It still produces a
 *    usable file, which beats refusing to export at all.
 *
 * ffmpeg.wasm is NOT involved in either path; it is used only to extract audio for
 * transcription. An earlier version burned captions with ffmpeg's `ass` filter and
 * it silently did nothing (that core carries no libass and no font), so the export
 * was the untouched original. Drawing the pixels ourselves cannot no-op.
 */

export type ExportOpts = {
  file: File;
  lines: Line[];
  style: CaptionStyle;
  /** Target video bitrate in Mbps. Resolution comes from the source and is never
   *  reduced — see draw.ts frameSize. */
  bitrateMbps: number;
  /** Burn the malesan.my.id mark. False only after the credit was charged. */
  watermark: boolean;
  onProgress: (ratio: number) => void;
  /** Short label for the blocking overlay, so the user knows what is happening. */
  onStage?: (stage: string) => void;
};

export async function exportBurnedVideo(
  opts: ExportOpts,
): Promise<{ blob: Blob; ext: string }> {
  if (canUseWebCodecs()) {
    try {
      return await exportFrameByFrame(opts);
    } catch (e) {
      // Only a genuine "this browser cannot" falls back. A mid-render failure is
      // reported, because silently restarting on the slow path would look like a
      // hang and produce the choppy file this replaced.
      if (!(e instanceof UnsupportedEncoder)) throw e;
    }
  }
  return exportRealtime(opts);
}

/* ------------------------------------------------- legacy real-time fallback */

async function exportRealtime(opts: ExportOpts): Promise<{ blob: Blob; ext: string }> {
  const { file, lines, style, bitrateMbps, watermark, onProgress, onStage } = opts;
  onStage?.("Nge-render (mode kompatibel)");

  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.playsInline = true;
  // Muted is what makes play() start reliably: a non-muted programmatic play,
  // after awaits have broken the click's user-activation, is rejected — and then
  // the code awaits an "ended" that never comes and hangs forever. Audio is still
  // captured from the element's stream regardless of muted.
  video.muted = true;
  await once(video, "loadedmetadata");

  const { W, H } = frameSize(video.videoWidth || 1080, video.videoHeight || 1920);

  try {
    await document.fonts.load(`${style.bold ? 800 : 600} ${Math.round(H * 0.06)}px "${style.fontFamily}"`);
    await document.fonts.ready;
  } catch {
    /* fonts are a nicety here, not a reason to fail the export */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas gak kebentuk di browser ini.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // captureStream(0): frames are produced only when we ask, via requestFrame, so
  // every recorded frame is a finished draw rather than a timer sampling a
  // half-updated canvas.
  const canvasStream = canvas.captureStream(0);
  const vTrack = canvasStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
  const vStream = getStream(video);
  if (vStream) for (const t of vStream.getAudioTracks()) canvasStream.addTrack(t);

  const bits = bitrateFor(bitrateMbps, W, H, 30);

  // Release every heavy resource this path held, on success and on failure alike.
  const release = () => {
    try { canvasStream.getTracks().forEach((t) => t.stop()); } catch {}
    try { vStream?.getTracks().forEach((t) => t.stop()); } catch {}
    try { video.pause(); } catch {}
    try { URL.revokeObjectURL(video.src); } catch {}
    video.removeAttribute("src");
    try { video.load(); } catch {}
    canvas.width = 0;
    canvas.height = 0;
  };

  const mime = pickMime();
  const rec = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: bits });

  // Stream the encoded output to disk rather than piling every chunk on the JS
  // heap — with no timeslice and an in-memory array, the heap briefly held the
  // whole video twice, which is what OOM-crashed phones ("Aw Snap").
  const sink = await makeSink(mime);
  let writeChain: Promise<void> = Promise.resolve();
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) {
      const chunk = e.data;
      writeChain = writeChain.then(() => sink.write(chunk));
    }
  };
  const stopped = new Promise<void>((res) => (rec.onstop = () => res()));

  const paint = (t: number) => {
    drawFrame(ctx, video, lines, t, style, W, H, watermark);
    vTrack?.requestFrame?.();
    onProgress(Math.min(0.999, t / (video.duration || 1)));
  };

  rec.start(1000);
  try {
    await video.play();
  } catch {
    try { rec.stop(); } catch {}
    await sink.finish().catch(() => {});
    release();
    throw new Error("Browser nolak play video buat render. Coba lagi atau pakai Chrome.");
  }

  // One canvas frame per decoded video frame where possible, so the capture stays
  // on the media element's own clock — the same clock the audio rides.
  const rvfc = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  };
  let raf = 0;
  await new Promise<void>((resolve) => {
    video.addEventListener("ended", () => resolve(), { once: true });
    if (typeof rvfc.requestVideoFrameCallback === "function") {
      const step = (_now: number, meta: { mediaTime: number }) => {
        if (video.ended) return;
        paint(meta.mediaTime);
        rvfc.requestVideoFrameCallback!(step);
      };
      rvfc.requestVideoFrameCallback!(step);
    } else {
      const step = () => {
        if (video.ended) return;
        paint(video.currentTime);
        raf = requestAnimationFrame(step);
      };
      step();
    }
  });
  cancelAnimationFrame(raf);

  drawFrame(ctx, video, lines, video.duration || 0, style, W, H, watermark);
  vTrack?.requestFrame?.();
  rec.stop();
  await stopped;
  await writeChain;
  const blob = await sink.finish();
  release();

  onProgress(1);
  return { blob, ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
}

type Sink = { write: (b: Blob) => Promise<void>; finish: () => Promise<Blob> };

/**
 * Where the recorder's output goes. OPFS streams it to a real file on disk so the
 * encoded video never accumulates on the JS heap; `getFile()` then hands back a
 * disk-backed File the download reads from disk. Degrades to an in-memory array
 * only where OPFS is unavailable.
 */
async function makeSink(mime: string): Promise<Sink> {
  try {
    const root = await navigator.storage?.getDirectory?.();
    if (root) {
      const handle = await root.getFileHandle("malesan-export.tmp", { create: true });
      const writable = await handle.createWritable();
      return {
        write: (b) => writable.write(b),
        finish: async () => {
          await writable.close();
          return handle.getFile();
        },
      };
    }
  } catch {
    /* OPFS blocked or unsupported — fall through to the in-memory sink */
  }
  const chunks: BlobPart[] = [];
  return {
    write: async (b) => {
      chunks.push(b);
    },
    finish: async () => new Blob(chunks, { type: mime }),
  };
}

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

// Re-exported so the preview overlay and the export draw from one source.
export { activeAt };
export type { CaptionStyle, Line };
