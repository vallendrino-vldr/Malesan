"use client";

import { useMemo, useState, useEffect } from "react";
import { adaptSceneFootage } from "@/app/actions/pipeline";
import { saveOfflineScriptCache, markOfflineScriptSynced } from "@/lib/offline-draft-cache";

export type ScriptScene = {
  timestamp?: string;
  spoken?: string;
  visual?: string;
  on_screen_text?: string;
  user_footage_note?: string;
};

export type ScriptOutput = {
  script?: ScriptScene[];
  cta?: { text?: string; placement?: string };
  caption?: string;
  hashtags?: string[];
};

function FilmIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M3 7.5h4" />
      <path d="M3 12h18" />
      <path d="M3 16.5h4" />
      <path d="M17 3v18" />
      <path d="M17 7.5h4" />
      <path d="M17 16.5h4" />
    </svg>
  );
}

function SparkleIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z" />
    </svg>
  );
}

function isTextPlatform(platform?: string) {
  return ["x", "threads", "facebook", "linkedin"].includes((platform ?? "").toLowerCase());
}

function buildReadThrough(s: ScriptOutput, textMode: boolean) {
  const scenes = s.script ?? [];
  const hook = scenes[0];
  const body = scenes.slice(1);

  const lines: string[] = [];
  if (hook?.spoken) lines.push(`${textMode ? "PEMBUKA" : "HOOK"}\n${hook.spoken}`);
  if (body.length) {
    lines.push(
      `${textMode ? "LANJUTAN" : "BODY"}\n${body
        .map((sc) => sc.spoken)
        .filter(Boolean)
        .join("\n\n")}`,
    );
  }
  if (s.cta?.text) lines.push(`CTA\n${s.cta.text}`);
  return lines.join("\n\n");
}

function buildMarkdown(s: ScriptOutput, title: string, textMode: boolean) {
  const out: string[] = [
    `# ${title}`,
    "",
    textMode ? "## Tulisan siap posting" : "## Voice over",
    "",
    buildReadThrough(s, textMode),
    "",
  ];

  if (s.script?.length) {
    out.push(textMode ? "## Bagian" : "## Scene", "");
    s.script.forEach((sc, i) => {
      out.push(`### ${i + 1}. ${sc.timestamp ?? ""}`.trim());
      if (sc.spoken) out.push(`**${textMode ? "Teks" : "Diucapkan"}:** ${sc.spoken}`);
      if (sc.on_screen_text) out.push(`**${textMode ? "Fungsi" : "Teks di layar"}:** ${sc.on_screen_text}`);
      if (sc.visual && !textMode) out.push(`**Footage:** ${sc.visual}`);
      if (sc.user_footage_note && !textMode) out.push(`**Bahan Kreator:** ${sc.user_footage_note}`);
      out.push("");
    });
  }

  if (s.cta?.text) {
    out.push("## CTA", "", s.cta.text);
    if (s.cta.placement) out.push("", `_Penempatan: ${s.cta.placement}_`);
    out.push("");
  }
  if (s.caption) out.push("## Caption", "", s.caption, "");
  if (s.hashtags?.length) out.push("## Hashtag", "", s.hashtags.join(" "), "");

  return out.join("\n");
}

