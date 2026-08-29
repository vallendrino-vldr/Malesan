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

const STEPS = [
  "Baca link videonya...",
  "AI lagi nonton videonya...",
  "Nyisir momen paling nempel...",
  "Nyusun ranking viral...",
];

const clock = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

export function ClipRadar({ cost }: { cost: number }) {
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
        <div className="mt-3 space-y-2" aria-live="polite">
          <p className="text-mini text-muted">{STEPS[step]}</p>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-shimmer-sweep relative h-16 overflow-hidden rounded-xl border border-hairline bg-obsidian"
            />
          ))}
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

          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 truncate text-mini text-muted" title={scan.title}>
              {scan.title}
            </p>
            <span className="shrink-0 whitespace-nowrap text-micro font-semibold text-ember tabular-nums">
              {playerState === "playing" ? "Diputar" : "Terpilih"} · {clock(clip.startTime)}–{clock(clip.endTime)}
            </span>
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

          <p className="rounded-xl border border-ember/20 bg-ember/5 px-3 py-2.5 text-micro leading-relaxed text-muted">
            Preview ini langsung dari YouTube. Auto potong, subtitle, dan face track dari URL lagi
            disiapkan lewat Malesan Bridge—bukan download-upload manual.
          </p>
        </div>
      )}
    </section>
  );
}
