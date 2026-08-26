import "server-only";
import { type CreatorDna } from "../supabase/database.types";
import {
  buildEngineContext,
  type LearnedNote,
  type PromptExtras,
  type TrendCard,
} from "./index";

/**
 * Niche workflow engines.
 *
 * The five original modules are deliberately general — they work for any
 * creator. That is also their ceiling: a general tool produces a general answer,
 * and a general answer is the thing a creator can already get free elsewhere in
 * thirty seconds.
 *
 * These two are the opposite bet. Each knows one job well enough to ask for the
 * right input and to reject the wrong output shape:
 *
 *   - a clip engine that thinks in seconds, cuts and on-screen text, because a
 *     stream highlight lives or dies on the first two seconds and the edit;
 *   - a thread engine that thinks in posts, where every post has to survive
 *     being read alone, because that is how a timeline actually delivers them.
 *
 * They share the whole context layer (DNA, trends, ratings, shadow prompt,
 * reference material, persona, CTA) — only the brief and the schema differ.
 */

export const CLIP_ENGINE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    hook_line: { type: "string" },
    hook_visual: { type: "string" },
    beats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timestamp: { type: "string" },
          spoken: { type: "string" },
          visual: { type: "string" },
          on_screen_text: { type: "string" },
          edit_note: { type: "string" },
        },
        required: ["timestamp", "spoken", "visual", "on_screen_text", "edit_note"],
      },
    },
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    thumbnail_idea: { type: "string" },
  },
  required: ["title", "hook_line", "hook_visual", "beats", "caption", "hashtags", "thumbnail_idea"],
};

export const THREAD_ENGINE_SCHEMA = {
  type: "object",
  properties: {
    hook_post: { type: "string" },
    posts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          order: { type: "number" },
          text: { type: "string" },
          role: { type: "string" },
        },
        required: ["order", "text", "role"],
      },
    },
    closing_post: { type: "string" },
    alt_hooks: { type: "array", items: { type: "string" } },
  },
  required: ["hook_post", "posts", "closing_post", "alt_hooks"],
};

/**
 * Streaming / gaming clip engine.
 *
 * `moment` is the creator's own description of what happened on stream, which
 * is nearly always unstructured and full of in-jokes — so the prompt asks the
 * model to find the beat rather than to summarise the paragraph.
 */
export function buildClipEnginePrompt(
  moment: string,
  platform: string,
  duration: string,
  dna: CreatorDna | null,
  trends: TrendCard[],
  learned?: LearnedNote[],
  extras?: PromptExtras,
): string {
  const shared = buildEngineContext(dna, trends, learned, extras);

  return `${shared}
Kreator ini streamer/gamer. Dia baru ngalamin momen ini pas live:

"${moment}"

Bikin script short video (${duration}, buat ${platform}) dari momen itu.

YANG HARUS LO PAHAM SOAL KLIP STREAM:
- Penonton klip GAK nonton stream-nya. Mereka gak tau konteks, gak kenal nama
  orang di chat, gak tau ini game apa. Dua detik pertama harus ngasih konteks
  DAN alasan buat lanjut nonton, sekaligus.
- Momen lucu di stream sering gak lucu pas dipotong, karena yang bikin lucu itu
  build-up 10 menit sebelumnya. Kalau momennya begitu, bilang terus terang di
  hook_visual gimana cara ngasih build-up-nya dalam 2 detik.
- Reaksi muka kreator lebih penting dari gameplay-nya. Kasih tau kapan harus
  ke facecam, kapan ke gameplay.
- Klip tanpa teks di layar mati di mute autoplay. Tiap beat wajib ada
  on_screen_text — pendek, bukan transkrip.

edit_note itu instruksi editing beneran: jump cut, zoom, slow-mo, freeze frame,
sound effect, replay. Sebutin yang spesifik, jangan "bikin menarik".

JSON:
{
  "title": "judul klip, maksimal 8 kata",
  "hook_line": "kalimat pertama yang diucapin, maksimal 12 kata",
  "hook_visual": "apa yang keliatan di 2 detik pertama",
  "beats": [
    {
      "timestamp": "0-3s",
      "spoken": "yang diomongin",
      "visual": "yang keliatan (facecam / gameplay / overlay)",
      "on_screen_text": "teks di layar, pendek",
      "edit_note": "instruksi editing spesifik"
    }
  ],
  "caption": "caption buat postingannya",
  "hashtags": ["tag tanpa tanda pagar"],
  "thumbnail_idea": "ide thumbnail/cover, 1 kalimat"
}`;
}

/**
 * Market / tech thread engine.
 *
 * The input is raw bullet points — today's numbers, a changelog, meeting notes.
 * The value is entirely in the ordering and the compression, so the prompt
 * spends its instruction budget on those two things.
 */
