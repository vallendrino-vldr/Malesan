# Tutorial Malesan 60 detik

Tujuan video: user yang belum pernah memakai tool AI paham satu alur inti tanpa
harus membaca dokumentasi: pilih kebutuhan, dapat konten, lalu salin atau simpan.

## Lokasi di aplikasi

Video tampil paling atas di sheet **Cara pakai**, tepat setelah ringkasan tiga
langkah. Komponen sudah menyiapkan slot responsif di `TutorialSheet.tsx`.

- MP4: isi environment `NEXT_PUBLIC_TUTORIAL_VIDEO_URL`.
- Caption WebVTT: isi `NEXT_PUBLIC_TUTORIAL_CAPTIONS_URL`.
- Rasio: 16:9, H.264/AAC, 1080p, target di bawah 12 MB.
- Video tidak ditampilkan sebelum URL tersedia, jadi user tidak melihat
  placeholder atau tombol mati.

## Script suara

**0–6 detik**

“Bingung mau bikin konten apa? Mulai dari Ide Hari Ini. Lo gak perlu nulis ide.”

**6–18 detik**

“Pilih mau posting di TikTok, Threads, Facebook, atau tempat lain. Terus pilih
tujuannya: cari views, jualan, branding, edukasi, atau ngajak ngobrol.”

**18–34 detik**

“Tap Kasih 3 ide. Malesan bakal nyiapin tiga pilihan yang sesuai platform lo,
lengkap sama pembuka, alur, tulisan siap pakai, dan caption.”

**34–46 detik**

“Kalau udah cocok, tap Salin konten buat langsung dipakai. Mau dilanjutin nanti?
Simpan ke Alur.”

**46–56 detik**

“Biar hasil berikutnya makin nyambung, isi Profil Konten Lo. Bisa beda profil
buat akun pribadi, bisnis, atau klien.”

**56–60 detik**

“Udah. Males mikirnya, bukan bikinnya.”

## Storyboard

| Waktu | Visual | Penekanan |
|---|---|---|
| 0–6 | Dashboard mobile, tap **Ide Hari Ini** | Satu fokus, tanpa cursor berputar-putar |
| 6–18 | Tap TikTok/Reels lalu **Jualan** | Zoom ringan pada state aktif |
| 18–34 | Tap CTA; tampilkan status nyata sampai kartu hasil muncul | Jangan mempercepat progress palsu |
| 34–46 | Buka konten, tap **Salin konten**, lalu **Simpan ke Alur** | Tampilkan feedback “Udah tersalin” |
| 46–56 | Tab Profil, sorot kartu **Profil konten lo** | Contoh label: Pribadi, Toko, Klien |
| 56–60 | Kembali ke dashboard dan wordmark | Tutup bersih, tanpa daftar fitur |

## Produksi dan aksesibilitas

- Rekam dari viewport 375×812 agar sama dengan pengalaman mayoritas user.
- Gunakan data contoh UMKM fiktif; jangan tampilkan email, saldo, atau konten user asli.
- Semua ucapan wajib ada di file VTT dan tetap terbaca saat audio mati.
- Hindari musik keras, gerakan cepat, dan teks kecil.
- Setelah aset dipasang, cek Chrome Android, Safari iPhone, mode gelap/terang,
  reduced motion, dan koneksi lambat sebelum dianggap selesai.
