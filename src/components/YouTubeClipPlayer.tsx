"use client";

import { useEffect, useRef, useState } from "react";

type PlayerState = "loading" | "ready" | "playing" | "paused" | "error";

type YouTubePlayer = {
  destroy(): void;
  getCurrentTime(): number;
  loadVideoById(args: { videoId: string; startSeconds: number; endSeconds: number }): void;
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
  onState: (state: PlayerState) => void;
};

let iframeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube Player API gak kebaca."));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      iframeApiPromise = null;
      reject(new Error("Player YouTube gagal dimuat. Cek koneksi lalu coba lagi."));
    };
    document.head.appendChild(script);
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
  onState,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [initialRange] = useState(() => ({ start: initialStart, end: initialEnd }));
  const callbacksRef = useRef({ onController, onError, onPlaybackProof, onState });

  useEffect(() => {
    callbacksRef.current = { onController, onError, onPlaybackProof, onState };
  }, [onController, onError, onPlaybackProof, onState]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let disposed = false;
    let player: YouTubePlayer | null = null;
    let stopTimer: ReturnType<typeof setInterval> | null = null;
    let proofTimer: ReturnType<typeof setTimeout> | null = null;
    let endSeconds = initialRange.end;

    const clearPlaybackTimers = () => {
      if (stopTimer) clearInterval(stopTimer);
      if (proofTimer) clearTimeout(proofTimer);
      stopTimer = null;
      proofTimer = null;
    };

    callbacksRef.current.onState("loading");
    loadIframeApi()
      .then((YT) => {
        if (disposed) return;
        player = new YT.Player(iframe, {
          events: {
            onReady: () => {
              if (!player || disposed) return;
              callbacksRef.current.onState("ready");
              callbacksRef.current.onError(null);
              callbacksRef.current.onController({
                playRange(startSeconds, nextEndSeconds) {
                  if (!player || nextEndSeconds <= startSeconds) return false;
                  clearPlaybackTimers();
                  endSeconds = nextEndSeconds;
                  callbacksRef.current.onError(null);
                  player.loadVideoById({ videoId, startSeconds, endSeconds: nextEndSeconds });
                  player.seekTo(startSeconds, true);
                  proofTimer = setTimeout(() => {
                    if (player) callbacksRef.current.onPlaybackProof(player.getCurrentTime());
                  }, 850);
                  stopTimer = setInterval(() => {
                    if (player && player.getCurrentTime() >= endSeconds - 0.15) {
                      player.pauseVideo();
                      clearPlaybackTimers();
                    }
                  }, 200);
                  return true;
                },
              });
            },
            onStateChange: ({ data }) => {
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
      .catch((error: unknown) => {
        if (disposed) return;
        callbacksRef.current.onState("error");
        callbacksRef.current.onError(
          error instanceof Error ? error.message : "Player YouTube gagal dimuat.",
        );
      });

    return () => {
      disposed = true;
      clearPlaybackTimers();
      callbacksRef.current.onController(null);
      player?.destroy();
    };
  }, [initialRange.end, videoId]);

  const origin = typeof window === "undefined" ? "" : `&origin=${encodeURIComponent(window.location.origin)}`;

  return (
    <iframe
      ref={iframeRef}
      src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&playsinline=1&rel=0&start=${Math.floor(initialRange.start)}&end=${Math.floor(initialRange.end)}${origin}`}
      title={`Preview: ${title}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className="aspect-video min-h-[200px] w-full"
    />
  );
}
