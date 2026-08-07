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
