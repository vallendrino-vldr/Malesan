"use client";

import { useState } from "react";
import { StreamingText } from "./StreamingText";
import { saveToPipeline } from "@/app/actions/pipeline";
import { RateResult } from "./RateResult";
import {
  normalizeTodayPlatform,
  todayPlatformLabel,
  type TodayPlatform,
} from "@/lib/content-options";

export type IdeaData = {
  title: string;
  angle: string;
  why_now: string;
  format: string;
  est_duration: string;
  difficulty: string;
  hook_seed?: string;
  platform?: TodayPlatform;
  goal?: string;
  opening?: string;
  beats?: string[];
  ready_copy?: string;
  caption?: string;
  hashtags?: string[];
};

export function IdeaCard({ idea, isStreaming, generationId }: { idea: Partial<IdeaData>; isStreaming?: boolean; generationId?: string }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const normalizedPlatform = idea.platform ? normalizeTodayPlatform(idea.platform) : null;
  const isVideo = normalizedPlatform === "tiktok_reels" || normalizedPlatform === "youtube_shorts";
  const beatLabel =
    normalizedPlatform === "x" || normalizedPlatform === "threads"
      ? "Alur thread"
      : normalizedPlatform === "facebook"
        ? "Alur cerita"
        : normalizedPlatform === "linkedin"
          ? "Kerangka insight"
          : "Alur video";

  const handleSave = async () => {
    if (!idea.title) return;
    setIsSaving(true);
    setSaveError("");
    try {
      await saveToPipeline(idea.title, idea, generationId);
      setSaved(true);
    } catch {
      setSaveError("Belum berhasil masuk Alur. Coba tap sekali lagi.");
    }
    setIsSaving(false);
  };

  const copyPayload = [idea.ready_copy, idea.caption, idea.hashtags?.join(" ")]
    .filter((part): part is string => Boolean(part?.trim()))
    .join("\n\n");

  const handleCopy = async () => {
    if (!copyPayload) return;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(copyPayload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError("Belum bisa disalin otomatis. Buka kontennya, lalu salin manual ya.");
    }
  };

  // If streaming and title is missing, show a skeleton or partial text
  if (!idea.title && isStreaming) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface p-6 animate-pulse">
        <div className="h-6 w-2/3 rounded bg-surface-raised"></div>
        <div className="mt-4 h-4 w-full rounded bg-surface-raised"></div>
        <div className="mt-2 h-4 w-5/6 rounded bg-surface-raised"></div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-hairline bg-surface p-5 transition-all duration-[var(--duration-bloom)] sm:p-6 ${isStreaming ? 'glow-ember' : ''}`}>
      {normalizedPlatform && (
        <p className="eyebrow mb-2 text-ember">{todayPlatformLabel(normalizedPlatform)}</p>
      )}
      <h3 className="font-display text-xl font-bold text-ink">
        {idea.title}
      </h3>
      
      <div className="mt-4 space-y-3">
        {idea.angle && (
          <div>
            <span className="eyebrow text-ember">Sudutnya</span>
            <p className="mt-1 text-sm leading-relaxed text-ink/90">
              {isStreaming ? <StreamingText text={idea.angle} /> : idea.angle}
            </p>
          </div>
        )}
        
        {idea.why_now && (
          <div>
            <span className="eyebrow text-ember">Kenapa sekarang</span>
            <p className="mt-1 text-sm leading-relaxed text-ink/90">
              {isStreaming ? <StreamingText text={idea.why_now} /> : idea.why_now}
            </p>
          </div>
        )}

        {idea.hook_seed && (
          <div className="rounded-lg bg-obsidian p-3 border border-hairline">
            <span className="eyebrow text-ember">Calon hook</span>
            <p className="mt-1 text-sm font-semibold text-ink">
              {isStreaming ? <StreamingText text={idea.hook_seed} /> : idea.hook_seed}
            </p>
          </div>
        )}
      </div>

      {(idea.opening || idea.ready_copy || idea.beats?.length || idea.caption || idea.hashtags?.length) && (
        <details className="mt-5 overflow-hidden rounded-xl border border-hairline bg-obsidian/45">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-mini font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember">
            <span>Konten siap posting</span>
            <span className="text-micro font-normal text-muted">Buka</span>
          </summary>
          <div className="space-y-4 border-t border-hairline px-4 py-4">
            {idea.opening && (
              <div>
                <p className="eyebrow text-ember">{isVideo ? "Hook" : "Pembuka"}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-ink">
                  {idea.opening}
                </p>
              </div>
            )}
            {idea.beats && idea.beats.length > 0 && (
              <div>
                <p className="eyebrow text-ember">{beatLabel}</p>
                <ol className="mt-1.5 space-y-1.5 text-sm leading-relaxed text-ink/90">
                  {idea.beats.map((beat, index) => (
                    <li key={`${index}-${beat.slice(0, 24)}`} className="flex gap-2">
                      <span className="tabular shrink-0 font-mono text-micro text-muted">{index + 1}.</span>
                      <span>{beat}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {idea.ready_copy && (
              <div>
                <p className="eyebrow text-ember">{isVideo ? "Voice-over" : "Draft siap posting"}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                  {idea.ready_copy}
                </p>
              </div>
            )}
            {idea.caption && (
              <div>
                <p className="eyebrow text-ember">{isVideo ? "Caption" : "Penutup"}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                  {idea.caption}
                </p>
              </div>
            )}
            {idea.hashtags && idea.hashtags.length > 0 && (
              <p className="text-mini leading-relaxed text-muted">{idea.hashtags.join(" ")}</p>
            )}
          </div>
        </details>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {idea.format && (
          <span className="rounded bg-surface-raised px-2 py-1 font-mono text-micro uppercase tracking-wider text-muted">
            {idea.format}
          </span>
        )}
        {idea.est_duration && (
          <span className="rounded bg-surface-raised px-2 py-1 font-mono text-micro uppercase tracking-wider text-muted">
            {idea.est_duration}
          </span>
        )}
        {idea.difficulty && (
          <span className="rounded bg-surface-raised px-2 py-1 font-mono text-micro uppercase tracking-wider text-muted">
            {idea.difficulty}
          </span>
        )}
      </div>

      {!isStreaming && idea.title && (
        <div className="mt-4 space-y-3 border-t border-hairline pt-4">
          <p className="text-mini font-semibold text-ink">Mau langsung dipakai?</p>
          <div className={`grid gap-2 ${copyPayload ? "grid-cols-2" : "grid-cols-1"}`}>
            {copyPayload && (
              <button
                type="button"
                onClick={handleCopy}
                className={`h-8.5 sm:h-9 rounded-lg px-3 font-display text-xs font-bold transition-colors shadow-xs ${
                  copied ? "bg-success text-obsidian" : "bg-ember text-obsidian hover:bg-ember-lo"
                }`}
              >
                {copied ? "Udah tersalin" : "Salin konten"}
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || saved}
              className={`h-8.5 sm:h-9 rounded-lg border px-3 font-display text-xs font-semibold transition-colors shadow-xs ${
                saved
                  ? "cursor-default border-success/30 bg-success/10 text-success"
                  : "cursor-pointer border-hairline bg-surface-raised text-ink hover:border-ember/40 hover:text-ember-lo"
              }`}
            >
              {saved ? "Udah masuk Alur" : isSaving ? "Lagi nyimpen..." : "Simpan ke Alur"}
            </button>
          </div>
          {copyError && (
            <p role="alert" className="text-micro leading-relaxed text-danger">
              {copyError}
            </p>
          )}
          {saveError && (
            <p role="alert" className="text-micro leading-relaxed text-danger">
              {saveError}
            </p>
          )}
          {/* Rating lives here, next to the result, rather than only on a
              pipeline card that has already been marked Posted. Asking someone
              to come back later and grade their own homework is why only five
              of nineteen generations had ever been rated. */}
          <RateResult generationId={generationId ?? null} />
        </div>
      )}
    </div>
  );
}
