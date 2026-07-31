import "server-only";
import { type CreatorDna } from "../supabase/database.types";

export type TrendCard = {
  title: string;
  summary: string | null;
  category: string | null;
  content_angle?: string | null;
};

export const IDE_HARI_INI_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          angle: { type: "string" },
          why_now: { type: "string" },
          format: { type: "string" },
          est_duration: { type: "string" },
          difficulty: { type: "string" },
        },
        required: ["title", "angle", "why_now", "format", "est_duration", "difficulty"],
      },
    },
  },
  required: ["ideas"],
};

export const IDEA_ENGINE_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          angle: { type: "string" },
          why_now: { type: "string" },
          format: { type: "string" },
          est_duration: { type: "string" },
          difficulty: { type: "string" },
          hook_seed: { type: "string" },
        },
        required: ["title", "angle", "why_now", "format", "est_duration", "difficulty", "hook_seed"],
      },
    },
  },
  required: ["ideas"],
};

export const CREATOR_DNA_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    persona_summary: { type: "string" },
    signature_formats: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["persona_summary", "signature_formats"],
};

export const HOOK_LAB_SCHEMA = {
  type: "object",
  properties: {
    hooks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          pattern: { type: "string" },
          score: { type: "number" },
          why: { type: "string" }
        },
        required: ["text", "pattern", "score", "why"]
      }
    }
  },
  required: ["hooks"]
};

export const SCRIPT_BUILDER_SCHEMA = {
  type: "object",
  properties: {
    script: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timestamp: { type: "string" },
          spoken: { type: "string" },
          visual: { type: "string" },
          on_screen_text: { type: "string" }
        },
        required: ["timestamp", "spoken", "visual", "on_screen_text"]
      }
    },
    cta: {
      type: "object",
      properties: {
        text: { type: "string" },
        placement: { type: "string" }
      },
      required: ["text", "placement"]
    },
    caption: { type: "string" },
    hashtags: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["script", "cta", "caption", "hashtags"]
};

export const REPURPOSE_SCHEMA = {
  type: "object",
  properties: {
    tiktok: { type: "string" },
    instagram: { type: "string" },
    youtube: { type: "string" },
    x: { type: "string" },
    threads: { type: "string" }
  }
  // No strict required array, since they might only output for specific platforms, but we can demand all 5.
  // The PRD says "Output keyed by platform: tiktok, instagram, youtube, x, threads." Let's require all 5.
};

/**
 * One past generation the creator rated, with its score.
 *
 * `performance_rating` has been collected on every pipeline card and generation
 * since the ledger work and nothing ever read it. Ratings that only travel one
 * way are a survey, not a feedback loop — this is what turns them into one.
 */
export type LearnedNote = {
  module: string;
  rating: number;
  gist: string;
};

/**
 * Both ends matter. Showing only winners teaches the model what to imitate but
 * not what to avoid, and a creator's 1-star posts are usually more diagnostic
 * than their 5-star ones.
 */
function buildLearned(learned: LearnedNote[]): string {
  const good = learned.filter((l) => l.rating >= 4).slice(0, 4);
  const bad = learned.filter((l) => l.rating <= 2).slice(0, 3);
  if (!good.length && !bad.length) return "";

  let s = `\nAPA YANG UDAH KEBUKTI BUAT KREATOR INI:\n`;
  if (good.length) {
    s += `Yang perform bagus (dia kasih rating tinggi):\n`;
    for (const g of good) s += `- [${g.module}] ${g.gist}\n`;
  }
  if (bad.length) {
    s += `Yang gagal (rating rendah) — jangan diulang polanya:\n`;
    for (const b of bad) s += `- [${b.module}] ${b.gist}\n`;
  }
  s += `Tiru polanya, bukan topiknya. Jangan bikin ulang konten yang sama.\n`;
  return s;
}

