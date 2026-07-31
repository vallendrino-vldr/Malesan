"use client";

import { useState } from "react";

/**
 * A value you are meant to copy, with a button that actually copies it.
 *
 * The profile page rendered the referral link in a `<code>` with a comment
 * saying a copy button would need a client component "in a real app" — so the
 * one thing the user is supposed to do with a referral link, they could not do.
 * A long URL in a flex row also overflowed its container on a phone.
 */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (insecure context, or denied). The value is on screen
      // and selectable, so say so instead of failing silently.
      setCopied(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-obsidian p-3">
      {label && <p className="eyebrow mb-1.5 text-muted">{label}</p>}
      <div className="flex items-center gap-2">
        {/* `break-all` and `min-w-0`: without them a long link pushes the button
            off the edge of a 360px screen. */}
        <code className="min-w-0 flex-1 break-all font-mono text-mini leading-relaxed text-ember-lo">
          {value}
        </code>
        <button
          onClick={copy}
          aria-label={`Salin ${label ?? "nilai"}`}
          className="shrink-0 cursor-pointer rounded-lg border border-hairline bg-surface px-3 py-2 text-micro font-bold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember"
        >
          {copied ? "Kesalin!" : "Salin"}
        </button>
      </div>
    </div>
  );
}
