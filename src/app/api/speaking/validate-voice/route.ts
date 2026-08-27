import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spendCredits } from "@/lib/credits";
import { getCost } from "@/lib/config";
import { generate } from "@/lib/gemini/client";
import { aiRateLimit } from "@/lib/rate-limit";
import { transcribeAudio } from "@/lib/transcribe";

export const runtime = "nodejs";
export const maxDuration = 45;

interface VoiceValidationResult {
  score: number;
  isPassed: boolean;
  transcribedText: string;
  targetSentence: string;
  phoneticBreakdown: Array<{
    word: string;
    isCorrect: boolean;
    feedback: string;
  }>;
  humorRoast: string;
  recommendation: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: "Sesi lo udah habis. Masuk lagi ya." }, 401);
  }

  const limited = await aiRateLimit(user.id, "speaking_validate_voice", 15);
  if (limited) return limited;

  let textInput = "";
  let targetSentence = "This island has no doubt, thank you very much.";
  let stageId = 1;
  let stageTitle = "Tahap 1: Alfabet & Fonetik Dasar";
  let focusPhonetics = "Huruf bisu S pada Island, B pada Doubt, desisan TH";

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const audioFile = formData.get("audio");
      targetSentence = String(formData.get("targetSentence") || targetSentence);
      stageId = Number(formData.get("stageId") || 1);
      stageTitle = String(formData.get("stageTitle") || stageTitle);
      focusPhonetics = String(formData.get("focusPhonetics") || focusPhonetics);

      if (audioFile instanceof Blob) {
        const transcriptRes = await transcribeAudio(audioFile, "user_voice.webm", { language: "en" });
        textInput = transcriptRes.text.trim();
      } else {
        textInput = String(formData.get("text") || "").trim();
      }
    } catch (err) {
      console.error("[validate-voice] FormData parse error:", err);
      return json({ error: "Gagal memproses rekaman suara." }, 400);
    }
  } else {
    try {
      const body = await request.json();
      textInput = String(body.text || "").trim();
      targetSentence = String(body.targetSentence || targetSentence);
      stageId = Number(body.stageId || 1);
      stageTitle = String(body.stageTitle || stageTitle);
      focusPhonetics = String(body.focusPhonetics || focusPhonetics);
    } catch {
      return json({ error: "Permintaan tidak valid." }, 400);
    }
  }

  if (!textInput) {
    return json(
      {
        error: "Suara pelafalan lo belum terdengar jelas. Pastikan mikrofon aktif dan ucapkan kalimatnya sekali lagi.",
      },
      400,
    );
  }

  // Deduct credits server-side (1 credit)
  const cost = await getCost("speaking_coach").catch(() => 1);
  const spend = await spendCredits(user.id, cost, "speaking_coach");
  if (!spend.ok) {
    return json(
      {
        error: "Kredit lo nggak cukup untuk validasi suara AI. Silakan top-up dulu.",
        creditError: true,
      },
      402,
    );
  }

  const prompt = `Anda adalah Master AI Validator Fonetik & Bahasa Inggris untuk aplikasi Malesan (khas kreator Indonesia).
Tugas Anda adalah memvalidasi suara pelafalan pengguna asli terhadap target kalimat ujian tahap kelulusan secara presisi, cerdas, dan memberikan evaluasi berbobot yang diselingi humor santai khas Malesan (tanpa emoji, gunakan teks tajam dan segar).

DATA UJIAN:
- Tahap: ${stageTitle} (Tahap ID: ${stageId})
- Fokus Fonetik Ujian: ${focusPhonetics}
- Target Kalimat yang Wajib Diucapkan: "${targetSentence}"
- Kalimat yang Terdengar dari Suara Pengguna (Transkripsi Suara Asli): "${textInput}"

ATURAN PENILAIAN FONETIK & AKURASI:
1. Periksa apakah pengguna melafalkan kata-kata kunci dengan benar sesuai aturan fonetik materi tersebut:
   - Jika Tahap 1 (Huruf Bisu & Fonetik): Pastikan huruf S pada 'island' TIDAK dibaca ('eye-land'), huruf B pada 'doubt' TIDAK dibaca ('da-ut'), huruf V tidak tertukar P, dan 'th' terdengar berdesis bukan 'd'/'t'.
   - Jika Tahap 2 (Connected Speech): Pastikan sambungan kata mengalir ('hold on' -> 'hol-don', 'gonna'/'wanna').
   - Jika Tahap 3 (Larangan Indoglish): Pastikan tidak ada 'I am agree' atau 'thanks before'.
   - Jika Tahap 4 (Pola Refleks): Pastikan penggunaan verb lampau dan kesopanan tepat.
   - Jika Tahap 5-6 (Frasa Global): Pastikan kejelasan dan kelancaran intonasi.
2. Hitung SKOR AKURASI (0 sampai 100):
   - Skor >= 70: LULUS (isPassed: true). Pengguna melafalkan kalimat target dengan benar atau hanya salah minor yang wajar.
   - Skor < 70: TIDAK LULUS (isPassed: false). Pengguna salah membaca huruf bisu, salah kata fatal, atau kalimat yang diucapkan jauh dari target.
3. Buat "humorRoast": Komentar evaluasi tajam, akurat, dan diselingi sedikit humor gaul Indonesia (contoh lulus: "Gokil, lidah lo udah mulai licin kayak bule London! Lulus tahap ini, jangan sombong dulu.", contoh tidak lulus: "Waduh bro, huruf B di 'Doubt' kok masih diletupin kayak mercon? Kan silent letter! Coba lafalin DA-UT lagi.").
4. Format output WAJIB HANYA JSON MURNI tanpa markdown wrap \`\`\`json:
{
  "score": 85,
  "isPassed": true,
  "transcribedText": "${textInput.replace(/"/g, '\\"')}",
  "targetSentence": "${targetSentence.replace(/"/g, '\\"')}",
  "phoneticBreakdown": [
    { "word": "island", "isCorrect": true, "feedback": "Huruf S bisu berhasil tidak disuarakan ('eye-land')." },
    { "word": "doubt", "isCorrect": true, "feedback": "Huruf B bisu diabaikan dengan tepat ('da-ut')." }
  ],
  "humorRoast": "Pujian atau koreksi humoris Malesan di sini",
  "recommendation": "Saran langkah selanjutnya"
}`;

  try {
    const rawAiOutput = await generate({
      prompt,
      tier: "free",
    });

    const cleanedText = rawAiOutput
      .replace(/^\`\`\`json\s*/i, "")
      .replace(/^\`\`\`\s*/i, "")
      .replace(/\s*\`\`\`$/i, "")
      .trim();

    const result: VoiceValidationResult = JSON.parse(cleanedText);
    return json({ data: result });
  } catch (err) {
    console.error("[validate-voice] Gemini parse error:", err);
    const isClose = textInput.toLowerCase().includes(targetSentence.slice(0, 10).toLowerCase());
    return json({
      data: {
        score: isClose ? 75 : 55,
        isPassed: isClose,
        transcribedText: textInput,
        targetSentence,
        phoneticBreakdown: [
          {
            word: "Pelafalan",
            isCorrect: isClose,
            feedback: isClose ? "Pelafalan cukup mendekati target." : "Pelafalan masih belum terdengar akurat.",
          },
        ],
        humorRoast: isClose
          ? "Lumayan bro, udah mirip penutur asli dikit-dikit! Gas terus."
          : "Lidah lo masih rada kaku nih, coba dengarkan contoh suaranya lagi dan rekam ulang!",
        recommendation: isClose ? "Lanjut ke tahap berikutnya." : "Ulangi latihan audio.",
      },
    });
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
