import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spendCredits } from "@/lib/credits";
import { getCost } from "@/lib/config";
import { generate } from "@/lib/gemini/client";
import { aiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: "Sesi lo udah habis. Masuk lagi ya." }, 401);
  }

  const limited = await aiRateLimit(user.id, "speaking_slangify", 15);
  if (limited) return limited;

  try {
    const body = await request.json();
    const text = String(body.text || "").trim();
    const context = String(body.context || "");

    if (!text) {
      return json({ error: "Teks kalimat tidak boleh kosong." }, 400);
    }

    const cost = await getCost("speaking_coach").catch(() => 1);
    const spend = await spendCredits(user.id, Math.min(cost, 1), "speaking_slangify");
    if (!spend.ok) {
      return json({ error: spend.message }, spend.reason === "insufficient" ? 402 : 500);
    }

    const prompt = `Kamu adalah Master Native English Stylist & Slang Coach kelas dunia.
Tugasmu adalah mengubah kalimat bahasa Inggris yang kaku, literal, atau terdengar seperti buku teks menjadi 3 versi penutur asli (Native Speaker) modern 2026 yang mengalir alami dan berkelas.

Konteks percakapan: "${context || "General / Professional"}"
Kalimat asli dari pengguna: "${text}"

HASILKAN DALAM FORMAT JSON BERIKUT (HARUS PERSIS VALID JSON TANPA MARKDOWN LAIN):
{
  "original": "${text}",
  "casual": "Versi santai ala native California/London 2026, pakai slang/idiom yang natural, santai, dan ekspresif",
  "executive": "Versi korporat global/klien internasional bergaji dollar, terdengar percaya diri, diplomatis, dan berbobot",
  "creator": "Versi hook video/kreator konten, bernada tajam, punchy, memikat perhatian, dan energik",
  "explanation": "Penjelasan singkat (1-2 kalimat dalam Bahasa Indonesia santai) tentang mengapa kalimat asli terasa kaku dan rahasia kenapa versi native di atas jauh lebih nendang."
}`;

    const schema = {
      type: "OBJECT",
      properties: {
        original: { type: "STRING" },
        casual: { type: "STRING" },
        executive: { type: "STRING" },
        creator: { type: "STRING" },
        explanation: { type: "STRING" },
      },
      required: ["original", "casual", "executive", "creator", "explanation"],
    };

    const rawAi = await generate({ prompt, schema, tier: "free" });
    const parsed = JSON.parse(rawAi.trim());

    return json({
      ok: true,
      data: parsed,
    });
  } catch (err: unknown) {
    console.error("[speaking-slangify] Error:", err);
    return json(
      {
        error: "Gagal memproses Slangify. Coba kalimat lain ya.",
      },
      500
    );
  }
}
