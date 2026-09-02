"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  getNativeShell,
  pasteFromNativeClipboard,
  startNativeRequest,
  subscribeNative,
} from "@/lib/native/bridge";
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
  const [isNativeApk, setIsNativeApk] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(
      (typeof navigator !== "undefined" && (navigator.userAgent.includes("MalesanStudio") || navigator.userAgent.includes("MalesanApp"))) ||
      window.MalesanNative
    );
  });
  const [showLockModal, setShowLockModal] = useState(false);

  useEffect(() => {
    let active = true;
    void getNativeShell().then((shell) => {
      if (active) {
        setIsNativeApk(Boolean(
          shell?.capabilities.includes("native-auto-clip") ||
          (typeof navigator !== "undefined" && (navigator.userAgent.includes("MalesanStudio") || navigator.userAgent.includes("MalesanApp"))) ||
          (typeof window !== "undefined" && Boolean(window.MalesanNative))
        ));
      }
    });
    return () => {
      active = false;
    };
  }, []);

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

  const adjustClipTrim = useCallback((clipIndex: number, deltaStart: number, deltaEnd: number) => {
    setScan((prev) => {
      if (!prev) return prev;
      const updatedClips = [...prev.clips];
      const target = updatedClips[clipIndex];
      if (!target) return prev;
      const maxDur = prev.duration || 7200;
      const newStart = Math.max(0, Math.min(maxDur - 5, target.startTime + deltaStart));
      const newEnd = Math.max(newStart + 5, Math.min(maxDur, target.endTime + deltaEnd));
      updatedClips[clipIndex] = { ...target, startTime: newStart, endTime: newEnd };
      return { ...prev, clips: updatedClips };
    });
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try { navigator.vibrate(10); } catch {}
    }
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
    setBridgeError(null);

    const nativeShell = await getNativeShell();
    const isNative = Boolean(
      nativeShell?.capabilities.includes("native-auto-clip") ||
      (typeof navigator !== "undefined" && (navigator.userAgent.includes("MalesanStudio") || navigator.userAgent.includes("MalesanApp"))) ||
      (typeof window !== "undefined" && Boolean(window.MalesanNative))
    );
    const isMobileDevice = typeof window !== "undefined" && (/Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || window.innerWidth < 768);

    if (!isNative) {
      if (isMobileDevice) {
        setBridgeError("Mode Web HP / PWA tidak memiliki mesin pemotong YouTube lokal. Buka via aplikasi APK Android Malesan (Gratis) atau pilih 'Pakai file sendiri' di bawah.");
        return;
      }
      setBridgeError("Pemotongan otomatis dari link YouTube membutuhkan aplikasi Malesan Studio Desktop atau Malesan APK. Buka via aplikasi Malesan atau pilih 'Pakai file sendiri' di bawah.");
      return;
    }

    setBridgeBusy(true);
    setBridgeStartedAt(Date.now());
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
      if (isNative) {
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
        const extensionIds = [
          "momojnfkjflahebbaegiabcedokpibfn",
          process.env.NEXT_PUBLIC_MALESAN_BRIDGE_EXTENSION_ID || "ckpiijmjnnekfolkhhnoiifjgnbgbpjl",
        ];
        const chromeRuntime = (window as typeof window & { chrome?: ChromeExternal }).chrome?.runtime;
        if (window.innerWidth < 768 || !chromeRuntime) throw new Error(window.innerWidth < 768 ? "APK ini belum punya engine Auto Clip native. Perbarui APK Malesan." : "Malesan Bridge belum terdeteksi di browser ini. Jalankan INSTALL_MALESAN_BRIDGE.cmd sekali, lalu coba lagi.");
        
        const result = await new Promise<{ ok?: boolean; error?: string; downloadUrl?: string }>((resolve, reject) => {
          let resolved = false;
          const reqId = "req-" + Math.random().toString(36).slice(2);
          const onMsg = (ev: MessageEvent) => {
            if (ev.data?.type === "MALESAN_AUTO_CLIP_RESPONSE" && ev.data.requestId === reqId) {
              window.removeEventListener("message", onMsg);
              resolved = true;
              if (ev.data.response?.ok && ev.data.response.downloadUrl) resolve(ev.data.response);
              else reject(new Error(ev.data.response?.error ?? "Bridge gagal memproses klip."));
            }
          };
          window.addEventListener("message", onMsg);
          window.postMessage({
            type: "MALESAN_AUTO_CLIP_REQUEST",
            requestId: reqId,
            payload: { type: "MALESAN_AUTO_CLIP", jobId: created.job!.id, claimToken: created.claimToken, apiOrigin: location.origin }
          }, "*");

          // Also try direct extension messaging for all known IDs
          extensionIds.forEach((extId) => {
            chromeRuntime.sendMessage(extId, { type: "MALESAN_AUTO_CLIP", jobId: created.job!.id, claimToken: created.claimToken, apiOrigin: location.origin }, (value) => {
              if (resolved) return;
              if (value?.ok && value.downloadUrl) {
                resolved = true;
                window.removeEventListener("message", onMsg);
                resolve(value);
              }
            });
          });

          // Timeout fallback
          setTimeout(() => {
            if (!resolved) {
              window.removeEventListener("message", onMsg);
              reject(new Error("Bridge tidak merespons dalam 60 detik. Pastikan INSTALL_MALESAN_BRIDGE.cmd sudah dijalankan."));
            }
          }, 60_000);
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

      {/* Platform Awareness Engine Banner */}
      {isNativeApk ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-micro font-semibold text-emerald-400 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="truncate text-[11px] font-bold text-ink">Mesin Pemotong Native Aktif</span>
          </div>
          <span className="shrink-0 rounded-md border border-emerald-500/20 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
            1080p HD
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1 min-w-0">
          <input
            type="url"
            name="youtube-url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="https://youtu.be/..."
            aria-label="Link video YouTube"
            className="h-11 w-full min-w-0 rounded-xl border border-hairline bg-obsidian pl-3 pr-24 text-sm text-ink outline-none placeholder:text-muted focus:border-ember/60"
          />
          <button
            type="button"
            onClick={async () => {
              try {
                const nativeText = await pasteFromNativeClipboard();
                if (nativeText) {
                  setUrl(nativeText);
                  return;
                }
                if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
                  const text = await navigator.clipboard.readText();
                  if (text) setUrl(text.trim());
                }
              } catch {
                // Fallback
              }
            }}
            title="Tempel link otomatis dari clipboard"
            className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-micro font-bold text-muted hover:border-ember/40 hover:bg-ember/15 hover:text-ember transition-all cursor-pointer shadow-xs"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5 text-ember">
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            </svg>
            <span>Tempel</span>
          </button>
        </div>
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
                        <div className="flex items-center gap-1.5 shrink-0">
                          {i === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-ember/20 px-1.5 py-0.5 text-[9px] font-extrabold text-ember">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="size-2.5"><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/></svg>
                              <span>Hook</span>
                            </span>
                          ) : c.viralScore >= 90 ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-300">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="size-2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              <span>Top</span>
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold text-ink/90">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3 text-ember"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>{durSec}s</span>
                          </span>
                        </div>
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

              {/* Fine-tune Trim Controls */}
              <div className="rounded-xl border border-hairline/80 bg-obsidian/60 p-2.5 space-y-2">
                <div className="flex items-center justify-between text-micro font-bold text-muted">
                  <span>Sesuaikan Durasi Klip (+/- 3s)</span>
                  <span className="font-mono text-ember text-[11px]">{clock(clip.startTime)} — {clock(clip.endTime)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-micro">
                    <span className="text-mist font-semibold pl-1">Mulai</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjustClipTrim(active, -3, 0)}
                        className="flex h-6 px-1.5 items-center justify-center rounded bg-white/10 text-white font-bold hover:bg-ember hover:text-obsidian transition-colors text-[10px] cursor-pointer"
                        title="Mulai lebih awal 3 detik"
                      >-3s</button>
                      <button
                        type="button"
                        onClick={() => adjustClipTrim(active, +3, 0)}
                        className="flex h-6 px-1.5 items-center justify-center rounded bg-white/10 text-white font-bold hover:bg-ember hover:text-obsidian transition-colors text-[10px] cursor-pointer"
                        title="Mulai lebih lambat 3 detik"
                      >+3s</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-micro">
                    <span className="text-mist font-semibold pl-1">Selesai</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjustClipTrim(active, 0, -3)}
                        className="flex h-6 px-1.5 items-center justify-center rounded bg-white/10 text-white font-bold hover:bg-ember hover:text-obsidian transition-colors text-[10px] cursor-pointer"
                        title="Selesai lebih awal 3 detik"
                      >-3s</button>
                      <button
                        type="button"
                        onClick={() => adjustClipTrim(active, 0, +3)}
                        className="flex h-6 px-1.5 items-center justify-center rounded bg-white/10 text-white font-bold hover:bg-ember hover:text-obsidian transition-colors text-[10px] cursor-pointer"
                        title="Selesai lebih panjang 3 detik"
                      >+3s</button>
                    </div>
                  </div>
                </div>
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
                {isNativeApk ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="relative size-4 shrink-0" aria-hidden="true">
                    <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="relative size-4 shrink-0" aria-hidden="true">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                )}
                <span className="relative truncate">
                  {bridgeBusy
                    ? (bridgeJob?.stage || "Menyiapkan Auto Clip...")
                    : isNativeApk
                    ? `Bikin Auto Clip (${clock(clip.startTime)}–${clock(clip.endTime)})`
                    : `Bikin Auto Clip (Butuh APK Android)`}
                </span>
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
                      <span className="text-[10px] text-muted tabular-nums flex items-center gap-1">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-2.5 text-ember"><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>
                        <span>{elapsedSec}s / est. ~{Math.max(8, Math.min(25, Math.round((clip.endTime - clip.startTime) * 0.35)))}s</span>
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
              {/* Fine-tune Trim Controls Desktop */}
              <div className="rounded-xl border border-hairline/80 bg-obsidian/60 p-2.5 space-y-2">
                <div className="flex items-center justify-between text-micro font-bold text-muted">
                  <span>Sesuaikan Durasi Klip (+/- 3s)</span>
                  <span className="font-mono text-ember text-[11px]">{clock(clip.startTime)} — {clock(clip.endTime)} ({Math.round(clip.endTime - clip.startTime)}s)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-micro">
                    <span className="text-mist font-semibold pl-1">Mulai</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjustClipTrim(active, -3, 0)}
                        className="flex h-6 px-1.5 items-center justify-center rounded bg-white/10 text-white font-bold hover:bg-ember hover:text-obsidian transition-colors text-[10px] cursor-pointer"
                        title="Mulai lebih awal 3 detik"
                      >-3s</button>
                      <button
                        type="button"
                        onClick={() => adjustClipTrim(active, +3, 0)}
                        className="flex h-6 px-1.5 items-center justify-center rounded bg-white/10 text-white font-bold hover:bg-ember hover:text-obsidian transition-colors text-[10px] cursor-pointer"
                        title="Mulai lebih lambat 3 detik"
                      >+3s</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-micro">
                    <span className="text-mist font-semibold pl-1">Selesai</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjustClipTrim(active, 0, -3)}
                        className="flex h-6 px-1.5 items-center justify-center rounded bg-white/10 text-white font-bold hover:bg-ember hover:text-obsidian transition-colors text-[10px] cursor-pointer"
                        title="Selesai lebih awal 3 detik"
                      >-3s</button>
                      <button
                        type="button"
                        onClick={() => adjustClipTrim(active, 0, +3)}
                        className="flex h-6 px-1.5 items-center justify-center rounded bg-white/10 text-white font-bold hover:bg-ember hover:text-obsidian transition-colors text-[10px] cursor-pointer"
                        title="Selesai lebih panjang 3 detik"
                      >+3s</button>
                    </div>
                  </div>
                </div>
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
                    <span className="font-mono text-[11px] font-bold text-muted tabular-nums flex items-center gap-1">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-2.5 text-ember"><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>
                      <span>{elapsedSec}s · {Math.min(99, Math.max(5, Math.round(bridgeJob?.progress ?? 35)))}%</span>
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

              {bridgeError && !isNativeApk ? (
                <div className="rounded-2xl border border-ember/30 bg-surface-raised/90 p-4 text-mini space-y-3.5 shadow-lg" role="alert">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-xl bg-ember/15 flex items-center justify-center text-ember shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-ink text-mini">Auto Clip Butuh Aplikasi Malesan</h4>
                      <p className="text-micro text-muted leading-relaxed mt-0.5">
                        {isMobile
                          ? "Di browser HP / PWA, pasang APK Android Malesan (ada mesin pemotong bawaan) atau gunakan tab 'Pakai file sendiri'."
                          : "Di komputer, pasang aplikasi Malesan Studio Desktop atau gunakan tab 'Pakai file sendiri'."}
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
                          Gunakan aplikasi Malesan Studio Desktop. Mesin pemotong yt-dlp &amp; FFmpeg sudah terpasang bawaan.
                        </p>
                      </div>
                      <a
                        href="/Malesan-Setup.exe"
                        download="Malesan-Setup.exe"
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[11px] font-bold text-ink transition-colors hover:border-ember/40 hover:bg-ember/10 hover:text-ember active:scale-[0.98]"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>Unduh Malesan Studio (.exe)</span>
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

      {/* Pop-up Locked Feature Explainer Modal when opening on Web/PWA */}
      {showLockModal && mounted && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" role="dialog" aria-modal="true">
              <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-ember/40 bg-surface-raised/95 p-5 sm:p-6 shadow-2xl space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-xl bg-ember/15 border border-ember/30 text-ember">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4.5">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </span>
                    <div>
                      <h3 className="font-display text-sm sm:text-base font-bold text-ink">Fitur Auto Clip Terkunci di Web</h3>
                      <p className="text-[10px] sm:text-micro text-muted">Butuh Mesin Native untuk memotong 1080p tanpa batas.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLockModal(false)}
                    className="grid size-8 place-items-center rounded-lg border border-hairline bg-surface text-muted hover:text-ink cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-micro sm:text-xs text-muted leading-relaxed">
                  Browser web (Chrome/Safari) tidak dapat memotong stream video YouTube Full HD secara instan. Untuk memproses 1080p tanpa server &amp; tanpa batas:
                </p>

                <div className="space-y-2.5">
                  {/* Android Option */}
                  <div className="rounded-xl border border-hairline/80 bg-obsidian/70 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink text-mini flex items-center gap-1.5">
                        📱 Pengguna HP Android
                      </span>
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-400">Paling Praktis</span>
                    </div>
                    <p className="text-[10px] text-muted leading-relaxed">
                      Download aplikasi Android Malesan. Mesin pemotong sudah terpasang bawaan di aplikasi.
                    </p>
                    <a
                      href="/malesan.apk"
                      download="malesan.apk"
                      className="btn-ember flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold text-obsidian"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      <span>Unduh APK Android (.apk)</span>
                    </a>
                  </div>

                  {/* Desktop Option */}
                  <div className="rounded-xl border border-hairline/80 bg-obsidian/70 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink text-mini flex items-center gap-1.5">
                        💻 Pengguna PC / Laptop
                      </span>
                      <span className="rounded bg-ember/15 px-2 py-0.5 font-mono text-[9px] font-bold text-ember">Resmi</span>
                    </div>
                    <p className="text-[10px] text-muted leading-relaxed">
                      Download aplikasi Malesan Studio Desktop (.exe). Mesin pemotong bawaan langsung aktif.
                    </p>
                    <a
                      href="/Malesan-Setup.exe"
                      download="Malesan-Setup.exe"
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] text-xs font-bold text-ink hover:border-ember/40 hover:bg-ember/10 hover:text-ember"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      <span>Unduh Malesan Studio (.exe)</span>
                    </a>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowLockModal(false)}
                    className="w-full text-center text-[11px] font-semibold text-muted hover:text-ink cursor-pointer"
                  >
                    Tutup &amp; Pakai File Video Sendiri
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
