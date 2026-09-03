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

  const limited = await aiRateLimit(user.id, "speaking_essay", 6);
  if (limited) return limited;

  let essayText = "";
  let topic = "";
  let level = "intermediate";

  try {
    const body = await request.json();
    essayText = String(body.essayText || "").trim();
    topic = String(body.topic || "").trim();
    level = String(body.level || "intermediate");
  } catch {
    return json({ error: "Permintaan tidak valid." }, 400);
  }

  if (!essayText || essayText.length < 20) {
    return json({ error: "Tulisan esai minimal 20 karakter." }, 400);
  }

  // Deduct credits
  const cost = await getCost("speaking_coach").catch(() => 1);
  const spend = await spendCredits(user.id, cost, "speaking_essay");
  if (!spend.ok) {
    return json({ error: spend.message }, spend.reason === "insufficient" ? 402 : 500);
  }

  const prompt = `Kamu adalah Master English Examiner & Senior Writing Coach untuk kreator dan pembelajar Indonesia.
Level: ${level}
Topik yang Diberikan: ${topic || "Esai Bebas / Opini Pribadi"}

Teks Esai Pengguna:
"${essayText}"

TUGAS KAMU:
Lakukan bedah dan penilaian menyeluruh:
1. overallBandScore: Estimasi skor band setara IELTS (1.0 s/d 9.0, contoh: 6.5, 7.0).
2. overallScore100: Skor skala 1-100.
3. roastReview: Ulasan bergaya roasting cerdas, santai, dan lucu dalam bahasa Indonesia mengenai gaya penulisan, repetisi kata, atau logika tulisan pengguna (2-3 kalimat).
4. strengths: 2-3 poin kekuatan tulisan.
5. weaknesses: 2-3 poin kelemahan fatal (grammar, vocabulary, atau alur argumen).
6. grammarCorrections: Daftar perbaikan kalimat salah -> perbaikan benar + penjelasan singkat.
7. lexicalSuggestions: 3 kosakata tingkat tinggi (advanced vocab) yang bisa menggantikan kata-kata klise di esai tersebut.
8. perfectedDraft: Versi penulisan ulang (rewrite) esai pengguna dalam bahasa Inggris yang elegan, natural, dan berbobot tinggi.

ATURAN KETAT:
- DILARANG MENGGUNAKAN EMOJI APAPUN.
- Kembalikan HANYA JSON sesuai schema.`;

  const schema = {
    type: "OBJECT",
    properties: {
      overallBandScore: { type: "STRING" },
      overallScore100: { type: "NUMBER" },
      roastReview: { type: "STRING" },
      strengths: { type: "ARRAY", items: { type: "STRING" } },
      weaknesses: { type: "ARRAY", items: { type: "STRING" } },
      grammarCorrections: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            original: { type: "STRING" },
            corrected: { type: "STRING" },
            explanation: { type: "STRING" },
          },
          required: ["original", "corrected", "explanation"],
        },
      },
      lexicalSuggestions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            simpleWord: { type: "STRING" },
            advancedWord: { type: "STRING" },
            exampleUsage: { type: "STRING" },
          },
          required: ["simpleWord", "advancedWord", "exampleUsage"],
        },
      },
      perfectedDraft: { type: "STRING" },
    },
    required: ["overallBandScore", "overallScore100", "roastReview", "strengths", "weaknesses", "perfectedDraft"],
  };

  try {
    const rawAi = await generate({ prompt, schema });
    const parsed = JSON.parse(rawAi.trim());

    return json({
      ok: true,
      data: parsed,
      creditsSpent: cost,
    });
  } catch (err) {
    console.error("[speaking-essay] AI error:", err);
    return json({ error: "Gagal ngevaluasi esai. Coba lagi bentar ya." }, 500);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
