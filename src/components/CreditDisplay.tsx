"use client";

import Link from "next/link";

export function CreditDisplay({ credits }: { credits: number }) {
  return (
    <Link
      href="/app/topup"
      title="Beli atau kelola kredit"
      className="flex h-11 sm:h-10 shrink-0 items-center gap-2 rounded-full border border-hairline/80 bg-surface/60 px-3.5 sm:px-4 shadow-xs transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised"
    >
      <span className="size-2 rounded-full bg-ember animate-pulse" />
      <span className="tabular font-mono text-xs sm:text-sm font-bold text-ink">{credits}</span>
      <span className="hidden text-micro font-medium text-muted sm:inline">kredit</span>
    </Link>
  );
}
