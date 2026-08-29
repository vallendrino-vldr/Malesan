import { MAX_CLIP_SEC, MAX_SCAN_SEC, MIN_CLIP_SEC, parseYouTubeId } from "./youtube";

export const AUTO_CLIP_STATUSES = [
  "queued",
  "acquiring",
  "trimming",
  "tracking",
  "transcribing",
  "ready",
  "exporting",
  "failed",
  "cancelled",
] as const;

export type AutoClipStatus = (typeof AUTO_CLIP_STATUSES)[number];
export type AutoClipRatio = "9:16" | "1:1" | "16:9";
export type AutoClipFocus = "auto" | "left" | "center" | "right";

export type AutoClipDraft = {
  videoId: string;
  sourceUrl: string;
  title: string;
  clipTitle: string;
  startTime: number;
  endTime: number;
  ratio: AutoClipRatio;
  focus: AutoClipFocus;
  captionPreset: string;
  language: "id" | "en";
  rightsConfirmed: true;
};

export type AutoClipProgress = {
  status: AutoClipStatus;
  progress: number;
  stage: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  outputName: string | null;
  outputBytes: number | null;
};

const TRANSITIONS: Record<AutoClipStatus, readonly AutoClipStatus[]> = {
  queued: ["acquiring", "failed", "cancelled"],
  acquiring: ["trimming", "failed", "cancelled"],
  trimming: ["tracking", "ready", "failed", "cancelled"],
  tracking: ["transcribing", "failed", "cancelled"],
  transcribing: ["ready", "failed", "cancelled"],
  ready: ["exporting", "cancelled"],
  exporting: ["ready", "failed", "cancelled"],
  failed: ["queued", "cancelled"],
  cancelled: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

const integer = (value: unknown) => {
  const number = typeof value === "number" ? value : Number.NaN;
  return Number.isInteger(number) ? number : null;
};

export function canTransitionAutoClip(from: AutoClipStatus, to: AutoClipStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function parseAutoClipDraft(value: unknown): AutoClipDraft | null {
  if (!isRecord(value) || value.rightsConfirmed !== true) return null;
  const pastedUrl = typeof value.sourceUrl === "string" ? value.sourceUrl : "";
  const videoId = parseYouTubeId(pastedUrl);
  const startTime = integer(value.startTime);
  const endTime = integer(value.endTime);
  const title = cleanText(value.title, 300);
  const clipTitle = cleanText(value.clipTitle, 90);
  const ratio = value.ratio;
  const focus = value.focus;
  const captionPreset = cleanText(value.captionPreset ?? "default", 32);
  const language = value.language ?? "id";
  if (
    !videoId ||
    startTime === null ||
    endTime === null ||
    startTime < 0 ||
    endTime > MAX_SCAN_SEC ||
    endTime - startTime < MIN_CLIP_SEC ||
    endTime - startTime > MAX_CLIP_SEC ||
    !title ||
    !clipTitle ||
    !["9:16", "1:1", "16:9"].includes(String(ratio)) ||
    !["auto", "left", "center", "right"].includes(String(focus)) ||
    !captionPreset ||
    !["id", "en"].includes(String(language))
  ) return null;

  return {
    videoId,
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title,
    clipTitle,
    startTime,
    endTime,
    ratio: ratio as AutoClipRatio,
    focus: focus as AutoClipFocus,
    captionPreset,
    language: language as "id" | "en",
    rightsConfirmed: true,
  };
}

export function parseAutoClipProgress(value: unknown): AutoClipProgress | null {
  if (!isRecord(value) || !AUTO_CLIP_STATUSES.includes(value.status as AutoClipStatus)) return null;
  const progress = integer(value.progress);
  if (progress === null || progress < 0 || progress > 100) return null;
  const status = value.status as AutoClipStatus;
  const errorCode = cleanText(value.errorCode, 64) || null;
  const errorMessage = cleanText(value.errorMessage, 300) || null;
  const outputName = cleanText(value.outputName, 160) || null;
  const outputBytes = value.outputBytes == null ? null : integer(value.outputBytes);
  if (outputBytes !== null && outputBytes < 0) return null;
  if (status === "ready" && (!outputName || outputBytes === null)) return null;
  if (status === "failed" && !errorCode) return null;
  return {
    status,
    progress,
    stage: cleanText(value.stage, 100) || null,
    errorCode,
    errorMessage,
    outputName,
    outputBytes,
  };
}