export function buildThreadEnginePrompt(
  bullets: string,
  platform: string,
  dna: CreatorDna | null,
  trends: TrendCard[],
  learned?: LearnedNote[],
  extras?: PromptExtras,
): string {
  const shared = buildEngineContext(dna, trends, learned, extras);

  return `${shared}
Kreator ini bahas market/tech. Ini data mentah yang dia punya hari ini:

"${bullets}"

Olah jadi thread ${platform} yang orang mau baca sampai habis.

YANG HARUS LO PAHAM SOAL THREAD:
- Post pertama nentuin semuanya. Kalau dia gak bikin orang penasaran ATAU
  ngasih angka yang bikin kaget, sisa thread-nya gak akan kebaca.
- Tiap post harus berdiri sendiri. Orang nge-scroll timeline bisa ketemu post
  ke-4 duluan tanpa konteks. Jangan mulai post dengan "Selain itu" atau "Nah".
- ANGKA adalah nyawanya. Pakai angka dari data mentah di atas apa adanya.
  JANGAN bulatkan jadi angka cantik, jangan ngarang angka yang gak ada di situ.
  Kalau datanya gak ada angka, bilang di post-nya kalau itu observasi, bukan data.
- Panjang tiap post beda-beda. Thread yang semua post-nya sama panjang kelihatan
  banget dibikin mesin.
- Jangan pernah kasih saran investasi atau ngomong "pasti naik/turun". Jelasin
  apa yang kejadian dan kenapa itu penting, biar pembaca yang nyimpulin.

role itu fungsi post-nya: "konteks" | "data" | "analisis" | "kontras" |
"implikasi" | "penutup". Jangan dua post berturut-turut punya role yang sama.

Bikin 5-8 post isi, di luar hook dan penutup.

JSON:
{
  "hook_post": "post pertama, yang narik orang masuk",
  "posts": [
    { "order": 1, "text": "isi post", "role": "konteks" }
  ],
  "closing_post": "post penutup",
  "alt_hooks": ["2 alternatif hook kalau yang pertama kurang nendang"]
}`;
}

export const AFFILIATE_ENGINE_SCHEMA = {
  type: "object",
  properties: {
    product_name: { type: "string" },
    key_appeal: { type: "string" },
    variants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          angle_name: { type: "string" },
          hook_spoken: { type: "string" },
          hook_visual: { type: "string" },
          scenes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                scene: { type: "number" },
                duration: { type: "string" },
                spoken: { type: "string" },
                visual: { type: "string" },
                on_screen_text: { type: "string" },
              },
              required: ["scene", "duration", "spoken", "visual", "on_screen_text"],
            },
          },
          cta_fomo: { type: "string" },
          caption: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
        },
        required: ["angle_name", "hook_spoken", "hook_visual", "scenes", "cta_fomo", "caption", "hashtags"],
      },
    },
  },
  required: ["product_name", "key_appeal", "variants"],
};

/**
 * TikTok Shop & Shopee Affiliate Short Video Script Engine.
 */
export function buildAffiliateEnginePrompt(
  productName: string,
  sellingPoints: string,
  style: string,
  dna: CreatorDna | null,
  trends: TrendCard[],
  learned?: LearnedNote[],
  extras?: PromptExtras,
): string {
  const shared = buildEngineContext(dna, trends, learned, extras);

  return `${shared}
Tugas lo adalah bikin 3 VARIAN NASKAH VIDEO PENDEK (30-60 detik) berkonversi tinggi untuk jualan affiliate TikTok Shop / Shopee / Reels.

PRODUK YANG DIJUAL:
Nama Produk: "${productName}"
Keunggulan / Detail Harga: "${sellingPoints}"
Gaya Pendekatan Pilihan: "${style || "Campuran (Masalah, Demo Jujur, Flash Sale)"}"

ATURAN PSIKOLOGI KONVERSI & AFFILIATE INDONESIA:
1. HOOK PATTERN INTERRUPT (DETIK 0-3):
   - JANGAN buka dengan basa-basi "Halo guys hari ini aku mau review...". Itu trigger orang langsung swipe up.
   - Buka dengan paradoks masalah harian, rahasia harga diskon gila, atau aksi visual heboh (misal: banting barang/uji ketahanan).
2. ANATOMI 3 VARIAN KONVERSI TINGGI:
   - Varian 1 (PAS - Problem Agitate Solution): Fokus ke rasa kesal penonton saat masalah terjadi -> produk ini solusinya.
   - Varian 2 (Uji Ketahanan & Demo Jujur): Tunjukkan tes nyata (kualitas bahan, keaslian, kepraktisan) tanpa klaim berlebihan.
   - Varian 3 (FOMO Flash Sale & Keranjang Kuning): Mainkan Loss Aversion (promo tinggal hari ini, gratis ongkir, stok rebutan).
3. PACING 3 DETIK & VISUAL CUES:
   - Setiap 3-5 detik wajib ganti shot kamera: unboxing, zoom tekstur barang, pemakaian nyata di badan/meja, hingga tunjuk keranjang kuning di kiri bawah.
4. CALL TO ACTION (CTA) FOMO:
   - Berikan alasan logis kenapa harus check out SEKARANG (voucher gratis ongkir klaim dulu, harga promo besok balik normal).
5. BAHASA:
   - Bahasa Indonesia lisan yang santai, luwes, dan meyakinkan seperti teman dekat yang lagi spill barang bagus.

Format JSON Wajib:
{
  "product_name": "${productName}",
  "key_appeal": "${sellingPoints}",
  "variants": [
    {
      "angle_name": "Solusi Masalah Keseharian",
      "hook_spoken": "Kalimat pembuka 3 detik pertama yang bikin orang berhenti scrolling",
      "hook_visual": "Tindakan di layar saat hook diucapkan (misal: pegang produk sambil pasang muka bingung)",
      "scenes": [
        {
          "scene": 1,
          "duration": "00:00-00:04",
          "spoken": "Kalimat naskah yang diucapkan kreator",
          "visual": "Aksi visual di kamera (misal: tunjuk barang, zoom in)",
          "on_screen_text": "Teks singkat pemikat di layar"
        }
      ],
      "cta_fomo": "Kalimat penutup ajakan klik keranjang kuning kiri bawah",
      "caption": "Caption menarik + pertanyaan pemancing komentar",
      "hashtags": ["racuntiktok", "affiliate", "reviewjujur"]
    }
  ]
}`;
}

