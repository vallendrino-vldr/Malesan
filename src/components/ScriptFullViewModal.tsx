"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { ScriptOutput } from "./ScriptView";
import { VoicePreview } from "./VoicePreview";
import { haptic } from "@/lib/haptics";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface ScriptFullViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  platform?: string;
  script: ScriptOutput;
  onSaveScript?: (updatedScript: ScriptOutput) => Promise<void> | void;
}

export function ScriptFullViewModal({
  isOpen,
  onClose,
  title,
  platform = "TikTok / Reels",
  script,
  onSaveScript,
}: ScriptFullViewModalProps) {
  const isMounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [activeTab, setActiveTab] = useState<"teleprompter" | "baca" | "scenes">("teleprompter");
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(2); // 0=16px, 1=20px, 2=24px, 3=30px
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(1);
  const [copiedType, setCopiedType] = useState<"vo" | "all" | null>(null);
  const [prevScript, setPrevScript] = useState<ScriptOutput>(script);
  const [editableScript, setEditableScript] = useState<ScriptOutput>(script);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Sync script when prop changes (React 19 pattern)
  if (prevScript !== script) {
    setPrevScript(script);
    setEditableScript(script);
    setHasChanges(false);
  }

  const teleprompterRef = useRef<HTMLDivElement | null>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fontSizes = [
    "text-base leading-relaxed sm:text-lg sm:leading-loose",
    "text-lg leading-relaxed sm:text-xl sm:leading-loose",
    "text-xl leading-relaxed sm:text-2xl sm:leading-loose",
    "text-2xl leading-relaxed sm:text-3xl sm:leading-loose",
  ];

  const textMode = ["x", "threads", "facebook", "linkedin"].includes((platform ?? "").toLowerCase());

  const scenes = useMemo(() => editableScript.script ?? [], [editableScript.script]);

  // Pure clean flowing voiceover text for Teleprompter (no brackets, no scenes, no cues)
  const pureVoiceoverText = useMemo(() => {
    const parts: string[] = [];
    scenes.forEach((sc) => {
      if (sc.spoken?.trim()) {
        parts.push(sc.spoken.trim());
      }
    });
    if (editableScript.cta?.text?.trim()) {
      parts.push(editableScript.cta.text.trim());
    }
    return parts.join("\n\n");
  }, [scenes, editableScript.cta]);

  // Comprehensive Markdown export
  const markdownContent = useMemo(() => {
    const out: string[] = [
      `# ${title || "Naskah Video"}`,
      `Platform: ${platform}`,
      "",
      "---",
      "",
      "## 🎙️ Voiceover (Teks Lisan)",
      "",
      pureVoiceoverText,
      "",
      "---",
      "",
      "## 🎬 Rincian Shot & Scene",
      "",
    ];

    scenes.forEach((sc, i) => {
      out.push(`### Scene #${i + 1} ${sc.timestamp ? `(${sc.timestamp})` : ""}`);
      if (sc.spoken) out.push(`- **Suara/VO:** ${sc.spoken}`);
      if (sc.visual) out.push(`- **Visual:** ${sc.visual}`);
      if (sc.on_screen_text) out.push(`- **Teks Layar:** ${sc.on_screen_text}`);
      if (sc.user_footage_note) out.push(`- **Bahan Kreator:** ${sc.user_footage_note}`);
      out.push("");
    });

    if (editableScript.cta?.text) {
      out.push(`### CTA\n- ${editableScript.cta.text}\n`);
    }
    if (editableScript.caption) {
      out.push(`### Caption\n${editableScript.caption}\n`);
    }
    if (editableScript.hashtags?.length) {
      out.push(`### Hashtags\n${editableScript.hashtags.join(" ")}\n`);
    }

    return out.join("\n");
  }, [title, platform, pureVoiceoverText, scenes, editableScript.cta, editableScript.caption, editableScript.hashtags]);

  // Handle Teleprompter Auto-scroll
  useEffect(() => {
    if (isAutoScrolling) {
      scrollIntervalRef.current = setInterval(() => {
        if (teleprompterRef.current) {
          teleprompterRef.current.scrollTop += scrollSpeed;
        }
      }, 30);
    } else {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    }

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [isAutoScrolling, scrollSpeed]);

  const handleCopy = useCallback((type: "vo" | "all", content: string) => {
    navigator.clipboard.writeText(content);
    haptic.success();
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  }, []);

  const handleShare = useCallback(async () => {
    haptic.selection();
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: title || "Naskah Konten Malesan",
          text: pureVoiceoverText || markdownContent,
        });
        haptic.success();
        return;
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          handleCopy("vo", pureVoiceoverText);
        }
      }
    } else {
      handleCopy("vo", pureVoiceoverText);
    }
  }, [title, pureVoiceoverText, markdownContent, handleCopy]);

  const handleDownloadMd = useCallback(() => {
    haptic.tap();
    const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "naskah"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [markdownContent, title]);

  const handleUpdateSceneSpoken = (index: number, val: string) => {
    const updated = [...scenes];
    updated[index] = { ...updated[index], spoken: val };
    setEditableScript((prev) => ({ ...prev, script: updated }));
    setHasChanges(true);
  };

  const handleUpdateSceneVisual = (index: number, val: string) => {
    const updated = [...scenes];
    updated[index] = { ...updated[index], visual: val };
    setEditableScript((prev) => ({ ...prev, script: updated }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!onSaveScript) return;
    haptic.impact();
    setIsSaving(true);
    try {
      await onSaveScript(editableScript);
      haptic.success();
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !isMounted) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="script-fullview-title"
      className="fixed inset-0 z-[99999] flex flex-col h-[100dvh] w-full bg-[#0a0a0a] text-ink overflow-hidden animate-fade-in"
    >
      {/* 1. Top Header Bar */}
      <header className="h-14 sm:h-16 px-3.5 sm:px-8 border-b border-hairline/80 bg-[#121212] flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl bg-ember/15 text-ember border border-ember/30 shrink-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 sm:size-5"
              aria-hidden="true"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
              <path d="M6 10h10" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 id="script-fullview-title" className="text-xs sm:text-base font-bold text-ink truncate">
                {title || "Naskah Video"}
              </h2>
              <span className="rounded-full bg-surface border border-hairline px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-muted shrink-0">
                {platform}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-muted truncate">
              {scenes.length} Scene · Studio Reader & Prompter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {hasChanges && onSaveScript && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-7 sm:h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition-all cursor-pointer flex items-center gap-1"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{isSaving ? "Simpan..." : "Simpan"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-xl bg-surface hover:bg-surface-raised text-muted hover:text-ink transition-colors cursor-pointer border border-hairline flex items-center gap-1 text-[11px] sm:text-xs font-bold"
            aria-label="Tutup Layar Penuh"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span className="hidden sm:inline">Tutup</span>
          </button>
        </div>
      </header>

      {/* 2. Toolbar: Dedicated Responsive Grid Tabs + Secondary Controls */}
      <div className="px-3.5 sm:px-8 py-2.5 border-b border-hairline/60 bg-[#161616] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 shrink-0">
        {/* Equal 3-Column Grid Tabs (Never overflows or causes scrollbars) */}
        <div className="grid grid-cols-3 gap-1 bg-black/60 p-1 rounded-xl border border-hairline/60 w-full sm:w-auto sm:min-w-[420px]">
          <button
            type="button"
            onClick={() => {
              setActiveTab("teleprompter");
              setIsAutoScrolling(false);
            }}
            className={`h-7 sm:h-8 flex items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
              activeTab === "teleprompter"
                ? "bg-ember text-obsidian shadow-sm font-black"
                : "text-muted hover:text-ink hover:bg-white/[0.04]"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <span className="hidden sm:inline">Teleprompter (VO)</span>
            <span className="sm:hidden">Prompter</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("baca");
              setIsAutoScrolling(false);
            }}
            className={`h-7 sm:h-8 flex items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
              activeTab === "baca"
                ? "bg-ember text-obsidian shadow-sm font-black"
                : "text-muted hover:text-ink hover:bg-white/[0.04]"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span className="hidden sm:inline">Mode Baca</span>
            <span className="sm:hidden">Baca</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("scenes");
              setIsAutoScrolling(false);
            }}
            className={`h-7 sm:h-8 flex items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
              activeTab === "scenes"
                ? "bg-ember text-obsidian shadow-sm font-black"
                : "text-muted hover:text-ink hover:bg-white/[0.04]"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M7 3v18" />
              <path d="M3 7.5h4" />
              <path d="M3 12h18" />
              <path d="M3 16.5h4" />
              <path d="M17 3v18" />
              <path d="M17 7.5h4" />
              <path d="M17 16.5h4" />
            </svg>
            <span className="hidden sm:inline">Detail Scene</span>
            <span className="sm:hidden">Scene</span>
          </button>
        </div>

        {/* Right / Secondary Controls Strip */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {/* Teleprompter Auto-scroll Controls */}
          {activeTab === "teleprompter" ? (
            <div className="flex items-center gap-1 bg-black/40 p-0.5 sm:p-1 rounded-xl border border-hairline/60">
              <button
                type="button"
                onClick={() => setIsAutoScrolling((prev) => !prev)}
                className={`h-6 sm:h-7 flex items-center gap-1 rounded-lg px-2 text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                  isAutoScrolling
                    ? "bg-rose-500 text-white animate-pulse"
                    : "border border-ember/40 bg-ember/15 text-ember hover:bg-ember hover:text-obsidian"
                }`}
              >
                {isAutoScrolling ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3" aria-hidden="true">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                    <span>Jeda</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3 ml-0.5" aria-hidden="true">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>Auto-Scroll</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-0.5 bg-surface/50 rounded-md p-0.5 border border-hairline/40">
                {[1, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setScrollSpeed(spd)}
                    className={`h-5 sm:h-6 px-1.5 rounded text-[9px] sm:text-[10px] font-mono cursor-pointer transition-colors ${
                      scrollSpeed === spd
                        ? "bg-ember text-obsidian font-bold"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-muted font-medium pl-1">
              {activeTab === "baca" ? "Format naskah mengalir" : "Rincian shot per scene"}
            </div>
          )}

          {/* Font Size Scaling */}
          <div className="flex items-center gap-0.5 bg-black/40 p-0.5 sm:p-1 rounded-xl border border-hairline/60">
            <span className="text-[9px] sm:text-[10px] text-muted pl-1 font-medium">Font:</span>
            {["A-", "Normal", "A+", "A++"].map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => setFontSizeLevel(idx)}
                className={`h-5 sm:h-6 px-1.5 sm:px-2 rounded text-[9px] sm:text-[10px] font-bold transition-colors cursor-pointer ${
                  fontSizeLevel === idx
                    ? "bg-ember/20 text-ember border border-ember/40"
                    : "text-muted hover:text-ink hover:bg-white/[0.04]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Main Content Viewer Body */}
      <main
        ref={teleprompterRef}
        className="flex-1 overflow-y-auto px-3.5 sm:px-8 py-5 sm:py-6 custom-scrollbar bg-[#0d0d0d] overscroll-contain"
      >
        {activeTab === "teleprompter" ? (
          /* TAB 1: PURE FLOWING VOICEOVER TEXT (TELEPROMPTER) */
          <div className="max-w-3xl mx-auto space-y-6 pb-16 pt-1 sm:pt-2">
            <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4 sm:p-10 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-hairline/40 pb-3 mb-5">
                <span className="text-xs font-bold uppercase tracking-wider text-ember flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </svg>
                  <span>Teks Voiceover Siap Baca</span>
                </span>
                <span className="text-[10px] sm:text-[11px] text-muted">
                  Bebas keterangan scene / footage · Fokus artikulasi
                </span>
              </div>

              <div className={`space-y-6 font-medium text-ink/95 ${fontSizes[fontSizeLevel]}`}>
                {pureVoiceoverText ? (
                  pureVoiceoverText.split("\n\n").map((para, idx) => (
                    <p key={idx} className="tracking-wide">
                      {para}
                    </p>
                  ))
                ) : (
                  <p className="text-muted italic text-sm">Belum ada naskah yang siap dibaca.</p>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === "baca" ? (
          /* TAB 2: STRUCTURED READ-THROUGH (Hook -> Body -> CTA) */
          <div className="max-w-3xl mx-auto space-y-6 pb-16 pt-1 sm:pt-2">
            <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4 sm:p-8 space-y-6 shadow-xl">
              {/* Hook Section */}
              {scenes[0]?.spoken && (
                <div className="space-y-2 border-l-2 border-ember pl-4 py-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-ember/20 border border-ember/40 px-2 py-0.5 text-[10px] font-bold text-ember uppercase">
                      {textMode ? "1. Pembuka / Hook" : "1. Hook (3 Detik Pertama)"}
                    </span>
                    {scenes[0].timestamp && (
                      <span className="text-[11px] font-mono text-muted">{scenes[0].timestamp}</span>
                    )}
                  </div>
                  <p className={`font-semibold text-ink ${fontSizes[fontSizeLevel]}`}>
                    {scenes[0].spoken}
                  </p>
                </div>
              )}

              {/* Body Section */}
              {scenes.slice(1).length > 0 && (
                <div className="space-y-4 border-l-2 border-hairline pl-4 py-1">
                  <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-bold text-muted uppercase">
                    {textMode ? "2. Isi Konten" : "2. Isi Konten (Body Narasi)"}
                  </span>
                  <div className="space-y-4">
                    {scenes.slice(1).map((sc, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted font-mono">
                          <span>Point #{i + 1}</span>
                          {sc.timestamp && <span>{sc.timestamp}</span>}
                        </div>
                        <p className={`text-ink/90 ${fontSizes[fontSizeLevel]}`}>{sc.spoken}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA Section */}
              {editableScript.cta?.text && (
                <div className="space-y-2 border-l-2 border-success pl-4 py-1">
                  <span className="rounded bg-success/20 border border-success/40 px-2 py-0.5 text-[10px] font-bold text-success uppercase">
                    3. Call To Action (Penutup)
                  </span>
                  <p className={`font-semibold text-success ${fontSizes[fontSizeLevel]}`}>
                    {editableScript.cta.text}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB 3: FULL SCENE BY SCENE SHOT LIST & EDITING */
          <div className="max-w-4xl mx-auto space-y-4 pb-16 pt-1 sm:pt-2">
            {scenes.map((sc, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-hairline/80 bg-[#141414] p-4 sm:p-5 space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between border-b border-hairline/40 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-lg bg-ember/15 border border-ember/30 text-ember font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-xs text-ink">Scene #{idx + 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {sc.timestamp && (
                      <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-mono text-muted border border-hairline/60">
                        {sc.timestamp}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {/* Voiceover Spoken Script */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ember flex items-center gap-1">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden="true">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      </svg>
                      <span>Voiceover / Teks Lisan:</span>
                    </label>
                    <textarea
                      value={sc.spoken ?? ""}
                      onChange={(e) => handleUpdateSceneSpoken(idx, e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-hairline/80 bg-black/50 p-3 text-xs leading-relaxed text-ink focus:border-ember focus:outline-hidden resize-y"
                    />
                  </div>

                  {/* Visual Shot Direction */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden="true">
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                        <path d="M7 3v18" />
                      </svg>
                      <span>Panduan Visual Shot:</span>
                    </label>
                    <textarea
                      value={sc.visual ?? ""}
                      onChange={(e) => handleUpdateSceneVisual(idx, e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-hairline/80 bg-black/50 p-3 text-xs leading-relaxed text-muted focus:border-ember focus:text-ink focus:outline-hidden resize-y"
                    />
                  </div>
                </div>

                {sc.on_screen_text && (
                  <div className="rounded-lg bg-black/30 border border-hairline/40 p-2.5 text-[11px]">
                    <span className="text-[10px] text-muted uppercase font-bold">Teks di Layar:</span>
                    <p className="font-mono text-ember text-[11px] font-bold mt-0.5">{sc.on_screen_text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 4. Bottom Player & Action Strip */}
      <footer className="border-t border-hairline/80 bg-[#121212] px-3.5 sm:px-8 py-2.5 sm:py-3 shrink-0 space-y-2.5 sm:space-y-3 z-10 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {/* Native Indonesian AI Voice Preview Player */}
        <VoicePreview text={pureVoiceoverText} title={title} />

        {/* Action Buttons: Responsive Grid on Mobile, Flex on Desktop */}
        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-between gap-1.5 sm:gap-2 pt-1 border-t border-hairline/40">
          <button
            type="button"
            onClick={() => handleCopy("vo", pureVoiceoverText)}
            className="h-8 rounded-xl border border-hairline bg-surface px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold text-ink hover:border-ember/40 hover:text-ember active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            <span>{copiedType === "vo" ? "Disalin!" : "Salin VO"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy("all", markdownContent)}
            className="h-8 rounded-xl border border-hairline bg-surface px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold text-ink hover:border-ember/40 hover:text-ember active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            <span>{copiedType === "all" ? "Disalin!" : "Salin Lengkap"}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="h-8 rounded-xl border border-ember/30 bg-surface px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold text-ember hover:border-ember hover:bg-ember/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>Bagikan</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadMd}
            className="h-8 rounded-xl border border-hairline bg-surface px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold text-muted hover:text-ink active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 truncate"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Unduh .md</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="col-span-2 sm:col-span-1 h-8 rounded-xl bg-ember px-3.5 sm:px-5 text-[11px] sm:text-xs font-bold text-obsidian shadow-sm hover:bg-ember-lo active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            Tutup
          </button>
        </div>
      </footer>
    </div>
  );

  return createPortal(modalContent, document.body);
}
