"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  startStudioProcessing,
  updateStudioChars,
  updateStudioStatus,
  completeStudioProcessing,
} from "./studio/AIProcessingOverlay";

export function GenerationProgress({
  moduleKey,
  chars,
  label,
  status,
  compact = false,
}: {
  moduleKey: string;
  chars: number;
  label?: string;
  status?: string;
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const isEn = language === "en";
  const isStartedRef = useRef(false);

  // Trigger startStudioProcessing on mount ONLY and trigger completion sequence on unmount
  useEffect(() => {
    if (!isStartedRef.current) {
      isStartedRef.current = true;
      startStudioProcessing({ moduleKey, label, status });
    }
    return () => {
      // When parent generation completes and unmounts, trigger smooth 100% completion sequence
      completeStudioProcessing();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  // Update dynamic status without re-triggering start/unmount lifecycle
  useEffect(() => {
    if (status) {
      updateStudioStatus(status);
    }
  }, [status]);

  // Update streamed chars count
  useEffect(() => {
    if (chars > 0) {
      updateStudioChars(chars);
    }
  }, [chars]);

  // If compact inline status indicator is requested
  if (compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-ember/30 bg-ember/10 p-3 text-center"
      >
        <p className="font-display text-xs font-semibold text-ember animate-pulse flex items-center justify-center gap-1.5">
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 text-ember shrink-0">
            <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span>{status || label || (isEn ? "Malesan is thinking..." : "Malesan lagi mikir...")}</span>
        </p>
      </div>
    );
  }

  return null;
}
