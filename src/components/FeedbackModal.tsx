"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { submitFeedbackAction, type FeedbackCategory } from "@/app/actions/feedback";

const emptySubscribe = () => () => {};

const CATEGORIES: { key: FeedbackCategory; label: string; icon: string }[] = [
  { key: "kendala", label: "Lapor Kendala", icon: "🚨" },
  { key: "saran", label: "Usul Fitur", icon: "💡" },
  { key: "pertanyaan", label: "Tanya Sesuatu", icon: "❓" },
  { key: "lainnya", label: "Lainnya", icon: "💬" },
];

export function FeedbackModal() {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("kendala");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFeedbackAction({ category, message });
      setSuccess(true);
      setMessage("");
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
      }, 2500);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Gagal mengirim. Coba lagi ya.";
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-4 py-3 text-xs font-semibold text-muted transition-colors hover:border-ember/40 hover:text-ink w-full"
      >
        <span>💬</span> Ada kendala atau saran buat Malesan?
      </button>

      {open && isClient && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-hairline bg-surface p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-ink">Kirim Feedback ke Founder</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-raised hover:text-ink"
              >
                ✕
              </button>
            </div>

            {success ? (
              <div className="py-8 text-center">
                <span className="text-4xl">🎉</span>
                <p className="mt-3 font-display text-base font-bold text-success">Feedback Lo Udah Diterima!</p>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  Makasih banyak udah bantu Malesan jadi lebih baik. Bakal langsung ditinjau sama founder.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-micro font-bold uppercase tracking-wider text-muted mb-2">
                    Pilih Topik
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setCategory(c.key)}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                          category === c.key
                            ? "border-ember bg-ember/15 text-ember-lo"
                            : "border-hairline bg-surface-raised text-muted hover:border-hairline/90 hover:text-ink"
                        }`}
                      >
                        <span>{c.icon}</span>
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-micro font-bold uppercase tracking-wider text-muted mb-1.5">
                    Pesan / Cerita Lo
                  </label>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={category === "kendala" ? "Jelasin apa yang error atau nyangkut..." : "Tulis ide atau saran fitur yang lo pengenin..."}
                    className="w-full rounded-xl border border-hairline bg-obsidian p-3 text-xs text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none"
                    required
                  />
                </div>

                {error && (
                  <p className="text-micro text-danger font-medium">{error}</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-hairline px-4 py-2.5 text-xs font-semibold text-muted hover:bg-surface-raised"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !message.trim()}
                    className="btn-ember inline-flex items-center rounded-xl px-5 py-2.5 text-xs font-bold text-obsidian disabled:opacity-50"
                  >
                    {submitting ? "Mengirim..." : "Kirim Feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
