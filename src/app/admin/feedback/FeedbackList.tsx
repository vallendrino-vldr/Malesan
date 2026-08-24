"use client";

import { useState } from "react";
import { updateFeedbackStatusAction, type FeedbackStatus } from "@/app/actions/feedback";

export type FeedbackItem = {
  id: string;
  user_id: string;
  category: "kendala" | "saran" | "pertanyaan" | "lainnya";
  message: string;
  status: FeedbackStatus;
  admin_notes: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
};

const STATUS_BADGES: Record<FeedbackStatus, { label: string; bg: string; text: string; border: string }> = {
  baru: { label: "Baru", bg: "bg-ember/10", text: "text-ember", border: "border-ember/30" },
  ditinjau: { label: "Ditinjau", bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/30" },
  diproses: { label: "Diproses", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  selesai: { label: "Selesai", bg: "bg-success/10", text: "text-success", border: "border-success/30" },
};

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  kendala: {
    label: "Kendala",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-danger">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  saran: {
    label: "Saran",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-amber-400">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7Z" />
      </svg>
    ),
  },
  pertanyaan: {
    label: "Tanya",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-sky-400">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  lainnya: {
    label: "Lainnya",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-muted">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
};

export function FeedbackList({ initialItems }: { initialItems: FeedbackItem[] }) {
  const [items, setItems] = useState<FeedbackItem[]>(initialItems);
  const [filter, setFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = items.filter((x) => (filter === "all" ? true : x.status === filter));

  const handleStatusChange = async (id: string, newStatus: FeedbackStatus) => {
    setUpdatingId(id);
    setErrorMsg(null);
    try {
      await updateFeedbackStatusAction({ id, status: newStatus });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Gagal update status feedback");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveNote = async (id: string) => {
    const note = noteDrafts[id];
    if (typeof note === "undefined") return;
    setUpdatingId(id);
    setErrorMsg(null);
    try {
      const current = items.find((x) => x.id === id);
      if (!current) return;
      await updateFeedbackStatusAction({ id, status: current.status, admin_notes: note });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, admin_notes: note } : item))
      );
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Gagal simpan catatan");
    } finally {
      setUpdatingId(null);
    }
  };

  const counts = {
    all: items.length,
    baru: items.filter((x) => x.status === "baru").length,
    ditinjau: items.filter((x) => x.status === "ditinjau").length,
    diproses: items.filter((x) => x.status === "diproses").length,
    selesai: items.filter((x) => x.status === "selesai").length,
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs — Single-line horizontally scrollable rail on mobile */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
        {(["all", "baru", "ditinjau", "diproses", "selesai"] as const).map((tabKey) => {
          const label = tabKey === "all" ? "Semua" : STATUS_BADGES[tabKey]?.label;
          const count = counts[tabKey];
          const active = filter === tabKey;
          return (
            <button
              key={tabKey}
              type="button"
              onClick={() => setFilter(tabKey)}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                active
                  ? "border-ember bg-ember/15 text-ember-lo shadow-sm"
                  : "border-hairline bg-surface text-muted hover:border-hairline/90 hover:text-ink"
              }`}
            >
              <span>{label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  active ? "bg-ember text-obsidian font-bold" : "bg-surface-raised text-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          {errorMsg}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface p-8 text-center">
          <p className="text-sm text-muted">Belum ada feedback dalam kategori ini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const badge = STATUS_BADGES[item.status] ?? STATUS_BADGES.baru;
            const cat = CATEGORY_LABELS[item.category] ?? { label: item.category, icon: "💬" };
            const isUpdating = updatingId === item.id;
            return (
              <div
                key={item.id}
                className="surface-card rounded-2xl border border-hairline p-5 transition-all hover:border-hairline/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg bg-surface-raised border border-hairline text-xs">
                      {cat.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-ink">{item.user_name}</span>
                        <span className="text-micro text-muted font-mono">{item.user_email}</span>
                      </div>
                      <span className="text-[11px] text-muted">
                        {new Date(item.created_at).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        WIB
                      </span>
                    </div>
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-micro font-semibold ${badge.bg} ${badge.text} ${badge.border}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <div className="mt-3 rounded-xl border border-hairline bg-obsidian p-3.5 text-xs leading-relaxed text-ink/90 whitespace-pre-wrap font-sans">
                  {item.message}
                </div>

                {/* Status action buttons */}
                <div className="mt-4 flex flex-col gap-3 pt-2 border-t border-hairline sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-micro font-semibold text-muted mr-1">Ubah Status:</span>
                    {(["baru", "ditinjau", "diproses", "selesai"] as FeedbackStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={isUpdating || item.status === st}
                        onClick={() => handleStatusChange(item.id, st)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                          item.status === st
                            ? "border-transparent bg-surface-raised text-muted/40 cursor-default"
                            : "border-hairline bg-surface text-muted hover:border-ember/40 hover:text-ink"
                        }`}
                      >
                        {STATUS_BADGES[st].label}
                      </button>
                    ))}
                  </div>

                  {/* Admin notes input */}
                  <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[240px]">
                    <input
                      type="text"
                      placeholder="Catatan admin (opsional)..."
                      defaultValue={item.admin_notes ?? ""}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="flex-1 rounded-lg border border-hairline bg-obsidian px-2.5 py-1 text-[11px] text-ink placeholder:text-muted/50 focus:border-ember focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleSaveNote(item.id)}
                      className="shrink-0 rounded-lg border border-hairline bg-surface-raised px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-ember/40"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
