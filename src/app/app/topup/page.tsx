"use client";

import { useState } from "react";
import { submitTopup, redeemVoucher } from "@/app/actions/payments";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/utils/image";
import { motion } from "framer-motion";

const CREDIT_PACKS = [
  { credits: 100, price: 15000, label: "Starter" },
  { credits: 350, price: 45000, label: "Pro" },
  { credits: 1000, price: 100000, label: "Creator" }
];

export default function TopupPage() {
  const [activeTab, setActiveTab] = useState<"topup" | "voucher">("topup");
  const [selectedPack, setSelectedPack] = useState(CREDIT_PACKS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [voucherCode, setVoucherCode] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Pilih file bukti transfer dulu bos.");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      // Compress extreme down to 75kb max
      const compressedBlob = await compressImage(file, 75);
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("topup_proofs")
        .upload(fileName, compressedBlob, { contentType: `image/${ext}` });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("topup_proofs")
        .getPublicUrl(fileName);

      await submitTopup(
        selectedPack.price,
        selectedPack.credits,
        "bank_transfer",
        publicUrlData.publicUrl
      );

      setSuccess("Top up berhasil dikirim! Bentar ya, lagi di-review admin. Biasanya cuma 5-10 menit.");
      setFile(null);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Gagal upload bukti transfer.");
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
      setSuccess(`Mantap! Voucher berhasil ditukar jadi ${creditsAdded} credits.`);
      setVoucherCode("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Voucher gagal ditukar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black text-white tracking-tight mb-2">Beli Credits</h1>
        <p className="text-muted">Pilih paket sesuai kebutuhan atau tukerin kode voucher lo.</p>
      </div>

      <div className="flex p-1 bg-surface rounded-lg mb-8 max-w-sm mx-auto">
        <button
          onClick={() => { setActiveTab("topup"); setError(""); setSuccess(""); }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === "topup" ? "bg-surface-raised text-white shadow" : "text-muted hover:text-ink"
          }`}
        >
          Top Up
        </button>
        <button
          onClick={() => { setActiveTab("voucher"); setError(""); setSuccess(""); }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === "voucher" ? "bg-surface-raised text-white shadow" : "text-muted hover:text-ink"
          }`}
        >
          Pakai Voucher
        </button>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
          {success}
        </motion.div>
      )}

      {activeTab === "topup" ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {CREDIT_PACKS.map(pack => (
              <button
                key={pack.credits}
                onClick={() => setSelectedPack(pack)}
                className={`relative p-6 rounded-2xl border text-left transition-all ${
                  selectedPack.credits === pack.credits
                    ? "border-success bg-success/5 ring-1 ring-success"
                    : "border-hairline bg-surface/50 hover:border-hairline"
                }`}
              >
                <div className="text-sm font-medium text-success mb-1">{pack.label}</div>
                <div className="text-2xl font-black text-white mb-4">{pack.credits} <span className="text-sm font-normal text-muted">cr</span></div>
                <div className="text-sm text-muted font-medium">Rp {pack.price.toLocaleString("id-ID")}</div>
              </button>
            ))}
          </div>

          <div className="bg-surface/50 border border-hairline rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Transfer ke Rekening BCA</h3>
            <p className="text-muted text-sm mb-6">
              Transfer sebesar <strong className="text-white">Rp {selectedPack.price.toLocaleString("id-ID")}</strong> ke:
              <br/><br/>
              <span className="font-mono text-lg text-white bg-obsidian px-3 py-2 rounded-lg border border-hairline">123 456 7890</span>
              <br/><br/>
              a.n. PT Malesan Karya Bangsa
            </p>

            <form onSubmit={handleTopupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Upload Bukti Transfer</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-muted
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-success/10 file:text-success
                    hover:file:bg-success/20"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !file}
                className="w-full mt-4 flex items-center justify-center h-12 bg-success hover:bg-success text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Ngirim..." : "Kirim Bukti Transfer"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="bg-surface/50 border border-hairline rounded-2xl p-6 max-w-md mx-auto">
          <h3 className="text-white font-medium mb-2">Punya Kode Voucher?</h3>
          <p className="text-muted text-sm mb-6">Tukerin kode lo buat dapetin credits gratis.</p>
          
          <form onSubmit={handleVoucherSubmit} className="space-y-4">
            <input 
              type="text" 
              placeholder="Masukin kode di sini"
              value={voucherCode}
              onChange={e => setVoucherCode(e.target.value.toUpperCase())}
              className="w-full h-12 bg-obsidian border border-hairline rounded-xl px-4 text-white focus:outline-none focus:border-success font-mono tracking-widest text-center"
            />
            <button
              type="submit"
              disabled={loading || !voucherCode.trim()}
              className="w-full flex items-center justify-center h-12 bg-success hover:bg-success text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Mengecek..." : "Tukerin Voucher"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
