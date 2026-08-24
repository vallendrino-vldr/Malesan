"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

export function cleanScriptForSpeech(raw: string): string {
  if (!raw) return "";
  return raw
    // Remove bracketed cues e.g. [Visual: ...], [Footage: ...], [Text: ...]
    .replace(/\[(?:Visual|Footage|Teks|Scene|Arahan|Audio|Kamera|Shot)[^\]]*\]/gi, "")
    .replace(/\((?:Visual|Footage|Teks|Scene|Arahan|Audio|Kamera|Shot)[^)]*\)/gi, "")
    // Remove generic brackets if they look like metadata
    .replace(/\[\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\]/g, "")
    // Remove "Scene 1:", "Voiceover:", "VO:"
    .replace(/^(?:Scene\s*\d+|Voiceover|VO|Dialog|Naskah)\s*:\s*/gim, "")
    // Remove extra whitespace
    .replace(/\s+/g, " ")
    .trim();
}

interface VoicePreviewProps {
  text: string;
  title?: string;
  className?: string;
}

export function VoicePreview({ text, title = "Naskah Video", className = "" }: VoicePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        // Prioritize Indonesian voice (id-ID)
        const indoVoice = available.find((v) => v.lang.includes("id") || v.lang.includes("ID"));
        setSelectedVoice(indoVoice || available[0]);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleStop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const handlePlay = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = cleanScriptForSpeech(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;
    utterance.lang = "id-ID";

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  }, [isPaused, text, rate, selectedVoice]);

  const handlePause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  if (!supported) return null;

  return (
    <div
      className={`rounded-2xl border border-ember/30 bg-gradient-to-r from-surface to-surface-raised p-3 sm:p-4 shadow-xs ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              isPlaying
                ? "border-ember bg-ember text-obsidian shadow-sm animate-pulse"
                : "border-ember/40 bg-ember/15 text-ember"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs font-bold text-ink">🎙️ AI Voice Preview</span>
              {isPlaying && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ember">
                  <span className="size-1.5 rounded-full bg-ember animate-ping" />
                  Sedang Membaca...
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted">
              {title ? `${title} · Pratinjau intonasi baca` : "Dengarkan intonasi naskah sebelum take rekaman"}
            </p>
          </div>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1 rounded-lg border border-hairline bg-obsidian/80 p-0.5">
          {[
            { val: 0.85, label: "0.85x" },
            { val: 1.0, label: "1.0x" },
            { val: 1.2, label: "1.2x" },
          ].map((s) => (
            <button
              key={s.val}
              type="button"
              onClick={() => {
                setRate(s.val);
                if (isPlaying) {
                  // restart with new speed
                  handleStop();
                }
              }}
              className={`rounded-md px-2 py-0.5 text-[10px] font-mono transition-colors ${
                rate === s.val
                  ? "bg-ember/25 text-ember font-bold"
                  : "text-muted hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="mt-3 flex items-center gap-2 pt-2.5 border-t border-white/[0.04]">
        {!isPlaying ? (
          <button
            type="button"
            onClick={handlePlay}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-ember/40 bg-ember/20 px-3.5 py-1.5 text-xs font-bold text-ember transition-all hover:bg-ember hover:text-obsidian active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>{isPaused ? "Lanjut Putar" : "Putar Suara Naskah"}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePause}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-surface-raised px-3.5 py-1.5 text-xs font-bold text-ink transition-colors hover:border-ember/40"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            <span>Jeda</span>
          </button>
        )}

        {(isPlaying || isPaused) && (
          <button
            type="button"
            onClick={handleStop}
            className="cursor-pointer inline-flex items-center gap-1 rounded-xl border border-white/[0.06] bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-danger"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-3">
              <rect x="4" y="4" width="16" height="16" />
            </svg>
            <span>Stop</span>
          </button>
        )}

        {/* Visual Equalizer Wave */}
        {isPlaying && (
          <div className="ml-auto flex items-end gap-0.5 h-4">
            <span className="w-1 bg-ember rounded-full animate-bounce [animation-delay:-0.3s] h-3" />
            <span className="w-1 bg-ember rounded-full animate-bounce [animation-delay:-0.1s] h-4" />
            <span className="w-1 bg-ember rounded-full animate-bounce [animation-delay:-0.2s] h-2" />
            <span className="w-1 bg-ember rounded-full animate-bounce [animation-delay:-0.4s] h-3.5" />
          </div>
        )}
      </div>
    </div>
  );
}
