"use client";

import React from "react";
import { AIProcessingOverlay } from "./studio/AIProcessingOverlay";

export function GenerationProgress({
  moduleKey,
  chars,
  label,
  status,
  compact = false,
}: {
  moduleKey: string;
  /** Characters received so far. Stays 0 with models that flush in one burst. */
  chars: number;
  /** Module-specific verb, e.g. "Lagi nulis script". */
  label?: string;
  /** A real phase emitted by the server at the point that phase begins. */
  status?: string;
  /** Lean version for a Pipeline card that is already inside a surface. */
  compact?: boolean;
}) {
  return (
    <>
      {/* Immersive Floating AI Workspace Processing Overlay */}
      <AIProcessingOverlay
        busy={true}
        moduleKey={moduleKey}
        chars={chars}
        label={label}
        status={status}
      />

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
