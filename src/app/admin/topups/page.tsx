"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { approveTopup, rejectTopup, signedProofUrl } from "@/app/actions/admin";
import { LiveRefresh } from "@/components/LiveRefresh";
import type { ProofVerdict } from "@/lib/supabase/database.types";

/**
 * Top-up approval.
 *
 * Two things were broken here at once.
 *
 * The proof image was rendered straight from `proof_url`, a public storage URL.
 * That bucket was made private during the schema repair — the files are bank
 * transfer screenshots showing account numbers — so the image has been failing
 * to load ever since. The admin was approving payments against a broken
 * placeholder. Proofs now load through a 5-minute signed URL, fetched only when
 * you ask to see one.
 *
 * Rejection went through `prompt()`, which is unstyleable and blocked outright
 * in some mobile contexts, so on a phone the reject path could simply not be
 * completed. It is an inline field now.
 *
 * And the queue itself was empty no matter how many payments were waiting.
 * `topups` has two foreign keys into `profiles` — `user_id` and `reviewed_by` —
 * so `profiles(email)` is ambiguous and PostgREST refuses it outright with a 300
 * and PGRST201 rather than guessing. The response carried no rows, `error` was
 * discarded, and an empty array renders as "gak ada topup yang nunggu". The
 * admin was being told the queue was clear while money sat in it. The embed now
 * names the constraint it means, and a failed read says so instead of
 * impersonating an empty queue.
 */

/** Sentinel for "the signed URL is on its way", so it cannot be read as a failure. */
const LOADING = "__loading__";

type Topup = {
  id: string;
  amount_idr: number;
  credits: number;
  created_at: string;
  proof_url: string | null;
  check_verdict: ProofVerdict;
  check_detail: { flags?: string[]; reading?: { summary_id?: string } | null } | null;
  profiles?: { email?: string } | null;
};

/** How each automated verdict is presented. Wording matters more than colour. */
const VERDICT: Record<ProofVerdict, { label: string; tone: string; lead: string }> = {
  pass: {
    label: "Kelihatan beres",
    tone: "border-success/30 bg-success/10 text-success",
    lead: "Sistem udah baca struknya dan semuanya cocok. Tetap lihat sendiri sebelum approve.",
  },
  suspect: {
    label: "Perlu dilihat",
    tone: "border-ember/35 bg-ember/10 text-ember",
    lead: "Ada yang gak bisa dipastiin sistem. Cek bagian ini sendiri:",
  },
  fail: {
    label: "Mencurigakan",
    tone: "border-danger/30 bg-danger/10 text-danger",
    lead: "Sistem nemu masalah serius. Jangan approve sebelum lo yakin:",
  },
  error: {
    label: "Gagal dicek",
    tone: "border-hairline bg-surface-raised text-muted",
    lead: "Pemeriksaan otomatis gak jalan buat yang ini. Cek manual sepenuhnya.",
  },
  unchecked: {
    label: "Belum dicek",
    tone: "border-hairline bg-surface-raised text-muted",
    lead: "Topup ini masuk sebelum ada pemeriksaan otomatis. Cek manual.",
  },
};

