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
import type { VideoLayout } from "@/lib/video/draw";
import { getNativeShell, requestNative } from "@/lib/native/bridge";
import { ExportOverlay } from "./ExportOverlay";
import { ClipRadar } from "./ClipRadar";
import { VideoKeyframeControls } from "./VideoKeyframeControls";
import { VideoCompletionModal } from "./VideoCompletionModal";
import { VideoProjectHistoryModal } from "./VideoProjectHistoryModal";
import { saveVideoProject, type VideoProject } from "@/lib/video/project-history";
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
  const [layout, setLayout] = useState<VideoLayout>({ ratio: "9:16", focus: "center" });
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
      focus: "center",
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
    if (mode === "podcast_split") {
      setLayout((curr) => ({ ...curr, focus: "podcast_split", trajectory: undefined, panX: undefined }));
    } else if (mode === "preset_left") {
      handlePanChange(0.2);
    } else if (mode === "preset_center") {
      handlePanChange(0.5);
    } else if (mode === "preset_right") {
      handlePanChange(0.8);
    }
  };

  const handleSelectProject = (project: VideoProject) => {
    setWords(project.words);
    setSourceWords(project.words);
    setStyle(project.style);
    setPresetId(project.presetId as (typeof SOCIAL_PRESETS)[number]["id"]);
    setLayout(project.layout);
    if (project.manualKeyframes) setManualKeyframes(project.manualKeyframes);
    if (project.framingMode) setFramingMode(project.framingMode);
    setPhase("ready");
    setError(null);
  };
  const runFaceTrack = useCallback(async (mode: "face_track" | "podcast_dynamic" = "face_track") => {
    const video = videoRef.current;
    if (!video || trackingFace) return;
    setTrackingFace(true); setError(null);
    setStatus(mode === "podcast_dynamic" ? "AI lagi menganalisis giliran bicara pembicara..." : "AI lagi ngikutin wajah...");
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
      }));
      setStatus(
        mode === "podcast_dynamic"
          ? "Auto Speaker Switch (Host ↔ Tamu) aktif."
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
      void saveVideoProject({
        id: file.name.replace(/\.[^.]+$/, "") || "project_default",
        title: file.name,
        durationSec: videoRef.current?.duration || 0,
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
    if (!file || !words.length) return;
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
                    <span className="text-ember"> {cost * 2} kredit sekali scan.</span>
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
                <button type="button" onClick={doExport} disabled={busy} className="btn-ember flex h-7.5 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-obsidian shadow-xs transition-transform active:scale-95 disabled:opacity-50">
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

          {/* APK Pro Performance Badge / Web Notice */}
          {!isNativeAPK ? (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl border border-ember/30 bg-ember/10 text-xs text-white">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-ember animate-pulse shrink-0" />
                <span className="text-[11px] text-mist">
                  <strong className="text-white">Akselerasi APK Pro:</strong> Hardware 60fps & simpan otomatis ke Galeri HP (DCIM).
                </span>
              </div>
              <a
                href="/malesan.apk"
                download
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ember text-obsidian font-extrabold text-[10px] hover:bg-ember/90 shadow-xs"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                <span>Unduh APK</span>
              </a>
            </div>
          ) : null}

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

                    <VideoKeyframeControls
                      currentTime={currentTimeNow}
                      duration={videoDuration}
                      keyframes={manualKeyframes}
                      currentPanX={currentPanX}
                      currentZoom={currentZoom}
                      onPanChange={handlePanChange}
                      onZoomChange={handleZoomChange}
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
                      <TranscriptEditor words={words} onChange={setWords} />
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

                  <VideoKeyframeControls
                    currentTime={currentTimeNow}
                    duration={videoDuration}
                    keyframes={manualKeyframes}
                    currentPanX={currentPanX}
                    currentZoom={currentZoom}
                    onPanChange={handlePanChange}
                    onZoomChange={handleZoomChange}
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
                    <TranscriptEditor words={words} onChange={setWords} />
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
        videoTitle={file?.name.replace(/\.[^.]+$/, "") || "video"}
        isAPK={isNativeAPK}
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
}) {
  const [now, setNow] = useState(0);
  const rafRef = useRef<number | null>(null);
  const isPodcastSplit = layout.ratio === "9:16" && layout.focus === "podcast_split";
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, panX: 0 });

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      const v = videoRef.current;
      if (v && !v.paused) {
        setNow(v.currentTime);
        onTimeChange?.(v.currentTime);
        if (Number.isFinite(v.duration) && v.duration > 0) {
          onDurationChange?.(v.duration);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef, onTimeChange, onDurationChange]);

  // Sync secondary video with primary video during playback/seek for split view
  useEffect(() => {
    if (!isPodcastSplit) return;
    const v1 = videoRef.current;
    const v2 = secondaryVideoRef.current;
    if (!v1 || !v2) return;

    const onPlay = () => { void v2.play().catch(() => {}); };
    const onPause = () => { v2.pause(); };
    const onSeeking = () => { v2.currentTime = v1.currentTime; };

    v1.addEventListener("play", onPlay);
    v1.addEventListener("pause", onPause);
    v1.addEventListener("seeking", onSeeking);
    return () => {
      v1.removeEventListener("play", onPlay);
      v1.removeEventListener("pause", onPause);
      v1.removeEventListener("seeking", onSeeking);
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
  const videoTransform = currentZoom > 1.01 ? `scale(${currentZoom.toFixed(2)})` : undefined;
  const resolvedVideoSrc = videoUrl
    ? videoUrl.includes("#t=")
      ? videoUrl
      : `${videoUrl}#t=0.001`
    : undefined;

  const containerRatioClass =
    layout.ratio === "9:16"
      ? "aspect-[9/16] h-[48vh] sm:h-[56vh] max-h-[500px] w-auto max-w-[320px]"
      : layout.ratio === "16:9"
      ? "aspect-video h-[30vh] sm:h-[38vh] max-h-[360px] w-auto max-w-[480px]"
      : "aspect-square h-[36vh] sm:h-[44vh] max-h-[420px] w-auto max-w-[340px]";

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientY - rect.top > rect.height * 0.8) return; // Allow native video controls interaction
    isDraggingRef.current = true;
    startPosRef.current = {
      x: e.clientX,
      panX: currentPanX,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - startPosRef.current.x;
    // Map drag pixels to pan ratio: dragging left reveals right, dragging right reveals left
    const panSensitivity = 0.003;
    const nextPanX = Math.max(0, Math.min(1, startPosRef.current.panX - deltaX * panSensitivity));
    onManualPanChange?.(nextPanX);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl ring-1 ring-white/5 transition-all duration-300 touch-none cursor-grab active:cursor-grabbing ${containerRatioClass}`}
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
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full border border-white/15 bg-black/70 px-2 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-md shadow-md">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-2.5 text-ember"><path d="M8 9l-4 3 4 3M16 9l4 3-4 3"/></svg>
        <span>Geser sudut kamera</span>
      </div>

      {isPodcastSplit ? (
        <div className="absolute inset-0 flex flex-col">
          {/* Top Half: Left Speaker (Host) */}
          <div className="relative h-1/2 w-full overflow-hidden border-b border-white/30">
            <video
              ref={videoRef}
              src={resolvedVideoSrc}
              preload="auto"
              playsInline
              controls
              onTimeUpdate={(e) => {
                setNow(e.currentTarget.currentTime);
                onTimeChange?.(e.currentTarget.currentTime);
              }}
              onSeeked={(e) => {
                setNow(e.currentTarget.currentTime);
                onTimeChange?.(e.currentTarget.currentTime);
              }}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: "left center" }}
            />
          </div>
          {/* Bottom Half: Right Speaker (Guest) */}
          <div className="relative h-1/2 w-full overflow-hidden">
            <video
              ref={secondaryVideoRef}
              src={resolvedVideoSrc}
              preload="auto"
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: "right center" }}
            />
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={resolvedVideoSrc}
          preload="auto"
          controls
          playsInline
          onTimeUpdate={(e) => {
            setNow(e.currentTarget.currentTime);
            onTimeChange?.(e.currentTarget.currentTime);
          }}
          onSeeked={(e) => {
            setNow(e.currentTarget.currentTime);
            onTimeChange?.(e.currentTarget.currentTime);
          }}
          className="absolute inset-0 h-full w-full object-cover transition-[object-position] duration-75"
          style={{
            objectPosition,
            transform: videoTransform,
            transformOrigin: `${(currentPanX * 100).toFixed(2)}% ${(currentPanY * 100).toFixed(2)}%`,
          }}
        />
      )}

      {tracked && (
        <div className="pointer-events-none absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5 rounded-full border border-ember/40 bg-obsidian/80 px-2.5 py-0.5 text-[10px] font-bold text-ember backdrop-blur-xs shadow-xs">
          <span className="size-1.5 rounded-full bg-ember animate-ping" />
          <span>Face Track</span>
        </div>
      )}
      {safeZones && <SafeZones />}
      {active && <CaptionOverlay line={active.line} now={now} style={style} />}
    </div>
  );
}

/** Preview overlay: same per-word reveal the export burns in — only spoken
 *  words show, the latest one lit. */
function CaptionOverlay({ line, now, style }: { line: Line; now: number; style: CaptionStyle }) {
  const spoken = line.words.filter((w) => w.start <= now + 0.01).length;
  if (!spoken) return null;
  const currentIdx = spoken - 1;
  const enter = Math.min(1, Math.max(0, now - line.words[currentIdx].start) / 0.14);
  const eased = 1 - Math.pow(1 - enter, 3);
  const shown =
    style.mode === "word"
      ? [{ text: line.words[currentIdx].word, active: true }]
      : line.words.map((w, i) => ({ text: w.word, active: i === currentIdx }));
  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 justify-center px-4 text-center z-10 select-none"
      style={{ top: `${style.position * 100}%` }}
    >
      <p
        className="max-w-[92%] leading-[1.45] drop-shadow-md"
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
  );
}


function TranscriptEditor({ words, onChange }: { words: Word[]; onChange: (w: Word[]) => void }) {
  const text = useMemo(() => words.map((w) => w.word).join(" "), [words]);

  const commit = (newVal: string) => {
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

  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <p className="mb-2 text-mini font-semibold text-ink">Betulin teks (kalau ada typo)</p>
      <textarea
        key={text}
        defaultValue={text}
        onBlur={(e) => commit(e.target.value)}
        rows={5}
        placeholder="Teks subtitle..."
        className="w-full resize-none rounded-lg border border-hairline bg-obsidian/40 p-2.5 text-sm text-ink outline-none focus:border-ember/50"
      />
      <p className="mt-1.5 text-micro text-muted">
        Betulin ejaan atau lirik — ketuk di luar kotak untuk menerapkan perubahan.
      </p>
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
