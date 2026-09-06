"use client";

import React, { useState } from "react";
import { runJavaScriptSandbox, SandboxResult } from "@/lib/code-sandbox";
import { LessonItem } from "./StepLearnView";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface Props {
  lesson: LessonItem;
  onNextStep: () => void;
  onPrevStep: () => void;
}

export default function StepSandboxView({ lesson, onNextStep, onPrevStep }: Props) {
  const { language, dict } = useLanguage();
  const isEn = language === "en";

  // Pre-fill starter code replacing ___ with the correct answer so it runs immediately
  const defaultStarterCode = lesson.codeSnippet.includes("___")
    ? lesson.codeSnippet.replace(/___/g, lesson.correctAnswer)
    : lesson.codeSnippet;

  const [userCode, setUserCode] = useState(defaultStarterCode);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const handleRunCode = () => {
    const res = runJavaScriptSandbox(userCode, language);
    setResult(res);
    setHasRun(true);
  };

  const handleResetCode = () => {
    setUserCode(defaultStarterCode);
    setResult(null);
    setHasRun(false);
  };

  return (
    <div className="surface-card rounded-2xl border border-hairline/80 p-4 sm:p-5 space-y-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-micro font-mono text-ember font-bold">{dict.vibe.step2Tab}</span>
          <h3 className="font-display text-sm sm:text-base font-bold text-ink">
            {dict.vibe.sandboxTitle}
          </h3>
        </div>
        <button
          type="button"
          onClick={handleResetCode}
          className="text-micro font-mono text-muted hover:text-ink underline transition-colors"
        >
          {dict.vibe.resetCode}
        </button>
      </div>

      <p className="text-xs text-muted leading-relaxed">
        {dict.vibe.sandboxDesc}
      </p>

      {/* Interactive Code Editor */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-micro font-mono text-muted/80">
            {isEn ? "JavaScript Editor" : "Editor JavaScript"}
          </span>
          <span className="text-[10px] font-mono text-muted/60">
            {isEn ? "Editable in real-time" : "Bisa lo edit langsung"}
          </span>
        </div>
        <div className="relative rounded-xl border border-hairline bg-obsidian p-3 font-mono text-xs shadow-inner">
          <textarea
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full resize-y bg-transparent font-mono text-xs sm:text-[13px] text-ember-lo focus:outline-none leading-relaxed selection:bg-ember/30"
          />
        </div>
      </div>

      {/* Run Action Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleRunCode}
          className="flex h-9 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 font-display text-xs font-bold text-obsidian transition-all hover:brightness-110 active:scale-95 shadow-md shadow-emerald-500/20"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span>{dict.vibe.runCode}</span>
        </button>
      </div>

      {/* Terminal Output Screen */}
      <div className="rounded-xl border border-hairline bg-surface-raised/80 p-3.5 space-y-2">
        <div className="flex items-center justify-between border-b border-hairline/60 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-micro font-mono font-bold text-muted uppercase">
              {dict.vibe.terminalOutput}
            </span>
          </div>
          {result && (
            <span className="text-[10px] font-mono text-muted/60">
              {result.executionTimeMs}ms
            </span>
          )}
        </div>

        <div className="min-h-[60px] font-mono text-xs leading-relaxed">
          {!hasRun && (
            <p className="text-muted/60 italic">
              {dict.vibe.terminalEmpty}
            </p>
          )}

          {hasRun && result?.error && (
            <div className="rounded-lg bg-danger/10 border border-danger/30 p-2.5 text-danger space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>{isEn ? "Syntax / Execution Error:" : "Syntax / Execution Error:"}</span>
              </div>
              <p className="text-xs">{result.error}</p>
              <p className="text-[11px] text-danger/80 italic">
                {isEn ? "Check quotes, parentheses, or possible typo in variable names." : "Cek lagi tanda kurung, tanda petik, atau nama variabel yang mungkin typo."}
              </p>
            </div>
          )}

          {hasRun && !result?.error && (
            <div className="space-y-1 text-emerald-400">
              {result?.logs && result.logs.length > 0 ? (
                result.logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-muted/40 shrink-0">&gt;</span>
                    <span className="text-ink font-mono whitespace-pre-wrap">{log}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted italic">
                  {isEn ? "Program executed successfully without log messages." : "Program sukses jalan tanpa ada pesan log."}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="pt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevStep}
          className="h-8.5 px-3 rounded-xl border border-hairline text-xs font-semibold text-muted hover:text-ink transition-colors"
        >
          {isEn ? "← Back to Concept" : "← Balik ke Materi"}
        </button>

        <button
          type="button"
          onClick={onNextStep}
          className="flex h-9 items-center justify-center gap-2 rounded-xl bg-ember px-5 font-display text-xs font-bold text-obsidian transition-all hover:bg-ember-lo active:scale-95 shadow-md shadow-ember/20"
        >
          <span>{dict.vibe.continueToQuiz}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
