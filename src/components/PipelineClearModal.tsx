"use client";

import { useState } from "react";
import { clearPipelineCards } from "@/app/actions/pipeline";

interface PipelineClearModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalCards: number;
  weekCardsCount: number;
  startDate: string;
  endDate: string;
  onCleared: () => void;
}

export function PipelineClearModal({
  isOpen,
  onClose,
  totalCards,
  weekCardsCount,
  startDate,
  endDate,
  onCleared,
}: PipelineClearModalProps) {
  const [selectedScope, setSelectedScope] = useState<"week" | "all" | "unscheduled">("week");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleExecuteClear = async () => {
    setIsDeleting(true);
    setError("");
    try {
      if (selectedScope === "week") {
        await clearPipelineCards({
          scope: "week",
          startDate,
          endDate,
        });
      } else if (selectedScope === "unscheduled") {
        await clearPipelineCards({
          scope: "unscheduled",
        });
      } else {
        await clearPipelineCards({
          scope: "all",
        });
      }
      onCleared();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus kartu.");
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const countForScope =
    selectedScope === "week"
      ? weekCardsCount
      : selectedScope === "unscheduled"
        ? Math.max(0, totalCards - weekCardsCount)
        : totalCards;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-obsidian/80 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-hairline bg-surface p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-hairline/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-danger/15 text-danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </div>
            <h3 id="clear-modal-title" className="font-display text-sm font-bold text-ink">
              Bersihkan Alur Kerja
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {!showConfirm ? (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-muted">
              Pilih ruang lingkup kartu yang ingin lo kosongkan atau reset:
            </p>

            <div className="space-y-2">
              {/* Option 1: Week only */}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  selectedScope === "week"
                    ? "border-ember/40 bg-ember/10"
                    : "border-hairline bg-surface-raised hover:border-ink/20"
                }`}
              >
                <input
                  type="radio"
                  name="clear-scope"
                  checked={selectedScope === "week"}
                  onChange={() => setSelectedScope("week")}
                  className="mt-0.5 accent-ember"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xs font-semibold text-ink">
                      Jadwal Minggu Ini Saja
                    </span>
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold text-muted">
                      {weekCardsCount} kartu
                    </span>
                  </div>
                  <p className="mt-0.5 text-micro text-muted">
                    Hanya hapus kartu yang dijadwalkan pada minggu aktif saat ini ({startDate} s/d {endDate}).
                  </p>
                </div>
              </label>

              {/* Option 2: All cards */}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  selectedScope === "all"
                    ? "border-ember/40 bg-ember/10"
                    : "border-hairline bg-surface-raised hover:border-ink/20"
                }`}
              >
                <input
                  type="radio"
                  name="clear-scope"
                  checked={selectedScope === "all"}
                  onChange={() => setSelectedScope("all")}
                  className="mt-0.5 accent-ember"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xs font-semibold text-ink">
                      Semua Konten di Alur
                    </span>
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold text-muted">
                      {totalCards} kartu
                    </span>
                  </div>
                  <p className="mt-0.5 text-micro text-muted">
                    Kosongkan seluruh kartu dari semua kolom (Ide, Draft, Siap, dan Tayang).
                  </p>
                </div>
              </label>

              {/* Option 3: Unscheduled only */}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  selectedScope === "unscheduled"
                    ? "border-ember/40 bg-ember/10"
                    : "border-hairline bg-surface-raised hover:border-ink/20"
                }`}
              >
                <input
                  type="radio"
                  name="clear-scope"
                  checked={selectedScope === "unscheduled"}
                  onChange={() => setSelectedScope("unscheduled")}
                  className="mt-0.5 accent-ember"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xs font-semibold text-ink">
                      Ide Belum Terjadwal Saja
                    </span>
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold text-muted">
                      {Math.max(0, totalCards - weekCardsCount)} kartu
                    </span>
                  </div>
                  <p className="mt-0.5 text-micro text-muted">
                    Hanya hapus kartu yang belum memiliki tanggal di kalender.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-hairline/60 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-hairline px-3.5 py-2 text-xs font-semibold text-muted transition-colors hover:text-ink"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={countForScope === 0}
                className="rounded-lg bg-danger px-4 py-2 font-display text-xs font-bold text-obsidian transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Lanjut Hapus ({countForScope})
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
              <p className="font-semibold">Konfirmasi Penghapusan</p>
              <p className="mt-1 text-micro leading-relaxed text-danger/90">
                Lo akan menghapus <strong>{countForScope} kartu</strong>. Tindakan ini permanen dan tidak dapat dibatalkan.
              </p>
            </div>

            {error && (
              <p className="text-micro font-medium text-danger">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-hairline/60 pt-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg border border-hairline px-3.5 py-2 text-xs font-semibold text-muted transition-colors hover:text-ink"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleExecuteClear}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-lg bg-danger px-4 py-2 font-display text-xs font-bold text-obsidian transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus Sekarang"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
