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
import { motion, AnimatePresence } from "framer-motion";

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
  const [awaiting, setAwaiting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    paymentSettings().then(setPay).catch(() => setPay(null));
  }, []);

  const copyToClipboard = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 2000);
  };

  const receivePacks = useCallback((rows: CreditPackOption[]) => {
    setPacks(rows);
    setSelected((current) => rows.find((row) => row.id === current?.id) ?? rows[1] ?? rows[0] ?? null);
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

  const checkVerdict = useCallback(async () => {
    const { data, error } = await createClient()
      .from("topups")
      .select("status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return;

    if (data.status === "approved") {
      setSuccess("Pembayaran terverifikasi! Kredit sudah masuk ke akun kamu.");
      setAwaiting(false);
    } else if (data.status === "rejected") {
      setSuccess("");
      setError("Bukti transfer ditolak oleh admin. Periksa kembali nominal serta tujuan transfer, lalu kirim ulang.");
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
      setError("File harus berupa gambar screenshot atau foto bukti transfer (JPG / PNG).");
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setError("Ukuran gambar terlalu besar (maksimal 12MB).");
      return;
    }
    setFile(f);
  };

  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selected) {
      setError("Pilih paket kredit dan upload bukti transfer terlebih dahulu.");
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
      if (!user) throw new Error("Sesi login kamu sudah berakhir. Silakan login kembali.");

      const compressed = await compressImage(file, 420);
      const hash = await sha256Hex(compressed);
      const path = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("topup_proofs")
        .upload(path, compressed, { contentType: "image/jpeg" });

      if (uploadError) throw new Error("Bukti transfer gagal diunggah. Coba beberapa saat lagi.");

      const res = await submitTopup(selected.id, path, hash);

      setSuccess(
        res.flagged
          ? "Bukti transfer berhasil dikirim. Sedang diverifikasi manual oleh tim — proses mungkin membutuhkan beberapa saat."
          : "Bukti transfer berhasil dikirim! Kredit akan langsung masuk setelah proses review otomatis selesai.",
      );
      setAwaiting(true);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mengirim bukti transfer.");
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
      setSuccess(`Selamat! Voucher berhasil ditukarkan dengan ${creditsAdded} kredit.`);
      setVoucherCode("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kode voucher tidak valid atau sudah pernah digunakan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-obsidian text-ink">
      {awaiting && <LiveRefresh tables={["topups"]} onChange={checkVerdict} silent />}

      {/* Header Bar */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-hairline/60 bg-obsidian/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/app"
            className="flex h-9 items-center gap-2 rounded-xl border border-hairline/80 bg-surface/40 px-3.5 text-xs font-semibold text-muted transition-colors hover:border-ember/40 hover:text-ember"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-none stroke-current stroke-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Kembali ke Studio</span>
          </Link>

          <div className="flex items-center gap-2">
            <h1 className="font-display text-sm font-bold text-ink sm:text-base">
              Beli Kredit
            </h1>
          </div>

          <Logo markClass="h-5 sm:h-6" className="shrink-0" />
        </div>
      </header>

      {/* Hero Intro Banner */}
      <section className="relative overflow-hidden border-b border-hairline/40 bg-gradient-to-b from-surface/70 via-surface/30 to-transparent py-6 sm:py-8">
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-96 rounded-full bg-ember/10 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-3 py-1 text-micro font-bold uppercase tracking-wider text-ember">
              <span className="size-1.5 rounded-full bg-ember animate-ping" />
              <span>Saldo & Paket Kreator</span>
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl lg:text-4xl">
              Tingkatkan Kapasitas Produksi Konten
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted sm:text-sm">
              Gunakan kredit untuk seluruh modul Malesan: Auto-Clip YouTube, Hook Lab AI, Script Generator, hingga Video Auto-CC tanpa langganan bulanan.
            </p>

            {/* Segmented Switcher */}
            <div
              role="tablist"
              aria-label="Metode pembayaran"
              className="mt-6 flex w-full max-w-xs items-center gap-1 rounded-xl border border-hairline bg-surface-raised/80 p-1 shadow-inner"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "topup"}
                onClick={() => {
                  setActiveTab("topup");
                  setError("");
                  setSuccess("");
                }}
                className={`flex h-8 flex-1 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                  activeTab === "topup"
                    ? "bg-ember text-obsidian shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                Transfer Bank / QRIS
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "voucher"}
                onClick={() => {
                  setActiveTab("voucher");
                  setError("");
                  setSuccess("");
                }}
                className={`flex h-8 flex-1 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                  activeTab === "voucher"
                    ? "bg-ember text-obsidian shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                Tukar Voucher
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-xs leading-relaxed text-danger shadow-xs"
            >
              <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 fill-none stroke-current stroke-2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="flex-1">{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-start gap-3 rounded-2xl border border-success/30 bg-success/10 p-4 text-xs leading-relaxed text-success shadow-xs"
            >
              <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 fill-none stroke-current stroke-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="flex-1">{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === "topup" ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left Column: Package Options (7 Cols on Desktop) */}
            <div className="space-y-6 lg:col-span-7">
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-lg bg-ember/20 text-xs font-bold text-ember">
                      1
                    </span>
                    <h3 className="font-display text-base font-bold text-ink">
                      Pilih Paket Kredit
                    </h3>
                  </div>
                  <span className="text-micro font-medium text-muted">
                    Kredit aktif selamanya (tanpa expired)
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {packsLoading
                    ? [0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-44 animate-shimmer-glow rounded-2xl border border-hairline/80 p-5 shadow-xs"
                        />
                      ))
                    : packs.map((pack) => {
                        const on = selected?.id === pack.id;
                        const isPopular = pack.credits >= 300 && pack.credits < 1000;
                        const isBestValue = pack.credits >= 1000;
                        const unitPrice = Math.round(pack.price_idr / pack.credits);

                        return (
                          <button
                            key={pack.id}
                            type="button"
                            onClick={() => setSelected(pack)}
                            aria-pressed={on}
                            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200 cursor-pointer ${
                              on
                                ? "border-ember bg-gradient-to-b from-ember/15 via-surface-raised to-surface-raised shadow-md shadow-ember/10 ring-1 ring-ember"
                                : "border-hairline bg-surface-raised/60 hover:border-ember/40 hover:bg-surface-raised"
                            }`}
                          >
                            {isPopular && (
                              <div className="absolute top-0 right-0 rounded-bl-xl border-l border-b border-ember/40 bg-ember px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-obsidian shadow-xs">
                                Populer
                              </div>
                            )}
                            {isBestValue && (
                              <div className="absolute top-0 right-0 rounded-bl-xl border-l border-b border-amber-500/40 bg-gradient-to-r from-amber-500 to-ember px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-obsidian shadow-xs">
                                Hemat 33%
                              </div>
                            )}

                            <div>
                              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                                {pack.credits <= 150 ? "Starter" : isPopular ? "Kreator Aktif" : "Agensi / Pro"}
                              </span>

                              <div className="mt-2 flex items-baseline gap-1.5">
                                <span className={`font-display text-3xl font-extrabold tabular-nums ${on ? "text-ember" : "text-ink"}`}>
                                  {pack.credits}
                                </span>
                                <span className="text-xs font-semibold text-muted">kredit</span>
                              </div>

                              <p className="mt-1 text-micro text-muted">
                                Rp {unitPrice.toLocaleString("id-ID")}/kredit
                              </p>
                            </div>

                            <div className="mt-6 border-t border-hairline/60 pt-3 flex items-center justify-between">
                              <span className="text-sm font-bold text-ink">
                                Rp {pack.price_idr.toLocaleString("id-ID")}
                              </span>
                              <div className={`flex size-5 items-center justify-center rounded-full border transition-colors ${
                                on ? "border-ember bg-ember text-obsidian" : "border-hairline group-hover:border-ember/40"
                              }`}>
                                {on && (
                                  <svg viewBox="0 0 24 24" className="size-3 fill-none stroke-current stroke-3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                </div>

                {!packsLoading && packsError && (
                  <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-4">
                    <p className="text-xs text-danger">{packsError}</p>
                    <button
                      type="button"
                      onClick={() => void loadPacks()}
                      className="mt-2.5 h-8 rounded-lg border border-danger/40 px-3 text-xs font-bold text-danger hover:bg-danger/10"
                    >
                      Coba Lagi
                    </button>
                  </div>
                )}
              </section>

              {/* Package Capabilities Infobox */}
              <section className="rounded-2xl border border-hairline/80 bg-surface-raised/40 p-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Estimasi Penggunaan dengan {selected ? selected.credits : "100"} Kredit:
                </h4>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-hairline/60 bg-obsidian/60 p-3">
                    <span className="block font-display text-lg font-bold text-ember">
                      ~{Math.floor((selected?.credits ?? 100) / 4)}x
                    </span>
                    <span className="mt-0.5 block text-micro text-muted">Clip Radar YouTube</span>
                  </div>
                  <div className="rounded-xl border border-hairline/60 bg-obsidian/60 p-3">
                    <span className="block font-display text-lg font-bold text-ember">
                      ~{Math.floor((selected?.credits ?? 100) / 2)}x
                    </span>
                    <span className="mt-0.5 block text-micro text-muted">Video Auto-CC 1080p</span>
                  </div>
                  <div className="rounded-xl border border-hairline/60 bg-obsidian/60 p-3">
                    <span className="block font-display text-lg font-bold text-ember">
                      ~{Math.floor((selected?.credits ?? 100) / 1)}x
                    </span>
                    <span className="mt-0.5 block text-micro text-muted">Hook Lab / Idea Engine</span>
                  </div>
                  <div className="rounded-xl border border-hairline/60 bg-obsidian/60 p-3">
                    <span className="block font-display text-lg font-bold text-ember">
                      ~{Math.floor((selected?.credits ?? 100) / 1)}x
                    </span>
                    <span className="mt-0.5 block text-micro text-muted">Thread & Script Viral</span>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Sticky Payment & Proof Upload (5 Cols on Desktop) */}
            <div className="space-y-6 lg:col-span-5">
              {/* Step 2: Payment Destination */}
              <section className="rounded-2xl border border-hairline/80 bg-surface-raised/60 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-ember/20 text-xs font-bold text-ember">
                    2
                  </span>
                  <h3 className="font-display text-base font-bold text-ink">
                    Transfer Pembayaran
                  </h3>
                </div>

                <div className="rounded-xl border border-hairline/80 bg-obsidian/90 p-4">
                  <div className="flex items-center justify-between text-xs text-muted mb-2">
                    <span>Nominal Transfer:</span>
                    <span className="font-bold text-ember">Wajib Pas</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-2xl font-extrabold text-ink tabular-nums">
                      {selected ? `Rp ${selected.price_idr.toLocaleString("id-ID")}` : "Rp —"}
                    </span>
                    {selected && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(String(selected.price_idr), "nominal")}
                        className="flex h-7 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 text-[11px] font-semibold text-muted transition-colors hover:border-ember/40 hover:text-ember"
                      >
                        {copiedField === "nominal" ? (
                          <>
                            <svg viewBox="0 0 24 24" className="size-3 text-success fill-none stroke-current stroke-2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-success font-bold">Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 24 24" className="size-3 fill-none stroke-current stroke-2">
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {pay?.methods.bank !== false && (
                  <div className="mt-3 rounded-xl border border-hairline/80 bg-obsidian/90 p-4">
                    <div className="flex items-center justify-between text-xs text-muted mb-2">
                      <span className="font-semibold text-ink">{pay?.bankName || "Bank BCA"}</span>
                      <span>a.n. {pay?.accountHolder || "Muhammad Ryan Fadliansyah"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xl font-bold tracking-wider text-ink">
                        {pay?.accountNumber || "0552154809"}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(pay?.accountNumber || "0552154809", "bank")}
                        className="flex h-7 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 text-[11px] font-semibold text-muted transition-colors hover:border-ember/40 hover:text-ember"
                      >
                        {copiedField === "bank" ? (
                          <>
                            <svg viewBox="0 0 24 24" className="size-3 text-success fill-none stroke-current stroke-2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-success font-bold">Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 24 24" className="size-3 fill-none stroke-current stroke-2">
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {pay?.methods.qris && pay.qrisImageUrl && (
                  <div className="mt-3 rounded-xl border border-hairline/80 bg-obsidian/90 p-4 text-center">
                    <span className="text-xs font-semibold text-muted">Scan QRIS:</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pay.qrisImageUrl}
                      alt="Kode QRIS"
                      className="mx-auto mt-2 max-h-52 w-auto rounded-lg bg-white p-2"
                    />
                  </div>
                )}
              </section>

              {/* Step 3: Proof of Payment Upload */}
              <form onSubmit={handleTopupSubmit} className="rounded-2xl border border-hairline/80 bg-surface-raised/60 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-ember/20 text-xs font-bold text-ember">
                    3
                  </span>
                  <h3 className="font-display text-base font-bold text-ink">
                    Upload Bukti Struk
                  </h3>
                </div>

                <p className="text-xs text-muted leading-relaxed mb-3">
                  Lampirkan screenshot atau struk m-banking / ATM. Pastikan nominal dan tanggal terlihat jelas.
                </p>

                <input
                  ref={fileRef}
                  id="proof-upload"
                  type="file"
                  accept="image/*"
                  onChange={pickFile}
                  className="sr-only"
                />

                <label
                  htmlFor="proof-upload"
                  className={`group relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                    file
                      ? "border-ember/60 bg-ember/10"
                      : "border-hairline hover:border-ember/40 hover:bg-surface-raised"
                  }`}
                >
                  {preview ? (
                    <div className="flex flex-col items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt="Bukti Transfer"
                        className="max-h-36 w-auto rounded-lg border border-hairline object-contain shadow-xs"
                      />
                      <span className="text-xs font-bold text-ember">
                        Klik untuk mengganti gambar
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-ember/15 text-ember group-hover:scale-105 transition-transform">
                        <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-ink">
                        Pilih Gambar Bukti Transfer
                      </span>
                      <span className="text-micro text-muted">
                        Format JPG atau PNG (Maksimal 12MB)
                      </span>
                    </div>
                  )}
                </label>

                <button
                  type="submit"
                  disabled={loading || !file || !selected}
                  className="mt-4 flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-ember font-display text-sm font-bold text-obsidian shadow-md transition-all hover:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-obsidian border-t-transparent" />
                      <span>Mengunggah & Memproses...</span>
                    </div>
                  ) : (
                    <span>Kirim & Konfirmasi Pembayaran</span>
                  )}
                </button>

                <div className="mt-3 flex items-center justify-center gap-4 text-micro text-muted">
                  <span className="flex items-center gap-1">
                    <svg viewBox="0 0 24 24" className="size-3 text-success fill-none stroke-current stroke-2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Data 100% Aman
                  </span>
                  <span>·</span>
                  <span>Verifikasi Cepat</span>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* Voucher Tab Card */
          <div className="mx-auto max-w-lg rounded-2xl border border-hairline/80 bg-surface-raised/60 p-6 shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-ember/15 text-ember">
                <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  Punya Kode Voucher Promo?
                </h3>
                <p className="text-xs text-muted">
                  Masukkan kode voucher untuk menambah saldo kredit secara instan.
                </p>
              </div>
            </div>

            <form onSubmit={handleVoucherSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  placeholder="MALESAN-XXXX"
                  aria-label="Kode voucher"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  className="h-12 w-full rounded-xl border border-hairline bg-obsidian px-4 text-center font-mono text-base font-bold tracking-widest text-ink placeholder:text-muted focus:border-ember focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !voucherCode.trim()}
                className="flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-ember font-display text-sm font-bold text-obsidian shadow-md transition-all hover:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-obsidian border-t-transparent" />
                    <span>Memeriksa Kode...</span>
                  </div>
                ) : (
                  <span>Tukarkan Voucher Sekarang</span>
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
