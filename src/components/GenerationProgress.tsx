"use client";

import React, { useEffect } from "react";
import {
  startStudioProcessing,
  updateStudioChars,
  completeStudioProcessing,
  GlobalStudioProcessingOverlay,
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
  useEffect(() => {
    startStudioProcessing({ moduleKey, label, status });
    return () => {
      // When parent generation completes and unmounts, trigger smooth 100% completion celebration!
      completeStudioProcessing();
    };
  }, [moduleKey, label, status]);

  useEffect(() => {
    if (chars > 0) {
      updateStudioChars(chars);
    }
  }, [chars]);

  return (
    <>
      {/* Portal Overlay into document.body */}
      <GlobalStudioProcessingOverlay />

      {/* Inline indicator when compact */}
      {compact && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-ember/30 bg-ember/10 p-3 text-center"
        >
          <p className="font-display text-xs font-semibold text-ember animate-pulse">
            ⚡ {status || label || "Malesan lagi mikir..."}
          </p>
        </div>
      )}
    </>
  );
}
