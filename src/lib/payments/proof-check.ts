import "server-only";

import { parseJson } from "@/lib/gemini/client";
import { runAI } from "@/lib/ai/engine";
import { getPaymentConfig } from "@/lib/config";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Automated reading of a payment proof.
 *
 * The gap this closes: `submitTopup` accepted an amount, a credit count and a
 * proof URL straight from the browser and inserted them, and nothing ever
 * looked at the image. Uploading a photo of a cat and asking for 1000 credits
 * produced a queue entry indistinguishable from a real one. The only defence
 * was an admin squinting at a thumbnail at 2am.
 *
 * The split of responsibility here is deliberate and is the whole design:
 *
 *   The model READS. It is asked only what is visibly on the image — is this a
 *   payment receipt, what amount, to which account, does it say it succeeded.
 *   Those are OCR questions with checkable answers.
 *
 *   The code JUDGES. Whether the reading is good enough to pass is decided by
 *   the rules below, against the real configured destination account and the
 *   real price of the pack. A model asked "should I approve this?" will agree
 *   with whatever it is shown, and a payment check that can be talked out of
 *   its answer is not a check.
 *
 * The verdict is advisory. It never moves credits on its own — an admin still
 * approves. What it changes is that the admin is told *what to look at* rather
 * than starting from nothing.
 */

export type ProofReading = {
  is_payment_proof: boolean;
  document_type: string;
  amount_idr: number;
  amount_readable: boolean;
  destination_account: string;
  destination_name: string;
  transaction_time: string;
  status_text: string;
  looks_edited: boolean;
  edit_reasons: string[];
  confidence: number;
  summary_id: string;
};

export type Verdict = "pass" | "suspect" | "fail" | "error";

export type ProofCheck = {
  verdict: Verdict;
  /** Plain-language lines for the admin, already in Indonesian. */
  flags: string[];
  reading: ProofReading | null;
  checkedAt: string;
};

const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_payment_proof: { type: "BOOLEAN" },
    document_type: { type: "STRING" },
    amount_idr: { type: "INTEGER" },
    amount_readable: { type: "BOOLEAN" },
    destination_account: { type: "STRING" },
    destination_name: { type: "STRING" },
    transaction_time: { type: "STRING" },
    status_text: { type: "STRING" },
    looks_edited: { type: "BOOLEAN" },
    edit_reasons: { type: "ARRAY", items: { type: "STRING" } },
    confidence: { type: "NUMBER" },
    summary_id: { type: "STRING" },
  },
  required: [
    "is_payment_proof",
    "document_type",
    "amount_idr",
    "amount_readable",
    "destination_account",
    "destination_name",
    "transaction_time",
    "status_text",
    "looks_edited",
    "edit_reasons",
    "confidence",
    "summary_id",
  ],
} as const;

const PROMPT = `Kamu memeriksa sebuah gambar yang diunggah seseorang sebagai bukti transfer ke sebuah layanan di Indonesia.

Tugasmu HANYA MEMBACA apa yang benar-benar terlihat. Kamu tidak memutuskan diterima atau ditolak — itu urusan orang lain. Jangan berbaik sangka, jangan mengarang, jangan melengkapi yang tidak terbaca.

Jawab tiap kolom apa adanya:

- is_payment_proof: true HANYA kalau gambar ini benar-benar bukti/struk transaksi keuangan (mobile banking, e-wallet, QRIS, ATM, internet banking). Foto orang, meme, screenshot chat, tangkapan layar aplikasi lain, gambar acak → false.
- document_type: salah satu dari bank_transfer_receipt, ewallet_receipt, qris_receipt, atm_slip, other, unreadable.
- amount_idr: nominal yang ditransfer, angka bulat rupiah tanpa titik/koma. Kalau tidak terbaca jelas, isi 0.
- amount_readable: true hanya kalau kamu betul-betul melihat angka nominalnya, bukan menebak.
- destination_account: nomor rekening / nomor tujuan penerima persis seperti tertulis. Kosongkan kalau tidak ada.
- destination_name: nama penerima persis seperti tertulis. Kosongkan kalau tidak ada.
- transaction_time: tanggal dan jam transaksi seperti tertulis. Kosongkan kalau tidak ada.
- status_text: tulisan status di struk (misal "Transaksi Berhasil", "Sukses", "Pending"). Kosongkan kalau tidak ada.
- looks_edited: true kalau ada tanda gambar disunting — font tidak konsisten, angka miring sendiri, potongan tempelan, bekas hapus, kualitas beda di satu area, atau nominal yang jelas ditimpa.
- edit_reasons: alasan singkat untuk looks_edited, bahasa Indonesia. Array kosong kalau tidak ada.
- confidence: 0 sampai 1, seberapa yakin kamu pada pembacaan di atas.
- summary_id: SATU kalimat bahasa Indonesia santai yang menjelaskan isi gambar ini kepada admin. Contoh: "Struk BCA mobile, transfer Rp100.000 ke 1234567890 a.n. Vadly, status berhasil."

Kalau gambarnya buram, gelap, terpotong, atau tidak terbaca: katakan begitu lewat amount_readable=false dan confidence rendah. Menebak lebih buruk daripada mengaku tidak terbaca.`;