function buildSharedContext(
  dna: CreatorDna | null,
  trends: TrendCard[],
  learned?: LearnedNote[],
): string {
  // A named craft identity, not "an AI assistant for creators". The role
  // decides what the model thinks good looks like before a single rule is read,
  // and "asisten" produces the output of an assistant: agreeable and safe.
  let context =
    `Lo penulis konten yang udah lima tahun kerja bareng kreator Indonesia dan udah\n` +
    `hafal bedanya konten yang ditonton sampai habis sama konten yang di-skip di\n` +
    `detik kedua. Lo gak sopan-sopanan sama ide jelek, termasuk ide lo sendiri.\n`;

  if (dna) {
    // The onboarding flow spends 2 credits distilling everything above into one
    // sharp sentence, stores it as `ai_persona_summary` — and then no prompt
    // ever read it. It is the single most useful line in the profile, so it
    // leads, before the raw fields it was derived from.
    if (dna.ai_persona_summary) {
      context += `\nPERSONA KREATOR INI (pegang ini kuat-kuat):\n${dna.ai_persona_summary}\n`;
    }

    context += `\nPROFIL KREATOR:\n`;
    if (dna.niche) context += `- Niche: ${dna.niche}\n`;
    if (dna.industry) context += `- Bidang/industri: ${dna.industry}\n`;
    if (dna.target_audience) context += `- Target audience: ${dna.target_audience}\n`;
    if (dna.tone) context += `- Tone: ${dna.tone}\n`;
    if (dna.persona_style) context += `- Gaya persona: ${dna.persona_style}\n`;
    if (typeof dna.humor_level === "number") {
      context += `- Level humor: ${dna.humor_level}/10 (0 = serius/edukatif, 10 = komedi duluan)\n`;
    }
    if (dna.experience_level) context += `- Jam terbang: ${dna.experience_level}\n`;
    if (dna.content_pillars?.length) context += `- Pilar konten: ${dna.content_pillars.join(", ")}\n`;
    if (dna.posting_frequency) context += `- Frekuensi posting: ${dna.posting_frequency}\n`;
    if (dna.goals) context += `- Yang dia kejar: ${dna.goals}\n`;
    if (dna.reference_creators) context += `- Kreator referensi: ${dna.reference_creators}\n`;
    if (dna.platforms && dna.platforms.length > 0) context += `- Platform utama: ${dna.platforms.join(", ")}\n`;
    context += `- Bahasa output: ${dna.output_language || 'id'}\n`;
    if (dna.banned_words && dna.banned_words.length > 0) context += `- Kata yang HARUS dihindari: ${dna.banned_words.join(", ")}\n`;
    if (dna.brand_notes) context += `- Catatan brand: ${dna.brand_notes}\n`;

    // POV. A creator posting for themselves and a creator producing for a
    // client are writing as different people. Defaulting everything to
    // first-person-owner made client work read wrong in a way no amount of
    // tone tuning could fix.
    context += `\nSUDUT PANDANG NARASI:\n`;
    if (dna.work_context === "klien") {
      context += `- Kreator ini bikin konten UNTUK KLIEN, bukan buat dirinya sendiri.\n`;
      context += `- Jangan nulis pengalaman pribadi sebagai pemilik usaha. Dia orang di balik kamera.\n`;
      context += `- Aman: sudut pandang orang kedua ke audiens, atau narasi atas nama brand.\n`;
      if (dna.client_brief) context += `- Tentang kliennya: ${dna.client_brief}\n`;
    } else if (dna.work_context === "brand") {
      context += `- Kreator ini in-house, ngomong ATAS NAMA brand. Pakai "kami", bukan "gue".\n`;
      context += `- Boleh klaim soal produk, tapi jangan ngarang fitur yang gak disebutin.\n`;
      if (dna.client_brief) context += `- Tentang brand-nya: ${dna.client_brief}\n`;
    } else {
      context += `- Personal brand. Orang pertama, "gue". Pengalaman pribadi boleh dipakai.\n`;
    }
  } else {
    // No DNA yet — the first generation happens before onboarding by design.
    context += `\nCATATAN: Kreator ini belum ngisi profil. Pakai gaya kreator Indonesia`;
    context += ` yang ngobrol santai dan orang pertama, dan jangan ngarang detail personal.\n`;
  }

  if (trends && trends.length > 0) {
    context += `\nKONTEKS TREN HARI INI:\n`;
    for (const t of trends) {
      context += `- ${t.title} (${t.category}): ${t.summary} -> Angle: ${t.content_angle}\n`;
    }
    // Trends were being injected with no instruction on how to use them, so the
    // model treated them as topics to copy. They are context, not a brief.
    context += `Pakai tren cuma kalau nyambung sama niche dia. Maksa nyambungin tren`;
    context += ` yang gak relevan itu ketahuan banget dan bikin kontennya murahan.`;
    context += ` Kalau gak ada yang cocok, abaikan aja.\n`;
  }

  if (learned?.length) context += buildLearned(learned);

  context += `\nATURAN:\n`;
  context += `- Bahasa Indonesia yang natural dan ngobrol, bukan bahasa terjemahan.\n`;
  context += `- Jangan pernah nyaranin konten clickbait bohong atau menyesatkan.\n`;

  context += CRAFT_RULES;

  context += `\nBalas HANYA JSON valid. Tanpa \`\`\`json, tanpa penjelasan tambahan.\n`;

  return context;
}

