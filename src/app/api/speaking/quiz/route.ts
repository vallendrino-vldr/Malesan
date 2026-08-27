import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spendCredits } from "@/lib/credits";
import { getCost } from "@/lib/config";
import { generate } from "@/lib/gemini/client";
import { aiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: "Sesi lo udah habis. Masuk lagi ya." }, 401);
  }

  const limited = await aiRateLimit(user.id, "speaking_quiz", 10);
  if (limited) return limited;

  let level = "intermediate";
  let topic = "grammar_tenses";
  let count = 5;

  try {
    const body = await request.json();
    level = String(body.level || "intermediate");
    topic = String(body.topic || "grammar_tenses");
    count = Math.min(15, Math.max(5, Number(body.count) || 5));
  } catch {
    // default
  }

  // Deduct credits
  const cost = await getCost("speaking_coach").catch(() => 1);
  const spend = await spendCredits(user.id, cost, "speaking_quiz");
  if (!spend.ok) {
    return json({ error: spend.message }, spend.reason === "insufficient" ? 402 : 500);
  }

  const contextPool = [
    "Percakapan meeting remote tech startup dan presentasi ke klien bule",
    "Pemesanan kopi dan menu makanan khusus di kafe London/New York",
    "Komunikasi santai di DM Instagram / Discord / TikTok dengan teman luar negeri",
    "Wawancara kerja di perusahaan global (gaji, pengalaman, kelemahan)",
    "Liburan ke luar negeri: imigrasi, check-in hotel, dan menanyakan arah jalan",
    "Debat santai tentang film Netflix, game terbaru, dan gadget terkini",
    "Negosiasi harga sewa Airbnb dan komplain belanja online ke customer service",
    "Obrolan santai di pesta atau networking dinner dengan ekspatriat",
    "Membahas tren AI, teknologi masa depan, dan pekerjaan konten kreator",
    "Salah kaprah kosakata gaul sehari-hari yang sering bikin bule bingung",
    "Pemberian feedback proyek desain, software engineering, dan deadline",
    "Diskusi negosiasi harga jasa freelance dan kontrak kerja internasional",
  ];

  const randomContext = contextPool[Math.floor(Math.random() * contextPool.length)];
  const randomEntropy = `SEED_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const prompt = `Kamu adalah Master English Quiz Creator untuk pengguna Indonesia.
Level: ${level} (beginner / intermediate / advanced)
Topik Utama: ${topic}
Jumlah Soal yang Diminta: ${count} Soal
Konteks Suasana/Tema Kali Ini: "${randomContext}"
Kode Unik Regenerasi: ${randomEntropy}

INSTRUKSI KHUSUS KEBARUAN (ANTI-REPETISI & ANTI-DUMMY):
- Hasilkan TEPAT ${count} SOAL KUIS PILIHAN GANDA (A, B, C, D) yang 100% BARU, SEGAR, KREATIF, DAN TIDAK PERNAH SAMA DENGAN KUIS SEBELUMNYA.
- DILARANG membuat soal klasik standar buku pelajaran jadul (seperti "She go to school", "I have two apples", dsb).
- Gunakan kalimat bernuansa percakapan nyata zaman sekarang (modern colloquial, work life, travel, internet culture, atau daily dilemmas).
- Pastikan tingkat kesulitan sesuai dengan level (${level}).

Untuk setiap soal sertakan:
- question: Kalimat pertanyaan atau kalimat rumpang dalam bahasa Inggris yang menarik.
- options: Array berisi 4 pilihan jawaban teks yang variatif dan masuk akal.
- correctIndex: Angka index jawaban yang benar (0, 1, 2, atau 3). Acak posisi jawaban yang benar agar tidak selalu di posisi yang sama.
- explanation: Pembahasan ringkas dalam bahasa Indonesia mengapa jawaban itu benar dan kenapa pilihan lain salah.
- roastWrong: Celetukan/roasting humor santai khas Indonesia jika pengguna memilih jawaban yang salah (contoh: "Waduh, masa subjeknya 'She' tapi pakai 'have'? Jangan bikin guru SMP lo menangis.").

ATURAN KETAT:
- DILARANG MENGGUNAKAN EMOJI APAPUN.
- Kembalikan HANYA JSON sesuai schema.`;

  const schema = {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      questions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            question: { type: "STRING" },
            options: {
              type: "ARRAY",
              items: { type: "STRING" },
              minItems: 4,
              maxItems: 4,
            },
            correctIndex: { type: "NUMBER" },
            explanation: { type: "STRING" },
            roastWrong: { type: "STRING" },
          },
          required: ["question", "options", "correctIndex", "explanation", "roastWrong"],
        },
        minItems: count,
        maxItems: count,
      },
    },
    required: ["title", "questions"],
  };

  try {
    const rawAi = await generate({ prompt, schema });
    const parsed = JSON.parse(rawAi.trim());

    return json({
      ok: true,
      title: parsed.title || "Kuis Kilat Bahasa Inggris",
      questions: parsed.questions || [],
      creditsSpent: cost,
    });
  } catch (err) {
    console.error("[speaking-quiz] AI error:", err);
    return json({ error: "Gagal membuat kuis. Silakan coba lagi." }, 500);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
