"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  YouTubeClipPlayer,
  type YouTubeClipController,
} from "./YouTubeClipPlayer";

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

type Scan = { videoId: string; title: string; clips: Clip[] };
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
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [active, setActive] = useState(0);
  const [playerState, setPlayerState] = useState<"loading" | "ready" | "playing" | "paused" | "error">("loading");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [actualTime, setActualTime] = useState<number | null>(null);
  const [bridgeJob, setBridgeJob] = useState<BridgeJob | null>(null);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const playerRef = useRef<YouTubeClipController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const setController = useCallback((controller: YouTubeClipController | null) => {
    playerRef.current = controller;
  }, []);

  const setPlayerError = useCallback((message: string | null) => {
    setPreviewError(message);
  }, []);

  const provePlayback = useCallback((seconds: number) => {
    setActualTime(seconds);
  }, []);

  // Walk the status label forward while the request is in flight. The server
  // gives us no progress events, so this is honest pacing, not a fake bar.
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2600);
    return () => clearInterval(id);
  }, [loading]);

  const run = async () => {
    if (!url.trim() || loading) return;
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
        body: JSON.stringify({ url }),
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
  };

  const clip = scan?.clips[active];

  const startAutoClip = async () => {
    if (!scan || !clip || bridgeBusy) return;
    setBridgeBusy(true);
    setBridgeError(null);
    try {
      const response = await fetch("/api/video/auto-clip", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: url, title: scan.title, clipTitle: clip.hookTitle, startTime: clip.startTime, endTime: clip.endTime, ratio: "9:16", focus: "auto", captionPreset: "default", language: "id", rightsConfirmed }),
      });
      const created = await response.json().catch(() => null) as ({ job?: BridgeJob; claimToken?: string; error?: string } | null);
      if (!response.ok || !created?.job || !created.claimToken) throw new Error(created?.error ?? "Job Auto Clip gagal dibuat.");
      setBridgeJob(created.job);
      if (window.innerWidth < 768) return;
      const extensionId = process.env.NEXT_PUBLIC_MALESAN_BRIDGE_EXTENSION_ID || "ckpiijmjnnekfolkhhnoiifjgnbgbpjl";
      const chromeRuntime = (window as typeof window & { chrome?: ChromeExternal }).chrome?.runtime;
      if (!extensionId || !chromeRuntime) throw new Error("Malesan Bridge belum terpasang. Install Bridge sekali, lalu coba lagi.");
      const result = await new Promise<{ ok?: boolean; error?: string; downloadUrl?: string }>((resolve, reject) => {
        chromeRuntime.sendMessage(extensionId, { type: "MALESAN_AUTO_CLIP", jobId: created.job!.id, claimToken: created.claimToken, apiOrigin: location.origin }, (value) => {
          if (chromeRuntime.lastError) reject(new Error(chromeRuntime.lastError.message ?? "Bridge gak merespons.")); else resolve(value ?? {});
        });
      });
      if (!result.ok || !result.downloadUrl) throw new Error(result.error ?? "Bridge gagal memproses klip.");
      const fileResponse = await fetch(result.downloadUrl);
      if (!fileResponse.ok) throw new Error("Hasil Bridge gak bisa dibuka.");
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
      setBridgeError(reason instanceof Error ? reason.message : "Auto Clip gagal. Coba lagi.");
    } finally { setBridgeBusy(false); }
  };

  const playClip = (index: number) => {
    const selected = scan?.clips[index];
    if (!selected) return;
    setActive(index);
    setActualTime(null);
    setPreviewError(null);
    if (!playerRef.current?.playRange(selected.startTime, selected.endTime)) {
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
          onClick={run}
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
              initialStart={clip.startTime}
              initialEnd={clip.endTime}
              onController={setController}
              onError={setPlayerError}
              onPlaybackProof={provePlayback}
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

          <ul className="grid grid-cols-1 gap-2">
            {scan.clips.map((c, i) => (
              <li key={`${c.startTime}-${i}`}>
                <button
                  onClick={() => playClip(i)}
                  disabled={playerState === "loading"}
                  aria-current={i === active ? "true" : undefined}
                  aria-label={`Putar ${c.hookTitle}, ${clock(c.startTime)} sampai ${clock(c.endTime)}`}
                  className={`flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${
                    i === active
                      ? "border-ember/60 bg-ember/10"
                      : "border-hairline bg-obsidian hover:border-ember/40"
                  }`}
                >
                  <span className="mt-0.5 shrink-0 rounded-md bg-ember/15 px-1.5 py-0.5 text-micro font-bold text-ember tabular-nums">
                    {c.viralScore}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-mini font-semibold leading-snug text-ink">
                      {c.hookTitle}
                    </span>
                    <span className="mt-0.5 block text-micro leading-relaxed text-muted">
                      {clock(c.startTime)}–{clock(c.endTime)} · {c.reason}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="space-y-3 rounded-2xl border border-ember/30 bg-gradient-to-br from-surface to-ember/5 p-4 shadow-xs">
            <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-mini leading-relaxed text-muted">
              <input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} className="mt-1 size-4 shrink-0 accent-ember rounded" />
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
                    Proses Bridge Berjalan
                  </span>
                  <span className="font-mono font-bold text-muted">Kualitas HD 1080p</span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-obsidian border border-hairline">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ember/80 to-ember transition-all duration-300" style={{ width: `${Math.max(bridgeJob?.progress ?? 35, 35)}%` }}>
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
              <div className="rounded-xl border border-danger/40 bg-danger/10 p-3.5 text-mini text-danger space-y-2.5" role="alert">
                <div className="flex items-start gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0 text-danger mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>
                    <span className="font-bold block">{bridgeError}</span>
                    <span className="text-micro text-muted block mt-0.5">Malesan Bridge menghubungkan browser kamu dengan alat pemotong video lokal (Chrome, Brave, Edge).</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="rounded-lg border border-hairline bg-obsidian/60 p-2.5 space-y-1">
                    <p className="text-[11px] font-bold text-ink flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-ember"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                      Pengguna PC / Laptop
                    </p>
                    <p className="text-[10px] text-muted leading-relaxed">Jalankan file <code>INSTALL_MALESAN_BRIDGE.cmd</code> sekali di folder project, lalu restart browser.</p>
                  </div>
                  <div className="rounded-lg border border-hairline bg-obsidian/60 p-2.5 space-y-1">
                    <p className="text-[11px] font-bold text-ink flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-ember"><rect width="14" height="20" x="5" y="2" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                      Pengguna HP Android / iOS
                    </p>
                    <p className="text-[10px] text-muted leading-relaxed">Download video lewat aplikasi downloader di HP, lalu buka tab <strong>Video Studio</strong> untuk auto-potong & pasang subtitle.</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