/**
 * The craft layer.
 *
 * The old version of this was a list of banned phrases — "di era digital ini",
 * "mari kita", and so on. That catches the vocabulary of machine-written
 * Indonesian and nothing else, which is why output kept reading as AI even with
 * every forbidden word absent.
 *
 * What actually gives it away is structural, and none of it was addressed:
 *
 *   - Every item in a set has the same shape and nearly the same length.
 *   - Every explanation uses one sentence frame, repeated.
 *   - Nothing is checkable. No prices, no model names, no numbers.
 *   - The first idea is always the obvious one, and it is kept.
 *
 * A baseline run made all four visible at once: three ideas whose `why_now`
 * fields were the same template three times over ("X naik, anak muda pasti…").
 * Every banned word was correctly avoided. It still read like a machine.
 *
 * So these rules constrain *shape*, demand at least one falsifiable specific,
 * and require the model to throw away its own first answer — which is the one
 * thing that reliably gets past the obvious.
 *
 * Written once and shared by every module rather than per-prompt: the tells are
 * the same everywhere, and a rule that lives in six places drifts in six
 * directions.
 */
const CRAFT_RULES = `
CARA NULIS BIAR GAK KEDENGERAN KAYAK AI:

1. BUANG JAWABAN PERTAMA LO.
   Ide pertama yang muncul di kepala lo itu juga ide pertama yang muncul di
   kepala semua orang. Kalau sebuah ide bisa dipakai kreator lain di niche lain
   tanpa diubah, berarti itu belum jadi ide — itu template. Ganti.

2. WAJIB ADA YANG KONKRET DAN BISA DICEK.
   Tiap output harus punya minimal satu: angka, harga, nama produk/merek, tahun,
   durasi, atau kejadian spesifik. "Motor bekas yang irit" itu kosong.
   "Beat karbu 2015 di bawah 8 juta" itu isi.

3. BENTUKNYA HARUS BEDA-BEDA.
   Kalau lo bikin beberapa item sekaligus, jangan semuanya sepanjang dan
   sebentuk yang sama. Variasikan: ada yang pertanyaan, ada yang pernyataan
   tajam, ada yang cerita, ada yang angka. Kalau semua item pakai kerangka
   kalimat yang sama, itu ketahuan banget mesin yang nulis.

4. ALASAN JANGAN PAKAI TEMPLATE.
   Jangan jelasin semua item pakai pola kalimat yang sama persis. Tiap
   penjelasan berdiri sendiri. Konkretnya: dua item gak boleh punya kata
   pembuka yang sama, dan gak boleh dua-duanya pakai kerangka
   "[peristiwa] + [makanya orang bakal ...]". Kalau lo udah pakai kerangka itu
   sekali, item berikutnya harus masuk dari arah lain — misal langsung ke
   angkanya, ke pengalaman orangnya, atau ke bantahan anggapan umum.

5. KALIMAT PENDEK DAN PANJANG DISELANG-SELING.
   Ritme datar itu ciri tulisan mesin. Kadang tiga kata. Kadang satu kalimat
   panjang yang jalan terus sampai orangnya kehabisan napas dan baru berhenti.

6. HARAM DIPAKAI:
   "di era digital ini", "mari kita", "tak dapat dipungkiri", "sangatlah
   penting", "dalam dunia yang serba cepat", "bukan cuma X, tapi juga Y",
   "rahasia yang jarang diketahui", "wajib kamu tahu", "simak ulasannya".

7. JANGAN BUKA PAKAI DEFINISI ATAU BASA-BASI. Kalimat pertama langsung ke inti.

8. JANGAN MENGGURUI. Sejajar sama penonton, bukan di atasnya. Emoji bukan
   pengganti isi — jangan tiap poin dikasih emoji.

CONTOH BEDANYA (niche motor bekas):

  Lembek (jangan begini):
    judul  : "Tips Membeli Motor Bekas Agar Tidak Menyesal"
    angle  : "Membahas hal-hal penting yang perlu diperhatikan saat membeli motor bekas"
    why_now: "Banyak orang ingin membeli motor bekas namun masih ragu"
  Kenapa jelek: gak ada satu pun detail yang bisa dicek, judulnya bisa dipakai
  siapa aja, dan alasannya cuma mengulang judul pakai kata lain.

  Tajam (begini):
    judul  : "Beat Karbu 8 Juta: Cek Baut Ini Dulu"
    angle  : "Gue bongkar satu baut CVT yang biasanya udah dislek pedagang buat nutupin suara kasar — 10 detik ngecek, hemat 1,5 juta servis"
    why_now: "Stok Beat karbu 2014-2016 lagi banjir di lapak dan mayoritas bekas ojol"
  Kenapa bagus: ada angka, ada tindakan yang bisa langsung dilakukan penonton,
  dan alasannya bawa informasi baru — bukan mengulang judul.
`;

