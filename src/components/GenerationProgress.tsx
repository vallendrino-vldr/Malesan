"use client";

import React, { useEffect, useRef } from "react";
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
  const isStartedRef = useRef(false);

  useEffect(() => {
    if (!isStartedRef.current) {
      isStartedRef.current = true;
      startStudioProcessing({ moduleKey, label, status });
    }
    return () => {
      // When parent generation completes and unmounts, trigger smooth 100% completion sequence!
      completeStudioProcessing();
    };
  }, [moduleKey, label, status]);

  // Update dynamic status without re-triggering startStudioProcessing / reset
  useEffect(() => {
    if (status) {
      updateStudioStatus(status);
    }
  }, [status]);

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
        <p className="font-display text-xs font-semibold text-ember animate-pulse">
          ⚡ {status || label || "Malesan lagi mikir..."}
        </p>
      </div>
    );
  }

  return null;
}
