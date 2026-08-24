"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

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

/**
 * Normalises text for natural Indonesian spoken delivery.
 * Replaces abbreviations and internet slang with natural phonetic words
 * and injects micro-pauses for natural cadence and breathing.
 */
export function normalizeIndonesianSpeech(raw: string): string {
  if (!raw) return "";
  let s = cleanScriptForSpeech(raw);

  const slangMap: [RegExp, string][] = [
    [/\byg\b/gi, "yang"],
    [/\bbgt\b/gi, "banget"],
    [/\bgak\b/gi, "nggak"],
    [/\bga\b/gi, "nggak"],
    [/\budh\b/gi, "udah"],
    [/\bsdh\b/gi, "sudah"],
    [/\btp\b/gi, "tapi"],
    [/\bdgn\b/gi, "dengan"],
    [/\bblm\b/gi, "belum"],
    [/\bskrg\b/gi, "sekarang"],
    [/\bdr\b/gi, "dari"],
    [/\bkrn\b/gi, "karena"],
    [/\bjg\b/gi, "juga"],
    [/\bbs\b/gi, "bisa"],
    [/\bkmrn\b/gi, "kemarin"],
    [/\bbbrp\b/gi, "beberapa"],
    [/\bdan lain-lain\b/gi, "dan lain-lain"],
    [/\bdll\b/gi, "dan lain-lain"],
    [/\btsb\b/gi, "tersebut"],
    [/\bttg\b/gi, "tentang"],
    [/\butk\b/gi, "untuk"],
    [/\bhrs\b/gi, "harus"],
    [/\bbnr\b/gi, "bener"],
    [/\bbener2\b/gi, "bener-bener"],
    [/\bcta\b/gi, "call to action"],
    [/\bvt\b/gi, "video tiktok"],
    [/\bfyp\b/gi, "f y p"],
    [/\bwa\b/gi, "whatsapp"],
    [/\bdm\b/gi, "direct message"],
    [/\bcod\b/gi, "c o d"],
    [/\bklik link\b/gi, "klik tautan"],
    [/\bgue\b/gi, "gue"],
    [/\blo\b/gi, "lo"],
    [/\bngerasa\b/gi, "ngerasa"],
  ];

  for (const [regex, replacement] of slangMap) {
    s = s.replace(regex, replacement);
  }

  // Add micro-pause breathing points at punctuation
  s = s
    .replace(/([.!?])\s+/g, "$1... ")
    .replace(/([,;:])\s+/g, "$1, ");

  return s;
}

export type VoiceStylePreset = "kreator" | "story" | "edukasi";

interface VoicePreviewProps {
  text: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
}

