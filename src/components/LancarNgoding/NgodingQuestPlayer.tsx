"use client";

import React, { useState } from "react";
import { LessonItem } from "./StepLearnView";
import {
  runJavaScriptSandbox,
  validateLessonCode,
  getLessonChallenge,
  SandboxResult,
  ValidationResult,
} from "@/lib/code-sandbox";

interface Props {
  lesson: LessonItem;
  isCompleted: boolean;
  onSuccess: (xpEarned: number) => void;
  onNextLevel: () => void;
  onBackToRoadmap: () => void;
}

export default function NgodingQuestPlayer({
  lesson,
  isCompleted,
  onSuccess,
  onNextLevel,
  onBackToRoadmap,
}: Props) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Get tailored puzzle & objective for this level
  const challenge = getLessonChallenge(lesson.level);

  // Sandbox State
  const [userCode, setUserCode] = useState(challenge.starterCode);
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Quiz State
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isQuizChecked, setIsQuizChecked] = useState(false);
  const [isQuizCorrect, setIsQuizCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Handle Run & Validate in Step 2
  const handleRunAndValidate = () => {
    const sResult = runJavaScriptSandbox(userCode);
    setSandboxResult(sResult);
    const vResult = validateLessonCode(lesson.level, userCode, sResult);
    setValidationResult(vResult);
  };

  // Handle Quiz Check in Step 3
  const handleCheckQuiz = () => {
    if (!selectedOption) return;
    const correct = selectedOption.trim() === lesson.correctAnswer.trim();
    setIsQuizCorrect(correct);
    setIsQuizChecked(true);

    if (correct) {
      onSuccess(lesson.xpReward);
    }
  };

  const handleRetryQuiz = () => {
    setSelectedOption(null);
    setIsQuizChecked(false);
    setIsQuizCorrect(false);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-12 animate-fadeIn">
      {/* Top Mission Header & Step Tracker */}
      <div className="surface-card rounded-2xl border border-hairline/80 p-3.5 sm:p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          {/* Back to Roadmap button */}
          <button
            type="button"
            onClick={onBackToRoadmap}
            className="flex h-7.5 items-center gap-1.5 rounded-lg border border-hairline bg-surface-raised/70 px-2.5 text-xs font-semibold text-muted hover:text-ink hover:border-ember/40 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Peta Belajar</span>
          </button>

          {/* Level & XP info */}
          <div className="flex items-center gap-2">
            {isCompleted && (
              <span className="inline-flex h-6 items-center rounded-md bg-emerald-500/15 px-2 font-mono text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                ✓ Selesai
              </span>
            )}
            <span className="inline-flex h-6 items-center rounded-md bg-ember/15 px-2 font-mono text-[11px] font-bold text-ember border border-ember/30">
              LEVEL {lesson.level}
            </span>
            <span className="text-micro font-mono text-muted bg-surface-raised px-2 py-0.5 rounded border border-hairline/60">
              +{lesson.xpReward} XP
            </span>
          </div>
        </div>

        {/* Step Progress Tracker Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-micro font-mono text-muted">
            <span className="font-bold text-ember">
              Langkah {currentStep} dari 3:{" "}
              {currentStep === 1
                ? "Konsep Kilat"
                : currentStep === 2
                ? "Misi Tantangan Sandbox"
                : "Kuis Pengunci Ilmu"}
            </span>
            <span>{Math.round((currentStep / 3) * 100)}%</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                currentStep >= 1 ? "bg-ember shadow-[0_0_8px_rgba(255,138,61,0.4)]" : "bg-surface-raised"
              }`}
            />
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                currentStep >= 2 ? "bg-ember shadow-[0_0_8px_rgba(255,138,61,0.4)]" : "bg-surface-raised"
              }`}
            />
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                currentStep >= 3 ? "bg-ember shadow-[0_0_8px_rgba(255,138,61,0.4)]" : "bg-surface-raised"
              }`}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: KONSEP KILAT & BEDAH KATA KUNCI                                   */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="surface-card rounded-2xl border border-hairline/80 p-4 sm:p-5 space-y-4 shadow-xs animate-fadeIn">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-micro font-mono text-muted uppercase tracking-wider">{lesson.topic}</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-ink">{lesson.title}</h2>
          </div>

          {/* Analogy Card */}
          <div className="rounded-xl border border-ember/30 bg-gradient-to-br from-ember/15 via-ember/5 to-transparent p-4 relative overflow-hidden">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">💡</span>
              <div className="space-y-1 text-xs sm:text-[13px] leading-relaxed text-ink/90">
                <span className="font-display font-bold text-ember block mb-0.5">Analogi Bahasa Manusia:</span>
                <p>{lesson.analogy}</p>
              </div>
            </div>
          </div>

          {/* Code Breakdown Box */}
          <div className="space-y-2">
            <span className="text-micro font-bold uppercase tracking-wider text-muted font-mono block">
              Struktur Kode Contoh:
            </span>
            <div className="rounded-xl border border-hairline bg-obsidian/95 p-3.5 sm:p-4 font-mono text-xs sm:text-[13px] text-ember-lo overflow-x-auto shadow-inner">
              <pre className="whitespace-pre-wrap leading-relaxed">
                {lesson.codeSnippet.replace(/___/g, "[...isi nilai...]")}
              </pre>
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-xl border border-hairline/60 bg-surface-raised/50 p-3 flex items-start gap-2.5">
            <span className="text-sm shrink-0">🎯</span>
            <div className="text-xs leading-relaxed text-muted">
              <strong className="text-ink font-medium">Tips Cepat:</strong> {lesson.hint}
            </div>
          </div>

          {/* Forward Action */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="flex h-9 items-center justify-center gap-2 rounded-xl bg-ember px-6 font-display text-xs font-bold text-obsidian transition-all hover:bg-ember-lo active:scale-95 shadow-md shadow-ember/20 w-full sm:w-auto"
            >
              <span>Lanjut ke Praktek Live</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: PRAKTEK LIVE & VALIDASI OTOMATIS                                  */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="surface-card rounded-2xl border border-hairline/80 p-4 sm:p-5 space-y-4 shadow-xs animate-fadeIn">
          {/* Mission Target Objective */}
          <div className="rounded-xl border border-ember/40 bg-ember/10 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 font-display text-xs font-bold text-ember">
              <span>🎯 Target Misi:</span>
            </div>
            <p className="text-xs sm:text-[13px] text-ink/90 leading-relaxed font-medium">
              {challenge.objective}
            </p>
          </div>

          {/* Code Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-micro font-mono text-muted/80">Editor JavaScript</span>
              <button
                type="button"
                onClick={() => {
                  setUserCode(challenge.starterCode);
                  setSandboxResult(null);
                  setValidationResult(null);
                }}
                className="text-[10px] font-mono text-muted hover:text-ink underline"
              >
                Reset Kode
              </button>
            </div>
            <div className="relative rounded-xl border border-hairline bg-obsidian p-3 font-mono text-xs shadow-inner">
              <textarea
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                rows={7}
                spellCheck={false}
                className="w-full resize-y bg-transparent font-mono text-xs sm:text-[13px] text-ember-lo focus:outline-none leading-relaxed selection:bg-ember/30"
              />
            </div>
          </div>

          {/* Run and Validate Action */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunAndValidate}
              className="flex h-9 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 font-display text-xs font-bold text-obsidian transition-all hover:brightness-110 active:scale-95 shadow-md shadow-emerald-500/20"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Jalankan &amp; Validasi Kode ▶</span>
            </button>
          </div>

          {/* Validation Result Alert */}
          {validationResult && (
            <div
              className={`rounded-xl border p-3.5 space-y-1.5 animate-fadeIn ${
                validationResult.isValid
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-orange-500/40 bg-orange-500/10 text-orange-400"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                <span>{validationResult.isValid ? "✅ VALIDASI BERHASIL!" : "⚠️ VALIDASI BELUM TERCAPAI"}</span>
              </div>
              <p className="text-xs text-ink/90 leading-relaxed">{validationResult.message}</p>
              {validationResult.hint && !validationResult.isValid && (
                <p className="text-[11px] text-muted italic">💡 Tips: {validationResult.hint}</p>
              )}
            </div>
          )}

          {/* Terminal Console Log */}
          <div className="rounded-xl border border-hairline bg-surface-raised/80 p-3 space-y-1.5">
            <div className="flex items-center justify-between border-b border-hairline/60 pb-1.5">
              <span className="text-micro font-mono font-bold text-muted uppercase">Terminal Output</span>
              {sandboxResult && (
                <span className="text-[10px] font-mono text-muted/60">{sandboxResult.executionTimeMs}ms</span>
              )}
            </div>

            <div className="min-h-[40px] font-mono text-xs text-emerald-400">
              {sandboxResult ? (
                sandboxResult.logs.length > 0 ? (
                  sandboxResult.logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-muted/40 shrink-0">&gt;</span>
                      <span className="text-ink whitespace-pre-wrap">{log}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted italic">Program sukses jalan tanpa pesan log.</p>
                )
              ) : (
                <p className="text-muted/60 italic">Selesaikan tantangan di atas lalu klik &quot;Jalankan &amp; Validasi Kode ▶&quot;...</p>
              )}
            </div>
          </div>

          {/* Step 2 Navigation */}
          <div className="pt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="h-8.5 px-3 rounded-xl border border-hairline text-xs font-semibold text-muted hover:text-ink transition-colors"
            >
              ← Balik ke Konsep
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              disabled={!validationResult?.isValid}
              className="flex h-9 items-center justify-center gap-2 rounded-xl bg-ember px-5 font-display text-xs font-bold text-obsidian transition-all hover:bg-ember-lo disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-ember/20"
            >
              <span>Lanjut ke Kuis Pemahaman</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: BOSS CHALLENGE & KELULUSAN LEVEL                                  */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="surface-card rounded-2xl border border-hairline/80 p-4 sm:p-5 space-y-4 shadow-xs animate-fadeIn">
          {/* Question Banner */}
          <div className="space-y-2">
            <span className="text-micro font-mono text-ember font-bold block">
              LANGKAH 3: KUIS PENGUNCI ILMU
            </span>
            <p className="text-xs sm:text-[13px] font-medium text-ink/90 leading-relaxed">
              {lesson.question}
            </p>

            {lesson.codeSnippet && (
              <div className="rounded-xl border border-hairline bg-obsidian p-3 font-mono text-xs sm:text-[13px] text-ember-lo overflow-x-auto">
                <pre className="whitespace-pre-wrap leading-relaxed">{lesson.codeSnippet}</pre>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="space-y-2">
            <span className="text-micro font-mono text-muted uppercase tracking-wider block px-1">
              Pilih Jawaban yang Benar:
            </span>
            <div className="grid grid-cols-1 gap-2">
              {lesson.options.map((opt, idx) => {
                const isSelected = selectedOption === opt;
                let btnStyle =
                  "border-hairline bg-surface-raised/60 text-ink/90 hover:border-ember/40 hover:bg-surface-raised";

                if (isQuizChecked) {
                  if (opt === lesson.correctAnswer) {
                    btnStyle =
                      "border-emerald-500 bg-emerald-500/20 text-emerald-400 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)]";
                  } else if (isSelected && !isQuizCorrect) {
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
                      if (!isQuizChecked) setSelectedOption(opt);
                    }}
                    disabled={isQuizChecked && isQuizCorrect}
                    className={`flex min-h-[42px] items-center justify-between rounded-xl border p-3 text-left text-xs sm:text-[13px] transition-all active:scale-[0.99] ${btnStyle}`}
                  >
                    <span className="font-mono">{opt}</span>
                    <span className="text-xs opacity-60">{String.fromCharCode(65 + idx)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quiz Action / Result */}
          {!isQuizChecked ? (
            <div className="pt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="h-8.5 px-3 rounded-xl border border-hairline text-xs font-semibold text-muted hover:text-ink transition-colors"
              >
                ← Balik ke Sandbox
              </button>

              <button
                type="button"
                onClick={handleCheckQuiz}
                disabled={!selectedOption}
                className="flex h-9 items-center justify-center gap-2 rounded-xl bg-ember px-6 font-display text-xs font-bold text-obsidian transition-all hover:bg-ember-lo disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-ember/20"
              >
                <span>Periksa Jawaban</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {isQuizCorrect ? (
                /* VICTORY LEVEL COMPLETE CELEBRATION */
                <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent p-4 sm:p-5 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏆</span>
                      <div>
                        <h3 className="font-display text-sm sm:text-base font-bold text-emerald-400">
                          LEVEL {lesson.level} BERHASIL DITAKLUKKAN!
                        </h3>
                        <p className="text-micro font-mono text-muted">+{lesson.xpReward} XP Didapatkan · Bintang ⭐⭐⭐</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs sm:text-[13px] text-ink/90 leading-relaxed">
                    {lesson.explanation}
                  </p>

                  <div className="pt-2 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={onBackToRoadmap}
                      className="h-8.5 px-3 rounded-xl border border-hairline text-xs font-semibold text-muted hover:text-ink transition-colors w-full sm:w-auto"
                    >
                      🗺️ Balik ke Peta Belajar
                    </button>

                    <button
                      type="button"
                      onClick={onNextLevel}
                      className="flex h-9 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 font-display text-xs font-bold text-obsidian hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all w-full sm:w-auto"
                    >
                      <span>Buka Level Selanjutnya 🚀</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* WRONG ANSWER FEEDBACK */
                <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-2 text-danger font-bold text-xs">
                    <span>❌ Jawaban Belum Tepat!</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Coba ingat kembali analogi di langkah pertama atau buka petunjuk di bawah.
                  </p>

                  {showHint && (
                    <div className="rounded-lg bg-obsidian p-2.5 text-xs text-ember-lo border border-hairline/60">
                      💡 <strong>Petunjuk:</strong> {lesson.hint}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowHint(!showHint)}
                      className="h-8 px-3 rounded-xl border border-hairline text-xs font-semibold text-muted hover:text-ink transition-colors"
                    >
                      {showHint ? "Tutup Petunjuk" : "Lihat Petunjuk 💡"}
                    </button>
                    <button
                      type="button"
                      onClick={handleRetryQuiz}
                      className="flex h-8 items-center justify-center gap-2 rounded-xl bg-surface-raised border border-ember/40 px-4 font-display text-xs font-bold text-ember hover:bg-ember/15 transition-all"
                    >
                      <span>Coba Lagi 🔄</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
