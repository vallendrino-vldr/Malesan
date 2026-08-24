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
  const [activeTab, setActiveTab] = useState<"teleprompter" | "baca" | "scenes">("teleprompter");
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(2); // 0=16px, 1=20px, 2=24px, 3=30px
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(1);
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

  // Structured read-through format (Hook -> Body -> CTA) like Kanban
  const kanbanReadThrough = useMemo(() => {
    const hook = scenes[0];
    const body = scenes.slice(1);
    const lines: string[] = [];

    if (hook?.spoken) {
      lines.push(`${textMode ? "PEMBUKA" : "HOOK (3 DETIK PERTAMA)"}\n${hook.spoken}`);
    }
    if (body.length) {
      lines.push(
        `${textMode ? "LANJUTAN" : "ISI KONTEN (BODY)"}\n${body
          .map((sc) => sc.spoken)
          .filter(Boolean)
          .join("\n\n")}`,
      );
    }
    if (editableScript.cta?.text) {
      lines.push(`CALL TO ACTION (CTA)\n${editableScript.cta.text}`);
    }
    return lines.join("\n\n");
  }, [scenes, editableScript.cta, textMode]);

  // Build complete markdown for export
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Full View Window */}
      <div className="relative w-full max-w-5xl h-full sm:h-[90vh] sm:my-auto sm:mx-auto sm:rounded-2xl border-0 sm:border border-hairline/80 bg-[#101010] shadow-2xl flex flex-col overflow-hidden z-10 animate-scale-up">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-hairline/80 bg-surface/95 px-4 py-3 sm:px-6 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-ember/15 text-ember text-base font-bold border border-ember/30 shrink-0">
              📖
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-ink truncate">
                  {title || "Naskah Video"}
                </h2>
                <span className="hidden sm:inline-block rounded-full bg-surface-raised border border-hairline px-2 py-0.5 text-[10px] font-semibold text-muted">
                  {platform}
                </span>
              </div>
              <p className="text-[11px] text-muted truncate">
                {scenes.length} Scene · Studio Reader & Teleprompter
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasChanges && onSaveScript && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition-all cursor-pointer"
              >
                {isSaving ? "Menyimpan..." : "Simpan ✓"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-xl bg-surface hover:bg-surface-raised text-muted hover:text-ink transition-colors cursor-pointer border border-hairline"
              aria-label="Tutup Layar Penuh"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Toolbar Strip: 3 Clean Tabs + Font Controls + Teleprompter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-hairline/60 bg-surface/50 px-3 py-2 sm:px-6 shrink-0">
          {/* 3 Dedicated Modes */}
          <div className="flex items-center gap-1 bg-black/50 rounded-xl p-1 border border-hairline/60 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => {
                setActiveTab("teleprompter");
                setIsAutoScrolling(false);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "teleprompter"
                  ? "bg-ember text-obsidian shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>📜</span>
              <span>Teleprompter (VO Saja)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("baca");
                setIsAutoScrolling(false);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "baca"
                  ? "bg-ember text-obsidian shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>📖</span>
              <span>Mode Baca (Format Kanban)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("scenes");
                setIsAutoScrolling(false);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "scenes"
                  ? "bg-ember text-obsidian shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>📑</span>
              <span>Detail Scene & B-Roll</span>
            </button>
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Teleprompter Controls (Only visible in teleprompter mode) */}
            {activeTab === "teleprompter" && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAutoScrolling((prev) => !prev)}
                  className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    isAutoScrolling
                      ? "bg-rose-500 text-white animate-pulse"
                      : "border border-ember/40 bg-ember/15 text-ember hover:bg-ember hover:text-obsidian"
                  }`}
                >
                  <span>{isAutoScrolling ? "⏸ Jeda" : "▶ Putar Auto-Scroll"}</span>
                </button>

                <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-hairline">
                  {[1, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setScrollSpeed(spd)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-mono cursor-pointer transition-colors ${
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
            )}

            {/* Font Size Scaling */}
            <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-hairline">
              <span className="text-[10px] text-muted pl-1">Font:</span>
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
          className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-black/40"
        >
          {activeTab === "teleprompter" ? (
            /* TAB 1: PURE FLOWING VOICEOVER TEXT (TELEPROMPTER) - NO SCENE CARDS, NO FOOTAGE DISTRACTIONS */
            <div className="max-w-3xl mx-auto space-y-6 pb-20 pt-2">
              <div className="rounded-2xl border border-white/[0.08] bg-surface/40 p-6 sm:p-8 shadow-sm">
                <div className="flex items-center justify-between border-b border-hairline/40 pb-3 mb-6">
                  <span className="eyebrow text-ember font-bold">📜 Voiceover Siap Baca (Teleprompter):</span>
                  <span className="text-micro text-muted">
                    Fokus penuh pada lisan · Bebas distraksi metadata
                  </span>
                </div>

                <div className="space-y-6">
                  {scenes.map((sc, i) => (
                    <div key={i} className="group transition-opacity hover:opacity-100">
                      <p
                        className={`font-sans font-medium text-ink/95 tracking-wide ${fontSizes[fontSizeLevel]}`}
                      >
                        {sc.spoken || "(Teks kosong)"}
                      </p>
                    </div>
                  ))}

                  {editableScript.cta?.text && (
                    <div className="mt-8 border-t border-ember/30 pt-6">
                      <span className="text-micro font-bold uppercase tracking-wider text-ember block mb-2">
                        🔥 Call to Action (Penutup):
                      </span>
                      <p
                        className={`font-sans font-bold text-ink leading-relaxed ${fontSizes[fontSizeLevel]}`}
                      >
                        {editableScript.cta.text}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "baca" ? (
            /* TAB 2: CLEAN READ FORMAT (LIKE KANBAN) */
            <div className="max-w-3xl mx-auto space-y-6 pb-20 pt-2">
              <div className="rounded-2xl border border-white/[0.08] bg-surface/50 p-6 sm:p-8 shadow-sm">
                <div className="flex items-center justify-between border-b border-hairline/40 pb-3 mb-4">
                  <span className="eyebrow text-emerald-400 font-bold">📖 Format Naskah Lengkap:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy("vo", kanbanReadThrough)}
                    className="text-micro font-bold text-ember hover:underline cursor-pointer"
                  >
                    {copiedType === "vo" ? "✓ Berhasil Disalin!" : "Salin Semua Teks Lisan"}
                  </button>
                </div>

                <pre className="whitespace-pre-wrap font-sans text-sm sm:text-base leading-relaxed text-ink/90">
                  {kanbanReadThrough}
                </pre>

                {editableScript.caption && (
                  <div className="mt-6 border-t border-hairline/60 pt-4">
                    <span className="eyebrow text-muted block mb-1">Caption Medsos:</span>
                    <p className="text-xs sm:text-sm text-ink/80 leading-relaxed bg-black/40 rounded-xl p-3 border border-hairline/40">
                      {editableScript.caption}
                    </p>
                  </div>
                )}

                {!!editableScript.hashtags?.length && (
                  <p className="mt-3 text-xs font-mono text-ember font-semibold">
                    {editableScript.hashtags.join(" ")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* TAB 3: DETAILED SCENES & B-ROLL GRID VIEW */
            <div className="max-w-3xl mx-auto space-y-4 pb-20 pt-2">
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
                      className="w-full rounded-xl border border-hairline bg-obsidian p-3 text-xs sm:text-sm leading-relaxed text-ink focus:border-ember focus:outline-none"
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

        {/* 🎙️ Natural Indonesian AI Voice Preview Player */}
        <div className="border-t border-hairline/80 bg-surface/95 p-3 sm:px-6 shrink-0">
          <VoicePreview text={pureVoiceoverText} title={title} />
        </div>

        {/* Bottom Actions Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline bg-[#111] px-4 py-3 sm:px-6 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleCopy("vo", pureVoiceoverText)}
              className="rounded-xl border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-ember/40 hover:text-ember active:scale-95 transition-all cursor-pointer"
            >
              {copiedType === "vo" ? "✓ Voiceover Disalin!" : "📋 Salin Voiceover"}
            </button>
            <button
              type="button"
              onClick={() => handleCopy("all", markdownContent)}
              className="rounded-xl border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-ember/40 hover:text-ember active:scale-95 transition-all cursor-pointer"
            >
              {copiedType === "all" ? "✓ Naskah Disalin!" : "📋 Salin Format Lengkap"}
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
            Tutup Layar Penuh
          </button>
        </div>
      </div>
    </div>
  );
}
