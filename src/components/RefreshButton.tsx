"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresh.
 *
 * An installed PWA has no browser chrome, so a stale screen had no way out
 * short of closing the app. `router.refresh()` re-runs the server components
 * and pulls fresh credits, pipeline state and config without a full reload.
 *
 * The icon spins for a beat even when the refresh returns instantly — a control
 * that appears to do nothing reads as broken, and people press it again.
 */
export function RefreshButton({ label }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [spinning, setSpinning] = useState(false);

  const go = () => {
    setSpinning(true);
    startTransition(() => router.refresh());
    setTimeout(() => setSpinning(false), 600);
  };

  const busy = pending || spinning;

  return (
    <button
      onClick={go}
      disabled={busy}
      aria-label="Muat ulang"
      title="Muat ulang"
      className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/35 hover:text-ember-lo disabled:opacity-70"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`size-4 fill-current ${busy ? "animate-spin" : ""}`}
      >
        <path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z" />
      </svg>
      {label ?? "Refresh"}
    </button>
  );
}
