"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

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
  if (typeof window === "undefined") return Promise.reject(new Error("window is undefined"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise((resolve, reject) => {
    const checkExisting = () => {
      if (window.YT?.Player) {
        resolve(window.YT);
        return true;
      }
      return false;
    };

    if (checkExisting()) return;

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      if (window.YT?.Player) resolve(window.YT);
    };

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      tag.onerror = () => {
        iframeApiPromise = null;
        reject(new Error("Gagal memuat YouTube Player API."));
      };
      document.head.appendChild(tag);
    }

    // Safety timeout: don't hang indefinitely if script loads but callback doesn't fire
    setTimeout(() => {
      let resolved = false;
      try {
        resolved = checkExisting();
      } catch {}
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

function playerError(code: number, isEn: boolean) {
  if (code === 101 || code === 150)
    return isEn
      ? "Video owner restricts embedding outside YouTube."
      : "Pemilik video melarang preview di luar YouTube.";
  if (code === 100)
    return isEn
      ? "The video has been deleted or is unavailable."
      : "Videonya sudah dihapus atau tidak tersedia.";
  if (code === 153)
    return isEn
      ? "YouTube could not verify this page. Please reload and try again."
      : "YouTube gak bisa memverifikasi halaman ini. Muat ulang lalu coba lagi.";
  return isEn
    ? "YouTube preview failed to play. Choose another moment or try again."
    : "Preview YouTube gagal diputar. Pilih momen lain atau coba lagi.";
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
  const { language } = useLanguage();
  const isEn = language === "en";
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [range, setRange] = useState<{ start: number; end: number }>({
    start: initialStart,
    end: initialEnd,
  });
  const callbacksRef = useRef({ onController, onError, onPlaybackProof, onDuration, onState });

  useEffect(() => {
    callbacksRef.current = { onController, onError, onPlaybackProof, onDuration, onState };
  }, [onController, onError, onPlaybackProof, onDuration, onState]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let disposed = false;
    let player: YouTubePlayer | null = null;

    const controller: YouTubeClipController = {
      playRange(startSeconds, nextEndSeconds) {
        if (nextEndSeconds <= startSeconds) return false;
        callbacksRef.current.onError(null);
        setRange({ start: startSeconds, end: nextEndSeconds });

        if (player) {
          try {
            player.seekTo(startSeconds, true);
            player.playVideo();
          } catch {}
        }

        try {
          const contentWin = iframeRef.current?.contentWindow;
          if (contentWin) {
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

        callbacksRef.current.onPlaybackProof(startSeconds);
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
              callbacksRef.current.onState("error");
              callbacksRef.current.onError(playerError(data, isEn));
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
      callbacksRef.current.onController(null);
      player?.destroy();
    };
  }, [videoId, isEn]);

  const origin = typeof window === "undefined" ? "" : `&origin=${encodeURIComponent(window.location.origin)}`;

  return (
    <iframe
      key={`${videoId}-${range.start}-${range.end}`}
      id={`yt-clip-player-${videoId}`}
      ref={iframeRef}
      src={`https://www.youtube.com/embed/${videoId}?autoplay=1&start=${Math.floor(range.start)}&end=${Math.floor(range.end)}&playsinline=1&rel=0&enablejsapi=1${origin}`}
      title={`Preview: ${title}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className="aspect-video min-h-[200px] w-full"
    />
  );
}
