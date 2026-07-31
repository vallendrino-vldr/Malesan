"use client";

import { useState } from "react";
import { StreamingText } from "./StreamingText";
import { saveToPipeline } from "@/app/actions/pipeline";
import { RateResult } from "./RateResult";

export type IdeaData = {
  title: string;
  angle: string;
  why_now: string;
  format: string;
  est_duration: string;
  difficulty: string;
  hook_seed?: string;
};

export function IdeaCard({ idea, isStreaming, generationId }: { idea: Partial<IdeaData>; isStreaming?: boolean; generationId?: string }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!idea.title) return;
    setIsSaving(true);
    try {
      await saveToPipeline(idea.title, idea, generationId);
      setSaved(true);
    } catch (err) {
      console.error(err);
    }
    setIsSaving(false);
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
    <div className={`rounded-2xl border border-hairline bg-surface p-6 transition-all duration-[var(--duration-bloom)] ${isStreaming ? 'glow-ember' : ''}`}>
      <h3 className="font-display text-xl font-bold text-ink">
        {idea.title}
      </h3>
      
      <div className="mt-4 space-y-3">
        {idea.angle && (
          <div>
            <span className="font-mono text-micro uppercase tracking-[0.14em] text-ember">Angle</span>
            <p className="mt-1 text-sm leading-relaxed text-ink/90">
              {isStreaming ? <StreamingText text={idea.angle} /> : idea.angle}
            </p>
          </div>
        )}
        
        {idea.why_now && (
          <div>
            <span className="font-mono text-micro uppercase tracking-[0.14em] text-ember">Why Now</span>
            <p className="mt-1 text-sm leading-relaxed text-ink/90">
              {isStreaming ? <StreamingText text={idea.why_now} /> : idea.why_now}
            </p>
          </div>
        )}

        {idea.hook_seed && (
          <div className="rounded-lg bg-obsidian p-3 border border-hairline">
            <span className="font-mono text-micro uppercase tracking-[0.14em] text-ember">Hook Seed</span>
            <p className="mt-1 text-sm font-semibold text-ink">
              {isStreaming ? <StreamingText text={idea.hook_seed} /> : idea.hook_seed}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {idea.format && (
          <span className="rounded bg-surface-raised px-2 py-1 font-mono text-micro uppercase tracking-wider text-muted">
            Format: {idea.format}
          </span>
        )}
        {idea.est_duration && (
          <span className="rounded bg-surface-raised px-2 py-1 font-mono text-micro uppercase tracking-wider text-muted">
            Durasi: {idea.est_duration}
          </span>
        )}
        {idea.difficulty && (
          <span className="rounded bg-surface-raised px-2 py-1 font-mono text-micro uppercase tracking-wider text-muted">
            Effort: {idea.difficulty}
          </span>
        )}
      </div>

      {!isStreaming && idea.title && (
        <div className="mt-4 space-y-3 border-t border-hairline pt-4">
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving || saved}
              className={`min-h-11 cursor-pointer font-display text-xs font-semibold transition-colors ${
                saved ? "cursor-default text-success" : "text-ember hover:text-ember-lo"
              }`}
            >
              {saved ? "✓ Tersimpan di Pipeline" : isSaving ? "Menyimpan..." : "+ Simpan ke Pipeline"}
            </button>
          </div>
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
