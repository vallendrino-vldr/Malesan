"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getNativeShell, startNativeRequest, subscribeNative } from "@/lib/native/bridge";
import {
  YouTubeClipPlayer,
  type YouTubeClipController,
} from "./YouTubeClipPlayer";

const emptySubscribe = () => () => {};
const getIsMobileSnapshot = () => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * AI Viral Radar. Gemini watches the URL server-side; YouTube's official IFrame
 * API handles interactive preview ranges here. Media bytes never cross either
 * boundary, so export remains a separate local-file capability until Bridge is
 * installed.
 */

type Clip = {
  viralScore: number;
  hookTitle: string;
  startTime: number;
  endTime: number;
  reason: string;
};

type Scan = { videoId: string; title: string; duration?: number; clips: Clip[] };
type BridgeJob = { id: string; status: string; progress: number; stage: string | null; credit_amount?: number };
type ChromeExternal = { runtime?: { sendMessage(extensionId: string, message: unknown, callback: (response: { ok?: boolean; error?: string; downloadUrl?: string } | undefined) => void): void; lastError?: { message?: string } } };

const STEPS = [
  "Baca link videonya...",
  "AI lagi nonton videonya...",
  "Nyisir momen paling nempel...",
  "Nyusun ranking viral...",
];

const clock = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

