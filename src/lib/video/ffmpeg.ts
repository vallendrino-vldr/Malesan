"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/**
 * A single lazily-loaded ffmpeg.wasm instance for the whole session.
 *
 * ffmpeg.wasm is a ~30MB WebAssembly download and a real memory cost, so it is
 * never part of the main bundle — this module is only ever reached through a
 * dynamic import inside the video editor, and the core is fetched on first use.
 *
 * SINGLE-THREADED core on purpose. The multi-threaded build needs
 * SharedArrayBuffer, which needs cross-origin isolation (COOP/COEP) set on every
 * response — and that header set breaks Google OAuth popups and cross-origin
 * avatar images across the rest of the app. Single-threaded is slower but costs
 * the product nothing anywhere else. If export speed ever justifies it, the
 * isolation has to be scoped to this route alone, not turned on globally.
 *
 * The core is loaded from a CDN via toBlobURL. Hardening step for later:
 * self-host the three core files under /public so a burn-in does not depend on
 * unpkg being reachable — noted rather than done because it adds ~30MB to the repo.
 */

const CORE_VERSION = "0.12.10";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export type ProgressFn = (ratio: number) => void;

/** Loads (once) and returns the shared instance. Safe to call repeatedly. */
export async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const inst = new FFmpeg();
    if (onLog) inst.on("log", ({ message }) => onLog(message));
    try {
      await inst.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      ffmpeg = inst;
      return inst;
    } catch (error) {
      // A rejected cached promise made the Retry button retry the same failure
      // forever. Clear it so a recovered connection can load a fresh instance.
      loadPromise = null;
      ffmpeg = null;
      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Extract a small mono 16kHz audio track from a video for transcription.
 *
 * 16kHz mono is what Whisper wants, and it is also what keeps the file under the
 * server's ~4.5MB request-body ceiling for clips up to the editor's 10-minute
 * cap. m4a/AAC rather than wav because wav at any sample rate blows that ceiling
 * within a couple of minutes.
 */
export async function extractAudio(
  file: File,
  onProgress?: ProgressFn,
): Promise<Blob> {
  const ff = await getFFmpeg();
  const inName = "in_" + safeExt(file.name);
  const outName = "audio.m4a";

  const handler = onProgress ? ({ progress }: { progress: number }) => onProgress(progress) : null;
  if (handler) ff.on("progress", handler);
  try {
    await ff.writeFile(inName, await fetchFile(file));
    await ff.exec([
      "-i", inName,
      "-vn",
      "-ac", "1",
      "-ar", "24000",
      "-c:a", "aac",
      "-b:a", "128k",
      outName,
    ]);
    const data = await ff.readFile(outName);
    return new Blob([new Uint8Array(data as Uint8Array)], { type: "audio/mp4" });
  } finally {
    if (handler) ff.off("progress", handler);
    await safeDelete(ff, inName);
    await safeDelete(ff, outName);
  }
}

/**
 * Extract clean 44.1kHz 16-bit PCM WAV audio for frame-accurate WebCodecs export.
 * This guarantees AudioContext.decodeAudioData will never reject or fail on MP4 files.
 */
export async function extractWavAudio(file: File): Promise<ArrayBuffer> {
  const ff = await getFFmpeg();
  const inName = "in_wav_" + safeExt(file.name);
  const outName = "audio_export.wav";
  try {
    await ff.writeFile(inName, await fetchFile(file));
    await ff.exec([
      "-i", inName,
      "-vn",
      "-c:a", "pcm_s16le",
      "-ar", "44100",
      outName,
    ]);
    const data = await ff.readFile(outName);
    const u8 = new Uint8Array(data as Uint8Array);
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  } finally {
    await safeDelete(ff, inName);
    await safeDelete(ff, outName);
  }
}

/**
 * Burn a subtitle file into the video, hardcoded into the pixels.
 *
 * The captions arrive as an ASS file (built by buildAssSubtitle) because ASS is
 * the only subtitle format that can express per-word highlight — the karaoke
 * timing that makes the active word light up — plus font, colour and a
 * lower-third position in one file. The `ass` filter needs libass in the core;
 * if a burn-in fails with an "ass"/"No such filter" message, the loaded core was
 * built without it and needs swapping for one that has it.
 */
export async function burnInSubtitles(
  file: File,
  assContent: string,
  onProgress?: ProgressFn,
): Promise<Blob> {
  const ff = await getFFmpeg();
  const inName = "in_" + safeExt(file.name);
  const subName = "subs.ass";
  const outName = "out.mp4";

  const handler = onProgress ? ({ progress }: { progress: number }) => onProgress(progress) : null;
  if (handler) ff.on("progress", handler);
  try {
    await ff.writeFile(inName, await fetchFile(file));
    await ff.writeFile(subName, new TextEncoder().encode(assContent));
    await ff.exec([
      "-i", inName,
      "-vf", `ass=${subName}`,
      "-c:a", "copy",
      "-preset", "ultrafast",
      outName,
    ]);
    const data = await ff.readFile(outName);
    return new Blob([new Uint8Array(data as Uint8Array)], { type: "video/mp4" });
  } finally {
    if (handler) ff.off("progress", handler);
    await safeDelete(ff, inName);
    await safeDelete(ff, subName);
    await safeDelete(ff, outName);
  }
}

function safeExt(name: string): string {
  const m = /\.([a-z0-9]{2,4})$/i.exec(name);
  return `input.${m ? m[1].toLowerCase() : "mp4"}`;
}

async function safeDelete(ff: FFmpeg, name: string) {
  try {
    await ff.deleteFile(name);
  } catch {
    // Cleanup is best-effort; a missing scratch file is not an error worth
    // failing an export over.
  }
}
