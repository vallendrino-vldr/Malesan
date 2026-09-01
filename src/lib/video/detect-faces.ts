"use client";

import { buildCropTrajectory, type CropKeyframe, type FaceSample } from "./face-track";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

const seek = (video: HTMLVideoElement, time: number) => new Promise<void>((resolve, reject) => {
  if (Math.abs(video.currentTime - time) < 0.01) return resolve();
  let timer: NodeJS.Timeout | null = null;
  const done = () => { cleanup(); resolve(); };
  const failed = () => { cleanup(); reject(new Error("Frame video gak bisa dibaca.")); };
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    video.removeEventListener("seeked", done);
    video.removeEventListener("error", failed);
  };
  video.addEventListener("seeked", done, { once: true });
  video.addEventListener("error", failed, { once: true });
  timer = setTimeout(() => { cleanup(); resolve(); }, 3500);
  video.currentTime = time;
});

async function getModelAsset(): Promise<{ modelAssetBuffer?: Uint8Array; modelAssetPath?: string }> {
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open("malesan-ai-models-v1");
      const matched = await cache.match(MODEL);
      if (matched) {
        const buf = await matched.arrayBuffer();
        return { modelAssetBuffer: new Uint8Array(buf) };
      }
      const fetched = await fetch(MODEL);
      if (fetched.ok) {
        void cache.put(MODEL, fetched.clone()).catch(() => {});
        const buf = await fetched.arrayBuffer();
        return { modelAssetBuffer: new Uint8Array(buf) };
      }
    } catch {
      // Fallback
    }
  }
  return { modelAssetPath: MODEL };
}

export async function detectFaceTrajectory(
  video: HTMLVideoElement,
  options: { mode?: "face_track" | "podcast_dynamic"; start?: number; end?: number; signal?: AbortSignal; onProgress?: (progress: number) => void } = {},
): Promise<CropKeyframe[]> {
  const { buildPodcastSpeakerTrajectory } = await import("./face-track");
  const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const [vision, modelAsset] = await Promise.all([
    FilesetResolver.forVisionTasks(WASM),
    getModelAsset(),
  ]);
  const create = (delegate: "GPU" | "CPU") => FaceDetector.createFromOptions(vision, {
    baseOptions: { ...modelAsset, delegate }, runningMode: "IMAGE", minDetectionConfidence: 0.25,
  });
  let detector;
  try {
    try { detector = await create("GPU"); } catch { detector = await create("CPU"); }
  } catch {
    // If MediaPipe model fails to load, gracefully return dynamic trajectory for podcast or empty for center fallback
    return options.mode === "podcast_dynamic"
      ? buildPodcastSpeakerTrajectory([], Number.isFinite(video.duration) ? video.duration : 60)
      : [];
  }
  const wasPlaying = !video.paused;
  if (wasPlaying) {
    try { video.pause(); } catch {}
  }
  const originalTime = video.currentTime;
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  const start = Math.max(0, Math.min(duration, options.start ?? 0));
  const end = Math.min(duration, Math.max(start, options.end ?? duration));
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 4;
  const step = weak ? 0.35 : 0.15;
  const total = Math.max(1, Math.ceil((end - start) / step));
  const samples: FaceSample[] = [];
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;

  try {
    for (let index = 0, time = start; time <= end; index += 1, time = start + index * step) {
      if (options.signal?.aborted) throw new DOMException("Dibatalkan", "AbortError");
      const targetTime = Math.min(time, end);
      await seek(video, targetTime);

      const result = detector.detect(video);
      samples.push({
        time: targetTime,
        faces: result.detections.map((detection) => {
          const box = detection.boundingBox;
          return {
            x: box ? box.originX / vw : 0,
            y: box ? box.originY / vh : 0,
            width: box ? box.width / vw : 0,
            height: box ? box.height / vh : 0,
            score: detection.categories[0]?.score ?? 0,
          };
        }),
      });
      options.onProgress?.(Math.min(1, (index + 1) / total));
    }
    return options.mode === "podcast_dynamic"
      ? buildPodcastSpeakerTrajectory(samples, duration)
      : buildCropTrajectory(samples);
  } finally {
    detector.close();
    if (duration > 0) {
      await seek(video, Math.min(originalTime, duration)).catch(() => {});
    }
  }
}

declare global { interface Navigator { deviceMemory?: number } }