export function ClipRadar({ cost, onClipReady }: { cost: number; onClipReady?: (file: File) => void }) {
  const router = useRouter();
  const [url, setUrl] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("yt_share") || new URLSearchParams(window.location.search).get("url") || "";
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [playerState, setPlayerState] = useState<"loading" | "ready" | "playing" | "paused" | "error">("loading");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [actualTime, setActualTime] = useState<number | null>(null);
  
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [bridgeJob, setBridgeJob] = useState<BridgeJob | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [bridgeStartedAt, setBridgeStartedAt] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    if (!bridgeBusy) return;
    const interval = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [bridgeBusy]);

  const elapsedSec = bridgeStartedAt && bridgeBusy ? Math.max(0, Math.floor((nowTs - bridgeStartedAt) / 1000)) : 0;

  const isMobile = useSyncExternalStore(emptySubscribe, getIsMobileSnapshot, () => false);
  const playerRef = useRef<YouTubeClipController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const autoTriggeredRef = useRef(false);

  const setController = useCallback((controller: YouTubeClipController | null) => {
    playerRef.current = controller;
  }, []);

  const setPlayerError = useCallback((message: string | null) => {
    setPreviewError(message);
  }, []);

  const provePlayback = useCallback((seconds: number) => {
    setActualTime(seconds);
  }, []);

  const handleDuration = useCallback((duration: number) => {
    if (!duration || duration <= 0) return;
    setVideoDuration(duration);
    setScan((prev) => {
      if (!prev) return null;
      let changed = false;
      const updatedClips = prev.clips.map((c) => {
        if (c.startTime >= duration) {
          changed = true;
          const safeStart = Math.max(0, duration - 30);
          const safeEnd = duration;
          return { ...c, startTime: safeStart, endTime: safeEnd };
        }
        if (c.endTime > duration) {
          changed = true;
          return { ...c, endTime: duration };
        }
        return c;
      });
      return changed ? { ...prev, duration, clips: updatedClips } : prev;
    });
  }, []);

  // Walk the status label forward while the request is in flight. The server
  // gives us no progress events, so this is honest pacing, not a fake bar.
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2600);
    return () => clearInterval(id);
  }, [loading]);

  const run = useCallback(async (targetUrl?: string) => {
    const inputUrl = targetUrl || url;
    if (!inputUrl.trim() || loading) return;
    setLoading(true);
    setStep(0);
    setError(null);
    setPreviewError(null);
    setActualTime(null);
    setScan(null);
    try {
      const res = await fetch("/api/video/youtube-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });
      const data = (await res.json().catch(() => null)) as (Scan & { error?: string }) | null;
      if (!res.ok || !data?.clips?.length) {
        setError(data?.error ?? "Gagal scan videonya. Coba lagi bentar ya.");
        return;
      }
      setScan(data);
      setActive(0);
      // Credits just came off server-side; pull the header balance fresh.
      router.refresh();
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch {
      setError("Koneksinya putus di tengah jalan. Coba lagi ya.");
    } finally {
      setLoading(false);
    }
  }, [url, loading, router]);

  // Auto-trigger scan when shared from YouTube mobile app (via yt_share param)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get("yt_share") || params.get("url");
    if (!shared || loading || scan) return;

    const shareId = params.get("share_id") || `legacy:${shared}`;
    const storageKey = `malesan:consumed-share:${shareId}`;
    if (autoTriggeredRef.current || sessionStorage.getItem(storageKey)) return;
    autoTriggeredRef.current = true;
    sessionStorage.setItem(storageKey, "1");

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("yt_share");
    cleanUrl.searchParams.delete("url");
    cleanUrl.searchParams.delete("share_id");
    window.history.replaceState(null, "", cleanUrl.toString());

    const timer = setTimeout(() => void run(shared), 50);
    return () => clearTimeout(timer);
  }, [loading, scan, run]);

  const clip = scan?.clips[active];

  const startAutoClip = async () => {
    if (!scan || !clip || bridgeBusy) return;
    setBridgeBusy(true);
    setBridgeStartedAt(Date.now());
    setBridgeError(null);
    let claimedJobId: string | null = null;
    let claimedWorkerToken: string | null = null;
    try {
      const response = await fetch("/api/video/auto-clip", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: url, title: scan.title, clipTitle: clip.hookTitle, startTime: clip.startTime, endTime: clip.endTime, ratio: "9:16", focus: "auto", captionPreset: "default", language: "id", rightsConfirmed }),
      });
      const created = await response.json().catch(() => null) as ({ job?: BridgeJob; claimToken?: string; error?: string } | null);
      if (!response.ok || !created?.job || !created.claimToken) throw new Error(created?.error ?? "Job Auto Clip gagal dibuat.");
      setBridgeJob(created.job);

      let downloadUrl: string;
      const nativeShell = await getNativeShell();
      if (nativeShell?.capabilities.includes("native-auto-clip")) {
        const claimed = await fetch("/api/bridge/auto-clip/claim", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: created.job.id, claimToken: created.claimToken }),
        }).then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => null) as { workerToken?: string; error?: string } | null }));
        if (!claimed.ok || !claimed.data?.workerToken) throw new Error(claimed.data?.error ?? "Gagal mengunci job Auto Clip.");
        const workerToken = claimed.data.workerToken;
        claimedJobId = created.job.id;
        claimedWorkerToken = workerToken;
        const requestId = startNativeRequest({
          type: "CLIP_START", jobId: created.job.id, sourceUrl: url,
          startTime: clip.startTime, endTime: clip.endTime,
        });
        const nativeResult = await new Promise<{ downloadUrl: string; outputBytes: number }>((resolve, reject) => {
          const timer = window.setTimeout(() => { unsubscribe(); reject(new Error("Auto Clip native melewati batas waktu.")); }, 10 * 60_000);
          const unsubscribe = subscribeNative((message) => {
            if (message.requestId !== requestId) return;
            if (message.type === "CLIP_PROGRESS") {
              setBridgeJob({ ...created.job!, status: "processing", progress: Math.round(message.progress ?? 0), stage: message.stage ?? "Memproses clip di HP..." });
              return;
            }
            window.clearTimeout(timer); unsubscribe();
            if (message.type === "NATIVE_ERROR") reject(new Error(message.message ?? "Auto Clip native gagal."));
            else if (message.type === "CLIP_READY" && message.downloadUrl && message.outputBytes) resolve({ downloadUrl: message.downloadUrl, outputBytes: message.outputBytes });
            else reject(new Error("Respons Auto Clip native tidak valid."));
          });
        });
        const settled = await fetch("/api/bridge/auto-clip/acquired", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: created.job.id, workerToken, outputBytes: nativeResult.outputBytes }),
        });
        if (!settled.ok) throw new Error((await settled.json().catch(() => null) as { error?: string } | null)?.error ?? "Gagal mengunci biaya Auto Clip.");
        const outputName = `${clip.hookTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "malesan-clip"}.mp4`;
        const markedReady = await fetch("/api/bridge/auto-clip/progress", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: created.job.id, workerToken, status: "ready", progress: 100, stage: "Klip siap", outputName, outputBytes: nativeResult.outputBytes }),
        });
        if (!markedReady.ok) throw new Error((await markedReady.json().catch(() => null) as { error?: string } | null)?.error ?? "Status hasil Auto Clip gagal disimpan.");
        // Job is terminal now; a later failure must not try to overwrite it as failed.
        claimedJobId = null;
        claimedWorkerToken = null;
        downloadUrl = nativeResult.downloadUrl;
      } else {
        const extensionId = process.env.NEXT_PUBLIC_MALESAN_BRIDGE_EXTENSION_ID || "ckpiijmjnnekfolkhhnoiifjgnbgbpjl";
        const chromeRuntime = (window as typeof window & { chrome?: ChromeExternal }).chrome?.runtime;
        if (window.innerWidth < 768 || !chromeRuntime) throw new Error(window.innerWidth < 768 ? "APK ini belum punya engine Auto Clip native. Perbarui APK Malesan." : "Malesan Bridge belum terdeteksi di browser ini. Jalankan INSTALL_MALESAN_BRIDGE.cmd sekali, lalu coba lagi.");
        const result = await new Promise<{ ok?: boolean; error?: string; downloadUrl?: string }>((resolve, reject) => {
          chromeRuntime.sendMessage(extensionId, { type: "MALESAN_AUTO_CLIP", jobId: created.job!.id, claimToken: created.claimToken, apiOrigin: location.origin }, (value) => {
            if (chromeRuntime.lastError) reject(new Error(chromeRuntime.lastError.message ?? "Bridge gak merespons.")); else resolve(value ?? {});
          });
        });
        if (!result.ok || !result.downloadUrl) throw new Error(result.error ?? "Bridge gagal memproses klip.");
        downloadUrl = result.downloadUrl;
      }

      const fileResponse = await fetch(downloadUrl);
      if (!fileResponse.ok) throw new Error("Hasil Auto Clip gak bisa dibuka.");
      const blob = await fileResponse.blob();
      const filename = `${clip.hookTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "malesan-clip"}.mp4`;
      const localFile = new File([blob], filename, { type: blob.type || "video/mp4" });
      if (onClipReady) onClipReady(localFile);
      else {
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(blob); anchor.download = filename; anchor.click();
        setTimeout(() => URL.revokeObjectURL(anchor.href), 30_000);
      }
      setBridgeJob({ ...created.job, status: "ready", progress: 100, stage: "Klip siap" });
      router.refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Auto Clip gagal. Coba lagi.";
      // A claimed job must always reach a terminal state, otherwise it stays locked
      // behind a live worker token and the user cannot retry the same clip.
      if (claimedJobId && claimedWorkerToken) {
        await fetch("/api/bridge/auto-clip/progress", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: claimedJobId, workerToken: claimedWorkerToken, status: "failed", progress: 0, stage: "Gagal", errorCode: "native_clip_failed", errorMessage: message.slice(0, 300) }),
        }).catch(() => undefined);
      }
      setBridgeError(message);
    } finally { setBridgeBusy(false); }
  };

  const playClip = (index: number) => {
    const selected = scan?.clips[index];
    if (!selected) return;
    setActive(index);
    setActualTime(null);
    setPreviewError(null);
    const dur = videoDuration ?? scan?.duration;
    let safeStart = selected.startTime;
    let safeEnd = selected.endTime;
    if (dur && dur > 0) {
      if (safeStart >= dur) {
        safeStart = Math.max(0, dur - 30);
        safeEnd = dur;
      } else if (safeEnd > dur) {
        safeEnd = dur;
      }
    }
    if (!playerRef.current?.playRange(safeStart, safeEnd)) {
      setPreviewError("Player belum siap. Tunggu sebentar lalu tap momennya lagi.");
    }
  };

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-4">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-ember/15">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 text-ember"
            aria-hidden="true"
          >
            <path d="M12 3a9 9 0 1 0 9 9" />
            <path d="M12 8a4 4 0 1 0 4 4" />
            <path d="m13 11 8-8" />
          </svg>
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink">Clip Radar YouTube</h3>
          <p className="mt-1 text-mini leading-relaxed text-muted">
            Tempel link YouTube-nya, AI yang nyariin momen paling layak dipotong. Gak perlu
            download videonya. <span className="text-ember">{cost} kredit sekali scan.</span>
          </p>
        </div>
      </header>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          name="youtube-url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="https://youtu.be/..."
          aria-label="Link video YouTube"
          className="h-11 w-full min-w-0 rounded-xl border border-hairline bg-obsidian px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ember/60"
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || !url.trim()}
          className="h-11 shrink-0 cursor-pointer rounded-xl bg-ember px-4 text-sm font-bold text-obsidian transition-colors hover:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-50 sm:w-40"
        >
          {loading ? "Lagi scan..." : "Cari Momen Viral"}
        </button>
      </div>

      {loading && (
        <div className="mt-4 space-y-3 rounded-2xl border border-ember/30 bg-gradient-to-b from-ember/10 via-surface-raised/80 to-surface-raised/40 p-4 shadow-lg" aria-live="polite">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="relative flex size-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-75" />
                  <span className="relative inline-flex size-3 rounded-full bg-ember" />
                </span>
                <p className="text-xs font-bold text-ink">
                  {STEPS[step]}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-ember tabular-nums">
                Langkah {step + 1} dari {STEPS.length}
              </span>
            </div>

            {/* Live Progress Bar */}
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-obsidian/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-ember/60 via-ember to-amber-400 transition-all duration-700 ease-out"
                style={{ width: `${Math.min(95, 25 + step * 24)}%` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-sweep" />
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {[98, 92, 85].map((mockScore, i) => (
              <div
                key={i}
                className="animate-shimmer-glow relative overflow-hidden rounded-xl border border-hairline/70 p-3.5 flex items-start gap-3 shadow-xs"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ember/20 text-xs font-bold text-ember animate-pulse">
                  {mockScore}
                </div>
                <div className="flex-1 space-y-2 py-0.5">
                  <div
                    className="h-4 rounded bg-white/20 animate-pulse"
                    style={{ width: i === 0 ? "75%" : i === 1 ? "85%" : "65%" }}
                  />
                  <div
                    className="h-3 rounded bg-white/10 animate-pulse"
                    style={{ width: i === 0 ? "90%" : i === 1 ? "70%" : "80%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-mini text-danger">
          {error}
        </p>
      )}

      {scan && clip && (
        <div ref={resultRef} className="mt-4 space-y-3">
          <div className="overflow-hidden rounded-xl border border-hairline bg-black">
            <YouTubeClipPlayer
              key={scan.videoId}
              videoId={scan.videoId}
              title={clip.hookTitle}
              initialStart={scan.clips[0]?.startTime ?? 0}
              initialEnd={scan.clips[0]?.endTime ?? 60}
              onController={setController}
              onError={setPlayerError}
              onPlaybackProof={provePlayback}
              onDuration={handleDuration}
              onState={setPlayerState}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-mini text-muted" title={scan.title}>
              {scan.title}
            </p>
            <div className="flex items-center gap-2">
              <a
                href={`https://youtu.be/${scan.videoId}?t=${Math.floor(clip.startTime)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 items-center gap-1 rounded-md border border-hairline bg-obsidian px-2 text-[11px] font-semibold text-muted hover:border-ember/40 hover:text-ember transition-colors"
              >
                <span>Buka {clock(clip.startTime)} di YouTube</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
              </a>
              <span className="shrink-0 whitespace-nowrap text-micro font-semibold text-ember tabular-nums">
                {playerState === "playing" ? "Diputar" : "Terpilih"} · {clock(clip.startTime)}–{clock(clip.endTime)}
              </span>
            </div>
          </div>

          {actualTime !== null && Math.abs(actualTime - clip.startTime) <= 2.5 ? (
            <p className="text-micro text-success" role="status">
              Preview pindah ke {clock(actualTime)}.
            </p>
          ) : null}

          {previewError ? (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-mini text-danger" role="alert">
              {previewError}
            </p>
          ) : null}

          <ul className="grid grid-cols-1 gap-2.5">
            {scan.clips.map((c, i) => {
              const durSec = Math.round(c.endTime - c.startTime);
              return (
                <li key={`${c.startTime}-${i}`}>
                  <button
                    onClick={() => playClip(i)}
                    aria-current={i === active ? "true" : undefined}
                    aria-label={`Putar ${c.hookTitle}, ${clock(c.startTime)} sampai ${clock(c.endTime)} (${durSec} detik)`}
                    className={`flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${
                      i === active
                        ? "border-ember/60 bg-ember/10 shadow-sm ring-1 ring-ember/20"
                        : "border-hairline bg-obsidian hover:border-ember/40 hover:bg-surface-raised/30"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 rounded-md bg-ember/15 px-2 py-0.5 text-micro font-extrabold text-ember tabular-nums">
                      {c.viralScore}
                    </span>
                    <span className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="block truncate text-mini font-bold leading-snug text-ink">
                          {c.hookTitle}
                        </span>
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold text-ink/90">
                          ⏱️ {durSec}s
                        </span>
                      </div>
                      <span className="mt-1 block text-micro leading-relaxed text-muted">
                        {clock(c.startTime)}–{clock(c.endTime)} · {durSec} detik · {c.reason}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {isMobile ? (
            <div className="space-y-3 rounded-2xl border border-ember/30 bg-gradient-to-br from-surface to-ember/5 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/40 bg-ember/15 px-2.5 py-0.5 text-[10px] font-bold text-ember uppercase">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden="true">
                    <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />
                  </svg>
                  Momen Terpilih
                </span>
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-ember">
                  <span>{clock(clip.startTime)}–{clock(clip.endTime)}</span>
                  <span className="rounded-md bg-ember/20 px-1.5 py-0.5 text-[11px] text-ember">
                    {Math.round(clip.endTime - clip.startTime)} detik
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-hairline/80 bg-obsidian/80 p-3.5 space-y-1.5">
                <p className="text-xs font-bold text-ink leading-snug">{clip.hookTitle}</p>
                <p className="text-micro text-muted leading-relaxed">{clip.reason}</p>
              </div>

              <label
                onClick={(e) => {
                  e.preventDefault();
                  setRightsConfirmed((prev) => !prev);
                }}
                className="flex min-h-11 cursor-pointer items-start gap-2.5 text-mini leading-relaxed text-muted select-none"
              >
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  readOnly
                  className="mt-1 size-4 shrink-0 accent-ember rounded pointer-events-none"
                />
                <span>Gue punya hak atau izin buat mengolah video ini. Pemotongan &amp; subtitle ditagih per menit sesuai durasi.</span>
              </label>

              <button
                type="button"
                onClick={startAutoClip}
                disabled={bridgeBusy || !rightsConfirmed}
                className="btn-ember relative flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl px-5 font-display text-sm font-bold text-obsidian shadow-md transition-all active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 sm:text-base"
              >
                {bridgeBusy ? <span className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/30 to-transparent" /> : null}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="relative size-4 shrink-0" aria-hidden="true">
                  <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
                </svg>
                <span className="relative truncate">{bridgeBusy ? (bridgeJob?.stage || "Menyiapkan Auto Clip...") : `Bikin Auto Clip (${clock(clip.startTime)}–${clock(clip.endTime)})`}</span>
              </button>
              {bridgeBusy && bridgeJob ? (
                <div className="space-y-2 pt-1.5">
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ember/80 to-ember transition-[width] duration-300 relative overflow-hidden"
                      style={{ width: `${Math.max(8, Math.min(99, bridgeJob.progress))}%` }}
                    >
                      <span className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-micro text-muted font-medium">
                    <span className="truncate pr-2 font-medium text-ink/90 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-ember animate-ping shrink-0" />
                      {bridgeJob.stage || "Memotong klip di HP..."}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted tabular-nums">
                        ⏳ {elapsedSec}s / est. ~{Math.max(8, Math.min(25, Math.round((clip.endTime - clip.startTime) * 0.35)))}s
                      </span>
                      <span className="tabular-nums text-ember font-extrabold text-xs">
                        {Math.min(99, Math.max(5, Math.round(bridgeJob.progress)))}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
              {bridgeError ? <p className="text-mini leading-relaxed text-red-300" role="alert">{bridgeError}</p> : null}

              <div className="flex items-center justify-between gap-2 pt-1">
                <a
                  href={`https://www.youtube.com/watch?v=${scan.videoId}&t=${clip.startTime}s`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] font-display text-xs font-semibold text-muted hover:border-ember/40 hover:bg-ember/10 hover:text-ink transition-all"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 text-ember shrink-0">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <span>Tonton Menit {clock(clip.startTime)} di YouTube ↗</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-ember/30 bg-gradient-to-br from-surface to-ember/5 p-4 shadow-xs">
              <label
                onClick={(e) => {
                  e.preventDefault();
                  setRightsConfirmed((prev) => !prev);
                }}
                className="flex min-h-11 cursor-pointer items-start gap-2.5 text-mini leading-relaxed text-muted select-none"
              >
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  readOnly
                  className="mt-1 size-4 shrink-0 accent-ember rounded pointer-events-none"
                />
                <span>Gue punya hak atau izin buat mengolah video ini. Pemotongan ditagih per menit sesuai durasi; subtitle ditagih terpisah.</span>
              </label>
              <button
                type="button"
                onClick={startAutoClip}
                disabled={bridgeBusy || !rightsConfirmed}
                className="btn-ember relative flex min-h-12 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl px-5 font-display text-sm sm:text-base font-bold text-obsidian shadow-md transition-all active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
              >
                {bridgeBusy ? (
                  <div className="flex items-center gap-2.5">
                    <div className="size-4 animate-spin rounded-full border-2 border-obsidian border-t-transparent" />
                    <span>Malesan lagi potong klip HD...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
                    </svg>
                    <span>Bikin Auto Clip ({clock(clip.startTime)}–{clock(clip.endTime)})</span>
                  </div>
                )}
              </button>

              {bridgeBusy ? (
                <div className="relative overflow-hidden rounded-xl border border-ember/30 bg-surface-raised/80 p-3.5 space-y-2.5" aria-live="polite">
                  <div className="flex items-center justify-between gap-2 text-micro">
                    <span className="font-semibold text-ember flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-ember animate-ping" />
                      Proses Auto Clip Berjalan
                    </span>
                    <span className="font-mono text-[11px] font-bold text-muted tabular-nums">
                      ⏳ {elapsedSec}s · {Math.min(99, Math.max(5, Math.round(bridgeJob?.progress ?? 35)))}%
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-obsidian border border-hairline">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ember/80 to-ember transition-all duration-300" style={{ width: `${Math.max(bridgeJob?.progress ?? 35, 10)}%` }}>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-sweep" />
                    </div>
                  </div>
                  <p className="text-micro text-muted leading-relaxed flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember shrink-0">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    <span>{bridgeJob?.stage || "Mengambil potongan video 1080p & audio tanpa re-encoding..."}</span>
                  </p>
                </div>
              ) : null}

              {bridgeError ? (
                <div className="rounded-2xl border border-ember/30 bg-surface-raised/90 p-4 text-mini space-y-3.5 shadow-lg" role="alert">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-xl bg-ember/15 flex items-center justify-center text-ember shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-ink text-mini">Auto Clip Butuh Mesin Pemotong Video</h4>
                      <p className="text-micro text-muted leading-relaxed mt-0.5">
                        Pemotongan klip YouTube diproses langsung di perangkat kamu (privat & tanpa kuota server). Pilih cara paling praktis di bawah:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {/* Option 1: Android APK */}
                    <div className="rounded-xl border border-hairline/80 bg-obsidian/60 p-3 flex flex-col justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-ink text-[11px]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember shrink-0"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                          <span>📱 Pengguna Android (Paling Praktis)</span>
                        </div>
                        <p className="text-[10px] text-muted leading-relaxed">
                          Gunakan aplikasi Android Malesan. Sudah ada mesin pemotong bawaan, tinggal paste link langsung jadi tanpa install tool lain.
                        </p>
                      </div>
                      <a
                        href="/malesan.apk"
                        download="malesan.apk"
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-ember px-3 text-[11px] font-bold text-obsidian transition-opacity hover:opacity-90 active:scale-[0.98]"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>Unduh APK Android (.apk)</span>
                      </a>
                    </div>

                    {/* Option 2: Desktop PC / Laptop */}
                    <div className="rounded-xl border border-hairline/80 bg-obsidian/60 p-3 flex flex-col justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-ink text-[11px]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember shrink-0"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                          <span>💻 Pengguna PC / Laptop (Windows)</span>
                        </div>
                        <p className="text-[10px] text-muted leading-relaxed">
                          Download Malesan Bridge (1-Click Installer). Ekstrak lalu jalankan <code>INSTALL_MALESAN_BRIDGE.cmd</code> sekali saja.
                        </p>
                      </div>
                      <a
                        href="/malesan-bridge.zip"
                        download="malesan-bridge.zip"
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-ember/40 bg-ember/15 px-3 text-[11px] font-bold text-ember transition-colors hover:bg-ember/25 active:scale-[0.98]"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>Unduh Bridge Installer (.zip)</span>
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Pop-up modal window with blurred backdrop during Auto Clip */}
      {bridgeBusy && mounted && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" role="dialog" aria-modal="true">
              <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-ember/40 bg-surface-raised/95 p-6 shadow-2xl space-y-5 text-center">
                <div className="pointer-events-none absolute -top-24 -left-24 size-48 rounded-full bg-ember/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -right-24 size-48 rounded-full bg-ember/15 blur-3xl" />

                {/* Animated Spinner & Icon */}
                <div className="relative mx-auto flex size-20 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-obsidian" />
                  <div className="absolute inset-0 rounded-full border-4 border-ember border-t-transparent animate-spin" />
                  <div className="size-14 rounded-full bg-ember/10 flex items-center justify-center text-ember">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-7">
                      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
                    </svg>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-display text-lg font-bold text-ink">
                    Memotong Klip HD
                  </h3>
                  <p className="text-mini font-semibold text-ember line-clamp-1">
                    {clip ? clip.hookTitle : "Menyiapkan klip pilihan"}
                  </p>
                  {clip ? (
                    <p className="text-micro text-muted">
                      Durasi: {clock(clip.startTime)} – {clock(clip.endTime)} ({Math.round(clip.endTime - clip.startTime)} detik)
                    </p>
                  ) : null}
                </div>

                {/* Progress Bar & ETA */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-micro font-mono">
                    <span className="font-semibold text-ember flex items-center gap-1.5 text-left">
                      <span className="size-2 rounded-full bg-ember animate-ping shrink-0" />
                      <span className="line-clamp-1">{bridgeJob?.stage || "Memproses di perangkat kamu..."}</span>
                    </span>
                    <span className="font-bold text-ink tabular-nums shrink-0 ml-2">
                      {Math.min(99, Math.max(5, Math.round(bridgeJob?.progress ?? 35)))}%
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-obsidian border border-hairline">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ember/80 to-ember transition-all duration-300"
                      style={{ width: `${Math.max(bridgeJob?.progress ?? 35, 10)}%` }}
                    >
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-sweep" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>Waktu berjalan: <strong className="text-ink font-mono">{elapsedSec}s</strong></span>
                    <span className="font-mono text-muted">Kualitas 1080p HD</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-hairline/60 bg-obsidian/40 p-3 text-micro leading-relaxed text-muted text-left flex items-start gap-2.5">
                  <span className="text-ember text-sm shrink-0">💡</span>
                  <span>Proses berjalan di perangkat lo. Layar terkunci sementara agar proses tidak terganggu.</span>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
