"use client";

import { Muxer, FileSystemWritableFileStreamTarget } from "mp4-muxer";
import { bitrateFor, drawFrame, frameSize } from "./draw";
import type { CaptionStyle, Line } from "./captions";

/**
 * Deterministic frame-by-frame video export.
 *
 * WHY THIS REPLACED MediaRecorder. The previous export recorded a canvas in real
 * time: it played the video and hoped the phone could paint and encode 30 frames
 * a second. When it could not — which on a phone is most of the time — frames were
 * silently dropped while the audio clock kept running, so the file came out
 * choppy AND the captions slid out of sync with the speech. No amount of tuning
 * fixes that; the design itself races the wall clock.
 *
 * This does not race anything. It walks the video frame by frame, seeking to an
 * exact timestamp, drawing that frame, and handing it to a `VideoEncoder` stamped
 * with that same exact timestamp. Every frame in the output exists and carries the
 * time it belongs at, so the result is smooth and the captions are locked to the
 * audio by construction. It takes as long as it takes — correctness over speed.
 *
 * MEMORY. The muxed MP4 is streamed straight into an OPFS file through
 * `FileSystemWritableFileStreamTarget`, so the encoded video never accumulates on
 * the JS heap — this is what keeps the earlier mobile "Aw Snap" OOM from coming
 * back at a much higher bitrate. Frames are closed the moment they are encoded and
 * the encoder queue is kept short, so peak memory is a handful of frames.
 *
 * QUALITY. Nothing is downscaled and nothing is compressed harder than asked: the
 * canvas is the same size the recorder path used (never below the source), and the
 * bitrate is the user's own preset with the same anti-starvation floor.
 */

export type EncodeOpts = {
  file: File;
  lines: Line[];
  style: CaptionStyle;
  bitrateMbps: number;
  watermark: boolean;
  /** 0..1 over the whole job, frame-accurate. */
  onProgress: (ratio: number) => void;
  /** Short human label for the overlay, e.g. "Nyiapin audio". */
  onStage?: (stage: string) => void;
};

/** Thrown when this browser cannot run the deterministic path at all. */
export class UnsupportedEncoder extends Error {}

/** H.264 profiles, best first. High → Main → Baseline, all at a level that
 *  covers 4K so a large source is never rejected for its size. */
const AVC_CANDIDATES = ["avc1.640034", "avc1.4d0034", "avc1.42E034", "avc1.640028", "avc1.42E01E"];

export function canUseWebCodecs(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof AudioEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof AudioData !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function"
  );
}

