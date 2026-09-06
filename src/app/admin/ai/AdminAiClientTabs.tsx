"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export function AdminAiClientTabs({
  defaultTab = "brain",
  brainView,
  quotaTrackerView,
  totalQuotaRemaining,
  totalCapacity,
}: {
  defaultTab?: "brain" | "tracker";
  brainView: ReactNode;
  quotaTrackerView: ReactNode;
  totalQuotaRemaining?: number;
  totalCapacity?: number;
}) {
  const [activeTab, setActiveTab] = useState<"brain" | "tracker">(defaultTab);

  return (
    <div className="space-y-6">
      {/* ---------- Top Sub-Navigation Tabs ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2 p-1 rounded-xl bg-surface border border-white/[0.06]">
          <button
            type="button"
            onClick={() => setActiveTab("brain")}
            className={`h-9 inline-flex items-center gap-2 rounded-lg px-3.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "brain"
                ? "bg-ember text-obsidian shadow-sm"
                : "text-muted hover:text-ink hover:bg-surface-raised"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>Otak AI & Brain</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tracker")}
            className={`h-9 inline-flex items-center gap-2 rounded-lg px-3.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "tracker"
                ? "bg-emerald-400 text-obsidian shadow-[0_0_12px_rgba(52,211,153,0.3)]"
                : "text-muted hover:text-ink hover:bg-surface-raised"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Quota Tracker & ATM Cuan (4 Akun)</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              activeTab === "tracker"
                ? "bg-obsidian/20 text-obsidian"
                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
            }`}>
              {totalQuotaRemaining !== undefined
                ? `${totalQuotaRemaining.toLocaleString("id-ID")}${totalCapacity ? ` / ${totalCapacity.toLocaleString("id-ID")}` : ""} req`
                : "Live"}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-micro text-muted">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Google Free Tier Pool: Modal Rp 0</span>
        </div>
      </div>

      {/* ---------- Tab Content ---------- */}
      {activeTab === "brain" && (
        <div className="space-y-6 animate-fadeIn">
          {brainView}
        </div>
      )}

      {activeTab === "tracker" && (
        <div className="space-y-6 animate-fadeIn">
          {quotaTrackerView}
        </div>
      )}
    </div>
  );
}
