"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { submitFeedbackAction, type FeedbackCategory } from "@/app/actions/feedback";

const emptySubscribe = () => () => {};

interface CategoryItem {
  key: FeedbackCategory;
  label: string;
  icon: (className?: string) => React.ReactNode;
}

const CATEGORIES: CategoryItem[] = [
  {
    key: "kendala",
    label: "Lapor Kendala",
    icon: (className = "size-4 text-danger") => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    key: "saran",
    label: "Usul Fitur",
    icon: (className = "size-4 text-amber-400") => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </svg>
    ),
  },
  {
    key: "pertanyaan",
    label: "Tanya Sesuatu",
    icon: (className = "size-4 text-sky-400") => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    key: "lainnya",
    label: "Lainnya",
    icon: (className = "size-4 text-muted") => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
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
        className="group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border border-ember/25 bg-gradient-to-r from-surface to-surface-raised p-4 text-left transition-all duration-200 hover:border-ember/50 hover:shadow-xs active:scale-[0.99] cursor-pointer"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-ember/30 bg-ember/15 text-ember shadow-xs transition-transform duration-200 group-hover:scale-105">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M12 7v2" />
              <path d="M12 13h.01" />
            </svg>
          </div>
          <div>
            <p className="font-display text-xs sm:text-sm font-bold text-ink group-hover:text-ember transition-colors">
              Punya saran atau ada kendala?
            </p>
            <p className="mt-0.5 text-micro sm:text-xs text-muted">
              Kirim masukan langsung ke founder Malesan
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/[0.08] bg-obsidian/60 px-3 py-1 text-micro font-semibold text-ember group-hover:border-ember/40">
          <span>Kirim</span>
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </div>
      </button>

      {open && isClient && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-hairline bg-surface p-5 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-ink">Kirim Feedback ke Founder</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-raised hover:text-ink cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {success ? (
              <div className="py-8 text-center space-y-3">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/20 border border-success/40 text-success">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="font-display text-base font-bold text-success">Feedback Lo Udah Diterima!</p>
                <p className="text-xs text-muted leading-relaxed max-w-xs mx-auto">
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
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all cursor-pointer ${
                          category === c.key
                            ? "border-ember bg-ember/15 text-ember-lo"
                            : "border-hairline bg-surface-raised text-muted hover:border-hairline/90 hover:text-ink"
                        }`}
                      >
                        <span>{c.icon("size-4 shrink-0")}</span>
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
                    className="w-full rounded-xl border border-hairline bg-obsidian p-3 text-xs text-ink placeholder:text-muted/60 focus:border-ember focus:outline-hidden"
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
                    className="rounded-xl border border-hairline px-4 py-2.5 text-xs font-semibold text-muted hover:bg-surface-raised cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !message.trim()}
                    className="btn-ember inline-flex items-center rounded-xl px-5 py-2.5 text-xs font-bold text-obsidian disabled:opacity-50 cursor-pointer"
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
