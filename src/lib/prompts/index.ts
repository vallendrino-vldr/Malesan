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
  let context = `Lo adalah otak kreatif di balik Malesan — asisten buat kreator konten Indonesia.\n`;

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
  context += `- Spesifik dan bisa langsung dieksekusi. Jangan kasih saran umum.\n`;
  context += `- Jangan pernah nyaranin konten clickbait bohong atau menyesatkan.\n`;

  // The single most-repeated complaint about this product's output is that it
  // reads like AI. Naming the specific tells works better than asking for
  // "natural" — a model cannot act on an adjective, but it can avoid a list.
  context += `\nJANGAN KEDENGERAN KAYAK AI:\n`;
  context += `- Haram: "di era digital ini", "mari kita", "tak dapat dipungkiri", "sangatlah penting", "dalam dunia yang serba cepat".\n`;
  context += `- Jangan buka pakai definisi atau basa-basi. Kalimat pertama langsung ke intinya.\n`;
  context += `- Kalimat pendek-panjang diselang-seling. Ritme datar itu ciri khas tulisan mesin.\n`;
  context += `- Boleh nyebut angka, merek, harga, dan detail konkret. Vague itu bikin murah.\n`;
  context += `- Jangan pakai emoji sebagai pengganti isi, dan jangan tiap poin dikasih emoji.\n`;
  context += `- Jangan rapi-rapi amat. Orang beneran ngomong pakai jeda, koreksi, dan penekanan.\n`;
  context += `- Jangan menggurui. Sejajar sama penonton, bukan di atasnya.\n`;

  context += `\n- Balas HANYA JSON valid. Tanpa \`\`\`json, tanpa penjelasan tambahan.\n`;

  return context;
}

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

Wajib pakai pola yang beda-beda: curiosity gap, contrarian, POV, angka, kesalahan umum, before-after, pertanyaan langsung, pengakuan, peringatan, cerita.

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

JSON:
{
  "tiktok": "naskah gaya tiktok",
  "instagram": "caption/reels gaya instagram",
  "youtube": "ide shorts / deskripsi video",
  "x": "thread atau tweet",
  "threads": "postingan gaya threads"
}`;
}