export function ScriptView({
  script,
  title,
  platform,
  onSaveScript,
}: {
  script: ScriptOutput;
  title: string;
  platform?: string;
  onSaveScript?: (updated: ScriptOutput) => Promise<void>;
}) {
  const [currentScript, setCurrentScript] = useState<ScriptOutput>(script);
  const [tab, setTab] = useState<"scene" | "baca">("scene");
  const [copied, setCopied] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [adaptingSceneIdx, setAdaptingSceneIdx] = useState<number | null>(null);
  const [openFootageNoteIdx, setOpenFootageNoteIdx] = useState<number | null>(null);

  // Sync state when incoming prop changes
  useEffect(() => {
    setCurrentScript(script);
    setHasChanges(false);
  }, [script]);

  const textMode = isTextPlatform(platform);
  const readThrough = useMemo(() => buildReadThrough(currentScript, textMode), [currentScript, textMode]);
  const markdown = useMemo(() => buildMarkdown(currentScript, title, textMode), [currentScript, title, textMode]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("gagal");
      setTimeout(() => setCopied(""), 1600);
    }
  };

  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.slice(0, 60).replace(/[^\w\s-]/g, "").trim() || "script"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdateScene = (
    index: number,
    field: keyof ScriptScene,
    value: string,
  ) => {
    const updatedScenes = [...(currentScript.script || [])];
    if (!updatedScenes[index]) return;
    updatedScenes[index] = {
      ...updatedScenes[index],
      [field]: value,
    };
    const updated = {
      ...currentScript,
      script: updatedScenes,
    };
    setCurrentScript(updated);
    setHasChanges(true);
    // Instant offline resilient local caching
    saveOfflineScriptCache(title, updated);
  };

  const handleSave = async () => {
    if (!onSaveScript) return;
    setIsSaving(true);
    try {
      await onSaveScript(currentScript);
      setHasChanges(false);
      markOfflineScriptSynced(title);
    } catch (err) {
      console.error("Gagal simpan script:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIFootageSuggest = async (index: number) => {
    const scene = currentScript.script?.[index];
    if (!scene) return;

    const note = scene.user_footage_note?.trim() || "";
    if (!note) {
      setOpenFootageNoteIdx(index);
      return;
    }

    setAdaptingSceneIdx(index);
    try {
      const adapted = await adaptSceneFootage({
        sceneSpoken: scene.spoken || "",
        sceneVisual: scene.visual || "",
        creatorFootageNote: note,
        title,
      });

      if (adapted) {
        handleUpdateScene(index, "visual", adapted);
      }
    } catch (err) {
      console.error("Gagal adapt footage:", err);
    } finally {
      setAdaptingSceneIdx(null);
    }
  };

  const scenes = currentScript.script ?? [];

  return (
    <div className="mt-3 w-full overflow-hidden rounded-xl border border-hairline bg-obsidian">
      {/* Top Tab Bar & Save Status */}
      <div className="flex items-center justify-between border-b border-hairline p-1.5">
        <div className="flex flex-1 items-center gap-1">
          {(["scene", "baca"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`flex-1 cursor-pointer rounded-lg py-1.5 text-micro font-bold transition-all duration-[var(--duration-standard)] ease-heat ${
                tab === t ? "bg-ember/15 text-ember shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {t === "baca"
                ? textMode
                  ? "Tulisan"
                  : "Baca"
                : `${textMode ? "Bagian" : "Scene"} · ${scenes.length}`}
            </button>
          ))}
        </div>

        {/* Save Button if user made changes */}
        {hasChanges && onSaveScript && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="ml-1.5 cursor-pointer shrink-0 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2 py-1 text-micro font-bold text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
          >
            {isSaving ? "Simpan..." : "Simpan ✓"}
          </button>
        )}
      </div>

      <div className="max-h-80 w-full overflow-y-auto overflow-x-hidden p-2.5 space-y-2.5 overscroll-contain">
        {tab === "baca" ? (
          <div className="space-y-2">
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink/90">
              {readThrough}
            </pre>
          </div>
        ) : (
          <ol className="w-full space-y-2.5">
            {scenes.map((sc, i) => (
              <li
                key={i}
                className="group relative w-full rounded-xl border border-white/[0.08] bg-surface/90 p-2.5 shadow-sm hover:border-ember/30 transition-all"
              >
                {/* Scene Header */}
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex size-4.5 items-center justify-center rounded-full bg-ember/15 text-[10px] font-bold text-ember">
                      {i + 1}
                    </span>
                    <span className="font-mono text-micro font-semibold text-ember">
                      {sc.timestamp || `0:0${i * 4}-0:0${(i + 1) * 4}`}
                    </span>
                  </div>
                </div>

                {/* Spoken Voiceover Textarea */}
                <div className="mt-2">
                  <label
                    htmlFor={`scene-${i}-spoken`}
                    className="block text-[10px] font-semibold text-muted/70 uppercase tracking-wider mb-1"
                  >
                    {textMode ? "Teks Kalimat" : "Voiceover (Diucapkan)"}
                  </label>
                  <textarea
                    id={`scene-${i}-spoken`}
                    name={`scene_${i}_spoken`}
                    aria-label={`Voiceover scene ${i + 1}`}
                    rows={2}
                    value={sc.spoken || ""}
                    onChange={(e) => handleUpdateScene(i, "spoken", e.target.value)}
                    placeholder="Ketik kalimat voiceover scene ini..."
                    className="w-full rounded-lg border border-white/[0.06] bg-obsidian/70 p-2 text-xs leading-relaxed text-ink placeholder:text-muted/40 focus:border-ember/50 focus:outline-none transition-colors resize-y"
                  />
                </div>

                {/* On-Screen Text Input */}
                <div className="mt-2">
                  <label
                    htmlFor={`scene-${i}-overlay`}
                    className="block text-[10px] font-semibold text-muted/70 uppercase tracking-wider mb-1"
                  >
                    {textMode ? "Fungsi / Judul Bagian" : "Teks di Layar (Overlay)"}
                  </label>
                  <input
                    id={`scene-${i}-overlay`}
                    name={`scene_${i}_overlay`}
                    aria-label={`Teks di layar scene ${i + 1}`}
                    type="text"
                    value={sc.on_screen_text || ""}
                    onChange={(e) => handleUpdateScene(i, "on_screen_text", e.target.value)}
                    placeholder="Contoh: Bahaya cuci CVT pakai bensin"
                    className="w-full rounded-lg border border-white/[0.06] bg-obsidian/70 px-2.5 py-1.5 text-micro text-ink placeholder:text-muted/40 focus:border-ember/50 focus:outline-none transition-colors"
                  />
                </div>

                {/* Visual Footage Director Box */}
                {!textMode && (
                  <div className="mt-2 rounded-xl border border-white/[0.08] bg-black/40 p-2.5 w-full min-w-0">
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <label
                        htmlFor={`scene-${i}-visual`}
                        className="flex min-w-0 items-center gap-1 text-[10px] font-bold tracking-wider text-ember uppercase truncate"
                      >
                        <FilmIcon className="size-3 text-ember shrink-0" />
                        <span className="truncate">Arahan Visual</span>
                      </label>

                      {/* Top quick helper button */}
                      <button
                        type="button"
                        onClick={() => handleAIFootageSuggest(i)}
                        disabled={adaptingSceneIdx === i}
                        title="Sesuaikan arahan visual dengan AI"
                        className="cursor-pointer inline-flex shrink-0 items-center gap-1 rounded-md border border-ember/30 bg-ember/10 px-2 py-0.5 text-micro font-bold text-ember transition-all hover:bg-ember/20 disabled:opacity-50"
                      >
                        {adaptingSceneIdx === i ? (
                          <>
                            <span className="size-1.5 rounded-full bg-ember animate-ping" />
                            <span>AI...</span>
                          </>
                        ) : (
                          <>
                            <SparkleIcon className="size-2 text-ember" />
                            <span>AI</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Footage Description Textarea */}
                    <textarea
                      id={`scene-${i}-visual`}
                      name={`scene_${i}_visual`}
                      aria-label={`Arahan visual scene ${i + 1}`}
                      rows={2}
                      value={sc.visual || ""}
                      onChange={(e) => handleUpdateScene(i, "visual", e.target.value)}
                      placeholder="Contoh: Close-in gearbox terbuka, zoom ke sil kruk as..."
                      className="w-full rounded-lg border border-white/[0.08] bg-obsidian p-2 text-xs leading-relaxed text-ink/90 placeholder:text-muted/40 focus:border-ember/60 focus:outline-none transition-colors resize-y"
                    />

                    {/* Creator Custom Footage Note Input */}
                    {openFootageNoteIdx === i || sc.user_footage_note ? (
                      <div className="mt-2 rounded-lg border border-ember/25 bg-[#141210] p-2 shadow-sm w-full min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <label
                            htmlFor={`scene-${i}-footage-note`}
                            className="flex min-w-0 items-center gap-1 text-[10px] font-bold tracking-wider text-ember uppercase truncate"
                          >
                            <FilmIcon className="size-2.5 text-ember shrink-0" />
                            <span className="truncate">Rekaman Sendiri</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenFootageNoteIdx(null);
                              if (!sc.user_footage_note) handleUpdateScene(i, "user_footage_note", "");
                            }}
                            className="cursor-pointer shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-muted transition-colors hover:border-white/20 hover:text-ink"
                          >
                            Tutup
                          </button>
                        </div>

                        {/* Unified Slim Input Bar with Embedded CTA Button */}
                        <div className="relative flex w-full min-w-0 items-center gap-1 rounded-md border border-white/10 bg-obsidian p-1 focus-within:border-ember/60 transition-colors">
                          <input
                            id={`scene-${i}-footage-note`}
                            name={`scene_${i}_footage_note`}
                            aria-label={`Bahan rekaman sendiri scene ${i + 1}`}
                            type="text"
                            value={sc.user_footage_note || ""}
                            onChange={(e) => handleUpdateScene(i, "user_footage_note", e.target.value)}
                            placeholder="Ketik rekamanmu..."
                            className="min-w-0 flex-1 bg-transparent px-1.5 py-0.5 text-xs text-ink placeholder:text-muted/40 outline-none"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && sc.user_footage_note?.trim()) {
                                e.preventDefault();
                                handleAIFootageSuggest(i);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAIFootageSuggest(i)}
                            disabled={adaptingSceneIdx === i || !sc.user_footage_note?.trim()}
                            className="cursor-pointer inline-flex shrink-0 items-center gap-1 rounded bg-ember px-2 py-1 text-micro font-bold text-obsidian whitespace-nowrap shadow-sm transition-all hover:bg-ember-lo disabled:opacity-30 active:scale-95"
                          >
                            {adaptingSceneIdx === i ? (
                              <>
                                <span className="size-1.5 rounded-full bg-obsidian animate-ping" />
                                <span>...</span>
                              </>
                            ) : (
                              <>
                                <SparkleIcon className="size-2 fill-current" />
                                <span>Sesuaikan</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenFootageNoteIdx(i)}
                        className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-white/[0.02] py-1.5 px-2 text-micro font-semibold text-ink/80 transition-all hover:border-ember/50 hover:bg-ember/[0.06] hover:text-ember active:scale-[0.98]"
                      >
                        <FilmIcon className="size-3 opacity-70" />
                        <span>+ Tambah rekaman sendiri</span>
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {currentScript.caption && (
          <div className="mt-3 border-t border-hairline pt-3">
            <label htmlFor="script-caption-input" className="eyebrow text-muted block">
              {textMode ? "Penutup" : "Caption"}
            </label>
            <textarea
              id="script-caption-input"
              name="script_caption"
              aria-label="Caption naskah"
              rows={2}
              value={currentScript.caption || ""}
              onChange={(e) => {
                const updated = { ...currentScript, caption: e.target.value };
                setCurrentScript(updated);
                setHasChanges(true);
                saveOfflineScriptCache(title, updated);
              }}
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-obsidian p-2 text-xs leading-relaxed text-ink/80 focus:border-ember/50 focus:outline-none"
            />
          </div>
        )}

        {!!currentScript.hashtags?.length && (
          <p className="mt-2 text-micro leading-relaxed text-ember-lo">
            {currentScript.hashtags.join(" ")}
          </p>
        )}
      </div>

      {/* Bottom Action Strip */}
      <div className="flex gap-1.5 border-t border-hairline p-1.5">
        <Btn
          label={copied === "vo" ? "Kesalin!" : textMode ? "Salin tulisan" : "Salin voice over"}
          onClick={() => copy("vo", readThrough)}
        />
        <Btn
          label={copied === "all" ? "Kesalin!" : "Salin semua"}
          onClick={() => copy("all", markdown)}
        />
        <Btn label="Unduh .md" onClick={download} />
      </div>
      {copied === "gagal" && (
        <p className="px-3 pb-2 text-micro text-danger">
          Browser-nya nolak akses clipboard. Pakai Unduh aja.
        </p>
      )}
    </div>
  );
}

function Btn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 cursor-pointer rounded-lg bg-surface px-2 py-2 text-micro font-bold text-ink/80 transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-surface-raised hover:text-ink hover:border-ember/30"
    >
      {label}
    </button>
  );
}
