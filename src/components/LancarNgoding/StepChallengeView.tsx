"use client";

import React, { useState } from "react";
import { LessonItem } from "./StepLearnView";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface Props {
  lesson: LessonItem;
  isCompleted: boolean;
  onSuccess: (xpEarned: number) => void;
  onNextLevel: () => void;
  onPrevStep: () => void;
}

export default function StepChallengeView({
  lesson,
  isCompleted,
  onSuccess,
  onNextLevel,
  onPrevStep,
}: Props) {
  const { language, dict } = useLanguage();
  const isEn = language === "en";

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const handleCheckAnswer = () => {
    if (!selectedOption) return;
    const correct = selectedOption.trim() === lesson.correctAnswer.trim();
    setIsCorrect(correct);
    setIsAnswerChecked(true);

    if (correct) {
      onSuccess(lesson.xpReward);
    }
  };

  const handleRetry = () => {
    setSelectedOption(null);
    setIsAnswerChecked(false);
    setIsCorrect(false);
  };

  return (
    <div className="surface-card rounded-2xl border border-hairline/80 p-4 sm:p-5 space-y-4 shadow-xs">
      {/* Header Info */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div>
            <span className="text-micro font-mono text-ember font-bold">{dict.vibe.step3Tab}</span>
            <h3 className="font-display text-sm sm:text-base font-bold text-ink">
              {dict.vibe.quizTitle}
            </h3>
          </div>
          {isCompleted && (
            <span className="inline-flex h-5 items-center rounded bg-emerald-500/15 px-2 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              ✓ {dict.vibe.completed}
            </span>
          )}
        </div>
        <span className="inline-flex h-6 items-center rounded-md bg-ember/15 px-2 font-mono text-[11px] font-bold text-ember border border-ember/30">
          +{lesson.xpReward} XP
        </span>
      </div>

      {/* Question */}
      <div className="rounded-xl border border-hairline bg-surface-raised/50 p-3.5 space-y-2">
        <p className="text-xs sm:text-[13px] font-medium text-ink/90 leading-relaxed">
          {lesson.question}
        </p>

        {/* Code Snippet Box */}
        {lesson.codeSnippet && (
          <div className="rounded-xl border border-hairline bg-obsidian p-3 font-mono text-xs sm:text-[13px] text-ember-lo overflow-x-auto">
            <pre className="whitespace-pre-wrap leading-relaxed">{lesson.codeSnippet}</pre>
          </div>
        )}
      </div>

      {/* Options List */}
      <div className="space-y-2">
        <span className="text-micro font-mono text-muted uppercase tracking-wider block px-1">
          {dict.vibe.quizDesc}
        </span>
        <div className="grid grid-cols-1 gap-2">
          {lesson.options.map((opt, idx) => {
            const isSelected = selectedOption === opt;
            let btnStyle =
              "border-hairline bg-surface-raised/60 text-ink/90 hover:border-ember/40 hover:bg-surface-raised";

            if (isAnswerChecked) {
              if (opt === lesson.correctAnswer) {
                btnStyle =
                  "border-emerald-500 bg-emerald-500/20 text-emerald-400 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)]";
              } else if (isSelected && !isCorrect) {
                btnStyle = "border-danger bg-danger/20 text-danger";
              }
            } else if (isSelected) {
              btnStyle =
                "border-ember bg-ember/15 text-ember font-bold shadow-[0_0_12px_rgba(255,138,61,0.25)]";
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (!isAnswerChecked) setSelectedOption(opt);
                }}
                disabled={isAnswerChecked && isCorrect}
                className={`flex min-h-[42px] items-center justify-between rounded-xl border p-3 text-left text-xs sm:text-[13px] transition-all active:scale-[0.99] ${btnStyle}`}
              >
                <span className="font-mono">{opt}</span>
                <span className="text-xs opacity-60">
                  {String.fromCharCode(65 + idx)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Check / Feedback */}
      {!isAnswerChecked ? (
        <div className="pt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onPrevStep}
            className="h-8.5 px-3 rounded-xl border border-hairline text-xs font-semibold text-muted hover:text-ink transition-colors"
          >
            {isEn ? "← Back to Sandbox" : "← Balik ke Sandbox"}
          </button>

          <button
            type="button"
            onClick={handleCheckAnswer}
            disabled={!selectedOption}
            className="flex h-9 items-center justify-center gap-2 rounded-xl bg-ember px-6 font-display text-xs font-bold text-obsidian transition-all hover:bg-ember-lo disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-ember/20"
          >
            <span>{dict.vibe.checkAnswer}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          {/* Result Alert */}
          {isCorrect ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>{dict.vibe.correctAlert} (+{lesson.xpReward} XP)</span>
              </div>
              <p className="text-xs sm:text-[13px] text-ink/90 leading-relaxed">
                {lesson.explanation}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 text-danger font-bold text-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span>{dict.vibe.wrongAlert}</span>
              </div>
              <p className="text-xs sm:text-[13px] text-muted leading-relaxed">
                {isEn
                  ? "Review concepts from earlier steps or review the hint below."
                  : "Coba ingat lagi konsep di materi sebelumnya atau gunakan hint di bawah."}
              </p>
              {showHint && (
                <div className="rounded-lg bg-obsidian p-2.5 text-xs text-ember-lo border border-hairline/60 flex items-start gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 text-ember mt-0.5">
                    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                  </svg>
                  <div>
                    <strong>Hint:</strong> {lesson.hint}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {!isCorrect ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowHint(!showHint)}
                  className="h-8.5 px-3 rounded-xl border border-hairline text-xs font-semibold text-muted hover:text-ink transition-colors"
                >
                  {showHint ? dict.vibe.hideHint : dict.vibe.showHint}
                </button>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex h-9 items-center justify-center gap-2 rounded-xl bg-surface-raised border border-ember/40 px-5 font-display text-xs font-bold text-ember hover:bg-ember/15 transition-all"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M3 21v-5h5" />
                  </svg>
                  <span>{dict.vibe.retryQuiz}</span>
                </button>
              </>
            ) : (
              <div className="w-full flex justify-end">
                <button
                  type="button"
                  onClick={onNextLevel}
                  className="flex h-9 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 font-display text-xs font-bold text-obsidian hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <span>{dict.vibe.nextLevel}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
