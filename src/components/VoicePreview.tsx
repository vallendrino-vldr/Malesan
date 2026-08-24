"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

import { cleanScriptForSpeech, normalizeIndonesianSpeech } from "@/lib/speech-cleaner";

export { cleanScriptForSpeech, normalizeIndonesianSpeech };

interface VoicePreviewProps {
  text: string;
  title?: string;
  className?: string;
}

export function VoicePreview({ text, className = "" }: VoicePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.1); // Default energetic creator speed
  const [error, setError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const lastTextRef = useRef<string>("");

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const handlePlayPause = async () => {
    setError("");

    // If already initialized and just paused
    if (audioRef.current && audioUrlRef.current && lastTextRef.current === text) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.playbackRate = playbackRate;
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      }
      return;
    }

    // Clean previous audio
    cleanupAudio();
    setIsLoading(true);
    lastTextRef.current = text;

    try {
      const clean = normalizeIndonesianSpeech(text);
      if (!clean) {
        throw new Error("Naskah belum memiliki teks voiceover.");
      }

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Gagal memproses suara Bahasa Indonesia");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new Audio(url);
      audio.playbackRate = playbackRate;

      audio.onloadedmetadata = () => {
        setDuration(audio.duration || 0);
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime || 0);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
        setError("Gagal memutar audio preview.");
      };

      audioRef.current = audio;
      await audio.play();
      setIsPlaying(true);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Gagal memutar audio.");
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleChangeSpeed = (speed: number) => {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div
      className={`rounded-2xl border border-ember/30 bg-gradient-to-r from-surface via-[#141414] to-surface-raised p-3 sm:p-4 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Play/Pause Button & Pulse Indicator */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePlayPause}
            disabled={isLoading || !text.trim()}
            aria-label={isPlaying ? "Jeda Voice Preview" : "Putar Suara Bahasa Indonesia"}
            className={`flex size-10 items-center justify-center rounded-xl font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
              isPlaying
                ? "bg-ember text-obsidian shadow-[0_0_15px_rgba(255,138,61,0.4)]"
                : "border border-ember/40 bg-ember/15 text-ember hover:bg-ember hover:text-obsidian"
            } disabled:opacity-40`}
          >
            {isLoading ? (
              <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 ml-0.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          {isPlaying && (
            <button
              type="button"
              onClick={handleStop}
              title="Berhenti & Ulang"
              className="flex size-7 items-center justify-center rounded-lg border border-hairline bg-surface text-muted hover:text-danger hover:border-danger/30 transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-3">
                <rect x="4" y="4" width="16" height="16" rx="1" />
              </svg>
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xs font-bold text-ink">🎙️ AI Voice Preview</span>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.2 text-[9px] font-bold text-emerald-400">
                100% Bahasa Indonesia
              </span>
            </div>
            <p className="text-[10px] text-muted">
              {isLoading
                ? "Menyiapkan suara Bahasa Indonesia natural..."
                : isPlaying
                  ? `Memutar · ${formatTime(currentTime)} / ${formatTime(duration || 0)}`
                  : "Uji artikulasi & ritme naskah lisan"}
            </p>
          </div>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center justify-between gap-1 bg-black/40 rounded-xl p-1 border border-hairline/60 w-full sm:w-auto">
          <span className="text-[10px] text-muted pl-1 font-medium shrink-0">Tempo:</span>
          <div className="flex items-center gap-1 flex-1 sm:flex-none justify-end">
            {[
              { label: "0.95x Santai", speed: 0.95 },
              { label: "1.1x Kreator", speed: 1.1 },
              { label: "1.25x Cepat", speed: 1.25 },
            ].map((sp) => (
              <button
                key={sp.speed}
                type="button"
                onClick={() => handleChangeSpeed(sp.speed)}
                className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition-all cursor-pointer flex-1 sm:flex-none text-center ${
                  playbackRate === sp.speed
                    ? "bg-ember text-obsidian font-bold shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-[10px] text-danger font-medium">{error}</p>}
    </div>
  );
}
