import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — Malesan",
  description: "Data apa yang Malesan simpan, kenapa, dan gimana cara hapusnya.",
};

/**
 * Required to publish the Google OAuth consent screen — Google will not move an
 * app out of Testing without a reachable privacy policy URL on the same domain
 * listed under Authorized domains.
 *
 * Written plainly and specifically. A generic template is worse than useless
 * here: it has to actually describe what this app stores, and reviewers do read
 * it.
 */
export default function PrivasiPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <Link
        href="/"
        className="text-sm text-muted transition-colors hover:text-ink"
      >
        ← Balik
      </Link>

      <h1 className="mt-6 font-display text-2xl font-bold tracking-display-md text-ink">
        Kebijakan Privasi
      </h1>
      <p className="mt-2 text-sm text-muted">Berlaku sejak 30 Juli 2026.</p>

      <div className="mt-8 space-y-7 text-sm leading-relaxed text-ink/85">
        <section>
          <h2 className="font-display text-base font-bold text-ink">
            Data yang kami simpan
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
            <li>
              <span className="text-ink">Dari akun Google lo:</span> alamat email,
              nama tampilan, dan foto profil. Itu aja — kami tidak minta akses ke
              Gmail, Drive, Kontak, atau layanan Google lainnya.
            </li>
            <li>
              <span className="text-ink">Profil kreator:</span> niche, target
              audiens, gaya bahasa, dan preferensi lain yang lo isi sendiri saat
              setup.
            </li>
            <li>
              <span className="text-ink">Hasil yang dibikin:</span> ide, hook, script,
              dan dokumen yang dibuat lewat aplikasi ini, beserta rating yang lo
              kasih.
            </li>
            <li>
              <span className="text-ink">Catatan kredit:</span> riwayat pemakaian
              dan penambahan kredit.
            </li>
            <li>
              <span className="text-ink">Bukti transfer:</span> kalau lo top up
              manual. File ini dihapus permanen begitu transaksinya diproses.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-ink">
            Kenapa disimpan
          </h2>
          <p className="mt-2 text-muted">
            Email dipakai buat mengenali akun lo. Profil kreator dipakai supaya
            hasilnya nyambung sama gaya lo — itu inti produknya. Catatan
            kredit dipakai supaya saldo lo akurat. Kami tidak menjual data lo dan
            tidak memakainya untuk iklan.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-ink">
            Pihak ketiga
          </h2>
          <p className="mt-2 text-muted">
            Isi yang lo ketik dikirim ke Google Gemini API untuk diproses jadi
            hasil yang dibikin. Data disimpan di Supabase dan aplikasi berjalan di
            Vercel. Ketiganya punya kebijakan privasinya masing-masing.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-ink">
            Hapus akun dan data
          </h2>
          <p className="mt-2 text-muted">
            Kirim permintaan hapus akun melalui menu Laporan di aplikasi Malesan.
            Akun dan semua data yang terkait akan dihapus permanen dalam 7 hari
            kerja. Kredit yang belum terpakai hangus dan tidak bisa diuangkan.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-ink">Kontak &amp; Dukungan</h2>
          <p className="mt-2 text-muted">
            Ada pertanyaan atau kendala seputar data akun lo? Laporkan kendala
            atau kirim saran melalui menu Laporan di dashboard Malesan.
          </p>
        </section>
      </div>
    </main>
  );
}
