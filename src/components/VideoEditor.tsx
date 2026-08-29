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
import { ExportOverlay } from "./ExportOverlay";
import { ClipRadar } from "./ClipRadar";
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
    mbps: 12,
    maxWords: 4,
    maxGap: 0.5,
    style: {
      fontFamily: "Montserrat",
      bold: true,
      textColor: "#ffffff",
      highlightColor: "#c8ff36",
      style: "plain" as const,
      position: 0.58,
      fontScale: 1.04,
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
    mbps: 12,
    maxWords: 3,
    maxGap: 0.48,
    style: {
      fontFamily: "Archivo Black",
      bold: true,
      textColor: "#ffffff",
      highlightColor: "#ffdf39",
      style: "outline" as const,
      position: 0.62,
      fontScale: 1.08,
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
    mbps: 16,
    maxWords: 5,
    maxGap: 0.65,
    style: {
      fontFamily: "Poppins",
      bold: false,
      textColor: "#ffffff",
      highlightColor: "#ffb067",
      style: "box" as const,
      position: 0.68,
      fontScale: 0.9,
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
  const [sourceWords, setSourceWords] = useState<Word[] | null>(null);
  const [translating, setTranslating] = useState(false);
  const [layout, setLayout] = useState<VideoLayout>({ ratio: "9:16", focus: "center" });
  const [editorTab, setEditorTab] = useState<"frame" | "subtitles" | "style" | "export">("frame");
  const [exportPct, setExportPct] = useState(0);
  const [exportStage, setExportStage] = useState("");
  const [trackingFace, setTrackingFace] = useState(false);
  const [autoProcess, setAutoProcess] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const autoEnhanceRef = useRef(false);
  const runFaceTrack = useCallback(async () => {
    const video = videoRef.current;
    if (!video || trackingFace) return;
    setTrackingFace(true); setError(null); setStatus("AI lagi ngikutin wajah...");
    try {
      const { detectFaceTrajectory } = await import("@/lib/video/detect-faces");
      const trajectory = await detectFaceTrajectory(video, { onProgress: (value) => setProgress(Math.round(value * 100)) });
      setLayout((current) => ({ ...current, trajectory }));
      setStatus(trajectory.some((keyframe) => keyframe.confidence > 0) ? "Face track aktif." : "Wajah fokus tengah aktif.");
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
      form.append("language", "id");

      const res = await fetch("/api/video/transcribe", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as
        | { words?: Word[]; error?: string }
        | null;
      if (!res.ok || !data?.words?.length) {
        setError(data?.error ?? "Transkripsi gagal. Coba lagi bentar lagi.");
        setPhase("idle");
        return;
      }
      setWords(data.words);
      setSourceWords(data.words);
      setCaptionLanguage("id");

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
    if (target === "id" && sourceWords) {
      setWords(sourceWords);
      setCaptionLanguage("id");
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
  }, [captionLanguage, preset.maxGap, preset.maxWords, sourceWords, translating, words]);

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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "video";
      a.download = `Auto Caption by malesan.my.id - ${base}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPhase("ready");
      setStatus("");
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
          <header>
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
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-hairline bg-surface/90 backdrop-blur-md p-3 sm:px-4 shadow-sm">
            <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
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
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline bg-surface-raised px-2.5 text-xs font-semibold text-muted transition-all hover:border-ember/50 hover:text-ink shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5"><path d="m15 18-6-6 6-6"/></svg>
                <span>Ganti Video</span>
              </button>
              <div className="min-w-0"><span className="block max-w-[150px] sm:max-w-[320px] truncate text-xs font-bold text-ink" title={file.name}>{file.name}</span></div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {words.length > 0 ? (
                <button type="button" onClick={doExport} disabled={busy} className="btn-ember flex h-8.5 w-full sm:w-auto justify-center cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-obsidian shadow-xs transition-transform active:scale-95 disabled:opacity-50">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  <span>Export Mateng</span>
                </button>
              ) : phase === "idle" ? (
                <button type="button" onClick={generate} className="btn-ember flex h-8.5 w-full sm:w-auto justify-center cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-obsidian shadow-xs">
                  <span>Bikinin Subtitle</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5 lg:sticky lg:top-4 space-y-2.5 flex flex-col items-center">
              <VideoPreviewPlayer videoRef={videoRef} videoUrl={videoUrl} lines={lines} style={style} safeZones={safeZones} layout={layout} />
              <div className="flex w-full max-w-[340px] items-center justify-between gap-2 px-1 text-micro text-muted">
                <label className="flex cursor-pointer items-center gap-1.5 hover:text-ink">
                  <input type="checkbox" checked={safeZones} onChange={(e) => setSafeZones(e.target.checked)} className="size-3.5 accent-ember rounded" />
                  <span>Safe Zone TikTok/Reels</span>
                </label>
                <span className="font-mono text-[10px] text-ember/80 font-bold bg-surface-raised px-1.5 py-0.5 rounded border border-hairline uppercase">{layout.ratio} · {presetId}</span>
              </div>
              {phase === "idle" && words.length === 0 && (
                <button onClick={generate} className="btn-ember w-full max-w-[340px] cursor-pointer rounded-xl px-4 py-3 text-sm font-bold text-obsidian shadow-md transition-colors hover:brightness-105">Bikinin Subtitle AI</button>
              )}
              {busy && (
                <div className="w-full max-w-[340px]"><ProgressBar phase={phase} progress={progress} status={status} /></div>
              )}
            </div>

            <div className="lg:col-span-7 flex flex-col rounded-2xl border border-hairline bg-surface overflow-hidden shadow-xs">
              <div className="grid grid-cols-4 border-b border-hairline bg-surface-raised/50 p-1 gap-1">
                <button type="button" onClick={() => setEditorTab("frame")} className={`flex h-8.5 sm:h-9 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] sm:text-xs font-bold transition-all ${editorTab === "frame" ? "bg-ember text-obsidian shadow-xs" : "text-muted hover:text-ink hover:bg-surface-raised"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 shrink-0"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
                  <span className="truncate">Bingkai</span>
                </button>
                <button type="button" onClick={() => setEditorTab("subtitles")} className={`flex h-8.5 sm:h-9 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] sm:text-xs font-bold transition-all ${editorTab === "subtitles" ? "bg-ember text-obsidian shadow-xs" : "text-muted hover:text-ink hover:bg-surface-raised"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 shrink-0"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
                  <span className="truncate">Teks</span>
                </button>
                <button type="button" onClick={() => setEditorTab("style")} className={`flex h-8.5 sm:h-9 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] sm:text-xs font-bold transition-all ${editorTab === "style" ? "bg-ember text-obsidian shadow-xs" : "text-muted hover:text-ink hover:bg-surface-raised"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/></svg>
                  <span className="truncate">Gaya</span>
                </button>
                <button type="button" onClick={() => setEditorTab("export")} className={`flex h-8.5 sm:h-9 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] sm:text-xs font-bold transition-all ${editorTab === "export" ? "bg-ember text-obsidian shadow-xs" : "text-muted hover:text-ink hover:bg-surface-raised"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  <span className="truncate">Export</span>
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto custom-scrollbar">
                {editorTab === "frame" && (
                  <div className="space-y-4">
                    <LayoutPanel layout={layout} onChange={setLayout} onAutoTrack={runFaceTrack} tracking={trackingFace} />
                    <div className="rounded-xl border border-hairline/60 bg-surface-raised/40 p-3 text-micro text-muted leading-relaxed">💡 <span className="text-ink font-semibold">Tips Face Track:</span> AI otomatis mengunci posisi wajah ke tengah pada format 9:16 vertikal, jadi kamu gak perlu potong manual.</div>
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
                      <div className="flex justify-between font-mono"><span>Kualitas Render:</span><span className="text-ink font-semibold">1080p HD (Frame-Accurate)</span></div>
                      <div className="flex justify-between font-mono"><span>Bitrate Video:</span><span className="text-ink font-semibold">{bitrate} Mbps</span></div>
                    </div>
                    <button onClick={doExport} disabled={busy || words.length === 0} className="btn-ember w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold text-obsidian shadow-md transition-transform active:scale-[0.99] disabled:opacity-50">
                      {phase === "exporting" ? `Lagi render... ${progress}%` : "⚡ Export Video Mateng"}
                    </button>
                    <p className="text-micro leading-snug text-muted text-center">Tiap frame digambar satu-satu di browser kamu. Kualitas ngikut aslinya, gak diturunin.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      {doneMsg && <p className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">{doneMsg}</p>}
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
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  lines: Line[];
  style: CaptionStyle;
  safeZones: boolean;
  layout: VideoLayout;
}) {
  const [now, setNow] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      const v = videoRef.current;
      if (v && !v.paused) {
        setNow(v.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef]);

  const active = activeAt(lines, now);
  const aspectRatio = layout.ratio === "9:16" ? "9 / 16" : layout.ratio === "16:9" ? "16 / 9" : "1 / 1";
  const tracked = layout.trajectory?.length ? cropFocusAt(layout.trajectory, now) : null;
  const objectPosition = tracked
    ? `${(tracked.x * 100).toFixed(2)}% ${(tracked.y * 100).toFixed(2)}%`
    : layout.focus === "left" ? "left center" : layout.focus === "right" ? "right center" : "center";

  return (
    <div
      className="relative mx-auto max-h-[46vh] sm:max-h-[64vh] w-full max-w-[320px] sm:max-w-[360px] overflow-hidden rounded-2xl border border-hairline bg-black shadow-lg transition-[aspect-ratio] duration-300"
      style={{ aspectRatio }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        playsInline
        onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
        onSeeked={(e) => setNow(e.currentTarget.currentTime)}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition }}
      />
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
      className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 justify-center px-3 text-center"
      style={{ top: `${style.position * 100}%` }}
    >
      <p
        className="max-w-[94%] leading-tight"
        style={{
          fontFamily: `"${style.fontFamily}", sans-serif`,
          fontWeight: style.bold ? 800 : 600,
          fontSize: `calc(${style.mode === "word" ? "clamp(22px, 8.5vw, 44px)" : "clamp(16px, 6.5vw, 32px)"} * ${style.fontScale})`,
          color: style.textColor,
          textShadow:
            style.style === "outline"
              ? "0 0 3px #000,0 0 3px #000,0 2px 4px #000"
              : style.style === "plain"
                ? "0 2px 6px rgba(0,0,0,0.85)"
                : "none",
          background: style.style === "box" ? "rgba(0,0,0,0.55)" : "transparent",
          padding: style.style === "box" ? "0.15em 0.4em" : 0,
          borderRadius: style.style === "box" ? "0.3em" : 0,
          opacity: style.animation === "fade" ? eased : 1,
          transform: style.animation === "pop" ? `scale(${0.82 + eased * 0.18})` : undefined,
        }}
      >
        {shown.map((w, i) => (
          <span
            key={i}
            className="inline-block"
            style={{
              color: w.active ? style.highlightColor : undefined,
              transform: w.active && style.activeScale !== 1 ? `scale(${style.activeScale})` : undefined,
              textShadow: w.active && style.activeGlow
                ? `0 0 0.45em ${style.highlightColor}, 0 0 0.9em ${style.highlightColor}`
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

function LayoutPanel({
  layout,
  onChange,
  onAutoTrack,
  tracking,
}: {
  layout: VideoLayout;
  onChange: (layout: VideoLayout) => void;
  onAutoTrack: () => void;
  tracking: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-hairline bg-surface p-3">
      <div>
        <p className="text-mini font-semibold text-ink">Bingkai video</p>
        <p className="text-micro text-muted">Auto ikuti wajah, atau pilih fokus manual.</p>
      </div>
      <button type="button" onClick={onAutoTrack} disabled={tracking} className={`relative h-11 w-full overflow-hidden rounded-lg border px-3 text-mini font-semibold ${layout.trajectory?.length ? "border-ember bg-ember/15 text-ember" : "border-hairline bg-obsidian/30 text-ink"}`}>
        {tracking ? <span className="animate-shimmer-sweep absolute inset-0" aria-hidden="true" /> : null}
        <span className="relative">{tracking ? "Lagi lacak wajah..." : layout.trajectory?.length ? "Face Track Aktif" : "Auto Face Track"}</span>
      </button>
      <div className="grid grid-cols-3 gap-1.5">
        {(["9:16", "1:1", "16:9"] as const).map((ratio) => (
          <button
            key={ratio}
            type="button"
            onClick={() => onChange({ ...layout, ratio })}
            className={`min-h-11 rounded-lg border px-2 font-mono text-micro font-bold transition-colors ${
              layout.ratio === ratio
                ? "border-ember bg-ember/15 text-ember"
                : "border-hairline bg-obsidian/30 text-muted hover:text-ink"
            }`}
          >
            {ratio}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {(["left", "center", "right"] as const).map((focus) => (
          <button
            key={focus}
            type="button"
            onClick={() => onChange({ ratio: layout.ratio, focus })}
            className={`min-h-11 rounded-lg border px-2 text-micro font-semibold transition-colors ${
              !layout.trajectory?.length && layout.focus === focus
                ? "border-ember bg-ember/15 text-ember"
                : "border-hairline bg-obsidian/30 text-muted hover:text-ink"
            }`}
          >
            {focus === "left" ? "Kiri" : focus === "right" ? "Kanan" : "Tengah"}
          </button>
        ))}
      </div>
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
            <span className="text-micro text-muted">Munculnya</span>
            <div className="mt-1 flex gap-1.5">
              {(["word", "line"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set({ mode: m })}
                  className={`h-8 flex-1 rounded-lg border px-2 text-micro font-semibold transition-colors ${
                    style.mode === m
                      ? "border-ember bg-ember/15 text-ember"
                      : "border-hairline bg-obsidian/30 text-muted hover:text-ink"
                  }`}
                >
                  {m === "word" ? "Per kata" : "Per kalimat"}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-micro text-muted">Font</span>
            <select
              value={style.fontFamily}
              onChange={(e) => set({ fontFamily: e.target.value })}
              className="mt-1 h-8.5 w-full rounded-lg border border-hairline bg-obsidian/40 px-2 text-mini text-ink outline-none focus:border-ember/50"
            >
              {CAPTION_FONTS.map((f) => (
                <option key={f.family} value={f.family}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-1.5">
            {(["box", "outline", "plain"] as const).map((captionStyle) => (
              <button
                key={captionStyle}
                type="button"
                onClick={() => set({ style: captionStyle })}
                className={`h-8 flex-1 rounded-lg border px-2 text-micro font-semibold capitalize transition-colors ${
                  style.style === captionStyle
                    ? "border-ember bg-ember/15 text-ember"
                    : "border-hairline bg-obsidian/30 text-muted hover:text-ink"
                }`}
              >
                {captionStyle}
              </button>
            ))}
          </div>

          <div>
            <span className="text-micro text-muted">Animasi masuk</span>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {(["none", "pop", "fade"] as const).map((animation) => (
                <button
                  key={animation}
                  type="button"
                  onClick={() => set({ animation })}
                  className={`h-8 rounded-lg border px-2 text-micro font-semibold capitalize transition-colors ${
                    style.animation === animation
                      ? "border-ember bg-ember/15 text-ember"
                      : "border-hairline bg-obsidian/30 text-muted hover:text-ink"
                  }`}
                >
                  {animation === "none" ? "Tanpa" : animation}
                </button>
              ))}
            </div>
          </div>

          <label className="flex h-8 items-center gap-2 text-mini text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={style.bold}
              onChange={(e) => set({ bold: e.target.checked })}
              className="size-4 accent-ember"
            />
            Extra tebal
          </label>

          <label className="block">
            <span className="text-micro text-muted">Posisi (naik-turun)</span>
            <input
              type="range"
              min={0.4}
              max={0.9}
              step={0.02}
              value={style.position}
              onChange={(e) => set({ position: Number(e.target.value) })}
              className="mt-1 w-full accent-ember"
            />
          </label>

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