export function buildIdeHariIniPrompt(dna: CreatorDna | null, trends: TrendCard[], learned?: LearnedNote[]): string {
  const today = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const shared = buildSharedContext(dna, trends, learned);

  return `${shared}
Kreator ini buka aplikasi dan gak tau mau bikin apa hari ini. Tanggal: ${today}.

Kasih 3 ide konten yang paling masuk akal buat dia HARI INI, berdasarkan profil
dan tren di atas. Tiap ide harus terasa personal — bukan ide generik yang bisa
dipakai siapa aja.

Ketiganya harus BEDA JENIS, bukan cuma beda topik. Ambil satu dari tiga arah ini
masing-masing:
  a. Nyambung ke sesuatu yang baru kejadian (tren, harga, kebijakan).
  b. Kesalahan atau salah kaprah yang udah lama ada di niche ini — gak
     bergantung tren, tetap relevan kapan aja.
  c. Perbandingan atau vonis: dua pilihan diadu, terus lo pilih satu.

Formatnya juga jangan sama semua. Kalau dua ide udah "talking head", yang ketiga
cari yang lain.

JSON:
{
  "ideas": [
    {
      "title": "judul singkat, maksimal 8 kata",
      "angle": "sudut pandang uniknya, 1 kalimat",
      "why_now": "kenapa ide ini pas banget dibikin hari ini",
      "format": "talking head | b-roll | skit | tutorial | reaction | storytime",
      "est_duration": "contoh: 30-45 detik",
      "difficulty": "gampang | sedang | effort"
    }
  ]
}`;
}

export function buildIdeaEnginePrompt(
  userInput: string,
  dna: CreatorDna | null,
  trends: TrendCard[],
  learned?: LearnedNote[]
): string {
  const shared = buildSharedContext(dna, trends, learned);

  return `${shared}
Kreator punya pikiran atau ide kasar ini: "${userInput}"

Kembangkan ide kasar itu jadi 5 ide konten yang matang dan siap dieksekusi.

JSON:
{
  "ideas": [
    {
      "title": "judul singkat, maksimal 8 kata",
      "angle": "sudut pandang uniknya, 1 kalimat",
      "why_now": "kenapa ide ini pas banget dibikin hari ini",
      "format": "talking head | b-roll | skit | tutorial | reaction | storytime",
      "est_duration": "contoh: 30-45 detik",
      "difficulty": "gampang | sedang | effort",
      "hook_seed": "ide hook 1 kalimat untuk narik audiens"
    }
  ]
}`;
}