export const CAROUSEL_ENGINE_SCHEMA = {
  type: "object",
  properties: {
    topic_title: { type: "string" },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" }, // "cover" | "point" | "stat" | "cta"
          badge: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          stat_number: { type: "string" },
          stat_label: { type: "string" },
          footer: { type: "string" },
        },
        required: ["type", "badge", "title", "body", "footer"],
      },
    },
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
  },
  required: ["topic_title", "slides", "caption", "hashtags"],
};

/**
 * AI Carousel & Slide Deck Generator Engine.
 */
export function buildCarouselEnginePrompt(
  topic: string,
  slideCount: number,
  platform: string,
  dna: CreatorDna | null,
  trends: TrendCard[],
  learned?: LearnedNote[],
  extras?: PromptExtras,
): string {
  const shared = buildEngineContext(dna, trends, learned, extras);
  const count = Math.min(Math.max(slideCount || 5, 4), 7);

  return `${shared}
Tugas lo adalah merancang 1 SET KONTEN CAROUSEL / SLIDE CARD VISUAL yang sangat mewah, tajam, bernilai tinggi, dan viral untuk Instagram & LinkedIn (${count} slide).

TOPIK / DRAFT / IDE KONTEN:
"${topic}"
TARGET JUMLAH SLIDE: ${count} Slide
PLATFORM UTAMA: ${platform || "Instagram & LinkedIn"}

STRUKTUR ANATOMI CAROUSEL FLAGSHIP:
1. SLIDE 1 (COVER HOOK - 'cover'):
   - Badge: Label kategori / Niche (misal: "STRATEGI KONTEN", "FRAMEWORK 10X", "BEDAH KASUS").
   - Title: Judul Hook yang super punchy, bikin penasaran, dan mematahkan asumsi umum (maksimal 8-12 kata).
   - Body: Subtitle 1 kalimat yang menjelaskan keuntungan jika membaca sampai habis.
   - Footer: "Geser ke samping ➔"

2. SLIDE 2 s/d ${count - 1} (ISI / INSIGHT / BUKTI - 'point' atau 'stat'):
   - Campurkan variasi slide 'point' (langkah/strategi konkret) dan 'stat' (fakta/angka mengejutkan jika relevan).
   - Badge: Penanda urutan (misal: "LANGKAH #1", "FAKTA MENGEJUTKAN", "KESALAHAN FATAL").
   - Title: Header poin yang tegas, actionable, dan tidak bertele-tele.
   - Body: Penjelasan tajam 2-3 kalimat yang nyaman dibaca di layar HP (tidak berparagraf tebal).
   - Stat (jika tipe 'stat'): Isi stat_number (misal: "87%", "10x", "3 Detik") dan stat_label (penjelasan singkat di bawah angka).
   - Footer: "Slide N dari ${count}"

3. SLIDE TERAKHIR (KESIMPULAN & CTA - 'cta'):
   - Badge: "ACTION STEP" / "KESIMPULAN"
   - Title: Ajakan bertindak / Ringkasan utama dalam 1 kalimat berbobot.
   - Body: Panduan praktis untuk mulai mempraktikkan hari ini.
   - Footer: "Simpan & bagikan postingan ini ✨"

4. CAPTION & HASHTAGS:
   - Tuliskan caption Instagram/LinkedIn yang rapi, ada hook, ringkasan bullet points, dan pertanyaan pemancing komentar (engagement trigger).

Format JSON Wajib:
{
  "topic_title": "${topic.slice(0, 40)}",
  "slides": [
    {
      "type": "cover",
      "badge": "PANDUAN LENGKAP",
      "title": "Judul Hook Utama",
      "body": "Penjelasan singkat sub-hook penarik perhatian.",
      "footer": "Geser ke samping ➔"
    }
  ],
  "caption": "Teks caption lengkap dengan spacing rapi...",
  "hashtags": ["tipsbisnis", "carouseltips", "malesan"]
}`;
}
