"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rateGeneration, deleteGeneration } from "@/app/actions/pipeline";

/**
 * Generation history.
 *
 * Every generation has been persisted to `generations` since the first module
 * shipped and no screen ever listed them, so yesterday's work was gone the
 * moment the tab changed. People were paying credits to regenerate things they
 * already had.
 *
 * Rating lives here rather than only on posted pipeline cards. Ratings are what
 * feed `LearnedNote[]` into the prompt, and gating them behind
 * "save → post → rate" meant almost nothing was ever rated — the feedback loop
 * had no data to run on. Two taps from history is the difference.
 */

export type HistoryItem = {
  id: string;
  module: string;
  created_at: string;
  credits_spent: number;
  performance_rating: number | null;
  gist: string;
};

const MODULE_LABEL: Record<string, string> = {
  ide_hari_ini: "Ide Hari Ini",
  idea: "Matengin Ide",
  hook: "Bikin Hook",
  script: "Bikin Script",
  repurpose: "Ubah Format",
  vibe_kit: "Bikin App",
};

export function HistoryList({ items }: { items: HistoryItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [local, setLocal] = useState<Record<string, number>>({});
  const [confirmDel, setConfirmDel] = useState("");

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-hairline px-4 py-8 text-center">
        <p className="text-sm text-muted">
          Belum ada riwayat. Semua yang Malesan bikinin bakal kesimpen di sini.
        </p>
      </div>
    );
  }

  const remove = async (id: string) => {
    setBusy(id);
    try {
      await deleteGeneration(id);
      router.refresh();
    } catch {
      /* the row stays; a failed delete is not worth an alert */
    } finally {
      setBusy("");
      setConfirmDel("");
    }
  };

  const rate = async (id: string, score: number) => {
    setBusy(id);
    setLocal((p) => ({ ...p, [id]: score }));
    try {
      await rateGeneration(id, score);
      router.refresh();
    } catch {
      setLocal((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const rating = local[it.id] ?? it.performance_rating ?? 0;
        return (
          <div key={it.id} className="surface-card rounded-xl p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow text-ember">{MODULE_LABEL[it.module] ?? it.module}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink">{it.gist}</p>
              </div>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-micro text-muted">
                  {new Date(it.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="eyebrow text-muted">{it.credits_spent} kredit</span>
              </span>
            </div>

            {confirmDel === it.id ? (
              <div className="mt-2.5 border-t border-hairline pt-2.5">
                <p className="text-micro leading-relaxed text-ink">
                  Hapus dari riwayat? Malesan juga berhenti belajar dari yang ini.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setConfirmDel("")}
                    className="flex-1 cursor-pointer rounded-lg border border-hairline py-2 text-micro font-semibold text-muted hover:text-ink"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => remove(it.id)}
                    disabled={busy === it.id}
                    className="flex-1 cursor-pointer rounded-lg bg-danger py-2 text-micro font-bold text-obsidian disabled:opacity-50"
                  >
                    {busy === it.id ? "..." : "Hapus"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 flex items-center gap-2 border-t border-hairline pt-2.5">
                <span className="min-w-0 flex-1 text-micro text-muted">
                  {rating ? "Rating lo" : "Perform-nya gimana?"}
                </span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => rate(it.id, s)}
                      disabled={busy === it.id}
                      aria-label={`Kasih ${s} bintang`}
                      className={`cursor-pointer text-base leading-none transition-colors disabled:opacity-50 ${
                        s <= rating ? "text-ember" : "text-muted hover:text-ink"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
                        <path d="m12 2.7 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.7Z" />
                      </svg>
                    </button>
                  ))}
                </div>
                {/* History was read-only, so a bad result sat there forever and
                    the list became clutter nobody could clear. */}
                <button
                  onClick={() => setConfirmDel(it.id)}
                  aria-label="Hapus dari riwayat"
                  title="Hapus"
                  className="ml-1 shrink-0 cursor-pointer text-muted/50 transition-colors hover:text-danger"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
                    <path d="M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-1 12H7L6 9Z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Nobody can guess what a star does. Spelled out, because an unexplained
          rating control is just clutter — and these ratings are the only way the
          model learns what works for this specific creator. */}
      <div className="mt-1 rounded-xl border border-ember/20 bg-ember/5 p-3.5">
        <p className="text-mini font-semibold text-ember-lo">
          Kasih bintang = hasil berikutnya makin nyambung
        </p>
        <p className="mt-1 text-micro leading-relaxed text-muted">
          Tiap hasil yang lo kasih bintang beneran dibaca ulang pas bikin konten
          berikutnya. Yang lo kasih <span className="text-ink">4–5</span> dipakai
          jadi contoh pola yang cocok buat lo. Yang lo kasih{" "}
          <span className="text-ink">1–2</span> dipakai buat tau pola apa yang
          harus dihindarin.
          <br />
          <br />
          Makin sering lo rating, makin nyambung hasilnya. Kalau nggak dirating
          sama sekali, Malesan harus nebak dari nol terus tiap kali.
        </p>
      </div>
    </div>
  );
}