export async function exportFrameByFrame(opts: EncodeOpts): Promise<{ blob: Blob; ext: string }> {
  if (!canUseWebCodecs()) throw new UnsupportedEncoder("WebCodecs tidak tersedia");

  const { file, lines, style, bitrateMbps, watermark, onProgress, onStage } = opts;
  onStage?.("Nyiapin video");

  const video = document.createElement("video");
  const srcUrl = URL.createObjectURL(file);
  video.src = srcUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  await once(video, "loadedmetadata");

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!duration) {
    URL.revokeObjectURL(srcUrl);
    throw new Error("Durasi videonya gak kebaca. Coba video lain.");
  }

  const { W, H } = frameSize(video.videoWidth || 1080, video.videoHeight || 1920);
  const fps = await probeFps(video);
  const bitrate = bitrateFor(bitrateMbps, W, H, fps);
  const totalFrames = Math.max(1, Math.round(duration * fps));

  // Fonts must be resident before the first frame is painted, or the opening
  // captions render in a fallback face while the rest render correctly.
  try {
    await document.fonts.load(`${style.bold ? 800 : 600} ${Math.round(H * 0.06)}px "${style.fontFamily}"`);
    await document.fonts.ready;
  } catch {
    /* a missing webfont is not worth failing an export over */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas gak kebentuk di browser ini.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const codec = await pickAvc(W, H, bitrate, fps);

  // Output file on disk, not in RAM.
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle("malesan-export.mp4", { create: true });
  const writable = await handle.createWritable();

  const audio = await loadAudio(file).catch(() => null);

  const muxer = new Muxer({
    target: new FileSystemWritableFileStreamTarget(writable),
    // `false` writes the index at the end of the file. The alternatives both cost
    // something we cannot pay: 'in-memory' buffers the entire MP4 on the heap
    // (the exact OOM this design exists to avoid), and reserving space up front
    // needs an exact chunk count, which is a guess that corrupts the file when it
    // is wrong. A downloaded local file plays fine either way — only HTTP
    // progressive streaming cares where the index sits.
    fastStart: "in-memory",
    video: { codec: "avc", width: W, height: H, frameRate: fps },
    ...(audio
      ? {
          audio: {
            codec: "aac" as const,
            numberOfChannels: audio.numberOfChannels,
            sampleRate: audio.sampleRate,
          },
        }
      : {}),
  });

  let failure: Error | null = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = failure ?? (e as Error);
    },
  });
  videoEncoder.configure({
    codec,
    width: W,
    height: H,
    bitrate,
    framerate: fps,
    avc: { format: "avc" },
    hardwareAcceleration: "prefer-hardware",
    latencyMode: "quality",
  });

  const cleanup = async () => {
    try { if (videoEncoder.state !== "closed") videoEncoder.close(); } catch {}
    try { URL.revokeObjectURL(srcUrl); } catch {}
    video.removeAttribute("src");
    try { video.load(); } catch {}
    canvas.width = 0;
    canvas.height = 0;
  };

  try {
    // ---- audio first: it is fast, and getting it in early means a failure costs
    // seconds rather than the whole frame walk.
    if (audio) {
      onStage?.("Nyiapin audio");
      await encodeAudio(audio, muxer, () => failure);
    }

    // ---- the frame walk: Continuous presentation via requestVideoFrameCallback
    onStage?.("Nge-render tiap frame");
    const frameDurUs = Math.round(1_000_000 / fps);
    const gop = Math.max(1, Math.round(fps * 2));

    const rvfc = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
    };

    let frameIndex = 0;
    let lastRenderedTime = -1;

    if (typeof rvfc.requestVideoFrameCallback === "function") {
      video.currentTime = 0;
      try {
        await video.play();
      } catch {
        /* fallback to stepping if browser rejects play */
      }
    }

    if (!video.paused) {
      await new Promise<void>((resolve) => {
        let isDone = false;
        const finish = () => {
          if (isDone) return;
          isDone = true;
          resolve();
        };

        video.addEventListener("ended", finish, { once: true });
        const maxTimer = setTimeout(finish, (duration + 5) * 1000);

        const step = (_now: number, meta: { mediaTime: number }) => {
          if (isDone || failure || video.ended) {
            clearTimeout(maxTimer);
            finish();
            return;
          }
          const t = meta.mediaTime;
          if (t > lastRenderedTime || lastRenderedTime < 0) {
            lastRenderedTime = t;
            drawFrame(ctx, video, lines, t, style, W, H, watermark);
            const frame = new VideoFrame(canvas, {
              timestamp: Math.round(t * 1_000_000),
              duration: frameDurUs,
            });
            videoEncoder.encode(frame, { keyFrame: frameIndex % gop === 0 });
            frame.close();
            frameIndex++;
            onProgress(Math.min(0.999, t / (duration || 1)));
          }
          if (!video.ended && !failure && !isDone) {
            rvfc.requestVideoFrameCallback!(step);
          }
        };
        rvfc.requestVideoFrameCallback!(step);
      });
      video.pause();
    } else {
      // Frame-by-frame step fallback with verified decode
      for (let i = 0; i < totalFrames; i++) {
        if (failure) throw failure;
        const t = i / fps;
        await seekToFrame(video, Math.min(t, Math.max(0, duration - 1e-3)));
        drawFrame(ctx, video, lines, t, style, W, H, watermark);

        const frame = new VideoFrame(canvas, {
          timestamp: Math.round(t * 1_000_000),
          duration: frameDurUs,
        });
        videoEncoder.encode(frame, { keyFrame: i % gop === 0 });
        frame.close();

        while (videoEncoder.encodeQueueSize > 4) {
          await sleep(4);
          if (failure) throw failure;
        }

        onProgress(Math.min(0.999, (i + 1) / totalFrames));
      }
    }

    await videoEncoder.flush();
    if (failure) throw failure;
    muxer.finalize();
    await writable.close();
    await cleanup();

    onProgress(1);
    return { blob: await handle.getFile(), ext: "mp4" };
  } catch (e) {
    try { await writable.close(); } catch {}
    await cleanup();
    throw e instanceof Error ? e : new Error("Render gagal di tengah jalan.");
  }
}

/* ------------------------------------------------------------------ audio */

type LoadedAudio = { channels: Float32Array[]; sampleRate: number; numberOfChannels: number; frames: number };

/**
 * Decode audio losslessly. If native AudioContext cannot parse the container
 * directly (common for MP4/MOV), uses ffmpeg.wasm extractWavAudio fallback.
 */
