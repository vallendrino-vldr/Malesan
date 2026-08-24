import "server-only";
import { type CreatorDna } from "../supabase/database.types";
import { todayGoalLabel, todayPlatformLabel, type TodayGoal, type TodayPlatform } from "../content-options";

export type StrategyPlanItem = {
  day_offset: number; // 0 for today, 1 for tomorrow, etc.
  day_name: string; // e.g. "Senin", "Selasa"
  content_pillar: "edukasi" | "storytelling" | "engagement" | "soft_selling";
  title: string;
  angle: string;
  why_now: string;
  format: string;
  est_duration: string;
  difficulty: "Mudah" | "Sedang" | "Tantangan";
  hook_seed: string;
  ai_score: number; // 0 - 100
  score_breakdown: {
    pattern: number; // 0 - 25
    curiosity: number; // 0 - 20
    pain: number; // 0 - 20
    specificity: number; // 0 - 20
    emotion: number; // 0 - 15
  };
  score_reason: string;
};

export const STRATEGY_7DAY_SCHEMA = {
  type: "object",
  properties: {
    strategy_overview: {
      type: "string",
      description: "Ringkasan strategi 7 hari ke depan untuk kreator (maksimal 2 kalimat santai dan menyemangati).",
    },
    plans: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          day_offset: { type: "integer", minimum: 0, maximum: 6 },
          day_name: { type: "string" },
          content_pillar: {
            type: "string",
            enum: ["edukasi", "storytelling", "engagement", "soft_selling"],
          },
          title: { type: "string", maxLength: 85 },
          angle: { type: "string", maxLength: 220 },
          why_now: { type: "string", maxLength: 220 },
          format: { type: "string", maxLength: 60 },
          est_duration: { type: "string", maxLength: 40 },
          difficulty: { type: "string", enum: ["Mudah", "Sedang", "Tantangan"] },
          hook_seed: { type: "string", maxLength: 180 },
          ai_score: { type: "integer", minimum: 75, maximum: 99 },
          score_breakdown: {
            type: "object",
            properties: {
              pattern: { type: "integer", minimum: 15, maximum: 25 },
              curiosity: { type: "integer", minimum: 12, maximum: 20 },
              pain: { type: "integer", minimum: 12, maximum: 20 },
              specificity: { type: "integer", minimum: 12, maximum: 20 },
              emotion: { type: "integer", minimum: 8, maximum: 15 },
            },
            required: ["pattern", "curiosity", "pain", "specificity", "emotion"],
          },
          score_reason: { type: "string", maxLength: 200 },
        },
        required: [
          "day_offset",
          "day_name",
          "content_pillar",
          "title",
          "angle",
          "why_now",
          "format",
          "est_duration",
          "difficulty",
          "hook_seed",
          "ai_score",
          "score_breakdown",
          "score_reason",
        ],
      },
    },
  },
  required: ["strategy_overview", "plans"],
};

export function build7DayStrategyPrompt(
  dna: CreatorDna | null,
  recentTitles: string[] = [],
  platform?: string,
  goal?: string,
  shadowPrompt?: string,
): string {
  const niche = dna?.niche || "Edukasi & Produktivitas Umum";
  const audience = dna?.target_audience || "Audiens muda Indonesia (18-35 tahun)";
  const tone = dna?.tone || "Santai, to the point, praktis tanpa basa-basi";
  const platformName = platform ? todayPlatformLabel(platform as TodayPlatform) : "TikTok / Reels / Shorts";
  const goalName = goal ? todayGoalLabel(goal as TodayGoal) : "Engagement & Pertumbuhan Audiens";

  const avoidContext =
    recentTitles.length > 0
      ? `\nTOPIK YANG SUDAH DIBUAT (HINDARI MEMBUAT IDE YANG MIRIP DENGAN INI):\n${recentTitles.map((t) => `- ${t}`).join("\n")}`
      : "";

  return `Kamu adalah "Malesan AI Content Brain" — Creative Director & Senior Content Strategist kelas dunia untuk kreator Indonesia.

TUGAS:
Rancang **Kalender Strategi Konten 7 Hari** yang matang, actionable, dan variatif untuk kreator ini.

PROFIL KREATOR (CREATOR DNA):
- Niche / Topik Utama: ${niche}
- Target Audiens: ${audience}
- Gaya Bahasa / Karakter: ${tone}
- Platform Prioritas: ${platformName}
- Target Utama: ${goalName}
${avoidContext}

KOMPOSISI STRATEGI 7 HARI (CONTENT BALANCE):
1. **Hari 1 & 4 (40% - Edukasi & Otoritas)**: Memberikan wawasan tajam, cara praktis, atau membongkar mitos salah.
2. **Hari 2 & 5 (30% - Storytelling & Relatable)**: Cerita perjuangan, pengalaman personal, atau kesalahan yang bikin audiens merasa "gue banget".
3. **Hari 3 (20% - Engagement & Diskusi)**: Opini kontroversial sehat, perdebatan pilihan, atau memicu interaksi di kolom komentar.
4. **Hari 6 (10% - Soft Selling / Konversi)**: Rekomendasi solusi, ajakan gabung, atau CTA relevan tanpa terkesan spammy.
5. **Hari 7 (Review / Santai)**: Rekap mingguan, inspirasi santai, atau perspektif baru.

STANDAR EVALUASI & SCORING (SELF-EVALUATION RUBRIC):
Untuk setiap hari, evaluasi potensi konten dengan bobot:
- Pattern Interrupt (0-25): Daya henti jempol 3 detik pertama
- Curiosity Gap (0-20): Menimbulkan rasa ingin tahu mendalam
- Audience Pain Match (0-20): Keselarasan dengan masalah audiens di Creator DNA
- Specificity (0-20): Menggunakan angka, kasus konkret, atau objek spesifik
- Emotion (0-15): Memicu validasi, kejutan, atau optimisme
Total skor = penjumlahan 5 kriteria (skala 75-99).

ATURAN GAYA BAHASA & STRUKTUR (ANTI-SLOP & CEPAT):
- Jangan gunakan pembuka klise seperti "Di era digital ini", "Tahukah kamu", "Halo sobat creator", atau "Hai guys".
- Gunakan bahasa Indonesia kasual, luwes, dan natural seperti obrolan kreator profesional.
- Setiap judul dan hook harus berbobot dan siap dieksekusi.
- Buat isi field padat dan to-the-point:
  * angle: maksimal 2 kalimat ringkas
  * why_now: 1 kalimat alasan kuat
  * hook_seed: 1 kalimat kalimat pembuka yang menghentak
  * score_reason: 1 kalimat evaluasi tajam
${shadowPrompt ? `\nPETUNJUK RUMAH:\n${shadowPrompt}` : ""}

Hasilkan tepat 7 rencana harian dalam format JSON sesuai schema yang diminta.`;
}