export default function AdminTopupsPage() {
  const [topups, setTopups] = useState<Topup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState("");
  /** Distinct from `null` (failed) and `undefined` (not asked for yet). */
  const [proofs, setProofs] = useState<Record<string, string | null>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const fetchTopups = useCallback(async () => {
    setLoading(true);
    const { data, error: readError } = await createClient()
      .from("topups")
      // `profiles!topups_user_id_fkey` — the payer, not the admin who reviewed
      // it. Left as bare `profiles` this whole query fails, see the note above.
      .select(
        "id, amount_idr, credits, created_at, proof_url, check_verdict, check_detail, profiles!topups_user_id_fkey(email)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (readError) {
      // An unread queue and an empty queue look identical on screen unless one
      // of them says so. This is the difference between "no one has paid" and
      // "someone paid and you cannot see it".
      setLoadFailed(readError.message);
      setTopups([]);
    } else {
      setLoadFailed("");
      setTopups((data as unknown as Topup[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Keep the fetch outside the effect's synchronous phase. Initial loading
    // state is already true, so this does not add a visible delay.
    const timer = setTimeout(() => void fetchTopups(), 0);
    return () => clearTimeout(timer);
  }, [fetchTopups]);

  const showProof = async (t: Topup) => {
    if (!t.proof_url || proofs[t.id] !== undefined) return;
    // "Loading" and "failed" were both `null`, so every proof accused itself of
    // failing for as long as the signed URL took to come back. On anything
    // slower than a local dev server that is an admin being told not to approve
    // a payment that is, in fact, about to load fine.
    setProofs((p) => ({ ...p, [t.id]: LOADING }));
    try {
      const url = await signedProofUrl(t.proof_url);
      setProofs((p) => ({ ...p, [t.id]: url }));
    } catch {
      setProofs((p) => ({ ...p, [t.id]: null }));
    }
  };

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    setError("");
    try {
      await fn();
      setRejecting(null);
      setNote("");
      await fetchTopups();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      {/* This list lives in client state, so it needs a refetch rather than a
          router refresh. The shell above already shows the toast. */}
      <LiveRefresh tables={["topups"]} onChange={fetchTopups} silent />

      <header>
        <h1 className="font-display text-xl font-bold text-ink">Antrean topup</h1>
        <p className="mt-1 text-sm text-muted">
          Cek bukti transfernya dulu sebelum approve. Approve langsung nambah kredit.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-hairline bg-surface/60" />
          ))}
        </div>
      ) : loadFailed ? (
        <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-danger">
            Antreannya gagal dibaca — ini bukan berarti kosong.
          </p>
          <p className="mt-1.5 text-micro leading-relaxed text-muted">
            Jangan anggap gak ada yang bayar sebelum ini kebuka. Detail:{" "}
            <span className="font-mono">{loadFailed}</span>
          </p>
          <button
            onClick={fetchTopups}
            className="mt-3 min-h-11 cursor-pointer rounded-lg border border-hairline bg-surface-raised px-4 text-xs font-bold text-ink hover:border-ember/40"
          >
            Coba baca lagi
          </button>
        </div>
      ) : topups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline px-4 py-10 text-center">
          <p className="text-sm text-muted">Gak ada topup yang nunggu. Mulus.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {topups.map((t) => (
            <div key={t.id} className="surface-card overflow-hidden rounded-xl">
              <div className="border-b border-hairline p-3.5">
                <p className="truncate text-micro text-muted">{t.profiles?.email ?? "—"}</p>
                <p className="mt-0.5 font-display text-lg font-bold text-ink">
                  Rp {t.amount_idr.toLocaleString("id-ID")}
                </p>
                <p className="text-xs text-ember">{t.credits} kredit</p>
                <p className="mt-1.5 text-micro text-muted">
                  {new Date(t.created_at).toLocaleString("id-ID")}
                </p>
              </div>

              {/* What the automated read found. Advisory — it never approves
                  anything — but it turns "judge this screenshot cold" into
                  "here is what to look at". */}
              {(() => {
                const v = VERDICT[t.check_verdict] ?? VERDICT.unchecked;
                const flags = t.check_detail?.flags ?? [];
                const summary = t.check_detail?.reading?.summary_id;
                return (
                  <div className={`border-b px-3.5 py-3 ${v.tone}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="eyebrow font-bold">{v.label}</span>
                    </div>
                    <p className="mt-1 text-micro leading-relaxed opacity-90">{v.lead}</p>
                    {flags.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {flags.map((f, i) => (
                          <li key={i} className="text-micro leading-relaxed opacity-95">
                            · {f}
                          </li>
                        ))}
                      </ul>
                    )}
                    {summary && (
                      <p className="mt-2 border-t border-current/15 pt-2 text-micro leading-relaxed opacity-75">
                        Yang kebaca: {summary}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="p-3.5">
                {!t.proof_url ? (
                  <p className="rounded-lg border border-dashed border-hairline px-3 py-4 text-center text-micro text-muted">
                    Gak ada bukti transfer. Hati-hati approve yang begini.
                  </p>
                ) : proofs[t.id] === undefined ? (
                  <button
                    onClick={() => showProof(t)}
                    className="w-full cursor-pointer rounded-lg border border-hairline bg-surface-raised py-2.5 text-xs font-bold text-ink hover:border-ember/40"
                  >
                    Lihat bukti transfer
                  </button>
                ) : proofs[t.id] === LOADING ? (
                  <div
                    aria-busy="true"
                    aria-label="Lagi buka bukti transfer"
                    className="h-24 animate-pulse rounded-lg border border-hairline bg-surface/60"
                  />
                ) : proofs[t.id] === null ? (
                  <div className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2">
                    <p className="text-micro leading-relaxed text-danger">
                      Gagal buka buktinya. Jangan approve sebelum keliatan.
                    </p>
                    <button
                      onClick={() =>
                        setProofs((p) => {
                          const next = { ...p };
                          delete next[t.id];
                          return next;
                        })
                      }
                      className="mt-1 min-h-11 cursor-pointer text-micro font-bold text-ink underline-offset-2 hover:underline"
                    >
                      Coba buka lagi
                    </button>
                  </div>
                ) : (
                  <a href={proofs[t.id]!} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={proofs[t.id]!}
                      alt="Bukti transfer"
                      className="max-h-64 w-full rounded-lg bg-obsidian object-contain"
                    />
                    <span className="mt-1 block text-center text-micro text-muted">
                      Tap buat buka gede · link mati dalam 5 menit
                    </span>
                  </a>
                )}
              </div>

              {rejecting === t.id ? (
                <div className="border-t border-hairline p-3.5">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Alasan reject"
                    aria-label="Alasan reject"
                    className="w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-ember focus:outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        setRejecting(null);
                        setNote("");
                      }}
                      className="flex-1 cursor-pointer rounded-lg border border-hairline py-2 text-xs font-semibold text-muted hover:text-ink"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => run(t.id, () => rejectTopup(t.id, note.trim()))}
                      disabled={busy === t.id || !note.trim()}
                      className="flex-1 cursor-pointer rounded-lg bg-danger py-2 text-xs font-bold text-obsidian disabled:opacity-45"
                    >
                      {busy === t.id ? "..." : "Reject"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 border-t border-hairline p-3.5">
                  <button
                    onClick={() => setRejecting(t.id)}
                    className="flex-1 cursor-pointer rounded-lg border border-hairline py-2.5 text-xs font-bold text-muted hover:border-danger/40 hover:text-danger"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => run(t.id, () => approveTopup(t.id))}
                    disabled={busy === t.id}
                    className="flex-1 cursor-pointer rounded-lg bg-ember py-2.5 text-xs font-bold text-obsidian hover:bg-ember-lo disabled:opacity-45"
                  >
                    {busy === t.id ? "..." : "Approve"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
