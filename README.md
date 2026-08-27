# Malesan 🚀

**Males mikirnya. Bukan bikinnya.**

Malesan adalah platform all-in-one AI content workspace modern yang dirancang khusus untuk kreator konten, affiliate marketer, dan video editor di Indonesia. Malesan membantu menghilangkan *blank-page syndrome* dengan mengotomasi riset ide viral, perumusan hook, penulisan script, pembuatan visual carousel, hingga subtitling video otomatis dengan sinkronisasi kata presisi tinggi.

🌐 **Live URL:** [malesan.my.id](https://malesan.my.id)

---

## ⚡ Fitur Utama

- **Ide Hari Ini & Idea Engine**: Generator ide konten berbasis tren Indonesia terkini dengan analisis formula viral dan target audiens.
- **Hook Lab**: Pembuat hook pembuka video dengan retensi tinggi untuk TikTok, Instagram Reels, dan YouTube Shorts.
- **Script Studio**: Penulisan naskah video terstruktur (Hook, Retain, Payoff, CTA) dengan dukungan autosave dan tab completion.
- **Content Repurpose & Thread Engine**: Mengubah satu ide menjadi berbagai format konten (X thread, carousel slide, script pendek, caption panjang).
- **Video Auto-CC Editor**: Subtitling video otomatis berbasis WebCodecs & Groq Whisper dengan rendering GPU client-side, efek pop/karaoke per kata, dan zero video server upload (100% aman dan privat di browser pengguna).
- **Creator DNA & Otak Kedua**: Sistem personalisasi gaya bahasa, target audiens, dan referensi materi milik kreator.
- **Pipeline Kanban & Posting Slot**: Manajemen alur kerja konten dari ide, draft, review, hingga jadwal tayang optimal.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) & React 19
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Framer Motion
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL dengan Row Level Security)
- **Audio & Video Processing**: WebCodecs API, `@ffmpeg/ffmpeg` (WebAssembly), Web Audio API
- **AI Infrastructure**: Google Gemini API & Groq Whisper
- **Deployment**: [Vercel](https://vercel.com/)

---

## 🚀 Memulai Pengembangan Lokal

### Prasyarat
- Node.js $\ge 20.x$
- npm atau pnpm

### Instalasi

1. Clone repositori:
```bash
git clone https://github.com/vallendrino-vldr/Malesan.git
cd Malesan
```

2. Instal dependensi:
```bash
npm install
```

3. Siapkan variabel lingkungan (`.env.local`):
```bash
cp .env.example .env.local
```
Isi konfigurasi Supabase dan API keys yang diperlukan pada `.env.local`.

4. Jalankan server pengembangan lokal:
```bash
npm run dev
```
Buka browser di `http://localhost:3000`.

---

## 🧪 Pengujian & Build

```bash
# Menjalankan pengujian unit & invarian
npm test

# Menjalankan linter ESLint
npm run lint

# Kompilasi build produksi
npm run build
```

---

## 📄 Lisensi & Hak Cipta

Hak Cipta © 2026 Malesan. Seluruh hak cipta dilindungi undang-undang.
