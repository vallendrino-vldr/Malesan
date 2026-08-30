"use client";

import { useEffect, useRef, useState } from "react";

type PlayerState = "loading" | "ready" | "playing" | "paused" | "error";

type YouTubePlayer = {
  destroy(): void;
  getCurrentTime(): number;
  getDuration?(): number;
  loadVideoById(args: { videoId: string; startSeconds: number; endSeconds?: number }): void;
  cueVideoById(args: { videoId: string; startSeconds: number; endSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
};

type YouTubeNamespace = {
  Player: new (
    element: HTMLIFrameElement,
    options: {
      events: {
        onError: (event: { data: number }) => void;
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YouTubeClipController = {
  playRange(startSeconds: number, endSeconds: number): boolean;
};

type Props = {
  videoId: string;
  title: string;
  initialStart: number;
  initialEnd: number;
  onController: (controller: YouTubeClipController | null) => void;
  onError: (message: string | null) => void;
  onPlaybackProof: (actualSeconds: number) => void;
  onDuration?: (durationSeconds: number) => void;
  onState: (state: PlayerState) => void;
};

let iframeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadIframeApi(): Promise<YouTubeNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise((resolve, reject) => {
    let resolved = false;
    const checkExisting = () => {
      if (window.YT?.Player) {
        resolved = true;
        resolve(window.YT);
        return true;
      }
      return false;
    };

    if (checkExisting()) return;

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (checkExisting()) return;
      setTimeout(() => {
        if (!checkExisting() && !resolved) {
          iframeApiPromise = null;
          reject(new Error("YouTube Player API gagal terhubung."));
        }
      }, 100);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        iframeApiPromise = null;
        reject(new Error("Player YouTube gagal dimuat. Cek koneksi lalu coba lagi."));
      };
      document.head.appendChild(script);
    }

    // Polling fallback in case onYouTubeIframeAPIReady already triggered
    const poll = setInterval(() => {
      if (checkExisting()) {
        clearInterval(poll);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(poll);
      if (!resolved && !checkExisting()) {
        // Resolve with window.YT if available, else reject gracefully
        if (window.YT?.Player) resolve(window.YT);
        else {
          iframeApiPromise = null;
          reject(new Error("Timeout memuat YouTube Player API."));
        }
      }
    }, 4000);
  });

  return iframeApiPromise;
}

function playerError(code: number) {
  if (code === 101 || code === 150) return "Pemilik video melarang preview di luar YouTube.";
  if (code === 100) return "Videonya sudah dihapus atau tidak tersedia.";
  if (code === 153) return "YouTube gak bisa memverifikasi halaman ini. Muat ulang lalu coba lagi.";
  return "Preview YouTube gagal diputar. Pilih momen lain atau coba lagi.";
}

export function YouTubeClipPlayer({
  videoId,
  title,
  initialStart,
  initialEnd,
  onController,
  onError,
  onPlaybackProof,
  onDuration,
  onState,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [activeRange, setActiveRange] = useState<{ start: number; end: number }>({
    start: initialStart,
    end: initialEnd,
  });
  const initialRangeRef = useRef({ start: initialStart, end: initialEnd });
  const callbacksRef = useRef({ onController, onError, onPlaybackProof, onDuration, onState });

  useEffect(() => {
    initialRangeRef.current = { start: initialStart, end: initialEnd };
  }, [initialStart, initialEnd]);

  useEffect(() => {
    callbacksRef.current = { onController, onError, onPlaybackProof, onDuration, onState };
  }, [onController, onError, onPlaybackProof, onDuration, onState]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let disposed = false;
    let player: YouTubePlayer | null = null;
    let stopTimer: ReturnType<typeof setInterval> | null = null;
    let proofTimer: ReturnType<typeof setTimeout> | null = null;
    let targetEnd = initialRangeRef.current.end;

    const clearPlaybackTimers = () => {
      if (stopTimer) clearInterval(stopTimer);
      if (proofTimer) clearTimeout(proofTimer);
      stopTimer = null;
      proofTimer = null;
    };

    const controller: YouTubeClipController = {
      playRange(startSeconds, nextEndSeconds) {
        if (nextEndSeconds <= startSeconds) return false;
        clearPlaybackTimers();
        targetEnd = nextEndSeconds;
        callbacksRef.current.onError(null);

        let didCallPlayer = false;

        // 1. Native IFrame API method invocation
        if (player) {
          try {
            player.loadVideoById({ videoId, startSeconds, endSeconds: nextEndSeconds });
            player.seekTo(startSeconds, true);
            player.playVideo();
            didCallPlayer = true;
          } catch {
            try {
              player.cueVideoById({ videoId, startSeconds, endSeconds: nextEndSeconds });
              player.seekTo(startSeconds, true);
              player.playVideo();
              didCallPlayer = true;
            } catch {}
          }
        }

        // 2. Direct postMessage fallback (ensures immediate scrub across any browser)
        try {
          const contentWin = iframeRef.current?.contentWindow;
          if (contentWin) {
            contentWin.postMessage(JSON.stringify({
              event: "command",
              func: "loadVideoById",
              args: [videoId, startSeconds, nextEndSeconds],
            }), "*");
            contentWin.postMessage(JSON.stringify({
              event: "command",
              func: "seekTo",
              args: [startSeconds, true],
            }), "*");
            contentWin.postMessage(JSON.stringify({
              event: "command",
              func: "playVideo",
              args: [],
            }), "*");
          }
        } catch {}

        // 3. Fallback range update if native player was not ready
        if (!didCallPlayer) {
          setActiveRange({ start: startSeconds, end: nextEndSeconds });
        }

        proofTimer = setTimeout(() => {
          if (player) {
            try { callbacksRef.current.onPlaybackProof(player.getCurrentTime()); } catch {}
          } else {
            callbacksRef.current.onPlaybackProof(startSeconds);
          }
        }, 600);

        stopTimer = setInterval(() => {
          if (player) {
            try {
              if (player.getCurrentTime() >= targetEnd - 0.15) {
                player.pauseVideo();
                clearPlaybackTimers();
              }
            } catch {}
          }
        }, 200);

        return true;
      },
    };

    callbacksRef.current.onController(controller);
    callbacksRef.current.onState("loading");

    loadIframeApi()
      .then((YT) => {
        if (disposed || !iframeRef.current) return;
        player = new YT.Player(iframeRef.current, {
          events: {
            onReady: () => {
              if (!player || disposed) return;
              callbacksRef.current.onState("ready");
              callbacksRef.current.onError(null);
              try {
                const duration = player.getDuration?.();
                if (typeof duration === "number" && duration > 0) {
                  callbacksRef.current.onDuration?.(duration);
                }
                const s = initialRangeRef.current.start;
                const e = initialRangeRef.current.end;
                player.cueVideoById({ videoId, startSeconds: s, endSeconds: e });
                player.seekTo(s, true);
              } catch {}
            },
            onStateChange: ({ data }) => {
              if (!player || disposed) return;
              try {
                const duration = player.getDuration?.();
                if (typeof duration === "number" && duration > 0) {
                  callbacksRef.current.onDuration?.(duration);
                }
              } catch {}
              if (data === YT.PlayerState.PLAYING) callbacksRef.current.onState("playing");
              if (data === YT.PlayerState.PAUSED || data === YT.PlayerState.ENDED) {
                callbacksRef.current.onState("paused");
              }
            },
            onError: ({ data }) => {
              clearPlaybackTimers();
              callbacksRef.current.onState("error");
              callbacksRef.current.onError(playerError(data));
            },
          },
        });
      })
      .catch(() => {
        if (disposed) return;
        callbacksRef.current.onState("ready");
      });

    return () => {
      disposed = true;
      clearPlaybackTimers();
      callbacksRef.current.onController(null);
      player?.destroy();
    };
  }, [videoId]);

  const origin = typeof window === "undefined" ? "" : `&origin=${encodeURIComponent(window.location.origin)}`;

  return (
    <iframe
      id={`yt-clip-player-${videoId}`}
      ref={iframeRef}
      src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1&rel=0&autoplay=1&start=${Math.floor(activeRange.start)}&end=${Math.floor(activeRange.end)}${origin}`}
      title={`Preview: ${title}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className="aspect-video min-h-[200px] w-full"
    />
  );
}
