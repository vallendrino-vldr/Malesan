"use client";

import { cropFocusAt } from "@/lib/video/face-track";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  activeAt,
  groupLines,
  retimeTranslatedLines,
  DEFAULT_STYLE,
  CAPTION_FONTS,
  CAPTION_FONTS_HREF,
  type CaptionStyle,
  type Line,
  type Word,
} from "@/lib/video/captions";
import { exportBurnedVideo } from "@/lib/video/export";
import type { VideoLayout, ClarityFilter } from "@/lib/video/draw";
import { getNativeShell, requestNative } from "@/lib/native/bridge";
import { ExportOverlay } from "./ExportOverlay";
import { ClipRadar } from "./ClipRadar";
import { VideoKeyframeControls } from "./VideoKeyframeControls";
import { VideoCompletionModal } from "./VideoCompletionModal";
import { VideoProjectHistoryModal } from "./VideoProjectHistoryModal";
import { saveVideoProject, getVideoProject, type VideoProject } from "@/lib/video/project-history";
import { interpolateKeyframes, manualKeyframesToTrajectory, type ManualKeyframe } from "@/lib/video/keyframe-engine";
/**
 * Video Auto-CC editor.
 *
 * Pipeline is client-heavy so the server stays cheap: decode, preview and
 * burn-in all happen in the browser, and only the extracted audio ever reaches
 * our server, on its way to transcription. ffmpeg.wasm (dynamically imported)
 * pulls the audio out; the caption burn-in is a canvas capture (see
 * lib/video/export) so the text is real pixels, in any font, revealed per word.
 */

type Phase = "idle" | "extracting" | "transcribing" | "ready" | "exporting";

function triggerHaptic(durationMs = 12) {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(durationMs);
    } catch {}
  }
}

const SOCIAL_PRESETS = [
  {
    id: "hormozi",
    label: "Hormozi",
    hint: "Kalimat tebal, kata aktif membesar dengan glow lime",
    mbps: 6.0,
    maxWords: 4,
    maxGap: 0.5,
    style: {
      fontFamily: "Montserrat",
      bold: true,
      textColor: "#ffffff",
      highlightColor: "#c8ff36",
      style: "plain" as const,
      position: 0.65,
      fontScale: 1.0,
      activeScale: 1.1,
      activeGlow: true,
      mode: "line" as const,
      animation: "none" as const,
    },
  },
  {
    id: "mrbeast",
    label: "MrBeast",
    hint: "Kuning menyala, outline tebal hitam, pop kata punchy",
    mbps: 6.0,
    maxWords: 3,
    maxGap: 0.45,
    style: {
      fontFamily: "Anton",
      bold: true,
      textColor: "#ffffff",
      highlightColor: "#ffe600",
      style: "outline" as const,
      position: 0.65,
      fontScale: 1.08,
      activeScale: 1.12,
      activeGlow: true,
      mode: "word" as const,
      animation: "pop" as const,
    },
  },
  {
    id: "tiktok",
    label: "TikTok",
    hint: "Satu kata, outline tebal, pop cepat yang kontras",
    mbps: 6.0,
    maxWords: 3,
    maxGap: 0.48,
    style: {
      fontFamily: "Archivo Black",
      bold: true,
      textColor: "#ffffff",
      highlightColor: "#ffdf39",
      style: "outline" as const,
      position: 0.62,
      fontScale: 1.0,
      activeScale: 1,
      activeGlow: false,
      mode: "word" as const,
      animation: "pop" as const,
    },
  },
  {
    id: "business",
    label: "Minimal",
    hint: "Kapsul hitam bersih, putih tenang, highlight amber halus",
    mbps: 5.5,
    maxWords: 5,
    maxGap: 0.65,
    style: {
      fontFamily: "Poppins",
      bold: false,
      textColor: "#ffffff",
      highlightColor: "#ffb067",
      style: "box" as const,
      position: 0.68,
      fontScale: 0.88,
      activeScale: 1,
      activeGlow: false,
      mode: "line" as const,
      animation: "fade" as const,
    },
  },
  {
    id: "neon",
    label: "Neon Cyber",
    hint: "Font modern, aksen cyan elektrik menyala di latar gelap",
    mbps: 6.0,
    maxWords: 4,
    maxGap: 0.5,
    style: {
      fontFamily: "Montserrat",
      bold: true,
      textColor: "#ffffff",
      highlightColor: "#00f0ff",
      style: "plain" as const,
      position: 0.65,
      fontScale: 1.0,
      activeScale: 1.08,
      activeGlow: true,
      mode: "line" as const,
      animation: "pop" as const,
    },
  },
] as const;

