"use client";

import { useState } from "react";

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c0e] p-3.5 shadow-inner transition-all hover:border-ember/30">
      {label && <p className="mb-1.5 text-xs font-semibold text-muted">{label}</p>}
      <div className="flex items-center gap-2.5">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-ember selection:bg-ember/20 selection:text-white">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Salin ${label ?? "nilai"}`}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl border h-11 sm:h-auto px-3.5 sm:py-2 font-display text-xs font-bold transition-all cursor-pointer ${
            copied
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
              : "border-ember/40 bg-ember/10 text-ember hover:border-ember hover:bg-ember/20 active:scale-[0.98]"
          }`}
        >
          {copied ? (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Tersalin!</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              <span>Salin Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
