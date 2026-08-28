"use client";

import React from "react";

export interface LessonItem {
  id: string;
  track: string;
  level: number;
  topic: string;
  title: string;
  analogy: string;
  type: "fill_blank" | "multiple_choice" | "bug_hunt" | "playground";
  question: string;
  codeSnippet: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  hint: string;
  xpReward: number;
}

interface Props {
  lesson: LessonItem;
  onNextStep: () => void;
}

export default function StepLearnView({ lesson, onNextStep }: Props) {
  return (
    <div className="surface-card rounded-2xl border border-hairline/80 p-4 sm:p-5 space-y-4 shadow-xs">
      {/* Header Info */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-md bg-ember/15 px-2 font-mono text-[11px] font-bold text-ember border border-ember/30">
            LEVEL {lesson.level}
          </span>
          <span className="text-xs font-semibold text-muted tracking-tight">{lesson.topic}</span>
        </div>
        <span className="text-micro font-mono text-ember/80 font-bold bg-surface-raised px-2 py-0.5 rounded border border-hairline/60">
          +{lesson.xpReward} XP
        </span>
      </div>

      {/* Main Title */}
      <div>
        <h2 className="font-display text-lg sm:text-xl font-bold text-ink mb-1.5">{lesson.title}</h2>
        <p className="text-xs text-muted leading-relaxed">
          Pahami konsep dasarnya dulu lewat analogi nyata di bawah sebelum kita coba ngoding langsung.
        </p>
      </div>

      {/* Analogy Box */}
      <div className="rounded-xl border border-ember/30 bg-gradient-to-br from-ember/15 via-ember/5 to-transparent p-4 relative overflow-hidden">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">💡</span>
          <div className="space-y-1 text-xs sm:text-[13px] leading-relaxed text-ink/90">
            <span className="font-display font-bold text-ember block mb-0.5">Analogi Dunia Nyata:</span>
            <p>{lesson.analogy}</p>
          </div>
        </div>
      </div>

      {/* Code Anatomy Visual Card */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-micro font-bold uppercase tracking-wider text-muted font-mono">
            Anatomi Kode Contoh
          </span>
          <span className="text-micro text-muted/75 font-mono">JavaScript</span>
        </div>

        <div className="rounded-xl border border-hairline bg-obsidian/95 p-3.5 sm:p-4 font-mono text-xs text-ink/90 overflow-x-auto shadow-inner">
          <pre className="text-ember-lo whitespace-pre-wrap leading-relaxed">
            {lesson.codeSnippet.replace(/___/g, "[...isi di sini...]")}
          </pre>
        </div>
      </div>

      {/* Pro Tip Note */}
      <div className="rounded-xl border border-hairline/60 bg-surface-raised/50 p-3 flex items-start gap-2.5">
        <span className="text-sm shrink-0">🎯</span>
        <div className="text-xs leading-relaxed text-muted">
          <strong className="text-ink font-medium">Tips Pemula:</strong> {lesson.hint}
        </div>
      </div>

      {/* Bottom CTA to step 2 */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={onNextStep}
          className="flex h-9 items-center justify-center gap-2 rounded-xl bg-ember px-5 font-display text-xs font-bold text-obsidian transition-all hover:bg-ember-lo active:scale-95 shadow-md shadow-ember/20 w-full sm:w-auto"
        >
          <span>Lanjut ke Eksperimen Live</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
