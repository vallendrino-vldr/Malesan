"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { ScriptOutput } from "./ScriptView";
import { VoicePreview } from "./VoicePreview";

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
  const [activeMode, setActiveMode] = useState<"teleprompter" | "scenes">("teleprompter");
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(2); // 0=14px, 1=18px, 2=22px, 3=28px
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(1); // 1, 1.5, 2
  const [copiedType, setCopiedType] = useState<"vo" | "all" | null>(null);
  const [prevScript, setPrevScript] = useState<ScriptOutput>(script);
  const [editableScript, setEditableScript] = useState<ScriptOutput>(script);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync script when prop changes (React 19 pattern)
  if (prevScript !== script) {
    setPrevScript(script);
    setEditableScript(script);
    setHasChanges(false);
  }

  const teleprompterRef = useRef<HTMLDivElement | null>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fontSizes = ["text-sm sm:text-base", "text-base sm:text-lg", "text-lg sm:text-2xl", "text-xl sm:text-3xl"];

  const textMode = ["x", "threads", "facebook", "linkedin"].includes((platform ?? "").toLowerCase());

  const scenes = useMemo(() => editableScript.script ?? [], [editableScript.script]);

  // Build clean spoken text
  const readThrough = useMemo(() => {
    const lines: string[] = [];
    scenes.forEach((sc, i) => {
      if (sc.spoken) {
        lines.push(`[Scene ${i + 1} - ${sc.timestamp || ""}]\n${sc.spoken}`);
      }
    });
    if (editableScript.cta?.text) {
      lines.push(`[CTA]\n${editableScript.cta.text}`);
    }
    return lines.join("\n\n");
  }, [scenes, editableScript.cta]);

  // Build markdown for copy/download
  const markdownContent = useMemo(() => {
    const out: string[] = [`# ${title}`, "", `**Platform:** ${platform}`, ""];
    out.push("## Naskah Lengkap", "");
    scenes.forEach((sc, i) => {
      out.push(`### Scene ${i + 1} (${sc.timestamp || ""})`);
      if (sc.spoken) out.push(`- **Voiceover:** ${sc.spoken}`);
      if (sc.visual) out.push(`- **Visual Footage:** ${sc.visual}`);
      if (sc.on_screen_text) out.push(`- **Teks Layar:** ${sc.on_screen_text}`);
      out.push("");
    });
    if (editableScript.cta?.text) {
      out.push(`**CTA:** ${editableScript.cta.text}`, "");
    }
    if (editableScript.caption) {
      out.push(`**Caption:**\n${editableScript.caption}`, "");
    }
    if (editableScript.hashtags?.length) {
      out.push(`**Hashtags:** ${editableScript.hashtags.join(" ")}`, "");
    }
    return out.join("\n");
  }, [title, platform, scenes, editableScript.cta, editableScript.caption, editableScript.hashtags]);

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
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  }, []);

  const handleDownloadMd = useCallback(() => {
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
    setIsSaving(true);
    try {
      await onSaveScript(editableScript);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Full View Window */}
      <div className="relative w-full max-w-4xl rounded-2xl border border-hairline/80 bg-[#0d0d0d] shadow-2xl flex flex-col h-[92vh] z-10 overflow-hidden animate-scale-up">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline/80 bg-surface/90 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-ember/15 text-ember text-base font-bold border border-ember/30">
              📖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-ink truncate max-w-[240px] sm:max-w-md">
                  {title || "Naskah Video"}
                </h2>
                <span className="rounded-full bg-surface-raised border border-hairline px-2 py-0.5 text-[10px] font-semibold text-muted">
                  {platform}
                </span>
              </div>
              <p className="text-[11px] text-muted">
                {scenes.length} Scene · Layar Penuh Studio Reader & Teleprompter
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && onSaveScript && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition-all cursor-pointer"
              >
                {isSaving ? "Menyimpan..." : "Simpan Perubahan ✓"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-xl bg-surface hover:bg-surface-raised text-muted hover:text-ink transition-colors cursor-pointer border border-hairline"
              aria-label="Tutup Full View"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Toolbar Strip: Mode Switcher, Font Resizer, Teleprompter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline/60 bg-surface/40 px-4 py-2.5 sm:px-6">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-hairline/60">
            <button
              type="button"
              onClick={() => setActiveMode("teleprompter")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                activeMode === "teleprompter"
                  ? "bg-ember text-obsidian shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>📜</span>
              <span>Teleprompter / Lisan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("scenes")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                activeMode === "scenes"
                  ? "bg-ember text-obsidian shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>📑</span>
              <span>Scene & Visual B-Roll</span>
            </button>
          </div>

          {/* Teleprompter Controls (Active when in teleprompter mode) */}
          {activeMode === "teleprompter" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAutoScrolling((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                  isAutoScrolling
                    ? "bg-rose-500 text-white animate-pulse"
                    : "border border-hairline bg-surface text-ink hover:border-ember/40 hover:text-ember"
                }`}
              >
                <span>{isAutoScrolling ? "⏸ Jeda Auto-Scroll" : "▶ Mulai Auto-Scroll"}</span>
              </button>

              <div className="flex items-center gap-1 text-[11px] text-muted">
                <span>Speed:</span>
                {[1, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setScrollSpeed(spd)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono cursor-pointer transition-colors ${
                      scrollSpeed === spd
                        ? "bg-ember/20 text-ember border border-ember/40 font-bold"
                        : "bg-surface text-muted hover:text-ink border border-hairline"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Font Resizer */}
          <div className="flex items-center gap-1 text-xs text-muted">
            <span>Ukuran Teks:</span>
            <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-hairline">
              {["A-", "Normal", "A+", "A++"].map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFontSizeLevel(idx)}
                  className={`rounded px-2 py-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                    fontSizeLevel === idx
                      ? "bg-ember/20 text-ember border border-ember/40"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div
          ref={teleprompterRef}
          className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 custom-scrollbar bg-black/30"
        >
          {activeMode === "teleprompter" ? (
            /* Mode 1: Clean Teleprompter Reader */
            <div className="max-w-3xl mx-auto space-y-8 pb-16">
              {scenes.map((sc, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/[0.06] bg-surface/50 p-5 sm:p-6 shadow-sm hover:border-ember/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-hairline/40 pb-2 mb-3">
                    <span className="flex items-center gap-2 font-display text-xs font-bold text-ember">
                      <span className="flex size-5 items-center justify-center rounded-full bg-ember/20 text-[10px]">
                        {i + 1}
                      </span>
                      <span>Scene #{i + 1}</span>
                    </span>
                    <span className="font-mono text-xs text-muted font-semibold">
                      {sc.timestamp || "0:00-0:05"}
                    </span>
                  </div>

                  <p
                    className={`font-sans font-medium text-ink leading-relaxed tracking-wide ${fontSizes[fontSizeLevel]}`}
                  >
                    {sc.spoken || "(Belum ada teks diucapkan)"}
                  </p>

                  {sc.visual && !textMode && (
                    <div className="mt-3.5 border-t border-hairline/40 pt-2 text-xs text-muted flex items-start gap-1.5">
                      <span className="font-semibold text-ember/80 shrink-0">🎬 Kamera/Visual:</span>
                      <span>{sc.visual}</span>
                    </div>
                  )}
                </div>
              ))}

              {editableScript.cta?.text && (
                <div className="rounded-2xl border border-ember/40 bg-ember/[0.04] p-5 sm:p-6">
                  <span className="eyebrow text-ember font-bold block mb-2">🔥 Call To Action (CTA):</span>
                  <p className={`font-sans font-bold text-ink leading-relaxed ${fontSizes[fontSizeLevel]}`}>
                    {editableScript.cta.text}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Mode 2: Detailed Scene & B-Roll Grid View */
            <div className="max-w-3xl mx-auto space-y-4 pb-16">
              {scenes.map((sc, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/[0.08] bg-surface/80 p-4 sm:p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-hairline/40 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-ember/15 text-xs font-bold text-ember">
                        {i + 1}
                      </span>
                      <span className="font-display text-xs font-bold text-ink">
                        Scene #{i + 1}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-ember font-bold">
                      {sc.timestamp || "0:00-0:05"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-ember uppercase tracking-wider">
                      Voiceover / Diucapkan:
                    </label>
                    <textarea
                      rows={3}
                      value={sc.spoken || ""}
                      onChange={(e) => handleUpdateSceneSpoken(i, e.target.value)}
                      className="w-full rounded-xl border border-hairline bg-obsidian p-3 text-xs leading-relaxed text-ink focus:border-ember focus:outline-none"
                    />
                  </div>

                  {!textMode && (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider">
                        Arahan Visual / B-Roll:
                      </label>
                      <textarea
                        rows={2}
                        value={sc.visual || ""}
                        onChange={(e) => handleUpdateSceneVisual(i, e.target.value)}
                        className="w-full rounded-xl border border-hairline bg-obsidian p-2.5 text-xs leading-relaxed text-muted focus:border-ember focus:text-ink focus:outline-none"
                      />
                    </div>
                  )}

                  {sc.on_screen_text && (
                    <div className="rounded-lg bg-black/40 border border-hairline/60 p-2 text-xs">
                      <span className="text-[10px] font-semibold text-muted">Teks di Layar:</span>
                      <p className="font-mono text-ember text-[11px] font-bold mt-0.5">{sc.on_screen_text}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Integrated Natural AI Voice Preview Bar */}
        <div className="border-t border-hairline/80 bg-surface/90 p-3 sm:px-6">
          <VoicePreview text={readThrough} title={title} />
        </div>

        {/* Footer Actions Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline bg-[#111] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleCopy("vo", readThrough)}
              className="rounded-xl border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-ember/40 hover:text-ember active:scale-95 transition-all cursor-pointer"
            >
              {copiedType === "vo" ? "✓ Voiceover Disalin!" : "📋 Salin Voiceover"}
            </button>
            <button
              type="button"
              onClick={() => handleCopy("all", markdownContent)}
              className="rounded-xl border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-ember/40 hover:text-ember active:scale-95 transition-all cursor-pointer"
            >
              {copiedType === "all" ? "✓ Naskah Disalin!" : "📋 Salin Naskah Lengkap"}
            </button>
            <button
              type="button"
              onClick={handleDownloadMd}
              className="rounded-xl border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink active:scale-95 transition-all cursor-pointer"
            >
              📥 Unduh .md
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-ember px-5 py-2 text-xs font-bold text-obsidian shadow-sm hover:bg-ember-lo active:scale-[0.98] transition-all cursor-pointer"
          >
            Tutup Full View
          </button>
        </div>
      </div>
    </div>
  );
}