export function VoicePreview({ text, className = "" }: VoicePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stylePreset, setStylePreset] = useState<VoiceStylePreset>("kreator");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);

  // Split text into natural conversational chunks
  const speechChunks = useMemo(() => {
    const clean = normalizeIndonesianSpeech(text);
    if (!clean) return [];
    // Split on sentence boundaries (dots, exclamation, question marks)
    return clean
      .split(/(?<=[.!?…])\s+/)
      .map((c) => c.trim())
      .filter(Boolean);
  }, [text]);

  const currentChunkIndexRef = useRef(0);
  const isCancelledRef = useRef(false);

  // Load and sort best quality natural voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices();
      if (!all.length) return;

      // Filter Indonesian voices first
      const indoVoices = all.filter(
        (v) =>
          v.lang.toLowerCase().includes("id") ||
          v.lang.toLowerCase().includes("in") ||
          v.name.toLowerCase().includes("indonesia") ||
          v.name.toLowerCase().includes("gadis") ||
          v.name.toLowerCase().includes("ardi") ||
          v.name.toLowerCase().includes("damayanti"),
      );

      // Prioritize natural/neural voices
      indoVoices.sort((a, b) => {
        const aNat = a.name.toLowerCase().includes("natural") || a.name.toLowerCase().includes("online") || a.name.toLowerCase().includes("google");
        const bNat = b.name.toLowerCase().includes("natural") || b.name.toLowerCase().includes("online") || b.name.toLowerCase().includes("google");
        if (aNat && !bNat) return -1;
        if (!aNat && bNat) return 1;
        return 0;
      });

      const list = indoVoices.length ? indoVoices : all;
      setAvailableVoices(list);

      if (!selectedVoiceURI && list.length > 0) {
        setSelectedVoiceURI(list[0].voiceURI);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [selectedVoiceURI]);

  // Handle Preset Parameters
  const { rate, pitch } = useMemo(() => {
    switch (stylePreset) {
      case "kreator":
        return { rate: 1.12, pitch: 1.04 }; // Enerjik, cepat, cocok untuk TikTok
      case "story":
        return { rate: 0.98, pitch: 0.98 }; // Bertutur santai & hangat
      case "edukasi":
      default:
        return { rate: 1.05, pitch: 1.0 }; // Jelas, tegas, artikulatif
    }
  }, [stylePreset]);

  const selectedVoice = useMemo(() => {
    return availableVoices.find((v) => v.voiceURI === selectedVoiceURI) || availableVoices[0] || null;
  }, [availableVoices, selectedVoiceURI]);

  const stopPlayback = useCallback(() => {
    isCancelledRef.current = true;
    currentChunkIndexRef.current = 0;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const playChunkRef = useRef<(index: number) => void>(() => {});

  const playChunk = useCallback(
    (index: number) => {
      if (isCancelledRef.current || index >= speechChunks.length) {
        setIsPlaying(false);
        setIsPaused(false);
        currentChunkIndexRef.current = 0;
        return;
      }

      currentChunkIndexRef.current = index;
      const chunkText = speechChunks[index];
      if (!chunkText) {
        playChunkRef.current(index + 1);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.lang = "id-ID";

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onend = () => {
        if (!isCancelledRef.current) {
          // Play next chunk with micro breathing delay (40ms)
          setTimeout(() => {
            playChunkRef.current(index + 1);
          }, 40);
        }
      };

      utterance.onerror = (e) => {
        // If canceled explicitly, ignore
        if (isCancelledRef.current || e.error === "canceled") {
          return;
        }
        setIsPlaying(false);
        setIsPaused(false);
      };

      window.speechSynthesis.speak(utterance);
    },
    [speechChunks, rate, pitch, selectedVoice],
  );

  useEffect(() => {
    playChunkRef.current = playChunk;
  }, [playChunk]);

  const handlePlay = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    window.speechSynthesis.cancel();
    isCancelledRef.current = false;

    if (!speechChunks.length) return;

    setIsPlaying(true);
    setIsPaused(false);
    playChunk(0);
  }, [isPaused, speechChunks, playChunk]);

  const handlePause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  if (!supported) return null;

  return (
    <div
      className={`rounded-2xl border border-ember/30 bg-gradient-to-r from-surface via-[#141414] to-surface-raised p-3 sm:p-4 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Play/Pause Button & Pulse Indicator */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={isPlaying ? handlePause : handlePlay}
            disabled={!speechChunks.length}
            aria-label={isPlaying ? "Jeda Voice Preview" : "Putar Natural AI Voice Preview"}
            className={`flex size-10 items-center justify-center rounded-xl font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
              isPlaying
                ? "bg-ember text-obsidian shadow-[0_0_15px_rgba(255,138,61,0.4)]"
                : "border border-ember/40 bg-ember/15 text-ember hover:bg-ember hover:text-obsidian"
            } disabled:opacity-40`}
          >
            {isPlaying ? (
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
              onClick={stopPlayback}
              title="Berhenti"
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
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-400">
                Natural Indo
              </span>
            </div>
            <p className="text-[10px] text-muted">
              {isPlaying
                ? "Sedang membaca dengan intonasi natural..."
                : isPaused
                  ? "Dijeda — klik putar untuk lanjut"
                  : "Uji artikulasi & ritme naskah lisan"}
            </p>
          </div>
        </div>

        {/* Voice Style Presets */}
        <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-hairline/60">
          {(
            [
              { id: "kreator", label: "⚡ Kreator", title: "Cepat & Enerjik (TikTok/Reels)" },
              { id: "story", label: "🎙️ Story", title: "Santai & Bertutur (Podcast/Story)" },
              { id: "edukasi", label: "🎯 Edukasi", title: "Tegas & Artikulatif (Tutorial)" },
            ] as const
          ).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setStylePreset(preset.id);
                if (isPlaying) {
                  stopPlayback();
                }
              }}
              title={preset.title}
              className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition-all cursor-pointer ${
                stylePreset === preset.id
                  ? "bg-ember text-obsidian font-bold shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Available Voices Dropdown (If device has multiple Indonesian/Neural voices) */}
      {availableVoices.length > 1 && (
        <div className="mt-2.5 flex items-center justify-between border-t border-hairline/40 pt-2 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <span>🗣️ Karakter Suara:</span>
          </span>
          <select
            value={selectedVoiceURI}
            onChange={(e) => {
              setSelectedVoiceURI(e.target.value);
              if (isPlaying) stopPlayback();
            }}
            className="rounded-md border border-hairline bg-surface px-2 py-0.5 text-[10px] text-ink focus:border-ember focus:outline-none max-w-[220px] truncate cursor-pointer"
          >
            {availableVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name.replace(/Microsoft|Google|Desktop/gi, "").trim()} ({v.lang})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