export function VideoEditor({
  cost,
  noWatermarkCost,
  mode = "auto_clip",
}: {
  cost: number;
  noWatermarkCost: number;
  mode?: "auto_clip" | "subtitle";
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [style, setStyle] = useState<CaptionStyle>(() => ({
    ...DEFAULT_STYLE,
    ...SOCIAL_PRESETS[0].style,
  }));
  const [safeZones, setSafeZones] = useState(false);
  const [bitrate, setBitrate] = useState(12);
  const [presetId, setPresetId] = useState<(typeof SOCIAL_PRESETS)[number]["id"]>("hormozi");
  const [noWatermark, setNoWatermark] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [captionLanguage, setCaptionLanguage] = useState<"id" | "en">("id");
  const [sourceLanguage, setSourceLanguage] = useState<"id" | "en">("id");
  const [sourceWords, setSourceWords] = useState<Word[] | null>(null);
  const [translating, setTranslating] = useState(false);
  const [layout, setLayout] = useState<VideoLayout>({ ratio: "9:16", focus: "center", filter: "wink_hd" });
  const [editorTab, setEditorTab] = useState<"frame" | "subtitles" | "style" | "export">("frame");
  const [activeDrawer, setActiveDrawer] = useState<"frame" | "subtitles" | "style" | "export" | null>(null);
  const [exportPct, setExportPct] = useState(0);
  const [exportStage, setExportStage] = useState("");
  const [trackingFace, setTrackingFace] = useState(false);
  const [autoProcess, setAutoProcess] = useState(false);

  // Advanced Framing, Keyframe & Project History States
  const [manualKeyframes, setManualKeyframes] = useState<ManualKeyframe[]>([]);
  const [currentPanX, setCurrentPanX] = useState(0.5);
  const [currentZoom, setCurrentZoom] = useState(1.0);
  const [framingMode, setFramingMode] = useState<
    "auto_ai" | "podcast_split" | "manual_keyframe" | "preset_left" | "preset_center" | "preset_right"
  >("auto_ai");
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | undefined>(undefined);
  const [exportedVideoFile, setExportedVideoFile] = useState<File | null>(null);
  const [isNativeAPK, setIsNativeAPK] = useState(false);
  const [currentTimeNow, setCurrentTimeNow] = useState(0);
  const [videoDuration, setVideoDuration] = useState(60);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const autoEnhanceRef = useRef(false);

  const handleAddKeyframe = (newKf: Omit<ManualKeyframe, "id">) => {
    const kfWithId: ManualKeyframe = { ...newKf, id: `kf_${Date.now()}` };
    setManualKeyframes((prev) => {
      const filtered = prev.filter((k) => Math.abs(k.time - newKf.time) > 0.3);
      const updated = [...filtered, kfWithId].sort((a, b) => a.time - b.time);
      const trajectory = manualKeyframesToTrajectory(updated, videoDuration || 60);
      setLayout((curr) => ({
        ...curr,
        focus: "manual_keyframe",
        trajectory,
        manualKeyframes: updated,
      }));
      return updated;
    });
  };

  const handleRemoveKeyframe = (id: string) => {
    setManualKeyframes((prev) => {
      const updated = prev.filter((k) => k.id !== id);
      const trajectory = manualKeyframesToTrajectory(updated, videoDuration || 60);
      setLayout((curr) => ({
        ...curr,
        focus: updated.length > 0 ? "manual_keyframe" : "center",
        trajectory: updated.length > 0 ? trajectory : undefined,
        manualKeyframes: updated,
      }));
      return updated;
    });
  };

  const handlePanChange = (panX: number) => {
    setCurrentPanX(panX);
    setLayout((curr) => ({
      ...curr,
      panX,
      focus: "manual_keyframe",
      trajectory: undefined,
      zoom: curr.ratio === "16:9" && (curr.zoom ?? 1.0) <= 1.05 ? 1.25 : curr.zoom,
    }));
    setFramingMode("manual_keyframe");
  };

  const handleSplitPanChange = (speaker: "top" | "bottom", panX: number) => {
    setLayout((curr) => ({
      ...curr,
      focus: "podcast_split",
      splitTopPanX: speaker === "top" ? panX : (curr.splitTopPanX ?? 0.25),
      splitBottomPanX: speaker === "bottom" ? panX : (curr.splitBottomPanX ?? 0.75),
    }));
  };

  const handleZoomChange = (zoom: number) => {
    setCurrentZoom(zoom);
    setLayout((curr) => ({
      ...curr,
      zoom,
    }));
  };

  const handleFramingModeChange = (mode: "auto_ai" | "podcast_split" | "manual_keyframe" | "preset_left" | "preset_center" | "preset_right") => {
    setFramingMode(mode);
    if (mode === "auto_ai") {
      setManualKeyframes([]);
      setLayout((curr) => ({ ...curr, focus: "podcast_dynamic", manualKeyframes: undefined, panX: undefined }));
      void runFaceTrack("podcast_dynamic");
    } else if (mode === "podcast_split") {
      setManualKeyframes([]);
      setLayout((curr) => ({ ...curr, focus: "podcast_split", trajectory: undefined, manualKeyframes: undefined, panX: undefined }));
    } else if (mode === "preset_left") {
      handlePanChange(0.2);
    } else if (mode === "preset_center") {
      handlePanChange(0.5);
    } else if (mode === "preset_right") {
      handlePanChange(0.8);
    }
  };

  const handleSelectProject = async (project: VideoProject) => {
    try {
      const fullProject = (await getVideoProject(project.id)) || project;

      setWords(fullProject.words);
      setSourceWords(fullProject.words);
      setStyle(fullProject.style);
      if (fullProject.presetId) setPresetId(fullProject.presetId as (typeof SOCIAL_PRESETS)[number]["id"]);
      setLayout(fullProject.layout);
      if (fullProject.manualKeyframes) setManualKeyframes(fullProject.manualKeyframes);
      if (fullProject.framingMode) setFramingMode(fullProject.framingMode);

      if (fullProject.videoBlob && fullProject.videoBlob.size > 0) {
        const restoredFile = new File([fullProject.videoBlob], fullProject.title, {
          type: fullProject.videoBlob.type || "video/mp4",
          lastModified: fullProject.updatedAt,
        });
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        setFile(restoredFile);
        setVideoUrl(URL.createObjectURL(restoredFile));
        setPhase("ready");
        setDoneMsg(`Draf proyek "${fullProject.title}" berhasil dimuat.`);
      } else {
        // For drafts without cached blob, create a standby file so the editor opens immediately
        const standbyFile = new File([new Blob([])], fullProject.title, {
          type: "video/mp4",
          lastModified: fullProject.updatedAt,
        });
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        setFile(standbyFile);
        setVideoUrl("");
        setPhase("ready");
        setDoneMsg(`Draf subtitle "${fullProject.title}" berhasil dibuka.`);
      }
      setError(null);
    } catch (err) {
      console.error("Gagal membuka proyek:", err);
      setError("Gagal memuat draf proyek.");
    }
  };
  const runFaceTrack = useCallback(async (mode: "face_track" | "podcast_dynamic" = "podcast_dynamic") => {
    const video = videoRef.current;
    if (!video || trackingFace) return;
    setTrackingFace(true); setError(null);
    setStatus(mode === "podcast_dynamic" ? "AI lagi menganalisis giliran bicara & posisi wajah..." : "AI lagi ngikutin wajah...");
    try {
      const { detectFaceTrajectory } = await import("@/lib/video/detect-faces");
      const trajectory = await detectFaceTrajectory(video, {
        mode,
        onProgress: (value) => setProgress(Math.round(value * 100)),
      });
      setLayout((current) => ({
        ...current,
        focus: mode === "podcast_dynamic" ? "podcast_dynamic" : "center",
        trajectory,
        manualKeyframes: undefined,
      }));
      setStatus(
        mode === "podcast_dynamic"
          ? "Auto AI Framing & Speaker Switch aktif."
          : trajectory.some((keyframe) => keyframe.confidence > 0)
          ? "Face track aktif."
          : "Wajah fokus tengah aktif."
      );
    } catch {
      setStatus("Wajah fokus tengah aktif.");
    } finally {
      setTrackingFace(false);
    }
  }, [trackingFace]);

  const preset = SOCIAL_PRESETS.find((item) => item.id === presetId) ?? SOCIAL_PRESETS[0];
  const lines = useMemo(
    () => groupLines(words, preset.maxWords, preset.maxGap),
    [words, preset.maxWords, preset.maxGap],
  );
  const busy = phase === "extracting" || phase === "transcribing" || phase === "exporting";

  useEffect(() => {
    if (document.getElementById("malesan-caption-fonts")) return;
    const link = document.createElement("link");
    link.id = "malesan-caption-fonts";
    link.rel = "stylesheet";
    link.href = CAPTION_FONTS_HREF;
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    void getNativeShell().then((shell) => {
      setIsNativeAPK(Boolean(shell?.capabilities.includes("native-auto-clip") || shell));
    });
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const onPick = (f: File | null) => {
    if (!f) return;
    setAutoProcess(false);
    setError(null);
    setWords([]);
    setSourceWords(null);
    setCaptionLanguage("id");
    setPhase("idle");
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
  };

  // Auto-save draft progress to IndexedDB
  useEffect(() => {
    if (!file || words.length === 0) return;
    const timer = setTimeout(() => {
      const shouldSaveBlob = file && file.size > 0 && file.size < 150 * 1024 * 1024;
      void saveVideoProject({
        id: file.name.replace(/\.[^.]+$/, "") || "project_default",
        title: file.name,
        durationSec: videoRef.current?.duration || 0,
        videoBlob: shouldSaveBlob ? file : undefined,
        words,
        style,
        presetId,
        layout,
        manualKeyframes,
        framingMode,
        createdAt: Date.now(),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [file, words, style, presetId, layout, manualKeyframes, framingMode]);

  const generate = useCallback(async () => {
    if (!file) return;
    const v = videoRef.current;
    const durationSec = v?.duration && isFinite(v.duration) ? v.duration : 0;
    if (!durationSec) {
      setError("Durasi videonya belum kebaca. Tunggu sebentar lalu coba lagi.");
      return;
    }
    if (durationSec > 600) {
      setError("Video maksimal 10 menit. Potong dulu, lalu upload ulang ya.");
      return;
    }
    setError(null);
    setProgress(0);
    try {
      setPhase("extracting");
      setStatus("Ngambil audio dari video...");
      const { extractAudio } = await import("@/lib/video/ffmpeg");
      const { blob: audioBlob, filename: audioFilename } = await extractAudio(
        file,
        (r) => setProgress(Math.round(r * 100)),
      );

      setPhase("transcribing");
      setProgress(0);
      setStatus("AI lagi denger & nulis tiap kata...");
      const form = new FormData();
      form.append("audio", audioBlob, audioFilename);
      form.append("durationSec", String(durationSec));
      form.append("language", "auto");

      const res = await fetch("/api/video/transcribe", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as
        | { words?: Word[]; language?: string; error?: string }
        | null;
      if (!res.ok || !data?.words?.length) {
        setError(data?.error ?? "Transkripsi gagal. Coba lagi bentar lagi.");
        setPhase("idle");
        return;
      }
      setWords(data.words);
      setSourceWords(data.words);
      const detected = (data.language || "id") === "en" ? "en" : "id";
      setSourceLanguage(detected);
      setCaptionLanguage(detected);

      setPhase("ready");
      setStatus("");
      if (autoEnhanceRef.current) {
        autoEnhanceRef.current = false;
        await runFaceTrack();
      }
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? `Gagal ngolah video: ${e.message}` : "Gagal ngolah video.",
      );
      setPhase("idle");
    }
  }, [file, router, runFaceTrack]);

  useEffect(() => {
    const video = videoRef.current;
    if (!autoProcess || !video || !file) return;
    const start = () => { setAutoProcess(false); void generate(); };
    if (video.readyState >= 1 && Number.isFinite(video.duration)) start();
    else video.addEventListener("loadedmetadata", start, { once: true });
    return () => video.removeEventListener("loadedmetadata", start);
  }, [autoProcess, file, generate]);

  const translateCaptions = useCallback(async (target: "id" | "en") => {
    if (!words.length || translating || target === captionLanguage) return;
    if (target === sourceLanguage && sourceWords) {
      setWords(sourceWords);
      setCaptionLanguage(target);
      setError(null);
      return;
    }
    const sourceLines = groupLines(words, preset.maxWords, preset.maxGap);
    setTranslating(true);
    setError(null);
    try {
      const res = await fetch("/api/video/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          lines: sourceLines.map((line) => line.words.map((word) => word.word).join(" ")),
        }),
      });
      const data = (await res.json().catch(() => null)) as { lines?: string[]; error?: string } | null;
      if (!res.ok || !data?.lines) throw new Error(data?.error ?? "Gagal menerjemahkan subtitle.");
      setWords(retimeTranslatedLines(sourceLines, data.lines));
      setCaptionLanguage(target);
    } catch (translationError) {
      setError(translationError instanceof Error ? translationError.message : "Gagal menerjemahkan subtitle.");
    } finally {
      setTranslating(false);
    }
  }, [captionLanguage, preset.maxGap, preset.maxWords, sourceLanguage, sourceWords, translating, words]);

  const doExport = useCallback(async () => {
    if (!file || file.size === 0 || !videoUrl || !words.length) {
      setError("Hubungkan file video aslinya terlebih dahulu sebelum mengekspor.");
      return;
    }
    const v = videoRef.current;
    if (v && !v.paused) v.pause();
    setError(null);
    setDoneMsg(null);
    setProgress(0);
    setExportPct(0);
    setExportStage("Nyiapin");
    setPhase("exporting");
    setStatus("Nge-render caption ke video, jangan tutup tab...");
    try {
      if (noWatermark) {
        const wm = await fetch("/api/video/no-watermark", { method: "POST" });
        if (!wm.ok) {
          const d = (await wm.json().catch(() => null)) as { error?: string } | null;
          setError(d?.error ?? "Gagal motong kredit buat hapus watermark.");
          setPhase("ready");
          return;
        }
        router.refresh();
      }
      const { blob, ext } = await exportBurnedVideo({
        file,
        lines,
        style,
        bitrateMbps: bitrate,
        watermark: !noWatermark,
        layout,
        onProgress: (r) => {
          setProgress(Math.round(r * 100));
          setExportPct(r * 100);
        },
        onStage: setExportStage,
      });
      const base = file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "video";
      const finalFile = new File([blob], `${base}.${ext}`, { type: blob.type || "video/mp4" });
      setExportedVideoFile(finalFile);
      const nativeShell = await getNativeShell();
      const isAPK = !!nativeShell?.capabilities.includes("gallery-stream");
      setIsNativeAPK(isAPK);

      if (isAPK) {
        setExportStage("Menyiapkan Galeri Android...");
        const prepared = await requestNative({ type: "GALLERY_PREPARE", name: `Malesan_${base}.${ext}`, mimeType: blob.type || "video/mp4", bytes: blob.size });
        if (prepared.type !== "GALLERY_UPLOAD_READY" || !prepared.downloadToken) throw new Error(prepared.message ?? "Galeri Android gak siap.");
        const chunkSize = 512 * 1024;
        for (let offset = 0; offset < blob.size; offset += chunkSize) {
          const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
          let binary = "";
          for (let cursor = 0; cursor < bytes.length; cursor += 0x8000) binary += String.fromCharCode(...bytes.subarray(cursor, cursor + 0x8000));
          const accepted = await requestNative({ type: "GALLERY_CHUNK", downloadToken: prepared.downloadToken, chunk: btoa(binary) }, 60_000);
          if (accepted.type !== "GALLERY_CHUNK_ACCEPTED") throw new Error(accepted.message ?? "Potongan video gagal ditulis.");
          setExportPct(90 + Math.round(Math.min(1, (offset + bytes.length) / blob.size) * 10));
        }
        const committed = await requestNative({ type: "GALLERY_COMMIT", downloadToken: prepared.downloadToken });
        if (committed.type !== "GALLERY_SAVED") throw new Error(committed.message ?? "Video gagal disimpan ke Galeri Android.");
        void requestNative({ type: "HAPTIC", strength: "heavy" }).catch(() => {});
        setRenderedVideoUrl(undefined);
      } else {
        const url = URL.createObjectURL(blob);
        setRenderedVideoUrl(url);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Auto Caption by malesan.my.id - ${base}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setPhase("ready");
      setStatus("");
      setShowCompletionModal(true);
      setDoneMsg(
        noWatermark
          ? `Video kesimpen. ${noWatermarkCost} kredit kepotong buat hapus watermark.`
          : "Video kesimpen (watermark nempel, gratis).",
      );
    } catch (e) {
      setError(e instanceof Error ? `Export gagal: ${e.message}` : "Export gagal.");
      setPhase("ready");
    }
  }, [file, words, lines, style, bitrate, noWatermark, noWatermarkCost, router, layout]);

  return (
    <div className="space-y-3.5">
      <ExportOverlay open={phase === "exporting"} progress={exportPct} stage={exportStage} />

      {!file ? (
        <div className="space-y-4">
          <header className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold tracking-display-md text-ink">
                {mode === "auto_clip" ? "Auto Clip Video" : "Subtitle Video (Auto Caption)"}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {mode === "auto_clip" ? (
                  <>
                    Tempel link YouTube, pilih momen rekomendasi, lalu potong &amp; transkrip otomatis.
                    <span className="text-ember font-bold"> {Math.max(10, cost * 2)} kredit sekali scan.</span>
                  </>
                ) : (
                  <>
                    Upload rekaman video kamu, AI otomatis transkrip &amp; pasang subtitle animasi siap tayang.
                    <span className="text-ember"> Mulai dari {cost} kredit / menit.</span>
                  </>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-hairline bg-surface-raised px-3 text-xs font-bold text-ink transition-all hover:border-ember/50 hover:bg-white/10 shrink-0 shadow-xs"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4 text-ember"><path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
              <span>Draf &amp; Riwayat</span>
            </button>
          </header>

          {mode === "auto_clip" ? (
            <>
              <ClipRadar cost={cost * 2} onClipReady={(bridgeFile) => { autoEnhanceRef.current = true; onPick(bridgeFile); setAutoProcess(true); }} />

              <details className="group rounded-2xl border border-hairline bg-surface">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-mini font-semibold text-muted transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
                  <span>Pakai file sendiri</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <div className="border-t border-hairline p-3">
                  <p className="mb-3 text-micro leading-relaxed text-muted">Fallback buat video yang sudah ada di perangkat. Subtitle AI mulai dari {cost} kredit / menit.</p>
                  <UploadDrop onPick={onPick} />
                </div>
              </details>
            </>
          ) : (
            <div className="space-y-4">
              <UploadDrop onPick={onPick} />
              <details className="group rounded-2xl border border-hairline bg-surface">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-mini font-semibold text-muted transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
                  <span>Mau potong klip dari YouTube?</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <div className="border-t border-hairline p-3">
                  <ClipRadar cost={cost * 2} onClipReady={(bridgeFile) => { autoEnhanceRef.current = true; onPick(bridgeFile); setAutoProcess(true); }} />
                </div>
              </details>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Ultra-Compact Single-Row Studio Header */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-surface/90 backdrop-blur-md p-1.5 px-2.5 shadow-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setVideoUrl("");
                  setWords([]);
                  setPhase("idle");
                  setError(null);
                  setDoneMsg(null);
                }}
                className="flex h-7.5 cursor-pointer items-center gap-1 rounded-lg border border-hairline bg-surface-raised px-2 text-xs font-semibold text-muted transition-all hover:border-ember/50 hover:text-ink shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5"><path d="m15 18-6-6 6-6"/></svg>
                <span>Ganti</span>
              </button>

              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="flex h-7.5 cursor-pointer items-center gap-1 rounded-lg border border-hairline bg-surface-raised px-2 text-xs font-bold text-ink transition-all hover:border-ember/50 hover:bg-white/10 shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5 text-ember"><path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
                <span>Draf</span>
              </button>

              <span className="truncate text-xs font-bold text-ink max-w-[110px] sm:max-w-[240px]" title={file.name}>{file.name}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {words.length > 0 ? (
                <button type="button" onClick={doExport} disabled={busy || !videoUrl} className="btn-ember flex h-7.5 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-obsidian shadow-xs transition-transform active:scale-95 disabled:opacity-50">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  <span>Export</span>
                </button>
              ) : phase === "idle" ? (
                <button type="button" onClick={generate} className="btn-ember flex h-7.5 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-obsidian shadow-xs">
                  <span>Subtitle AI</span>
                </button>
              ) : null}
            </div>
          </div>



          {/* Desktop Dual-Pane & Mobile Centered Pro Canvas */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start pb-24 sm:pb-4">
            {/* Center Video Player Showcase */}
            <div className="lg:col-span-6 flex flex-col items-center space-y-2">
              <div className="w-full flex justify-center">
                <VideoPreviewPlayer
                  videoRef={videoRef}
                  videoUrl={videoUrl}
                  lines={lines}
                  style={style}
                  safeZones={safeZones}
                  layout={layout}
                  watermark={!noWatermark}
                  onTimeChange={setCurrentTimeNow}
                  onDurationChange={setVideoDuration}
                  onManualPanChange={(panX) => handlePanChange(panX)}
                  onSplitPanChange={handleSplitPanChange}
                  onSubtitleYChange={(y) => setLayout((curr) => ({ ...curr, subtitleY: y }))}
                  onAttachVideo={(picked) => {
                    if (videoUrl) URL.revokeObjectURL(videoUrl);
                    setFile(picked);
                    setVideoUrl(URL.createObjectURL(picked));
                    setDoneMsg(`Video "${picked.name}" berhasil terhubung ke draf.`);
                  }}
                  onResetStudio={() => {
                    setFile(null);
                    setVideoUrl("");
                    setWords([]);
                    setPhase("idle");
                    setError(null);
                    setDoneMsg(null);
                  }}
                />
              </div>

              {/* Quick Info & Safe Zone Pill */}
              <div className="flex w-full max-w-[320px] items-center justify-between gap-2 px-1 text-[11px] text-muted">
                <label className="flex cursor-pointer items-center gap-1.5 hover:text-ink">
                  <input type="checkbox" checked={safeZones} onChange={(e) => setSafeZones(e.target.checked)} className="size-3.5 accent-ember rounded" />
                  <span>Safe Zone</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-ember font-bold bg-surface-raised px-2 py-0.5 rounded border border-hairline uppercase">{layout.ratio}</span>
                  <span className="text-micro text-mist/80">{presetId}</span>
                </div>
              </div>

              {busy && (
                <div className="w-full max-w-[320px]"><ProgressBar phase={phase} progress={progress} status={status} /></div>
              )}

              {/* Mobile Action Bar: Inline in layout, NEVER overlapping video */}
              <div className="lg:hidden w-full max-w-[320px] pt-1">
                <div className="flex items-center justify-around gap-1 p-1.5 rounded-2xl bg-surface-raised border border-white/10 shadow-lg">
                  <button
                    type="button"
                    onClick={() => setActiveDrawer(activeDrawer === "frame" ? null : "frame")}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[11px] font-bold transition-all ${
                      activeDrawer === "frame" ? "bg-ember text-obsidian shadow-sm" : "text-mist hover:text-white"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
                    <span>Bingkai</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDrawer(activeDrawer === "subtitles" ? null : "subtitles")}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[11px] font-bold transition-all ${
                      activeDrawer === "subtitles" ? "bg-ember text-obsidian shadow-sm" : "text-mist hover:text-white"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
                    <span>Teks</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDrawer(activeDrawer === "style" ? null : "style")}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[11px] font-bold transition-all ${
                      activeDrawer === "style" ? "bg-ember text-obsidian shadow-sm" : "text-mist hover:text-white"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/></svg>
                    <span>Gaya</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDrawer(activeDrawer === "export" ? null : "export")}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[11px] font-bold transition-all ${
                      activeDrawer === "export" ? "bg-ember text-obsidian shadow-sm" : "text-mist hover:text-white"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    <span>Export</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Control Panel (Visible on lg+) */}
            <div className="hidden lg:flex lg:col-span-6 flex-col rounded-2xl border border-hairline bg-surface overflow-hidden shadow-xs">
              <div className="grid grid-cols-4 border-b border-hairline bg-surface-raised p-1 gap-1">
                <button type="button" onClick={() => setEditorTab("frame")} className={`flex h-8.5 items-center justify-center gap-1 rounded-lg px-1.5 text-xs font-bold transition-all ${editorTab === "frame" ? "bg-ember text-obsidian shadow-xs" : "text-muted hover:text-ink hover:bg-surface-raised"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 shrink-0"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
                  <span>Bingkai</span>
                </button>
                <button type="button" onClick={() => setEditorTab("subtitles")} className={`flex h-8.5 items-center justify-center gap-1 rounded-lg px-1.5 text-xs font-bold transition-all ${editorTab === "subtitles" ? "bg-ember text-obsidian shadow-xs" : "text-muted hover:text-ink hover:bg-surface-raised"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 shrink-0"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
                  <span>Teks</span>
                </button>
                <button type="button" onClick={() => setEditorTab("style")} className={`flex h-8.5 items-center justify-center gap-1 rounded-lg px-1.5 text-xs font-bold transition-all ${editorTab === "style" ? "bg-ember text-obsidian shadow-xs" : "text-muted hover:text-ink hover:bg-surface-raised"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/></svg>
                  <span>Gaya</span>
                </button>
                <button type="button" onClick={() => setEditorTab("export")} className={`flex h-8.5 items-center justify-center gap-1 rounded-lg px-1.5 text-xs font-bold transition-all ${editorTab === "export" ? "bg-ember text-obsidian shadow-xs" : "text-muted hover:text-ink hover:bg-surface-raised"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  <span>Export</span>
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto custom-scrollbar">
                {editorTab === "frame" && (
                  <div className="space-y-4">
                    {/* Clean Ratio Selector */}
                    <div className="rounded-xl border border-hairline bg-surface-raised/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-ink">Rasio Video</span>
                        <span className="text-[11px] font-mono text-ember font-bold">{layout.ratio}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["9:16", "1:1", "16:9"] as const).map((ratio) => (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => setLayout((curr) => ({ ...curr, ratio }))}
                            className={`h-8.5 rounded-lg border font-mono text-xs font-bold transition-all ${
                              layout.ratio === ratio
                                ? "border-ember bg-ember/20 text-ember shadow-xs"
                                : "border-hairline bg-black/40 text-muted hover:text-ink"
                            }`}
                          >
                            {ratio}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Kejernihan & Filter Visual (Ala Wink HD) */}
                    <div className="rounded-xl border border-hairline bg-surface-raised/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5 text-ember">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                          </svg>
                          <span className="text-xs font-bold text-ink">Kejernihan &amp; Filter Visual</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-ember/15 text-ember font-bold">Ala Wink HD</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: "wink_hd", label: "Wink HD Clarity", desc: "Super jernih & tajam" },
                          { id: "fyp_pop", label: "FYP Pop Glow", desc: "Warna cerah & hidup" },
                          { id: "soft_clean", label: "Soft De-noise", desc: "Halus bebas bintik" },
                          { id: "original", label: "Original", desc: "Alami apa adanya" },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setLayout((curr) => ({ ...curr, filter: opt.id as ClarityFilter }))}
                            className={`h-11 rounded-lg border px-2.5 flex flex-col items-start justify-center text-left transition-all cursor-pointer ${
                              (layout.filter ?? "wink_hd") === opt.id
                                ? "border-ember bg-ember/20 text-white shadow-xs"
                                : "border-hairline bg-black/40 text-muted hover:text-ink hover:border-white/20"
                            }`}
                          >
                            <span className={`text-[11px] font-bold ${(layout.filter ?? "wink_hd") === opt.id ? "text-ember" : "text-ink"}`}>
                              {opt.label}
                            </span>
                            <span className="text-[9px] text-muted line-clamp-1">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <VideoKeyframeControls
                      currentTime={currentTimeNow}
                      duration={videoDuration}
                      keyframes={manualKeyframes}
                      currentPanX={currentPanX}
                      currentZoom={currentZoom}
                      splitTopPanX={layout.splitTopPanX}
                      splitBottomPanX={layout.splitBottomPanX}
                      onPanChange={handlePanChange}
                      onZoomChange={handleZoomChange}
                      onSplitPanChange={handleSplitPanChange}
                      onAddKeyframe={handleAddKeyframe}
                      onRemoveKeyframe={handleRemoveKeyframe}
                      onSeek={(t) => {
                        const v = videoRef.current;
                        if (v) {
                          v.currentTime = t;
                          setCurrentTimeNow(t);
                        }
                      }}
                      framingMode={framingMode}
                      onFramingModeChange={handleFramingModeChange}
                      onRunAITrack={() => runFaceTrack("podcast_dynamic")}
                      isAITracking={trackingFace}
                    />
                  </div>
                )}
                {editorTab === "subtitles" && (
                  <div className="space-y-3.5">
                    <div className="rounded-xl border border-hairline bg-surface-raised/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-mini font-semibold text-ink">Bahasa Subtitle</p>
                          <p className="text-micro text-muted">Timing suara tetap dikunci.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-1 rounded-lg bg-obsidian/60 p-1">
                          {(["id", "en"] as const).map((language) => (
                            <button key={language} type="button" disabled={translating} onClick={() => translateCaptions(language)} className={`h-8 rounded-md px-3 text-micro font-bold transition-colors disabled:opacity-60 ${captionLanguage === language ? "bg-ember text-obsidian" : "text-muted hover:text-ink"}`}>
                              {translating && language !== captionLanguage ? "..." : language.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {words.length > 0 ? (
                      <SentenceTimelineEditor
                        words={words}
                        lines={lines}
                        currentTime={currentTimeNow}
                        onSeek={(t) => {
                          const v = videoRef.current;
                          if (v) {
                            v.currentTime = t;
                            setCurrentTimeNow(t);
                          }
                        }}
                        onChange={setWords}
                      />
                    ) : (
                      <div className="rounded-xl border border-hairline bg-surface-raised/30 p-6 text-center space-y-2">
                        <p className="text-mini text-muted font-medium">Belum ada subtitle.</p>
                        <button type="button" onClick={generate} className="btn-ember inline-flex h-9 items-center justify-center rounded-lg px-4 text-xs font-bold text-obsidian">Buat Subtitle AI Sekarang</button>
                      </div>
                    )}
                  </div>
                )}
                {editorTab === "style" && (
                  <StylePanel style={style} onChange={setStyle} bitrate={bitrate} presetId={presetId} onPreset={(id) => { const next = SOCIAL_PRESETS.find((item) => item.id === id); if (!next) return; setPresetId(id); setBitrate(next.mbps); setStyle((current) => ({ ...current, ...next.style })); }} />
                )}
                {editorTab === "export" && (
                  <div className="space-y-4">
                    <label className="flex items-start gap-2.5 rounded-xl border border-hairline bg-surface-raised/40 p-3.5 text-mini text-ink cursor-pointer hover:border-ember/40 transition-colors">
                      <input type="checkbox" checked={noWatermark} onChange={(e) => setNoWatermark(e.target.checked)} className="mt-0.5 size-4 accent-ember rounded" />
                      <div>
                        <span className="font-semibold">Hapus watermark malesan.my.id</span>{" "}
                        <span className="text-ember font-bold">(+{noWatermarkCost} kredit)</span>
                        <span className="block mt-0.5 text-micro text-muted">Kalau gak dicentang, watermark tetap nempel halus (gratis).</span>
                      </div>
                    </label>
                    <div className="rounded-xl border border-hairline bg-surface-raised/30 p-3 text-micro text-muted space-y-1">
                      <div className="flex justify-between font-mono"><span>Kualitas Render:</span><span className="text-ink font-semibold">1080p HD (1080x1920)</span></div>
                      <div className="flex justify-between font-mono"><span>Bitrate Video:</span><span className="text-ink font-semibold">{bitrate} Mbps (Ukuran Ringan)</span></div>
                    </div>
                    <button onClick={doExport} disabled={busy || words.length === 0} className="btn-ember flex items-center justify-center gap-2 w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold text-obsidian shadow-md transition-transform active:scale-[0.99] disabled:opacity-50">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                      </svg>
                      <span>{phase === "exporting" ? `Lagi render... ${progress}%` : "Export Video Mateng"}</span>
                    </button>
                    <p className="text-micro leading-snug text-muted text-center">Tiap frame digambar satu-satu di browser kamu. Kualitas 1080p HD jernih tanpa beban ukuran berlebih.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Semi-Transparent Frosted Glass Bottom Drawer with Backdrop */}
          {activeDrawer && (
            <>
              <div
                onClick={() => setActiveDrawer(null)}
                className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
              />
              <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 max-h-[55vh] rounded-t-3xl border-t border-white/20 bg-obsidian/95 p-4 pb-20 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom duration-200 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-ember animate-pulse" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      {activeDrawer === "frame"
                        ? "Pengaturan Bingkai & Sudut"
                        : activeDrawer === "subtitles"
                        ? "Pengaturan Teks & Subtitle"
                        : activeDrawer === "style"
                        ? "Gaya Tampilan Subtitle"
                        : "Export Video Mateng"}
                    </h4>
                  </div>
                  <button
                    type="button"
                    aria-label="Tutup Pengaturan"
                    onClick={() => setActiveDrawer(null)}
                    className="flex size-7 items-center justify-center rounded-full bg-white/10 text-mist hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>

              {activeDrawer === "frame" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-hairline bg-surface-raised/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">Rasio Video</span>
                      <span className="text-[11px] font-mono text-ember font-bold">{layout.ratio}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["9:16", "1:1", "16:9"] as const).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setLayout((curr) => ({ ...curr, ratio }))}
                          className={`h-8.5 rounded-lg border font-mono text-xs font-bold transition-all ${
                            layout.ratio === ratio
                              ? "border-ember bg-ember/20 text-ember shadow-xs"
                              : "border-hairline bg-black/40 text-muted hover:text-ink"
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kejernihan & Filter Visual (Ala Wink HD) */}
                  <div className="rounded-xl border border-hairline bg-surface-raised/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5 text-ember">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                        </svg>
                        <span className="text-xs font-bold text-ink">Kejernihan &amp; Filter Visual</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-ember/15 text-ember font-bold">Ala Wink HD</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "wink_hd", label: "Wink HD Clarity", desc: "Super jernih & tajam" },
                        { id: "fyp_pop", label: "FYP Pop Glow", desc: "Warna cerah & hidup" },
                        { id: "soft_clean", label: "Soft De-noise", desc: "Halus bebas bintik" },
                        { id: "original", label: "Original", desc: "Alami apa adanya" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setLayout((curr) => ({ ...curr, filter: opt.id as ClarityFilter }))}
                          className={`h-11 rounded-lg border px-2.5 flex flex-col items-start justify-center text-left transition-all cursor-pointer ${
                            (layout.filter ?? "wink_hd") === opt.id
                              ? "border-ember bg-ember/20 text-white shadow-xs"
                              : "border-hairline bg-black/40 text-muted hover:text-ink hover:border-white/20"
                          }`}
                        >
                          <span className={`text-[11px] font-bold ${(layout.filter ?? "wink_hd") === opt.id ? "text-ember" : "text-ink"}`}>
                            {opt.label}
                          </span>
                          <span className="text-[9px] text-muted line-clamp-1">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <VideoKeyframeControls
                    currentTime={currentTimeNow}
                    duration={videoDuration}
                    keyframes={manualKeyframes}
                    currentPanX={currentPanX}
                    currentZoom={currentZoom}
                    splitTopPanX={layout.splitTopPanX}
                    splitBottomPanX={layout.splitBottomPanX}
                    onPanChange={handlePanChange}
                    onZoomChange={handleZoomChange}
                    onSplitPanChange={handleSplitPanChange}
                    onAddKeyframe={handleAddKeyframe}
                    onRemoveKeyframe={handleRemoveKeyframe}
                    onSeek={(t) => {
                      const v = videoRef.current;
                      if (v) {
                        v.currentTime = t;
                        setCurrentTimeNow(t);
                      }
                    }}
                    framingMode={framingMode}
                    onFramingModeChange={handleFramingModeChange}
                    onRunAITrack={() => runFaceTrack("podcast_dynamic")}
                    isAITracking={trackingFace}
                  />
                </div>
              )}

              {activeDrawer === "subtitles" && (
                <div className="space-y-3.5">
                  <div className="rounded-xl border border-hairline bg-surface-raised/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-mini font-semibold text-ink">Bahasa Subtitle</p>
                        <p className="text-micro text-muted">Timing suara tetap dikunci.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-1 rounded-lg bg-obsidian/60 p-1">
                        {(["id", "en"] as const).map((language) => (
                          <button key={language} type="button" disabled={translating} onClick={() => translateCaptions(language)} className={`h-8 rounded-md px-3 text-micro font-bold transition-colors disabled:opacity-60 ${captionLanguage === language ? "bg-ember text-obsidian" : "text-muted hover:text-ink"}`}>
                            {translating && language !== captionLanguage ? "..." : language.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {words.length > 0 ? (
                    <SentenceTimelineEditor
                      words={words}
                      lines={lines}
                      currentTime={currentTimeNow}
                      onSeek={(t) => {
                        const v = videoRef.current;
                        if (v) {
                          v.currentTime = t;
                          setCurrentTimeNow(t);
                        }
                      }}
                      onChange={setWords}
                    />
                  ) : (
                    <div className="rounded-xl border border-hairline bg-surface-raised/30 p-6 text-center space-y-2">
                      <p className="text-mini text-muted font-medium">Belum ada subtitle.</p>
                      <button type="button" onClick={generate} className="btn-ember inline-flex h-9 items-center justify-center rounded-lg px-4 text-xs font-bold text-obsidian">Buat Subtitle AI Sekarang</button>
                    </div>
                  )}
                </div>
              )}

              {activeDrawer === "style" && (
                <StylePanel style={style} onChange={setStyle} bitrate={bitrate} presetId={presetId} onPreset={(id) => { const next = SOCIAL_PRESETS.find((item) => item.id === id); if (!next) return; setPresetId(id); setBitrate(next.mbps); setStyle((current) => ({ ...current, ...next.style })); }} />
              )}

              {activeDrawer === "export" && (
                <div className="space-y-4">
                  <label className="flex items-start gap-2.5 rounded-xl border border-hairline bg-surface-raised/40 p-3.5 text-mini text-ink cursor-pointer hover:border-ember/40 transition-colors">
                    <input type="checkbox" checked={noWatermark} onChange={(e) => setNoWatermark(e.target.checked)} className="mt-0.5 size-4 accent-ember rounded" />
                    <div>
                      <span className="font-semibold">Hapus watermark malesan.my.id</span>{" "}
                      <span className="text-ember font-bold">(+{noWatermarkCost} kredit)</span>
                      <span className="block mt-0.5 text-micro text-muted">Kalau gak dicentang, watermark tetap nempel halus (gratis).</span>
                    </div>
                  </label>
                  <div className="rounded-xl border border-hairline bg-surface-raised/30 p-3 text-micro text-muted space-y-1">
                    <div className="flex justify-between font-mono"><span>Kualitas Render:</span><span className="text-ink font-semibold">1080p HD (1080x1920)</span></div>
                    <div className="flex justify-between font-mono"><span>Bitrate Video:</span><span className="text-ink font-semibold">{bitrate} Mbps (Ukuran Ringan)</span></div>
                  </div>
                  <button onClick={doExport} disabled={busy || words.length === 0} className="btn-ember flex items-center justify-center gap-2 w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold text-obsidian shadow-md transition-transform active:scale-[0.99] disabled:opacity-50">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                    <span>{phase === "exporting" ? `Lagi render... ${progress}%` : "Export Video Mateng"}</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      )}

      {error && <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      {doneMsg && <p className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">{doneMsg}</p>}

      {/* Completion & Project History Modals */}
      <VideoCompletionModal
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        videoUrl={renderedVideoUrl}
        videoFile={exportedVideoFile}
        videoTitle={file?.name.replace(/\.[^.]+$/, "") || "video"}
        isAPK={isNativeAPK}
        transcriptionText={words.map((w) => w.word).join(" ")}
      />
      <VideoProjectHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        onSelectProject={handleSelectProject}
      />
    </div>
  );
}

function UploadDrop({ onPick }: { onPick: (f: File | null) => void }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-hairline bg-surface px-6 py-14 text-center transition-colors hover:border-ember/50">
      <svg viewBox="0 0 24 24" className="size-10 fill-ember" aria-hidden="true">
        <path d="M12 3 8 7h3v7h2V7h3l-4-4Zm-7 12v4h14v-4h2v6H3v-6h2Z" />
      </svg>
      <span className="text-sm font-semibold text-ink">Tap buat pilih video (MP4)</span>
      <span className="text-mini text-muted">
        Maksimal ~10 menit. Video tetap diproses di HP atau laptop lo, jadi filenya gak dikirim ke mana-mana.
      </span>
      <input
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function SafeZones() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {/* Right button area guide */}
      <div className="absolute inset-y-0 right-0 w-[16%] border-l border-dashed border-white/20" />
      {/* Bottom caption safe area guide */}
      <div className="absolute inset-x-0 bottom-0 h-[18%] border-t border-dashed border-white/20" />
      <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 border-y border-dashed border-white/20" />
      <span className="absolute bottom-2 left-2 rounded bg-obsidian/80 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
        area caption aman
      </span>
    </div>
  );
}

function VideoPreviewPlayer({
  videoRef,
  videoUrl,
  lines,
  style,
  safeZones,
  layout,
  watermark = true,
  onTimeChange,
  onDurationChange,
  onManualPanChange,
  onSplitPanChange,
  onSubtitleYChange,
  onAttachVideo,
  onResetStudio,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  lines: Line[];
  style: CaptionStyle;
  safeZones: boolean;
  layout: VideoLayout;
  watermark?: boolean;
  onTimeChange?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onManualPanChange?: (panX: number) => void;
  onSplitPanChange?: (speaker: "top" | "bottom", panX: number) => void;
  onSubtitleYChange?: (y: number) => void;
  onAttachVideo?: (file: File) => void;
  onResetStudio?: () => void;
}) {
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [subtitleDragging, setSubtitleDragging] = useState(false);
  const subDragInfoRef = useRef<{ isDragging: boolean; startY: number; startPos: number; moved: boolean }>({
    isDragging: false,
    startY: 0,
    startPos: 0.8,
    moved: false,
  });
  const rafRef = useRef<number | null>(null);
  const isPodcastSplit = layout.ratio === "9:16" && layout.focus === "podcast_split";
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const dragInfoRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    target: "single" | "top" | "bottom";
    moved: boolean;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    target: "single",
    moved: false,
  });

  const cssFilter = useMemo(() => {
    const f = layout.filter ?? "wink_hd";
    if (f === "wink_hd") return "contrast(1.16) brightness(1.03) saturate(1.12)";
    if (f === "fyp_pop") return "contrast(1.20) brightness(1.04) saturate(1.24)";
    if (f === "soft_clean") return "contrast(1.08) brightness(1.02) saturate(1.05)";
    return "none";
  }, [layout.filter]);

  const handleSubtitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    triggerHaptic(10);
    const startPos = layout.subtitleY ?? style.position ?? 0.8;
    subDragInfoRef.current = {
      isDragging: true,
      startY: e.clientY,
      startPos,
      moved: false,
    };
    setSubtitleDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleSubtitlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!subDragInfoRef.current.isDragging) return;
    const deltaY = e.clientY - subDragInfoRef.current.startY;
    if (Math.abs(deltaY) > 3) subDragInfoRef.current.moved = true;
    const nextY = Math.max(0.12, Math.min(0.88, subDragInfoRef.current.startPos + deltaY / 380));
    onSubtitleYChange?.(Number(nextY.toFixed(3)));
  };

  const handleSubtitlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    subDragInfoRef.current.isDragging = false;
    setSubtitleDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      const v = videoRef.current;
      if (v && !v.paused) {
        const ct = v.currentTime;
        setNow(ct);
        onTimeChange?.(ct);
        if (Number.isFinite(v.duration) && v.duration > 0 && duration !== v.duration) {
          setDuration(v.duration);
          onDurationChange?.(v.duration);
        }

        // Frame-level locking for podcast split view without freezing the decoder
        if (isPodcastSplit) {
          const v2 = secondaryVideoRef.current;
          if (v2) {
            const drift = ct - v2.currentTime;
            if (Math.abs(drift) > 0.4) {
              // Desync is large (>400ms): one single seek
              v2.currentTime = ct;
            } else if (drift > 0.03) {
              // Secondary is lagging behind slightly: speed it up to catch up smoothly
              v2.playbackRate = 1.08;
            } else if (drift < -0.03) {
              // Secondary is slightly ahead: slow it down to let primary catch up
              v2.playbackRate = 0.92;
            } else if (v2.playbackRate !== 1.0) {
              // In perfect sync: standard playback speed
              v2.playbackRate = 1.0;
            }
            if (v2.paused) {
              void v2.play().catch(() => {});
            }
          }
        }
      } else if (v && v.paused && isPodcastSplit) {
        const v2 = secondaryVideoRef.current;
        if (v2) {
          if (!v2.paused) v2.pause();
          v2.playbackRate = 1.0;
          if (Math.abs(v2.currentTime - v.currentTime) > 0.02) {
            v2.currentTime = v.currentTime;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef, onTimeChange, onDurationChange, duration, isPodcastSplit]);

  // Sync secondary video with primary video during playback/seek for split view
  useEffect(() => {
    if (!isPodcastSplit) return;
    const v1 = videoRef.current;
    const v2 = secondaryVideoRef.current;
    if (!v1 || !v2) return;

    const onPlay = () => {
      v2.currentTime = v1.currentTime;
      v2.playbackRate = 1.0;
      void v2.play().catch(() => {});
    };
    const onPause = () => {
      v2.pause();
      v2.playbackRate = 1.0;
      v2.currentTime = v1.currentTime;
    };
    const onSeeking = () => {
      v2.currentTime = v1.currentTime;
      v2.playbackRate = 1.0;
    };
    const onSeeked = () => {
      v2.currentTime = v1.currentTime;
      v2.playbackRate = 1.0;
    };

    v1.addEventListener("play", onPlay);
    v1.addEventListener("pause", onPause);
    v1.addEventListener("seeking", onSeeking);
    v1.addEventListener("seeked", onSeeked);
    return () => {
      v1.removeEventListener("play", onPlay);
      v1.removeEventListener("pause", onPause);
      v1.removeEventListener("seeking", onSeeking);
      v1.removeEventListener("seeked", onSeeked);
    };
  }, [isPodcastSplit, videoRef]);

  const active = activeAt(lines, now);
  const tracked = layout.trajectory?.length ? cropFocusAt(layout.trajectory, now) : null;
  const currentKeyframe = layout.manualKeyframes?.length
    ? interpolateKeyframes(layout.manualKeyframes, now, layout.panX ?? 0.5, 0.45, layout.zoom ?? 1.0)
    : null;

  const currentPanX = currentKeyframe?.panX ?? (tracked ? tracked.x : layout.panX ?? (layout.focus === "left" ? 0.2 : layout.focus === "right" ? 0.8 : 0.5));
  const currentPanY = currentKeyframe?.panY ?? (tracked ? tracked.y : 0.45);
  const currentZoom = currentKeyframe?.zoom ?? layout.zoom ?? 1.0;

  const objectPosition = `${(currentPanX * 100).toFixed(2)}% ${(currentPanY * 100).toFixed(2)}%`;
  const topObjectPosition = `${((layout.splitTopPanX ?? 0.25) * 100).toFixed(2)}% 45%`;
  const bottomObjectPosition = `${((layout.splitBottomPanX ?? 0.75) * 100).toFixed(2)}% 45%`;
  const videoTransform = currentZoom > 1.01 ? `scale(${currentZoom.toFixed(2)})` : undefined;
  const resolvedVideoSrc = videoUrl
    ? videoUrl.includes("#t=")
      ? videoUrl
      : `${videoUrl}#t=0.001`
    : undefined;

  const containerRatioClass =
    layout.ratio === "9:16"
      ? "aspect-[9/16] w-full max-w-[270px] xs:max-w-[290px] sm:max-w-[320px] mx-auto"
      : layout.ratio === "16:9"
      ? "aspect-video w-full max-w-[480px] mx-auto"
      : "aspect-square w-full max-w-[330px] mx-auto";

  const togglePlay = () => {
    triggerHaptic(14);
    const v = videoRef.current;
    const v2 = secondaryVideoRef.current;
    if (!v) return;
    if (v.paused) {
      if (isPodcastSplit && v2) {
        v2.currentTime = v.currentTime;
        void v2.play().catch(() => {});
      }
      void v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      if (isPodcastSplit && v2) {
        v2.pause();
      }
      setIsPlaying(false);
    }
  };

  const handlePointerDownTarget = (e: React.PointerEvent<HTMLDivElement>, target: "single" | "top" | "bottom") => {
    triggerHaptic(8);
    const startPan = target === "top"
      ? (layout.splitTopPanX ?? 0.25)
      : target === "bottom"
      ? (layout.splitBottomPanX ?? 0.75)
      : currentPanX;

    dragInfoRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: startPan,
      target,
      moved: false,
    };
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMoveTarget = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragInfoRef.current.isDragging) return;
    const deltaX = e.clientX - dragInfoRef.current.startX;
    const deltaY = e.clientY - dragInfoRef.current.startY;
    if (Math.hypot(deltaX, deltaY) > 4) {
      dragInfoRef.current.moved = true;
    }

    const panSensitivity = 0.0025;
    const nextPanX = Math.max(0, Math.min(1, dragInfoRef.current.startPanX - deltaX * panSensitivity));

    if (dragInfoRef.current.target === "top") {
      onSplitPanChange?.("top", nextPanX);
    } else if (dragInfoRef.current.target === "bottom") {
      onSplitPanChange?.("bottom", nextPanX);
    } else {
      onManualPanChange?.(nextPanX);
    }
  };

  const handlePointerUpTarget = () => {
    if (dragInfoRef.current.isDragging && !dragInfoRef.current.moved) {
      togglePlay();
    }
    dragInfoRef.current.isDragging = false;
    setIsDragging(false);
  };

  const formatMinSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center w-full space-y-2">
      {/* 9:16 True Phone Canvas */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl ring-1 ring-white/5 touch-none select-none cursor-grab active:cursor-grabbing ${containerRatioClass}`}
      >
        {/* Ultra-Luxury Watermark Preview */}
        {watermark && (
          <div className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full border border-ember/30 bg-black/60 px-2.5 py-1 backdrop-blur-md shadow-md">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-3 text-ember drop-shadow-[0_0_4px_rgba(255,138,61,0.6)]">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
            </svg>
            <span className="font-display text-[11px] font-extrabold tracking-wide text-white">malesan<span className="text-ember font-bold">.my.id</span></span>
          </div>
        )}

        {/* Interactive Drag Hint */}
        <div className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full border border-white/15 bg-black/70 px-2.5 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-md shadow-md">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-2.5 text-ember"><path d="M8 9l-4 3 4 3M16 9l4 3-4 3"/></svg>
          <span>{isPodcastSplit ? "Geser kamera atas / bawah" : "Geser sudut kamera"}</span>
        </div>

        {/* If videoUrl is missing (standby draft), show clean dedicated obsidian reconnect canvas */}
        {!videoUrl ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-5 text-center bg-gradient-to-b from-surface via-obsidian to-black space-y-3.5 select-none">
            <div className="relative size-14 rounded-2xl bg-ember/15 border border-ember/30 flex items-center justify-center text-ember shadow-xl shadow-ember/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <span className="absolute -top-1 -right-1 flex size-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ember opacity-75" />
                <span className="relative inline-flex rounded-full size-3 bg-ember" />
              </span>
            </div>

            <div className="space-y-1 max-w-[240px]">
              <h3 className="font-display text-xs font-bold text-white tracking-wide">
                Hubungkan File Video
              </h3>
              <p className="text-mist text-[11px] leading-relaxed">
                Subtitle draf ({lines.length} baris) sudah termuat. Hubungkan file videonya dari HP kamu untuk memutar preview &amp; ekspor.
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 pt-0.5">
              <label className="btn-ember flex h-9.5 px-4 items-center justify-center gap-1.5 rounded-xl font-bold text-obsidian text-xs cursor-pointer shadow-lg shadow-ember/25 hover:brightness-110 active:scale-95 transition-all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5"><path d="M12 3 8 7h3v7h2V7h3l-4-4Zm-7 12v4h14v-4h2v6H3v-6h2Z"/></svg>
                <span>Pilih Video dari HP</span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) onAttachVideo?.(picked);
                  }}
                  className="hidden"
                />
              </label>

              {onResetStudio && (
                <button
                  type="button"
                  onClick={onResetStudio}
                  className="text-[11px] font-semibold text-mist hover:text-ember transition-colors py-1 cursor-pointer flex items-center gap-1 active:scale-95"
                >
                  <span>Atau Mulai Klip Baru</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              )}
            </div>

            <p className="text-[10px] text-muted max-w-[210px] leading-tight">
              📁 Tersimpan di album Galeri atau folder Download / DCIM Malesan.
            </p>
          </div>
        ) : (
          <>
            {/* Interactive Drag Hint */}
            <div className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full border border-white/15 bg-black/70 px-2.5 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-md shadow-md">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-2.5 text-ember"><path d="M8 9l-4 3 4 3M16 9l4 3-4 3"/></svg>
              <span>{isPodcastSplit ? "Geser kamera atas / bawah" : "Geser sudut kamera"}</span>
            </div>

            {/* Custom Frosted Play Icon Overlay when Paused (Non-blocking backdrop) */}
            {!isPlaying && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-[1px] transition-all">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-ember text-obsidian shadow-2xl ring-4 ring-ember/30 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  aria-label="Play Video"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-7 translate-x-0.5"><path d="M8 5v14l11-7z"/></svg>
                </button>
              </div>
            )}

            {isPodcastSplit ? (
              <div className="absolute inset-0 flex flex-col">
                {/* Top Half: Left Speaker (Host) */}
                <div
                  onPointerDown={(e) => handlePointerDownTarget(e, "top")}
                  onPointerMove={handlePointerMoveTarget}
                  onPointerUp={handlePointerUpTarget}
                  onPointerCancel={handlePointerUpTarget}
                  className="relative h-1/2 w-full overflow-hidden border-b border-white/30 cursor-grab active:cursor-grabbing"
                >
                  <div className="pointer-events-none absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-blue-300 border border-blue-400/30">
                    <span className="size-1.5 rounded-full bg-blue-400" />
                    <span>Host (Atas)</span>
                  </div>
                  <video
                    ref={videoRef}
                    src={resolvedVideoSrc}
                    preload="auto"
                    playsInline
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => {
                      setNow(e.currentTarget.currentTime);
                      onTimeChange?.(e.currentTarget.currentTime);
                    }}
                    onSeeked={(e) => {
                      setNow(e.currentTarget.currentTime);
                      onTimeChange?.(e.currentTarget.currentTime);
                    }}
                    className={`absolute inset-0 h-full w-full object-cover ${isDragging ? "transition-none" : "transition-[object-position] duration-75"}`}
                    style={{ objectPosition: topObjectPosition, filter: cssFilter }}
                  />
                </div>

                {/* Bottom Half: Right Speaker (Guest) */}
                <div
                  onPointerDown={(e) => handlePointerDownTarget(e, "bottom")}
                  onPointerMove={handlePointerMoveTarget}
                  onPointerUp={handlePointerUpTarget}
                  onPointerCancel={handlePointerUpTarget}
                  className="relative h-1/2 w-full overflow-hidden cursor-grab active:cursor-grabbing"
                >
                  <div className="pointer-events-none absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300 border border-emerald-400/30">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    <span>Tamu (Bawah)</span>
                  </div>
                  <video
                    ref={secondaryVideoRef}
                    src={resolvedVideoSrc}
                    preload="auto"
                    muted
                    playsInline
                    className={`absolute inset-0 h-full w-full object-cover ${isDragging ? "transition-none" : "transition-[object-position] duration-75"}`}
                    style={{ objectPosition: bottomObjectPosition, filter: cssFilter }}
                  />
                </div>
              </div>
            ) : (
              <div
                onPointerDown={(e) => handlePointerDownTarget(e, "single")}
                onPointerMove={handlePointerMoveTarget}
                onPointerUp={handlePointerUpTarget}
                onPointerCancel={handlePointerUpTarget}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
              >
                <video
                  ref={videoRef}
                  src={resolvedVideoSrc}
                  preload="auto"
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={(e) => {
                    setNow(e.currentTarget.currentTime);
                    onTimeChange?.(e.currentTarget.currentTime);
                  }}
                  onSeeked={(e) => {
                    setNow(e.currentTarget.currentTime);
                    onTimeChange?.(e.currentTarget.currentTime);
                  }}
                  className={`absolute inset-0 h-full w-full object-cover ${isDragging ? "transition-none" : "transition-[object-position] duration-75"}`}
                  style={{
                    objectPosition,
                    filter: cssFilter,
                    transform: videoTransform,
                    transformOrigin: `${(currentPanX * 100).toFixed(2)}% ${(currentPanY * 100).toFixed(2)}%`,
                  }}
                />
              </div>
            )}
          </>
        )}

        {tracked && (
          <div className="pointer-events-none absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5 rounded-full border border-ember/50 bg-black/80 px-2.5 py-1 text-[10px] font-bold text-white shadow-xl backdrop-blur-md">
            <span className="size-2 rounded-full bg-ember animate-pulse" />
            <span className="text-ember font-extrabold tracking-wide">
              {currentPanX < 0.38 ? "Host (Kiri)" : currentPanX > 0.62 ? "Tamu (Kanan)" : "Fokus Utama"}
            </span>
            <span className="text-[9px] text-white/70 font-mono">
              ({Math.round(currentPanX * 100)}%)
            </span>
          </div>
        )}
        {safeZones && <SafeZones />}
        {active && (
          <CaptionOverlay
            line={active.line}
            now={now}
            style={style}
            subtitleY={layout.subtitleY}
            isDragging={subtitleDragging}
            onPointerDown={handleSubtitlePointerDown}
            onPointerMove={handleSubtitlePointerMove}
            onPointerUp={handleSubtitlePointerUp}
          />
        )}
      </div>

      {/* Sleek Mini Timeline Scrubber */}
      {videoUrl ? (
        <div className="w-full max-w-[270px] xs:max-w-[290px] sm:max-w-[320px] flex items-center gap-2 px-1 py-1 rounded-xl bg-surface-raised border border-hairline shadow-xs">
          <button
            type="button"
            onClick={togglePlay}
            className="flex size-7 items-center justify-center rounded-lg bg-ember text-obsidian font-bold shadow-xs hover:bg-ember/90 shrink-0 transition-transform active:scale-95"
            aria-label={isPlaying ? "Pause Video" : "Play Video"}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 translate-x-0.5"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          <span className="font-mono text-[10px] font-bold text-ink shrink-0">
            {formatMinSec(now)}
          </span>

          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.05"
            value={now}
            onChange={(e) => {
              const t = parseFloat(e.target.value);
              const v = videoRef.current;
              const v2 = secondaryVideoRef.current;
              if (v) {
                v.currentTime = t;
                setNow(t);
                onTimeChange?.(t);
              }
              if (isPodcastSplit && v2) {
                v2.currentTime = t;
              }
            }}
            className="flex-1 accent-ember cursor-pointer h-1.5 bg-white/20 rounded-lg"
            aria-label="Timeline Video"
          />

          <span className="font-mono text-[10px] font-semibold text-mist shrink-0">
            {formatMinSec(duration)}
          </span>
        </div>
      ) : (
        <div className="w-full max-w-[270px] xs:max-w-[290px] sm:max-w-[320px] flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-surface-raised/70 border border-hairline/60 text-xs text-mist font-medium">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-[11px]">Hubungkan video untuk memutar preview</span>
        </div>
      )}
    </div>
  );
}




function SentenceTimelineEditor({
  words,
  lines,
  currentTime,
  onSeek,
  onChange,
}: {
  words: Word[];
  lines: Line[];
  currentTime: number;
  onSeek: (t: number) => void;
  onChange: (w: Word[]) => void;
}) {
  const [viewMode, setViewMode] = useState<"timeline" | "paragraph">("timeline");
  const text = useMemo(() => words.map((w) => w.word).join(" "), [words]);

  const commitBulk = (newVal: string) => {
    const tokens = newVal.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return;
    if (tokens.length <= words.length) {
      onChange(
        words
          .map((w, i) => (i < tokens.length ? { ...w, word: tokens[i] } : w))
          .filter((_, i) => i < tokens.length),
      );
    } else {
      const totalDur = words.length ? words[words.length - 1].end : 5;
      const durPerTok = totalDur / tokens.length;
      onChange(
        tokens.map((tok, i) => ({
          word: tok,
          start: i < words.length ? words[i].start : i * durPerTok,
          end: i < words.length ? words[i].end : (i + 1) * durPerTok,
        })),
      );
    }
  };

  const updateLineText = (lineIdx: number, newText: string) => {
    const targetLine = lines[lineIdx];
    if (!targetLine) return;
    const tokens = newText.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return;

    const start = targetLine.start;
    const end = targetLine.end;
    const dur = Math.max(0.2, end - start);
    const durPerToken = dur / tokens.length;

    const newWordsForLine: Word[] = tokens.map((tok, i) => ({
      word: tok,
      start: Number((start + i * durPerToken).toFixed(2)),
      end: Number((start + (i + 1) * durPerToken).toFixed(2)),
    }));

    const lineStartIndex = words.findIndex(
      (w) => w.start === targetLine.words[0]?.start && w.word === targetLine.words[0]?.word
    );
    if (lineStartIndex === -1) {
      const before = words.filter((w) => w.end <= start);
      const after = words.filter((w) => w.start >= end);
      onChange([...before, ...newWordsForLine, ...after]);
      return;
    }

    const before = words.slice(0, lineStartIndex);
    const after = words.slice(lineStartIndex + targetLine.words.length);
    onChange([...before, ...newWordsForLine, ...after]);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m.toString().padStart(2, "0")}:${s.padStart(4, "0")}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-mini font-bold text-ink">Edit Teks Subtitle ({lines.length} Kalimat)</p>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-raised p-0.5 border border-hairline text-micro font-bold">
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`px-2 py-1 rounded-md transition-colors ${viewMode === "timeline" ? "bg-ember text-obsidian" : "text-muted hover:text-ink"}`}
          >
            Per Kalimat
          </button>
          <button
            type="button"
            onClick={() => setViewMode("paragraph")}
            className={`px-2 py-1 rounded-md transition-colors ${viewMode === "paragraph" ? "bg-ember text-obsidian" : "text-muted hover:text-ink"}`}
          >
            Paragraf
          </button>
        </div>
      </div>

      {viewMode === "paragraph" ? (
        <div className="rounded-xl border border-hairline bg-surface p-3 space-y-2">
          <textarea
            key={text}
            defaultValue={text}
            onBlur={(e) => commitBulk(e.target.value)}
            rows={5}
            placeholder="Teks subtitle..."
            className="w-full resize-none rounded-lg border border-hairline bg-obsidian/40 p-2.5 text-sm text-ink outline-none focus:border-ember/50"
          />
          <p className="text-micro text-muted">
            Ketuk di luar kotak untuk menerapkan perubahan teks secara massal.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
          {lines.map((line, idx) => {
            const isSpeaking = currentTime >= line.start && currentTime <= line.end + 0.3;
            const lineStr = line.words.map((w) => w.word).join(" ");
            return (
              <div
                key={`${idx}-${line.start}`}
                className={`rounded-xl border p-2.5 transition-all ${
                  isSpeaking
                    ? "border-ember bg-ember/10 ring-1 ring-ember/30"
                    : "border-hairline bg-surface-raised/40 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <button
                    type="button"
                    onClick={() => onSeek(line.start)}
                    className="flex items-center gap-1 rounded-md bg-obsidian/70 px-2 py-0.5 text-micro font-mono font-bold text-ember border border-hairline hover:bg-ember hover:text-obsidian transition-colors cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-2.5"><path d="M8 5v14l11-7z"/></svg>
                    <span>{formatTime(line.start)} - {formatTime(line.end)}</span>
                  </button>
                  {isSpeaking && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ember/20 px-2 py-0.5 text-[9px] font-bold text-ember">
                      <span className="size-1.5 rounded-full bg-ember animate-pulse" />
                      Sedang Bicara
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  defaultValue={lineStr}
                  onBlur={(e) => {
                    if (e.target.value !== lineStr) {
                      updateLineText(idx, e.target.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-full rounded-lg border border-hairline/80 bg-obsidian/60 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-ember/60 transition-colors"
                  placeholder="Ketik kalimat ini..."
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Preview overlay: same per-word reveal the export burns in — only spoken
 *  words show, the latest one lit, with touch-drag positioning. */
function CaptionOverlay({
  line,
  now,
  style,
  subtitleY,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  line: Line;
  now: number;
  style: CaptionStyle;
  subtitleY?: number;
  isDragging?: boolean;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const spoken = line.words.filter((w) => w.start <= now + 0.01).length;
  if (!spoken) return null;
  const currentIdx = spoken - 1;
  const enter = Math.min(1, Math.max(0, now - line.words[currentIdx].start) / 0.14);
  const eased = 1 - Math.pow(1 - enter, 3);
  const shown =
    style.mode === "word"
      ? [{ text: line.words[currentIdx].word, active: true }]
      : line.words.map((w, i) => ({ text: w.word, active: i === currentIdx }));

  const effectivePos = subtitleY ?? style.position;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 justify-center px-3 text-center z-30 select-none"
      style={{ top: `${effectivePos * 100}%` }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`pointer-events-auto touch-none cursor-ns-resize max-w-[92%] transition-all ${
          isDragging ? "ring-2 ring-ember/80 rounded-xl bg-black/60 px-3 py-1 shadow-2xl scale-105" : ""
        }`}
      >
        {isDragging && (
          <span className="pointer-events-none block -mt-4 mb-1 text-[9px] font-extrabold text-ember uppercase tracking-wider">
            Posisi Teks: {Math.round(effectivePos * 100)}%
          </span>
        )}
        <p
          className="leading-[1.45] drop-shadow-md"
          style={{
            fontFamily: `"${style.fontFamily}", sans-serif`,
            fontWeight: style.bold ? 800 : 700,
            fontSize: `calc(${style.mode === "word" ? "clamp(16px, 5.2vw, 26px)" : "clamp(12px, 3.8vw, 19px)"} * ${style.fontScale})`,
            color: style.textColor,
            textShadow:
              style.style === "outline"
                ? "-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 3px 6px rgba(0,0,0,0.9)"
                : style.style === "plain"
                  ? "0 2px 8px rgba(0,0,0,0.95)"
                  : "none",
            background: style.style === "box" ? "rgba(12,10,8,0.72)" : "transparent",
            padding: style.style === "box" ? "0.3em 0.6em" : 0,
            borderRadius: style.style === "box" ? "0.45em" : 0,
            border: style.style === "box" ? "1px solid rgba(255,255,255,0.12)" : "none",
            opacity: style.animation === "fade" ? eased : 1,
            transform: style.animation === "pop" && style.mode === "word" ? `scale(${0.88 + eased * 0.12})` : undefined,
          }}
        >
          {shown.map((w, i) => (
            <span
              key={i}
              className="inline-block transition-colors duration-100"
              style={{
                color: w.active ? style.highlightColor : undefined,
                textShadow: w.active && (style.activeGlow || style.style === "plain")
                  ? `0 0 0.5em ${style.highlightColor}, 0 0 1em ${style.highlightColor}`
                  : undefined,
                marginInline: "0.14em",
              }}
            >
              {w.text}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

function StylePanel({
  style,
  onChange,
  bitrate,
  presetId,
  onPreset,
}: {
  style: CaptionStyle;
  onChange: (s: CaptionStyle) => void;
  bitrate: number;
  presetId: (typeof SOCIAL_PRESETS)[number]["id"];
  onPreset: (id: (typeof SOCIAL_PRESETS)[number]["id"]) => void;
}) {
  const set = (p: Partial<CaptionStyle>) => onChange({ ...style, ...p });
  return (
    <div className="space-y-3 rounded-xl border border-hairline bg-surface p-3">
      <div>
        <p className="text-mini font-semibold text-ink">Pilih gaya videonya</p>
        <p className="mt-0.5 text-micro leading-relaxed text-muted">
          Presetnya udah ngatur ukuran, posisi, dan ritme subtitle. Tinggal pilih.
        </p>
      </div>

      <div>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {SOCIAL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPreset(preset.id)}
              title={preset.hint}
              className={`min-h-11 rounded-lg border px-2 text-micro font-semibold transition-colors ${
                presetId === preset.id
                  ? "border-ember bg-ember/15 text-ember"
                  : "border-hairline bg-obsidian/30 text-muted hover:text-ink"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] leading-snug text-muted">
          {SOCIAL_PRESETS.find((preset) => preset.id === presetId)?.hint}
        </p>
      </div>

      <details className="overflow-hidden rounded-xl border border-hairline bg-obsidian/35">
        <summary className="flex h-8.5 sm:h-9 cursor-pointer items-center justify-between gap-3 px-3.5 text-mini font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
          <span>Atur sendiri</span>
          <span className="text-micro font-normal text-muted">Opsional</span>
        </summary>
        <div className="space-y-3 border-t border-hairline p-3.5">
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Warna teks" value={style.textColor} onChange={(v) => set({ textColor: v })} />
            <ColorField
              label="Warna highlight"
              value={style.highlightColor}
              onChange={(v) => set({ highlightColor: v })}
            />
          </div>

          <div>
            <span className="text-micro font-medium text-muted">Munculnya Teks</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["word", "line"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set({ mode: m })}
                  className={`flex h-10 items-center justify-center rounded-xl border px-3 text-mini font-semibold transition-all ${
                    style.mode === m
                      ? "border-ember bg-ember/15 text-ember shadow-sm"
                      : "border-hairline bg-surface-raised/40 text-muted hover:text-ink"
                  }`}
                >
                  {m === "word" ? "Per kata" : "Per kalimat"}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-micro font-medium text-muted">Font Tulisan</span>
            <select
              value={style.fontFamily}
              onChange={(e) => set({ fontFamily: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-hairline bg-surface-raised/50 px-3 text-mini font-semibold text-ink outline-none focus:border-ember/50"
            >
              {CAPTION_FONTS.map((f) => (
                <option key={f.family} value={f.family}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-micro font-medium text-muted">Gaya Teks</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(["box", "outline", "plain"] as const).map((captionStyle) => (
                <button
                  key={captionStyle}
                  type="button"
                  onClick={() => set({ style: captionStyle })}
                  className={`flex h-10 items-center justify-center rounded-xl border px-2 text-mini font-semibold capitalize transition-all ${
                    style.style === captionStyle
                      ? "border-ember bg-ember/15 text-ember shadow-sm"
                      : "border-hairline bg-surface-raised/40 text-muted hover:text-ink"
                  }`}
                >
                  {captionStyle}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-micro font-medium text-muted">Animasi Masuk</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(["none", "pop", "fade"] as const).map((animation) => (
                <button
                  key={animation}
                  type="button"
                  onClick={() => set({ animation })}
                  className={`flex h-10 items-center justify-center rounded-xl border px-2 text-mini font-semibold capitalize transition-all ${
                    style.animation === animation
                      ? "border-ember bg-ember/15 text-ember shadow-sm"
                      : "border-hairline bg-surface-raised/40 text-muted hover:text-ink"
                  }`}
                >
                  {animation === "none" ? "Tanpa" : animation}
                </button>
              ))}
            </div>
          </div>

          <label className="flex h-10 items-center gap-2 text-mini text-ink cursor-pointer rounded-xl border border-hairline bg-surface-raised/30 px-3">
            <input
              type="checkbox"
              checked={style.bold}
              onChange={(e) => set({ bold: e.target.checked })}
              className="size-4 accent-ember rounded"
            />
            <span className="font-semibold">Huruf ekstra tebal (Extra Bold)</span>
          </label>

          <div className="rounded-xl border border-hairline bg-surface-raised/30 p-3 space-y-2">
            <div className="flex justify-between items-center text-micro">
              <span className="font-medium text-muted">Posisi Vertikal Subtitle</span>
              <span className="font-mono text-ember font-bold">{Math.round(style.position * 100)}%</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Atas", pct: "30%", val: 0.30 },
                { label: "Tengah", pct: "50%", val: 0.50 },
                { label: "Bawah", pct: "65%", val: 0.65 },
              ].map((pos) => (
                <button
                  key={pos.label}
                  type="button"
                  onClick={() => set({ position: pos.val })}
                  className={`flex h-11 flex-col items-center justify-center rounded-xl border px-2 py-1 transition-all ${
                    Math.abs(style.position - pos.val) < 0.05
                      ? "border-ember bg-ember/15 text-ember shadow-sm"
                      : "border-hairline bg-surface-raised/40 text-muted hover:text-ink"
                  }`}
                >
                  <span className="text-mini font-bold leading-tight">{pos.label}</span>
                  <span className="text-[10px] opacity-75 font-mono">{pos.pct}</span>
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0.2}
              max={0.85}
              step={0.02}
              value={style.position}
              onChange={(e) => set({ position: Number(e.target.value) })}
              className="mt-2 w-full accent-ember"
            />
          </div>

          <label className="block">
            <span className="text-micro text-muted">Ukuran teks ({Math.round(style.fontScale * 100)}%)</span>
            <input
              type="range"
              min={0.7}
              max={1.6}
              step={0.05}
              value={style.fontScale}
              onChange={(e) => set({ fontScale: Number(e.target.value) })}
              className="mt-1 w-full accent-ember"
            />
          </label>

          <p className="text-[10px] leading-snug text-muted">
            Detail kualitas: {bitrate} Mbps. File dibuat cukup tajam sebelum sosmed mengompres ulang.
          </p>
        </div>
      </details>

      <p className="text-[10px] leading-snug text-muted">
        Kualitas ekspor otomatis disesuaikan biar hasilnya tetap tajam.
      </p>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-micro text-muted">{label}</span>
      <span className="mt-1 flex items-center gap-2 rounded-lg border border-hairline bg-obsidian/40 px-2 py-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="font-mono text-micro text-muted">{value}</span>
      </span>
    </label>
  );
}

function ProgressBar({
  phase,
  progress,
  status,
}: {
  phase: Phase;
  progress: number;
  status: string;
}) {
  const indeterminate = phase === "transcribing";
  return (
    <div className="mt-3 rounded-xl border border-hairline bg-surface p-3">
      <div className="mb-2 flex items-center justify-between text-mini">
        <span className="font-semibold text-ink">{status}</span>
        {!indeterminate && <span className="font-mono text-muted">{progress}%</span>}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-obsidian/50">
        <div
          className={`h-full rounded-full bg-ember ${indeterminate ? "animate-pulse" : ""}`}
          style={{ width: indeterminate ? "100%" : `${progress}%` }}
        />
      </div>
    </div>
  );
}
