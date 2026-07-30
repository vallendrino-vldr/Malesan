import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ketentuan Layanan — Malesan",
  description: "Aturan pakai Malesan, sistem kredit, dan batasannya.",
};

/**
 * Paired with the privacy policy for the Google OAuth consent screen. Also the
 * place the credit system is described in plain terms — a paid balance with no
 * written terms is the thing that makes a product look like a scam, which is
 * exactly the impression the owner was worried about.
 */
export default function KetentuanPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <Link href="/" className="text-sm text-muted transition-colors hover:text-ink">
        ← Balik
      </Link>

      <h1 className="mt-6 font-display text-2xl font-bold tracking-display-md text-ink">
        Ketentuan Layanan
      </h1>
      <p className="mt-2 text-sm text-muted">Berlaku sejak 30 Juli 2026.</p>

      <div className="mt-8 space-y-7 text-sm leading-relaxed text-ink/85">
        <section>
          <h2 className="font-display text-base font-bold text-ink">
            Apa ini
          </h2>
          <p className="mt-2 text-muted">
            Malesan bantu kreator konten Indonesia bikin ide, hook, dan script
            pakai AI. Buat pakai, lo perlu akun Google.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-ink">Kredit</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
            <li>Tiap akun dapat kredit gratis yang direset tiap hari jam 00:00 WIB.</li>
            <li>
              Kredit gratis yang gak kepakai <span className="text-ink">hangus</span>{" "}
              saat reset. Kredit berbayar tidak hangus.
            </li>
            <li>Tiap fitur punya harga kredit yang ditampilkan sebelum lo pakai.</li>
            <li>
              Kalau generate gagal karena kesalahan sistem kami, kredit lo
              dikembalikan otomatis.
            </li>
            <li>
              Kredit berbayar{" "}
              <span className="text-ink">tidak bisa diuangkan kembali</span> dan
              tidak bisa dipindah ke akun lain.
            </li>
            <li>
              Top up diproses manual dan biasanya masuk dalam 1×24 jam setelah
              bukti transfer diterima.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-ink">
            Hasil generate
          </h2>
          <p className="mt-2 text-muted">
            Hasil yang lo generate jadi milik lo — bebas dipakai buat konten
            komersial. Tapi AI bisa salah: cek dulu fakta, angka, dan klaim
            sebelum diposting. Kami tidak bertanggung jawab atas konten yang lo
            terbitkan.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-ink">
            Yang gak boleh
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
            <li>Bikin konten yang menyesatkan, memfitnah, atau melanggar hukum Indonesia.</li>
            <li>Bikin banyak akun buat ngakalin jatah kredit gratis.</li>
            <li>Otomatisasi atau scraping terhadap layanan ini.</li>
          </ul>
          <p className="mt-2 text-muted">
            Akun yang melanggar bisa dibekukan tanpa pengembalian kredit.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-ink">
            Status layanan
          </h2>
          <p className="mt-2 text-muted">
            Layanan ini dijalankan sendirian dan masih terus dikembangkan.
            Fitur bisa berubah, dan kadang bisa ada gangguan. Kalau ada
            perubahan besar pada ketentuan ini, kami umumkan di aplikasi.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-bold text-ink">Kontak</h2>
          <p className="mt-2 text-muted">
            <a
              href="mailto:vadlyvldr@gmail.com"
              className="text-ember underline-offset-2 hover:underline"
            >
              vadlyvldr@gmail.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
