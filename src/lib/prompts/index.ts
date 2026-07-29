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

function buildSharedContext(dna: CreatorDna | null, trends: TrendCard[]): string {
  let context = `Lo adalah otak kreatif di balik Malesan — asisten buat kreator konten Indonesia.\n`;

  if (dna) {
    context += `\nPROFIL KREATOR:\n`;
    if (dna.niche) context += `- Niche: ${dna.niche}\n`;
    if (dna.target_audience) context += `- Target audience: ${dna.target_audience}\n`;
    if (dna.tone) context += `- Tone: ${dna.tone}\n`;
    if (dna.platforms && dna.platforms.length > 0) context += `- Platform utama: ${dna.platforms.join(", ")}\n`;
    context += `- Bahasa output: ${dna.output_language || 'id'}\n`;
    if (dna.banned_words && dna.banned_words.length > 0) context += `- Kata yang HARUS dihindari: ${dna.banned_words.join(", ")}\n`;
    if (dna.brand_notes) context += `- Catatan brand: ${dna.brand_notes}\n`;
  }

  if (trends && trends.length > 0) {
    context += `\nKONTEKS TREN HARI INI:\n`;
    for (const t of trends) {
      context += `- ${t.title} (${t.category}): ${t.summary} -> Angle: ${t.content_angle}\n`;
    }
  }

  context += `\nATURAN:\n`;
  context += `- Bahasa Indonesia yang natural dan ngobrol, bukan bahasa terjemahan.\n`;
  context += `- Spesifik dan bisa langsung dieksekusi. Jangan kasih saran umum.\n`;
  context += `- Jangan pernah nyaranin konten clickbait bohong atau menyesatkan.\n`;
  context += `- Balas HANYA JSON valid. Tanpa \`\`\`json, tanpa penjelasan tambahan.\n`;

  return context;
}

export function buildIdeHariIniPrompt(dna: CreatorDna | null, trends: TrendCard[]): string {
  const today = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const shared = buildSharedContext(dna, trends);

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
  trends: TrendCard[]
): string {
  const shared = buildSharedContext(dna, trends);

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
Target Audience: ${rawDna.target_audience || "-"}
Tone: ${rawDna.tone || "-"}
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
  trends: TrendCard[]
): string {
  const shared = buildSharedContext(dna, trends);
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
  trends: TrendCard[]
): string {
  const shared = buildSharedContext(dna, trends);
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
  trends: TrendCard[]
): string {
  const shared = buildSharedContext(dna, trends);
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
