"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { approveTopup, rejectTopup, signedProofUrl } from "@/app/actions/admin";
import { LiveRefresh } from "@/components/LiveRefresh";

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
 */

type Topup = {
  id: string;
  amount_idr: number;
  credits: number;
  created_at: string;
  proof_url: string | null;
  profiles?: { email?: string } | null;
};

export default function AdminTopupsPage() {
  const [topups, setTopups] = useState<Topup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [proofs, setProofs] = useState<Record<string, string | null>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const fetchTopups = useCallback(async () => {
    setLoading(true);
    const { data } = await createClient()
      .from("topups")
      .select("*, profiles(email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setTopups((data as Topup[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTopups();
  }, [fetchTopups]);

  const showProof = async (t: Topup) => {
    if (!t.proof_url || proofs[t.id] !== undefined) return;
    setProofs((p) => ({ ...p, [t.id]: null }));
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
      <LiveRefresh tables={["topups"]} label="Ada topup baru" />

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
      ) : topups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline px-4 py-10 text-center">
          <p className="text-sm text-muted">Gak ada topup yang nunggu. Mulus.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {topups.map((t) => (
            <div key={t.id} className="surface-card overflow-hidden rounded-xl">
              <div className="border-b border-hairline p-3.5">
                <p className="truncate text-[11px] text-muted">{t.profiles?.email ?? "—"}</p>
                <p className="mt-0.5 font-display text-lg font-bold text-ink">
                  Rp {t.amount_idr.toLocaleString("id-ID")}
                </p>
                <p className="text-xs text-ember">{t.credits} kredit</p>
                <p className="mt-1.5 text-[10.5px] text-muted">
                  {new Date(t.created_at).toLocaleString("id-ID")}
                </p>
              </div>

              <div className="p-3.5">
                {!t.proof_url ? (
                  <p className="rounded-lg border border-dashed border-hairline px-3 py-4 text-center text-[11px] text-muted">
                    Gak ada bukti transfer. Hati-hati approve yang begini.
                  </p>
                ) : proofs[t.id] === undefined ? (
                  <button
                    onClick={() => showProof(t)}
                    className="w-full cursor-pointer rounded-lg border border-hairline bg-surface-raised py-2.5 text-xs font-bold text-ink hover:border-ember/40"
                  >
                    Lihat bukti transfer
                  </button>
                ) : proofs[t.id] === null ? (
                  <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[11px] text-danger">
                    Gagal buka buktinya. Jangan approve sebelum keliatan.
                  </p>
                ) : (
                  <a href={proofs[t.id]!} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={proofs[t.id]!}
                      alt="Bukti transfer"
                      className="max-h-64 w-full rounded-lg bg-obsidian object-contain"
                    />
                    <span className="mt-1 block text-center text-[10.5px] text-muted">
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
