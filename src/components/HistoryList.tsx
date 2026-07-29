"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rateGeneration } from "@/app/actions/pipeline";

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
  idea: "Idea Engine",
  hook: "Hook Lab",
  script: "Script Builder",
  repurpose: "Repurpose",
  vibe_kit: "Vibe Kit",
};

export function HistoryList({ items }: { items: HistoryItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [local, setLocal] = useState<Record<string, number>>({});

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-hairline px-4 py-8 text-center">
        <p className="text-sm text-muted">
          Belum ada riwayat. Semua yang lo generate bakal kesimpen di sini.
        </p>
      </div>
    );
  }

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
                <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink">{it.gist}</p>
              </div>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-[11px] text-muted">
                  {new Date(it.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="eyebrow text-muted">{it.credits_spent} kredit</span>
              </span>
            </div>

            <div className="mt-2.5 flex items-center gap-2 border-t border-hairline pt-2.5">
              <span className="text-[11px] text-muted">
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
                      s <= rating ? "text-ember" : "text-muted/30 hover:text-muted"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      <p className="px-1 pt-1 text-[11px] leading-relaxed text-muted">
        Rating lo kepake beneran — yang bagus jadi contoh, yang jelek dihindarin
        pas bikin konten berikutnya.
      </p>
    </div>
  );
}
