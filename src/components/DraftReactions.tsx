"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Instant audience reactions to whatever is in the draft, sitting under the
 * editor: a simulated netizen comment column and a blunt editor roast. Both hit
 * the Groq-powered /api/react, and both refresh the header afterwards because the
 * call spends a credit — the same balance-sync the video editor needed.
 *
 * `text` is the live draft content, passed down from the editor so the reaction
 * is always about what is on screen right now.
 */

type NetizenComment = {
  username: string;
  persona: string;
  sentiment: "positif" | "netral" | "julid";
  comment: string;
};

type Mode = "netizen" | "roast";

const SENTIMENT_TINT: Record<NetizenComment["sentiment"], string> = {
  positif: "text-success",
  netral: "text-muted",
  julid: "text-danger",
};

export function DraftReactions({ text }: { text: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState("");
  const [comments, setComments] = useState<NetizenComment[] | null>(null);
  const [roast, setRoast] = useState<string | null>(null);

  const canRun = text.trim().length > 0;

  const run = async (kind: Mode) => {
    if (!canRun || busy) return;
    setBusy(kind);
    setError("");
    if (kind === "netizen") setComments(null);
    else setRoast(null);

    try {
      const res = await fetch("/api/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, text }),
      });
      const data = (await res.json().catch(() => null)) as
        | { comments?: NetizenComment[]; roast?: string; error?: string }
        | null;

      if (!res.ok) {
        setError(data?.error ?? "Gagal manggil AI. Coba lagi bentar.");
        return;
      }

      if (kind === "netizen") setComments(data?.comments ?? []);
      else setRoast(data?.roast ?? "");
      // A credit just came off — sync the header without a manual reload.
      router.refresh();
    } catch {
      setError("Koneksi bermasalah. Coba lagi ya.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="surface-card mt-4 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold tracking-display-sm text-ink">
            Tes dulu sebelum posting
          </h3>
          <p className="mt-0.5 text-mini text-muted">
            Lempar draft lo ke penonton bohongan. Reaksinya instan.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => void run("netizen")}
          disabled={!canRun || busy !== null}
          className="h-8.5 sm:h-9 cursor-pointer rounded-lg border border-ember/45 bg-ember/10 px-3.5 text-xs font-semibold text-ember transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember hover:bg-ember/15 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
        >
          {busy === "netizen" ? "Ngumpulin komentar..." : "Simulasi netizen"}
        </button>
        <button
          onClick={() => void run("roast")}
          disabled={!canRun || busy !== null}
          className="h-8.5 sm:h-9 cursor-pointer rounded-lg border border-hairline bg-surface/60 px-3.5 text-xs font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-danger/45 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
        >
          {busy === "roast" ? "Lagi diroasting..." : "Roast draft gue 🔥"}
        </button>
      </div>

      {!canRun && (
        <p className="mt-2 text-micro text-muted">Tulis dulu drafnya, baru bisa dites.</p>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {roast && (
        <div className="mt-4 rounded-xl border border-danger/25 bg-danger/5 p-4">
          <p className="eyebrow mb-1.5 text-danger">Kata editor galak</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{roast}</p>
        </div>
      )}

      {comments && (
        <div className="mt-4 space-y-2.5">
          <p className="eyebrow text-muted">Kolom komentar (simulasi)</p>
          {comments.length === 0 ? (
            <p className="text-sm text-muted">Netizennya lagi diem. Coba lagi.</p>
          ) : (
            <ul className="space-y-2.5">
              {comments.map((c, i) => (
                <li key={i} className="rounded-xl border border-hairline bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ember/15 font-display text-mini font-bold text-ember">
                      {(c.username?.[0] ?? "?").toUpperCase()}
                    </span>
                    <span className="truncate text-mini font-semibold text-ink">
                      @{c.username || "netizen"}
                    </span>
                    <span
                      className={`ml-auto shrink-0 text-micro font-semibold capitalize ${SENTIMENT_TINT[c.sentiment] ?? "text-muted"}`}
                    >
                      {c.persona || c.sentiment}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink">{c.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
