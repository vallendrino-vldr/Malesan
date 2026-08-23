"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveRefresh } from "@/components/LiveRefresh";
import {
  activeCreditPacks,
  submitTopup,
  redeemVoucher,
  paymentSettings,
  type CreditPackOption,
} from "@/app/actions/payments";
import type { PaymentConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/utils/image";
import { sha256Hex } from "@/lib/utils/hash";
import { motion } from "framer-motion";

/**
 * Buy credits.
 *
 * Two things were wrong beyond the styling.
 *
 * There was no way back. This is a full-page route with no shell, no header and
 * no link out, so on an installed PWA — which has no address bar — opening it
 * was a dead end. The only exit was force-quitting the app.
 *
 * And it was painted in `text-white`/`bg-white`, nine times. Every other screen
 * draws from the colour tokens, which is what lets the light theme exist at all;
 * hardcoded white is white in both themes, so in bright mode the heading, the
 * pack names, the credit counts and the voucher field were white text on a
 * near-white surface. Not faint — invisible.
 *
 * The primary action was `bg-success` too: a green button on a page whose only
 * action is "pay". Ember is the product's action colour; green here read as
 * confirmation of something that had not happened yet.
 */

export default function TopupPage() {
  const [activeTab, setActiveTab] = useState<"topup" | "voucher">("topup");
  const [packs, setPacks] = useState<CreditPackOption[]>([]);
  const [selected, setSelected] = useState<CreditPackOption | null>(null);
  const [packsLoading, setPacksLoading] = useState(true);
  const [packsError, setPacksError] = useState("");
  const [pay, setPay] = useState<PaymentConfig | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  /** True between submitting a proof and an admin ruling on it. */
  const [awaiting, setAwaiting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    paymentSettings().then(setPay).catch(() => setPay(null));
  }, []);

  // Prices stay database-driven, but the read crosses the server boundary and
  // reports failure explicitly. The old browser query ignored `{ error }`, so
  // any failed request left skeletons and a Rp0 transfer instruction forever.
  const receivePacks = useCallback((rows: CreditPackOption[]) => {
    setPacks(rows);
    setSelected((current) => rows.find((row) => row.id === current?.id) ?? rows[0] ?? null);
    setPacksError("");
  }, []);

  const rejectPacks = useCallback((err: unknown) => {
    setPacks([]);
    setSelected(null);
    setPacksError(err instanceof Error ? err.message : "Daftar paketnya belum kebaca.");
  }, []);

  const loadPacks = useCallback(async () => {
    setPacksLoading(true);
    setPacksError("");
    try {
      receivePacks(await activeCreditPacks());
    } catch (err: unknown) {
      rejectPacks(err);
    } finally {
      setPacksLoading(false);
    }
  }, [receivePacks, rejectPacks]);

  useEffect(() => {
    let alive = true;
    activeCreditPacks()
      .then((rows) => {
        if (alive) receivePacks(rows);
      })
      .catch((err: unknown) => {
        if (alive) rejectPacks(err);
      })
      .finally(() => {
        if (alive) setPacksLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [receivePacks, rejectPacks]);

  /**
   * Watches the top-up the user just submitted until an admin rules on it.
   *
   * This is the one screen where somebody is actually sitting and waiting, and
   * until now it never changed — the "lagi di-review" line stayed put even after
   * the credits had landed, so the product looked stuck at exactly the moment
   * the user had paid.
   *
   * `onChange` rather than the default `router.refresh()`: this page is a client
   * component holding its own state, and refreshing the server pass would show
   * the toast and change nothing. `silent` because the balance pill in the shell
   * already announces the same approval.
   *
   * RLS scopes the read to the user's own rows, so "latest row" is theirs.
   */
  const checkVerdict = useCallback(async () => {
    const { data, error } = await createClient()
      .from("topups")
      .select("status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // A discarded error here would leave the screen claiming "lagi di-review"
    // forever, which is the bug this whole block exists to fix.
    if (error || !data) return;

    if (data.status === "approved") {
      setSuccess("Udah di-approve. Kreditnya masuk — cek saldo lo di atas.");
      setAwaiting(false);
    } else if (data.status === "rejected") {
      setSuccess("");
      setError("Bukti transfernya ditolak. Cek lagi nominal sama tujuan transfernya, terus kirim ulang.");
      setAwaiting(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setError("");
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Filenya harus gambar — screenshot atau foto bukti transfer.");
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setError("Gambarnya kegedean (maks 12MB). Screenshot biasa aja cukup.");
      return;
    }
    setFile(f);
  };

  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selected) {
      setError("Pilih paket sama bukti transfernya dulu.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi lo abis. Masuk lagi ya.");

      // 75KB was too aggressive for a document: the amount and the account
      // number turned to mush, which defeats the point of asking for a proof.
      // 420KB keeps the digits legible for a human and for the checker.
      const compressed = await compressImage(file, 420);
      const hash = await sha256Hex(compressed);
      const path = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("topup_proofs")
        .upload(path, compressed, { contentType: "image/jpeg" });

      if (uploadError) throw new Error("Bukti transfernya gagal keupload. Coba lagi.");

      // Only the pack id and the storage path cross the wire. Amount and
      // credits are looked up server-side — see submitTopup.
      const res = await submitTopup(selected.id, path, hash);

      setSuccess(
        res.flagged
          ? "Kekirim. Tapi sistem belum yakin sama buktinya, jadi bakal dicek manual — mungkin agak lebih lama."
          : "Kekirim! Lagi di-review. Kreditnya masuk begitu di-approve.",
      );
      setAwaiting(true);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal ngirim bukti transfer.");
    } finally {
      setLoading(false);
    }
  };

  const handleVoucherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const creditsAdded = await redeemVoucher(voucherCode.trim());
      setSuccess(`Mantap! Voucher ketuker jadi ${creditsAdded} kredit.`);
      setVoucherCode("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Vouchernya gak kepake.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-obsidian">
      {/* Only listens while there is actually a verdict to wait for. Mounting it
          unconditionally would hold a socket open for every visitor reading the
          pricing, which is the wasteful half of realtime. */}
      {awaiting && <LiveRefresh tables={["topups"]} onChange={checkVerdict} silent />}
      {/* The way out. Every other screen has the tab bar; this one had nothing. */}
      <header className="sticky top-0 z-20 shrink-0 border-b border-hairline/70 bg-obsidian/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 py-2.5">
          <Link
            href="/app"
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-hairline pl-2 pr-3.5 text-mini font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
              <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6 4.6-4.6Z" />
            </svg>
            Balik
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-display text-base font-bold text-ink">
            Beli kredit
          </h1>
          {/* This route has its own header, so without this the one screen
              where someone is deciding to pay never shows them whose product
              they are paying for. */}
          <Logo markClass="size-6" size="0.9375rem" className="shrink-0" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-6">
        <div
          role="tablist"
          aria-label="Cara nambah kredit"
          className="mx-auto mb-6 flex max-w-sm gap-1 rounded-xl border border-hairline bg-surface/60 p-1"
        >
          {(["topup", "voucher"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={activeTab === t}
              onClick={() => {
                setActiveTab(t);
                setError("");
                setSuccess("");
              }}
              className={`min-h-11 flex-1 cursor-pointer rounded-lg text-mini font-semibold transition-colors duration-[var(--duration-standard)] ease-heat ${
                activeTab === t ? "bg-ember/15 text-ember" : "text-muted hover:text-ink"
              }`}
            >
              {t === "topup" ? "Transfer" : "Pakai voucher"}
            </button>
          ))}
        </div>

        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-mini leading-relaxed text-danger"
          >
            {error}
          </motion.p>
        )}

        {success && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-mini leading-relaxed text-success"
          >
            {success}
          </motion.p>
        )}

        {activeTab === "topup" ? (
          <div className="space-y-6">
            <section>
              <h2 className="eyebrow mb-2.5 text-muted">1 · Pilih paket</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {packsLoading
                  ? [0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-28 animate-pulse rounded-2xl border border-hairline bg-surface/50"
                      />
                    ))
                  : packs.map((pack) => {
                      const on = selected?.id === pack.id;
                      return (
                        <button
                          key={pack.id}
                          onClick={() => setSelected(pack)}
                          aria-pressed={on}
                          className={`skeu-press cursor-pointer rounded-2xl border p-5 text-left transition-colors duration-[var(--duration-standard)] ease-heat ${
                            on
                              ? "border-ember bg-ember/10"
                              : "border-hairline bg-surface/50 hover:border-ember/35"
                          }`}
                        >
                          <div
                            className={`tabular font-display text-2xl font-bold ${
                              on ? "text-ember" : "text-ink"
                            }`}
                          >
                            {pack.credits}
                            <span className="ml-1 text-mini font-normal text-muted">kredit</span>
                          </div>
                          <div className="mt-2 text-mini font-semibold text-muted">
                            Rp {pack.price_idr.toLocaleString("id-ID")}
                          </div>
                        </button>
                      );
                    })}
              </div>
              {!packsLoading && packsError && (
                <div className="mt-3 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3">
                  <p className="text-mini leading-relaxed text-danger">{packsError}</p>
                  <button
                    type="button"
                    onClick={() => void loadPacks()}
                    className="mt-2 min-h-11 rounded-lg border border-danger/35 px-3 text-mini font-semibold text-danger transition-colors hover:bg-danger/10"
                  >
                    Coba lagi
                  </button>
                </div>
              )}
              {!packsLoading && !packsError && packs.length === 0 && (
                <p className="rounded-xl border border-hairline bg-surface/50 px-4 py-4 text-mini leading-relaxed text-muted">
                  Belum ada paket yang dijual. Coba lagi nanti ya.
                </p>
              )}
            </section>

            {/* Bank details, the QRIS image and which methods are offered all
                come from app_config, so the owner can change a destination
                account from the panel without a deploy. */}
            <section
              className={`rounded-2xl border border-hairline bg-surface/50 p-5 ${
                selected ? "" : "opacity-55"
              }`}
            >
              <h2 className="eyebrow mb-2.5 text-muted">2 · Transfer</h2>
              <p className="text-sm leading-relaxed text-muted">
                {selected ? "Kirim" : "Pilih paket dulu sebelum transfer"}{" "}
                <strong className="tabular font-semibold text-ink">
                  {selected ? `Rp ${selected.price_idr.toLocaleString("id-ID")}` : ""}
                </strong>{" "}
                {selected && pay?.methods.qris && !pay?.methods.bank
                  ? "lewat QRIS di bawah."
                  : selected
                    ? `ke ${pay?.bankName || "rekening"} di bawah.`
                    : ""}
              </p>

              {pay?.methods.bank !== false && (
                <div className="mt-3">
                  <p className="inline-block rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-lg text-ink">
                    {pay?.accountNumber || "—"}
                  </p>
                  <p className="mt-2 text-mini text-muted">a.n. {pay?.accountHolder || "—"}</p>
                </div>
              )}

              {pay?.methods.qris && pay.qrisImageUrl && (
                <div className="mt-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pay.qrisImageUrl}
                    alt="Kode QRIS"
                    className="mx-auto max-h-64 w-auto rounded-lg bg-surface-raised p-2"
                  />
                </div>
              )}

              {pay?.note && (
                <p className="mt-3 rounded-lg border border-hairline bg-obsidian px-3 py-2 text-mini leading-relaxed text-muted">
                  {pay.note}
                </p>
              )}
            </section>

            <form
              onSubmit={handleTopupSubmit}
              className="rounded-2xl border border-hairline bg-surface/50 p-5"
            >
              <h2 className="eyebrow mb-1 text-muted">3 · Kirim buktinya</h2>
              <p className="mb-3 text-mini leading-relaxed text-muted">
                Screenshot struk transfernya. Yang harus kebaca: nominal, tanggal,
                sama nama tujuan.
              </p>

              <input
                ref={fileRef}
                id="proof"
                type="file"
                accept="image/*"
                onChange={pickFile}
                className="sr-only"
              />
              <label
                htmlFor="proof"
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors duration-[var(--duration-standard)] ease-heat ${
                  file ? "border-ember/45 bg-ember/5" : "border-hairline hover:border-ember/35"
                }`}
              >
                {preview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="Pratinjau bukti transfer"
                      className="max-h-44 w-auto rounded-lg"
                    />
                    <span className="mt-2.5 text-mini font-semibold text-ember">
                      Tap buat ganti gambar
                    </span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7 fill-muted">
                      <path d="M19 13v4H5v-4H3v6h18v-6h-2ZM11 4v8.2L7.9 9.1 6.5 10.5 12 16l5.5-5.5-1.4-1.4L13 12.2V4h-2Z" />
                    </svg>
                    <span className="mt-2 text-mini font-semibold text-ink">
                      Pilih gambar bukti transfer
                    </span>
                    <span className="mt-0.5 text-micro text-muted">JPG atau PNG, maks 12MB</span>
                  </>
                )}
              </label>

              <button
                type="submit"
                disabled={loading || !file || !selected}
                className="btn-ember mt-4 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl font-display text-sm font-bold text-obsidian disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? "Lagi ngirim..." : "Kirim bukti transfer"}
              </button>
              <p className="mt-2.5 text-micro leading-relaxed text-muted">
                Bukti transfer lo cuma dipakai buat verifikasi, dan gak pernah jadi
                link publik.
              </p>
            </form>
          </div>
        ) : (
          <form
            onSubmit={handleVoucherSubmit}
            className="mx-auto max-w-md rounded-2xl border border-hairline bg-surface/50 p-5"
          >
            <h2 className="font-display text-base font-bold text-ink">Punya kode voucher?</h2>
            <p className="mb-5 mt-1 text-mini leading-relaxed text-muted">
              Ketik kodenya, kreditnya langsung masuk.
            </p>

            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              placeholder="MALESAN-XXXX"
              aria-label="Kode voucher"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              className="h-12 w-full rounded-xl border border-hairline bg-obsidian px-4 text-center font-mono tracking-widest text-ink placeholder:text-muted focus:border-ember focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !voucherCode.trim()}
              className="btn-ember mt-4 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl font-display text-sm font-bold text-obsidian disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading ? "Ngecek..." : "Tukerin voucher"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