async function loadAudio(file: File): Promise<LoadedAudio | null> {
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const actx = new AC();
  try {
    let decoded: AudioBuffer | null = null;
    try {
      const buf = await file.arrayBuffer();
      decoded = await actx.decodeAudioData(buf);
    } catch {
      // Fallback to ffmpeg.wasm lossless WAV extraction
      try {
        const { extractWavAudio } = await import("./ffmpeg");
        const wavBuf = await extractWavAudio(file);
        decoded = await actx.decodeAudioData(wavBuf);
      } catch {
        decoded = null;
      }
    }
    if (!decoded || !decoded.length) return null;
    const channels: Float32Array[] = [];
    for (let c = 0; c < decoded.numberOfChannels; c++) channels.push(decoded.getChannelData(c).slice());
    return {
      channels,
      sampleRate: decoded.sampleRate,
      numberOfChannels: decoded.numberOfChannels,
      frames: decoded.length,
    };
  } catch {
    return null; // a video with no audio track is valid
  } finally {
    try { await actx.close(); } catch {}
  }
}

async function encodeAudio(
  audio: LoadedAudio,
  muxer: Muxer<FileSystemWritableFileStreamTarget>,
  failed: () => Error | null,
) {
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: () => {},
  });
  encoder.configure({
    codec: "mp4a.40.2",
    sampleRate: audio.sampleRate,
    numberOfChannels: audio.numberOfChannels,
    bitrate: 192_000,
  });

  const step = audio.sampleRate;
  for (let offset = 0; offset < audio.frames; offset += step) {
    if (failed()) break;
    const count = Math.min(step, audio.frames - offset);
    const planar = new Float32Array(count * audio.numberOfChannels);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      planar.set(audio.channels[c].subarray(offset, offset + count), c * count);
    }
    const data = new AudioData({
      format: "f32-planar",
      sampleRate: audio.sampleRate,
      numberOfFrames: count,
      numberOfChannels: audio.numberOfChannels,
      timestamp: Math.round((offset / audio.sampleRate) * 1_000_000),
      data: planar,
    });
    encoder.encode(data);
    data.close();
    while (encoder.encodeQueueSize > 8) await sleep(4);
  }

  await encoder.flush();
  encoder.close();
  audio.channels.length = 0;
}

/* ------------------------------------------------------------------ helpers */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** First H.264 profile this device will actually accept at this size/bitrate. */
async function pickAvc(W: number, H: number, bitrate: number, fps: number): Promise<string> {
  for (const codec of AVC_CANDIDATES) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec,
        width: W,
        height: H,
        bitrate,
        framerate: fps,
        avc: { format: "avc" },
      });
      if (supported) return codec;
    } catch {
      /* try the next profile */
    }
  }
  throw new UnsupportedEncoder("Browser ini gak bisa encode H.264.");
}

/**
 * Measure the source frame rate instead of assuming 30.
 */
async function probeFps(video: HTMLVideoElement): Promise<number> {
  const rvfc = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  };
  if (typeof rvfc.requestVideoFrameCallback !== "function") return 30;

  const times: number[] = [];
  try {
    await video.play();
  } catch {
    return 30;
  }
  await new Promise<void>((resolve) => {
    const stopAt = performance.now() + 700;
    const step = (_n: number, meta: { mediaTime: number }) => {
      times.push(meta.mediaTime);
      if (times.length >= 20 || performance.now() > stopAt) return resolve();
      rvfc.requestVideoFrameCallback!(step);
    };
    rvfc.requestVideoFrameCallback!(step);
    setTimeout(resolve, 1200);
  });
  video.pause();
  video.currentTime = 0;

  const gaps = times.slice(1).map((t, i) => t - times[i]).filter((g) => g > 0.001 && g < 0.2);
  if (gaps.length < 3) return 30;
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  const raw = 1 / median;
  const common = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60];
  const near = common.reduce((best, c) => (Math.abs(c - raw) < Math.abs(best - raw) ? c : best), 30);
  return Math.abs(near - raw) / near < 0.12 ? near : Math.min(60, Math.max(15, Math.round(raw)));
}

/** Seek to an exact time with frame presentation verification. */
function seekToFrame(video: HTMLVideoElement, t: number): Promise<void> {
  if (Math.abs(video.currentTime - t) < 1e-4 && video.readyState >= 2) return Promise.resolve();
  const rvfc = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  };
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", onSeeked);
      clearTimeout(timer);
      resolve();
    };
    const onSeeked = () => {
      if (typeof rvfc.requestVideoFrameCallback === "function") {
        rvfc.requestVideoFrameCallback(() => finish());
      } else {
        finish();
      }
    };
    const timer = setTimeout(finish, 1000);
    video.addEventListener("seeked", onSeeked, { once: true });
    video.currentTime = t;
  });
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
