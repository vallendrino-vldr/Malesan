# Design Specification: Omnichannel Affiliate Engine, AI Voice Preview, Carousel Generator, & Smart Kanban Schedule Notification

**Date:** 2026-08-25  
**Topic:** 4 Interconnected Creator Features & Precise Kanban Scheduling  
**Target:** Malesan Creator SaaS (Production)

---

## 1. Executive Summary

Pengembangan 4 fitur terintegrasi yang saling tersinkronisasi untuk mempermudah kreator konten Indonesia dari hulu (ideation & affiliate naskah) ke hilir (audio rehearsal, visual slide carousel, dan eksekusi jadwal posting manual dengan notifikasi browser).

---

## 2. Architecture & 4 Feature Specifications

### 🛍️ Feature 1: TikTok Shop & Shopee Affiliate Script Generator (`AffiliateEngine.tsx`)
- **Tujuan**: Membuat naskah video pendek 30-60 detik berkonversi tinggi khusus jualan produk affiliate & keranjang kuning.
- **Form Input**:
  - `productName`: Nama produk (e.g. *Mic Wireless Clip-on K8*)
  - `sellingPoints`: 2-3 keunggulan / harga coret (e.g. *Anti-bising, colok langsung nyala, cuma Rp 39rb*)
  - `style`: Pilihan pendekatan (*Problem-Solution*, *Unboxing & Demo Jujur*, *Flash Sale FOMO*)
- **AI Prompt & Generator (`/api/generate`)**:
  - Menghasilkan 3 varian naskah lengkap dengan Hook 3 detik, Scene breakdown, visual cue keranjang kuning, dan CTA psikologis.
- **Tindakan Lanjutan**:
  - `[ Simpan ke Alur Kanban ]`
  - `[ 🎙️ Dengarkan Naskah ]`
  - `[ 🎨 Jadikan Slide Carousel ]`

---

### 🎙️ Feature 2: AI Voice Preview (`VoicePreview.tsx`)
- **Tujuan**: Membacakan naskah dengan intonasi natural sebelum take video.
- **Mekanisme**:
  - Memanfaatkan Web Speech API native browser (`id-ID`).
  - Pembersih regex otomatis (*Smart Script Stripper*): Membuang teks arahan visual seperti `[Visual: ...]`, `[Teks Layar: ...]`, `(Scene 1)` agar suara yang keluar hanya percakapan/voiceover.
  - Kontrol Kecepatan: `0.85x` (Santai), `1.0x` (Normal), `1.2x` (TikTok Tempo Cepat).
  - UI: Floating audio pill dengan visualizer gelombang dan tombol Play/Pause/Stop.
  - Dipasang pada: `ScriptView.tsx`, `AffiliateEngine.tsx`, dan `DraftEditor.tsx`.

---

### 🎨 Feature 3: AI Carousel / Slide Generator (`CarouselGenerator.tsx`)
- **Tujuan**: Mengubah naskah/poin edukasi menjadi slide visual siap download (PNG) format 4:5 (Instagram Portrait 1080×1350) dan 1:1 (Square).
- **Pilihan Tema Visual**:
  - *Obsidian Ember* (Tema gelap khas Malesan)
  - *Clean Paper* (Minimalis putih & abu-abu)
  - *Bold Emerald* (Gradien modern menarik perhatian)
- **Engine Rendering**:
  - Canvas Capture client-side (`html2canvas` / native SVG-to-Canvas render) $\to$ Instant 1-click PNG batch download tanpa server latency.
- **Akses**:
  - Modul Studio Baru & Tombol di `ScriptView` / `PipelineCardModal`.

---

### 📅 Feature 4: Kanban Manual Date & Time Picker + 🔔 Browser Notification
- **Tujuan**: User bebas menentukan jam posting presisi (misal: *19:30 WIB*) pada setiap kartu Kanban, dan browser akan memunculkan notifikasi pengingat saat jam posting tiba.
- **Skema Database**:
  - `pipeline_cards.scheduled_date` (`date`)
  - `pipeline_cards.scheduled_time` (`text`, e.g. `"19:30"`)
- **UI di Kanban Modal & Kartu**:
  - Picker Tanggal & Waktu Terintegrasi dengan Quick Pills (`12:00 Siang`, `17:00 Sore`, `19:30 Prime Time`, `21:00 Malam`).
  - Sinkronisasi instan ke tampilan Kalender & Kanban.
- **Pengingat Browser / PWA Notification**:
  - Registrasi Notification API di `PwaProvider.tsx` & `notifications.ts`.
  - Pengecekan lokal setiap menit terhadap kartu status `siap` $\to$ Muncul notifikasi:  
    *🔔 "Waktunya Posting Konten!" — [Judul Konten] dijadwalkan jam [19:30] sekarang! Klik untuk lihat naskah.*

---

## 3. Data Flow & Sinkronisasi Sistem

```
[ Ide / Script / Affiliate ] 
          │
          ├──► [ 🎙️ AI Voice Preview ] (Dengarkan naskah sebelum take)
          │
          ├──► [ 🎨 Carousel Generator ] (Ekspor ke Slide PNG Instagram)
          │
          └──► [ 📋 Simpan ke Alur Kanban ]
                     │
                     ▼
       [ ⏰ Set Waktu Manual (Contoh: 19:30 WIB) ]
                     │
                     ▼
  [ 🔔 Notifikasi Browser Otomatis Saat Jam Tiba ]
```

---

## 4. Verification & Testing Plan

1. **Unit & Invariant Tests**: Menambahkan test case untuk prompt affiliate dan notification scheduler.
2. **Database Verification**: Memastikan kolom `scheduled_time` tersimpan dan ter-update dengan benar di Supabase.
3. **Audio Rehearsal Test**: Memastikan Web Speech API membaca teks bersih tanpa membacakan tag visual.
4. **Canvas Slide Export Test**: Memastikan slide ter-render tajam 1080×1350 PNG.
5. **Full Build Gate**: `next build` lolos 100%.
