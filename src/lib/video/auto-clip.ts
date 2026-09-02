import { parseYouTubeId } from "./youtube";

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
  const number = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(number) ? Math.round(number) : null;
};

// Maximum end time for physical clipping: up to 4 hours (14,400s)
const MAX_CLIP_TARGET_SEC = 14_400;
const MIN_ALLOWED_CLIP_SEC = 5;
const MAX_ALLOWED_CLIP_SEC = 300;

export function canTransitionAutoClip(from: AutoClipStatus, to: AutoClipStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function parseAutoClipDraft(value: unknown): AutoClipDraft | null {
  if (!isRecord(value) || !Boolean(value.rightsConfirmed)) return null;
  const pastedUrl = typeof value.sourceUrl === "string" ? value.sourceUrl : "";
  const videoId = parseYouTubeId(pastedUrl);
  const rawStart = integer(value.startTime);
  const rawEnd = integer(value.endTime);
  const title = cleanText(value.title, 300) || "Video YouTube";
  const clipTitle = cleanText(value.clipTitle, 90) || "Klip Pilihan";
  const ratio = value.ratio || "9:16";
  const focus = value.focus || "auto";
  const captionPreset = cleanText(value.captionPreset ?? "default", 32) || "default";
  const language = value.language ?? "id";

  if (
    !videoId ||
    rawStart === null ||
    rawEnd === null ||
    rawStart < 0 ||
    rawEnd > MAX_CLIP_TARGET_SEC ||
    rawEnd - rawStart < MIN_ALLOWED_CLIP_SEC ||
    rawEnd - rawStart > MAX_ALLOWED_CLIP_SEC ||
    !["9:16", "1:1", "16:9"].includes(String(ratio)) ||
    !["auto", "left", "center", "right"].includes(String(focus)) ||
    !["id", "en"].includes(String(language))
  ) {
    console.warn("[auto-clip] Validation rejected draft:", {
      hasVideoId: Boolean(videoId),
      rawStart,
      rawEnd,
      duration: rawStart !== null && rawEnd !== null ? rawEnd - rawStart : null,
      title,
      clipTitle,
      ratio,
      focus,
      language,
    });
    return null;
  }

  return {
    videoId,
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title,
    clipTitle,
    startTime: rawStart,
    endTime: rawEnd,
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
