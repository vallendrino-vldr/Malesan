"use client";

export function CreditDisplay({ credits }: { credits: number }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5">
      <div className="h-2 w-2 rounded-full bg-ember"></div>
      <span className="tabular font-mono text-sm text-ink">{credits}</span>
    </div>
  );
}
