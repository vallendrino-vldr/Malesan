"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  activeAt,
  buildAss,
  groupLines,
  DEFAULT_STYLE,
  type CaptionStyle,
  type Word,
} from "@/lib/video/captions";

/**
 * Video Auto-CC editor.
 *
 * The pipeline is deliberately client-heavy so the server stays cheap: the video
 * is decoded, previewed and finally burned-in entirely in the browser, and the
 * only thing that ever reaches our server is the extracted audio, on its way to
 * transcription. ffmpeg.wasm is dynamically imported so its ~30MB never touches
 * anyone who does not open this tab.
 *
 * The live preview is an HTML overlay driven by `requestAnimationFrame` reading
 * the video's own clock — no canvas, no re-encode. Changing a colour or a word
 * is instant because nothing is rendered but text. The burned-in export reuses
 * the exact same grouping (src/lib/video/captions), so the file matches the
 * preview frame for frame.
 */

type Phase = "idle" | "extracting" | "transcribing" | "ready" | "exporting";

const FONTS = ["Arial", "Impact", "Georgia", "Verdana", "Courier New"];

export function VideoEditor({ cost }: { cost: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [style, setStyle] = useState<CaptionStyle>(DEFAULT_STYLE);
  const [safeZones, setSafeZones] = useState(true);
  const [now, setNow] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const lines = useMemo(() => groupLines(words), [words]);
  const busy = phase === "extracting" || phase === "transcribing" || phase === "exporting";

  // Object URLs must be released or every re-selected file leaks one.
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Drive the caption clock off rAF rather than the video's throttled
  // `timeupdate` (which fires ~4x/sec) so the active word lands on the beat.
  useEffect(() => {
    const tick = () => {
      const v = videoRef.current;
      if (v && !v.paused) setNow(v.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onPick = (f: File | null) => {
    if (!f) return;
    setError(null);
    setWords([]);
    setPhase("idle");
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
  };

  const generate = useCallback(async () => {
    if (!file) return;
    const v = videoRef.current;
    const durationSec = v?.duration && isFinite(v.duration) ? v.duration : 0;
    setError(null);
    setProgress(0);

    try {
      setPhase("extracting");
      setStatus("Ngambil audio dari video…");
      const { extractAudio } = await import("@/lib/video/ffmpeg");
      const audio = await extractAudio(file, (r) => setProgress(Math.round(r * 100)));

      setPhase("transcribing");
      setProgress(0);
      setStatus("AI lagi denger & nulis tiap kata…");
      const form = new FormData();
      form.append("audio", audio, "audio.m4a");
      form.append("durationSec", String(Math.ceil(durationSec)));
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
      setPhase("ready");
      setStatus("");
    } catch (e) {
      // The common first-run failure is ffmpeg.wasm not loading (network, or a
      // core the browser rejects). Say so plainly instead of a blank spinner.
      setError(
        e instanceof Error
          ? `Gagal ngolah video di browser: ${e.message}`
          : "Gagal ngolah video di browser.",
      );
      setPhase("idle");
    }
  }, [file]);

  const doExport = useCallback(async () => {
    if (!file || !words.length) return;
    const v = videoRef.current;
    const w = v?.videoWidth || 1080;
    const h = v?.videoHeight || 1920;
    setError(null);
    setProgress(0);
    setPhase("exporting");
    setStatus("Nge-render video mateng — jangan tutup tab…");
    try {
      const { burnInSubtitles } = await import("@/lib/video/ffmpeg");
      const ass = buildAss(lines, style, w, h);
      const out = await burnInSubtitles(file, ass, (r) => setProgress(Math.round(r * 100)));
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = (file.name.replace(/\.[^.]+$/, "") || "malesan") + "-cc.mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPhase("ready");
      setStatus("");
    } catch (e) {
      setError(
        e instanceof Error
          ? `Export gagal: ${e.message}. Kalau errornya soal "ass"/filter, core-nya perlu diganti yang ada libass-nya.`
          : "Export gagal.",
      );
      setPhase("ready");
    }
  }, [file, words, lines, style]);

  const active = activeAt(lines, now);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-xl font-bold tracking-display-md text-ink">
          Video Editor — Auto CC
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Upload video, AI tulisin subtitle-nya per kata, atur gayanya, terus export jadi
          .mp4 yang teksnya udah nyatu. <span className="text-ember">{cost} kredit / menit.</span>
        </p>
      </header>

      {!file ? (
        <UploadDrop onPick={onPick} />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* LEFT / TOP: the player + live caption overlay */}
          <div className="lg:flex-1">
            <div className="relative mx-auto aspect-[9/16] max-h-[70vh] w-full max-w-sm overflow-hidden rounded-2xl border border-hairline bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
                className="absolute inset-0 h-full w-full object-contain"
              />

              {safeZones && <SafeZones />}

              {active && (
                <CaptionOverlay line={active.line} wordIdx={active.wordIdx} style={style} />
              )}
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-mini text-muted">
              <input
                type="checkbox"
                checked={safeZones}
                onChange={(e) => setSafeZones(e.target.checked)}
                className="accent-ember"
              />
              Tampilin safe zone TikTok/Reels (biar teks gak ketutup tombol)
            </label>

            {phase === "idle" && (
              <button
                onClick={generate}
                className="mt-3 w-full cursor-pointer rounded-xl bg-ember px-4 py-3 text-sm font-bold text-obsidian transition-colors hover:bg-ember-lo"
              >
                Bikinin subtitle
              </button>
            )}

            {busy && <ProgressBar phase={phase} progress={progress} status={status} />}
          </div>

          {/* RIGHT / BOTTOM: transcript editor + styling + export */}
          <div className="space-y-4 lg:w-80 lg:shrink-0">
            {words.length > 0 && (
              <>
                <TranscriptEditor words={words} onChange={setWords} />
                <StylePanel style={style} onChange={setStyle} />
                <button
                  onClick={doExport}
                  disabled={busy}
                  className="w-full cursor-pointer rounded-xl bg-ember px-4 py-3 text-sm font-bold text-obsidian transition-colors hover:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {phase === "exporting" ? "Lagi render…" : "Export Video Mateng (.mp4)"}
                </button>
              </>
            )}

            <button
              onClick={() => {
                setFile(null);
                setWords([]);
                setPhase("idle");
              }}
              className="w-full cursor-pointer rounded-xl border border-hairline bg-surface px-4 py-2.5 text-mini font-semibold text-muted transition-colors hover:border-ember/40 hover:text-ink"
            >
              Ganti video
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
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
      <span className="text-mini text-muted">Maksimal ~10 menit. Diproses di HP lo, bukan diupload ke server.</span>
      <input
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

/** The translucent TikTok/Reels unsafe regions: right rail + bottom UI band. */
function SafeZones() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute inset-y-0 right-0 w-[16%] bg-danger/10" />
      <div className="absolute inset-x-0 bottom-0 h-[18%] bg-danger/10" />
      <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 border-y border-dashed border-white/20" />
      <span className="absolute bottom-1 left-2 rounded bg-obsidian/70 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">
        area caption
      </span>
    </div>
  );
}

function CaptionOverlay({
  line,
  wordIdx,
  style,
}: {
  line: { words: Word[] };
  wordIdx: number;
  style: CaptionStyle;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex justify-center px-4 text-center"
      style={{ bottom: `${(1 - style.position) * 100}%` }}
    >
      <p
        className="max-w-[92%] leading-tight"
        style={{
          fontFamily: style.fontFamily,
          fontWeight: style.bold ? 800 : 500,
          fontSize: "clamp(16px, 6vw, 30px)",
          color: style.textColor,
          textShadow: style.style === "outline" ? "0 0 4px #000, 0 2px 4px #000" : "none",
          background: style.style === "box" ? "rgba(0,0,0,0.55)" : "transparent",
          padding: style.style === "box" ? "0.15em 0.4em" : 0,
          borderRadius: style.style === "box" ? "0.3em" : 0,
        }}
      >
        {line.words.map((w, i) => (
          <span key={i} style={{ color: i === wordIdx ? style.highlightColor : undefined }}>
            {w.word}
            {i < line.words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    </div>
  );
}

function TranscriptEditor({
  words,
  onChange,
}: {
  words: Word[];
  onChange: (w: Word[]) => void;
}) {
  // A textarea of the plain text, re-mapped to the existing timings by index on
  // edit. It fixes typos, which is the job; it does not re-time, so changing the
  // NUMBER of words keeps the old timings for the words that still line up. Good
  // enough for corrections, and honest about it in the hint below.
  const text = useMemo(() => words.map((w) => w.word).join(" "), [words]);
  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <p className="mb-2 text-mini font-semibold text-ink">Betulin teks (kalau ada typo)</p>
      <textarea
        defaultValue={text}
        onBlur={(e) => {
          const tokens = e.target.value.trim().split(/\s+/).filter(Boolean);
          onChange(
            words.map((w, i) => (i < tokens.length ? { ...w, word: tokens[i] } : w)).filter(
              (_, i) => i < tokens.length,
            ),
          );
        }}
        rows={5}
        className="w-full resize-none rounded-lg border border-hairline bg-obsidian/40 p-2.5 text-sm text-ink outline-none focus:border-ember/50"
      />
      <p className="mt-1.5 text-micro text-muted">
        Betulin ejaan aja — jangan nambah/ngurangin jumlah kata biar timing-nya gak geser.
      </p>
    </div>
  );
}

function StylePanel({
  style,
  onChange,
}: {
  style: CaptionStyle;
  onChange: (s: CaptionStyle) => void;
}) {
  const set = (p: Partial<CaptionStyle>) => onChange({ ...style, ...p });
  return (
    <div className="space-y-3 rounded-xl border border-hairline bg-surface p-3">
      <p className="text-mini font-semibold text-ink">Gaya subtitle</p>

      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Warna teks" value={style.textColor} onChange={(v) => set({ textColor: v })} />
        <ColorField
          label="Warna highlight"
          value={style.highlightColor}
          onChange={(v) => set({ highlightColor: v })}
        />
      </div>

      <label className="block">
        <span className="text-micro text-muted">Font</span>
        <select
          value={style.fontFamily}
          onChange={(e) => set({ fontFamily: e.target.value })}
          className="mt-1 w-full rounded-lg border border-hairline bg-obsidian/40 px-2 py-2 text-mini text-ink outline-none focus:border-ember/50"
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-1.5">
        {(["box", "outline", "plain"] as const).map((s) => (
          <button
            key={s}
            onClick={() => set({ style: s })}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-micro font-semibold capitalize transition-colors ${
              style.style === s
                ? "border-ember bg-ember/15 text-ember"
                : "border-hairline bg-obsidian/30 text-muted hover:text-ink"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-mini text-ink">
        <input
          type="checkbox"
          checked={style.bold}
          onChange={(e) => set({ bold: e.target.checked })}
          className="accent-ember"
        />
        Tebal
      </label>

      <label className="block">
        <span className="text-micro text-muted">Posisi (naik-turun)</span>
        <input
          type="range"
          min={0.5}
          max={0.92}
          step={0.02}
          value={style.position}
          onChange={(e) => set({ position: Number(e.target.value) })}
          className="mt-1 w-full accent-ember"
        />
      </label>
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
  // Transcription has no numeric progress (it is one server call), so its bar is
  // indeterminate rather than a fake number crawling to 90 and stopping.
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
