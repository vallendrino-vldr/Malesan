"use client";

import React, { useState } from "react";
import { LessonItem } from "./StepLearnView";

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
            <span className="text-micro font-mono text-ember font-bold">LANGKAH 3: TANTANGAN KUIS</span>
            <h3 className="font-display text-sm sm:text-base font-bold text-ink">
              Kunci Pemahaman Lo
            </h3>
          </div>
          {isCompleted && (
            <span className="inline-flex h-5 items-center rounded bg-emerald-500/15 px-2 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              ✓ Selesai
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
          Pilih Jawaban yang Tepat:
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
            ← Balik ke Sandbox
          </button>

          <button
            type="button"
            onClick={handleCheckAnswer}
            disabled={!selectedOption}
            className="flex h-9 items-center justify-center gap-2 rounded-xl bg-ember px-6 font-display text-xs font-bold text-obsidian transition-all hover:bg-ember-lo disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-ember/20"
          >
            <span>Periksa Jawaban</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          {/* Result Alert */}
          {isCorrect ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <span>🎉 Benar Banget! (+{lesson.xpReward} XP)</span>
              </div>
              <p className="text-xs sm:text-[13px] text-ink/90 leading-relaxed">
                {lesson.explanation}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 text-danger font-bold text-sm">
                <span>❌ Belum Tepat! Jangan Nyerah.</span>
              </div>
              <p className="text-xs sm:text-[13px] text-muted leading-relaxed">
                Coba ingat lagi konsep di materi sebelumnya atau gunakan hint di bawah.
              </p>
              {showHint && (
                <div className="rounded-lg bg-obsidian p-2.5 text-xs text-ember-lo border border-hairline/60">
                  💡 <strong>Hint:</strong> {lesson.hint}
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
                  {showHint ? "Sembunyikan Hint" : "Lihat Hint 💡"}
                </button>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex h-9 items-center justify-center gap-2 rounded-xl bg-surface-raised border border-ember/40 px-5 font-display text-xs font-bold text-ember hover:bg-ember/15 transition-all"
                >
                  <span>Coba Lagi 🔄</span>
                </button>
              </>
            ) : (
              <div className="w-full flex justify-end">
                <button
                  type="button"
                  onClick={onNextLevel}
                  className="flex h-9 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 font-display text-xs font-bold text-obsidian hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <span>Lanjut ke Level Berikutnya 🚀</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