export function buildCreatorDnaAnalysisPrompt(rawDna: Partial<CreatorDna>): string {
  return `Lo adalah Creative Director buat kreator konten Indonesia. Kreator ini baru aja ngisi profil (DNA) mereka secara kasar:

Niche: ${rawDna.niche || "-"}
Bidang/industri: ${rawDna.industry || "-"}
Target Audience: ${rawDna.target_audience || "-"}
Tone: ${rawDna.tone || "-"}
Gaya persona: ${rawDna.persona_style || "-"}
Level humor (0-10): ${typeof rawDna.humor_level === "number" ? rawDna.humor_level : "-"}
Jam terbang: ${rawDna.experience_level || "-"}
Pilar konten: ${(rawDna.content_pillars || []).join(", ") || "-"}
Frekuensi posting: ${rawDna.posting_frequency || "-"}
Yang dia kejar: ${rawDna.goals || "-"}
Kreator referensi: ${rawDna.reference_creators || "-"}
Bikin konten buat: ${
    rawDna.work_context === "klien"
      ? "KLIEN (dia yang di balik kamera, bukan pemilik usahanya)"
      : rawDna.work_context === "brand"
        ? "BRAND tempat dia kerja (ngomong atas nama 'kami')"
        : "dirinya sendiri (personal brand, orang pertama)"
  }
Tentang klien/brand: ${rawDna.client_brief || "-"}
Platforms: ${(rawDna.platforms || []).join(", ") || "-"}
Banned Words: ${(rawDna.banned_words || []).join(", ") || "-"}
Brand Notes: ${rawDna.brand_notes || "-"}

Tugas lo:
1. Terjemahkan input mentah ini jadi satu kalimat 'persona_summary' yang tajam dan spesifik (misal: "Kreator gaming yang ngereview game bocil pake gaya bahasa abang-abang warnet").
2. Kasih 3 ide format konten ('signature_formats') yang paling cocok buat persona ini.

ATURAN:
- Bahasa Indonesia yang natural, bukan bahasa terjemahan.
- Balas HANYA JSON valid.

JSON:
{
  "persona_summary": "1 kalimat persona yang tajam",
  "signature_formats": ["format 1", "format 2", "format 3"]
}`;
}

export function buildHookLabPrompt(
  ideaOrTopic: string,
  platform: string,
  dna: CreatorDna | null,
  trends: TrendCard[],
  learned?: LearnedNote[]
): string {
  const shared = buildSharedContext(dna, trends, learned);
  return `${shared}
Bikin 10 hook buat konten ini: ${ideaOrTopic}
Platform: ${platform || "General"}

Hook itu 3 detik pertama. Kalau gak nahan orang di situ, sisa videonya gak ada
artinya. Jadi tiap hook harus lolos empat tes ini:

- DIUCAPKAN, BUKAN DITULIS. Baca keras-keras dalam kepala lo. Kalau kesandung,
  buang. Maksimal 15 kata, dan lebih pendek biasanya lebih kuat.
- BUKA DENGAN INFORMASI, BUKAN SAPAAN. Haram: "Halo guys", "Kalian tau gak
  sih", "Jadi gini". Kata pertama harus udah bawa isi.
- ADA YANG DIPERTARUHKAN. Penonton harus ngerasa rugi kalau nge-skip: kehilangan
  uang, kena tipu, salah beli, ketinggalan.
- JANGAN JANJIIN YANG GAK ADA DI KONTENNYA. Hook bohong bikin orang nonton 2
  detik terus kabur, dan itu lebih ngerusak daripada hook yang biasa aja.

Sepuluh-duanya wajib beda pola: curiosity gap, contrarian, POV, angka, kesalahan
umum, before-after, pertanyaan langsung, pengakuan, peringatan, cerita.

Skornya jujur. Kalau ada yang emang lemah, kasih 4 dan bilang kenapa — sepuluh
hook yang semuanya 8 ke atas itu bohong, dan bikin kreatornya gak bisa milih.

JSON:
{
  "hooks": [
    {
      "text": "hook-nya, maksimal 15 kata, siap diucapkan",
      "pattern": "nama polanya",
      "score": 1-10,
      "why": "kenapa dikasih skor segitu, 1 kalimat jujur"
    }
  ]
}`;
}