/** Normalises account numbers for comparison: digits only. */
const digits = (s: string) => (s || "").replace(/\D/g, "");

/** Loose name match — "PT Malesan Indonesia" vs "MALESAN INDONESIA". */
function nameLooksSame(a: string, b: string): boolean {
  const norm = (s: string) =>
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const A = norm(a);
  const B = norm(b);
  if (!A.length || !B.length) return false;
  return A.some((w) => B.includes(w)) || B.some((w) => A.includes(w));
}

/**
 * Read the proof and decide what an admin should be told about it.
 *
 * Never throws. A checker that can fail the submission is worse than no
 * checker: a user whose transfer is real should not be blocked because the
 * vision model was rate-limited. On any failure the verdict is "error" and the
 * top-up simply goes to manual review, which is where it used to go anyway.
 */
export async function checkProof(opts: {
  storagePath: string;
  expectedAmountIdr: number;
}): Promise<ProofCheck> {
  const checkedAt = new Date().toISOString();
  const flags: string[] = [];

  try {
    const supabase = createServiceRoleClient();
    const { data: blob, error } = await supabase.storage
      .from("topup_proofs")
      .download(opts.storagePath);

    if (error || !blob) {
      return {
        verdict: "error",
        flags: ["Gambarnya gagal dibuka sistem — cek manual."],
        reading: null,
        checkedAt,
      };
    }

    const bytes = Buffer.from(await blob.arrayBuffer());
    // `proof_check` declares a `vision` requirement, so the Brain cannot route a
    // payment receipt onto a text-only model however cheap it is. A blind model
    // would not fail here — it would confidently describe an image it never saw,
    // which on a money screen is worse than no check at all.
    const { text: raw } = await runAI({
      feature: "proof_check",
      prompt: PROMPT,
      schema: SCHEMA as unknown as Record<string, unknown>,
      images: [{ mimeType: blob.type || "image/jpeg", data: bytes.toString("base64") }],
      signal: AbortSignal.timeout(50_000),
      budgetMs: 48_000,
    });

    const reading = parseJson<ProofReading>(raw);
    const pay = await getPaymentConfig();

    // ---- rules ----
    // Ordered worst-first: the first hard failure decides the verdict, and the
    // softer flags are still collected so the admin sees everything at once.
    let hard = false;
    let soft = false;

    if (!reading.is_payment_proof) {
      hard = true;
      flags.push("Ini kelihatannya bukan bukti transfer sama sekali.");
    }

    if (reading.looks_edited) {
      hard = true;
      flags.push(
        `Ada tanda gambarnya disunting: ${reading.edit_reasons.join("; ") || "tidak dijelaskan"}.`,
      );
    }

    if (!reading.amount_readable || reading.amount_idr <= 0) {
      soft = true;
      flags.push("Nominalnya gak kebaca dari gambar — pastiin sendiri.");
    } else if (reading.amount_idr !== opts.expectedAmountIdr) {
      const short = reading.amount_idr < opts.expectedAmountIdr;
      // A wrong amount is a real mismatch, not a reading quirk, so it is hard.
      hard = true;
      flags.push(
        `Nominal di struk Rp${reading.amount_idr.toLocaleString("id-ID")}, ` +
          `harusnya Rp${opts.expectedAmountIdr.toLocaleString("id-ID")} — ${
            short ? "kurang" : "lebih"
          }.`,
      );
    }

    const expectAcc = digits(pay.accountNumber || "");
    const gotAcc = digits(reading.destination_account || "");
    if (expectAcc && gotAcc && expectAcc !== gotAcc) {
      hard = true;
      flags.push(`Rekening tujuannya beda: ${reading.destination_account}, bukan rekening lo.`);
    } else if (expectAcc && !gotAcc) {
      soft = true;
      flags.push("Rekening tujuan gak kebaca di struk.");
    }

    if (
      pay.accountHolder &&
      reading.destination_name &&
      !nameLooksSame(pay.accountHolder, reading.destination_name)
    ) {
      soft = true;
      flags.push(
        `Nama penerima di struk "${reading.destination_name}" gak mirip "${pay.accountHolder}".`,
      );
    }

    const status = (reading.status_text || "").toLowerCase();
    if (status && /pending|gagal|failed|dibatalkan|batal/.test(status)) {
      hard = true;
      flags.push(`Status di struk: "${reading.status_text}" — belum tentu duitnya masuk.`);
    }

    if (reading.confidence < 0.45) {
      soft = true;
      flags.push("Sistem gak yakin bacanya — gambarnya kurang jelas.");
    }

    const verdict: Verdict = hard ? "fail" : soft ? "suspect" : "pass";
    if (verdict === "pass") flags.push("Cocok semua: nominal, rekening, dan statusnya.");

    return { verdict, flags, reading, checkedAt };
  } catch (err) {
    // Includes rate limits, model outages and unparseable JSON.
    return {
      verdict: "error",
      flags: [
        `Pemeriksaan otomatis gak jalan (${
          err instanceof Error ? err.message.slice(0, 120) : "error"
        }). Cek manual.`,
      ],
      reading: null,
      checkedAt,
    };
  }
}
