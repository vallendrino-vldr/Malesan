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

  try {
    const body = await request.json();
    level = String(body.level || "intermediate");
    topic = String(body.topic || "grammar_tenses");
  } catch {
    // default
  }

  // Deduct credits
  const cost = await getCost("speaking_coach").catch(() => 1);
  const spend = await spendCredits(user.id, cost, "speaking_quiz");
  if (!spend.ok) {
    return json({ error: spend.message }, spend.reason === "insufficient" ? 402 : 500);
  }

  const prompt = `Kamu adalah Master English Quiz Creator untuk pengguna Indonesia.
Level: ${level} (beginner / intermediate / advanced)
Topik: ${topic} (grammar_tenses / idioms_phrases / vocabulary_slang / business_pro / error_spotting)

Buat 5 SOAL KUIS PILIHAN GANDA (A, B, C, D) yang cerdas, praktis, dan langsung menguji pemahaman nyata.
Untuk setiap soal sertakan:
- question: Kalimat pertanyaan atau kalimat rumpang (dalam bahasa Inggris).
- options: Array berisi 4 pilihan jawaban teks.
- correctIndex: Angka index jawaban yang benar (0, 1, 2, atau 3).
- explanation: Pembahasan ringkas dalam bahasa Indonesia mengapa jawaban itu benar.
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
        minItems: 5,
        maxItems: 5,
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