export function buildScriptBuilderPrompt(
  idea: string,
  hook: string,
  platform: string,
  duration: string,
  dna: CreatorDna | null,
  trends: TrendCard[],
  learned?: LearnedNote[]
): string {
  const shared = buildSharedContext(dna, trends, learned);
  return `${shared}
Bikin naskah lengkap. Ide: ${idea}. Hook: ${hook}. Platform: ${platform || "General"}.
Durasi target: ${duration || "pendek"}.

Panjang dan ritme HARUS nyesuain platform:
- TikTok / Reels / Shorts: padat, hook di 1 detik pertama, potong tiap 2-3 detik
- YouTube long: boleh napas, ada intro-body-outro
- X / Threads: teks, bukan naskah lisan

YANG BIKIN NASKAH INI KEPAKAI ATAU ENGGAK:

- \`spoken\` itu buat DIBACA DEPAN KAMERA. Tulis persis kayak orang ngomong,
  lengkap sama jeda dan penekanannya. Bukan kalimat artikel yang dibacain.
- JANGAN ADA SCENE KOSONG. Tiap potongan harus mindahin cerita. Kalau satu scene
  dihapus dan videonya gak berubah, berarti scene itu emang gak perlu ada.
- \`visual\` harus bisa disyuting sama satu orang pakai HP. "Footage sinematik
  drone" itu bukan arahan, itu mimpi. Sebut objek dan angle konkret.
- TAHAN ORANGNYA DI TENGAH. Sekitar sepertiga jalan, orang mulai mau pergi.
  Taruh sesuatu di situ: bantahan, angka yang bikin kaget, atau pertanyaan baru.
- \`on_screen_text\` bukan salinan \`spoken\`. Isinya angka, nama, atau satu kata
  penekanan. Kalau cuma ngulang omongan, kosongin aja.
- CTA-nya nyambung sama isinya. "Follow buat konten menarik lainnya" itu tempelan
  yang bisa ditaruh di video apa aja — berarti gak ada gunanya di video ini.

JSON:
{
  "script": [
    {
      "timestamp": "0:00-0:03",
      "spoken": "yang diucapkan",
      "visual": "yang keliatan di layar / b-roll",
      "on_screen_text": "teks di layar, kosongin kalau gak ada"
    }
  ],
  "cta": {
    "text": "CTA-nya",
    "placement": "di mana ditaro dan kenapa"
  },
  "caption": "caption siap posting",
  "hashtags": ["maksimal 8, relevan, bukan spam"]
}`;
}

export function buildRepurposePrompt(
  sourceContent: string,
  dna: CreatorDna | null,
  trends: TrendCard[],
  learned?: LearnedNote[]
): string {
  const shared = buildSharedContext(dna, trends, learned);
  return `${shared}
Ini ada satu konten mentah atau naskah:
"${sourceContent}"

Tugas lo adalah menulis ulang konten ini jadi format yang pas buat platform lain.
Tiap platform HARUS ditulis ulang sesuai gaya platform itu, JANGAN cuma sekadar copy-paste.

Beda platform itu beda cara orang nontonnya, bukan cuma beda panjang:

- tiktok    : suara duluan, visual nomor dua. Bahasa lisan, potong cepat, gak
              ada pengantar. Orang nemu ini tanpa niat, jadi detik pertama harus
              udah nahan.
- instagram : caption dibaca setengah — kalimat pertama harus berdiri sendiri
              sebelum tombol "selengkapnya". Lebih rapi dari TikTok, masih santai.
- youtube   : orang ke sini emang niat nyari. Boleh lebih panjang dan lebih
              teknis, judul dan menit-menit awal yang nentuin.
- x         : tanpa basa-basi, satu pikiran per baris. Kalau jadi thread, tiap
              baris harus bisa berdiri sendiri kalau di-screenshot.
- threads   : kayak ngobrol sama temen yang udah paham konteksnya. Boleh
              setengah pendapat, boleh ngajak debat.

Sama isinya, beda cara ngomongnya. Kalau kelima-limanya masih kebaca mirip,
berarti lo belum nulis ulang — lo baru motong panjangnya.

JSON:
{
  "tiktok": "naskah gaya tiktok",
  "instagram": "caption/reels gaya instagram",
  "youtube": "ide shorts / deskripsi video",
  "x": "thread atau tweet",
  "threads": "postingan gaya threads"
}`;
}
