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
        const transcriptRes = await transcribeAudio(audioFile, "user_voice.webm", {
          language: "en",
          prompt: targetSentence,
        });
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
        error: "Kredit lo nggak cukup buat validasi suara AI. Top up dulu ya.",
        creditError: true,
      },
      402,
    );
  }

  // ---- Programmatic Ground-Truth Match Engine ----
  const tokenize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

  const targetTokens = tokenize(targetSentence);
  const inputTokens = tokenize(textInput);
  const inputTokenSet = new Set(inputTokens);

  const matchedTokens = targetTokens.filter((t) => inputTokenSet.has(t));
  const recall = targetTokens.length > 0 ? matchedTokens.length / targetTokens.length : 1;

  // Check forbidden phrases (e.g. Indoglish)
  const lowerInput = textInput.toLowerCase();
  const forbiddenList = [
    { regex: /\bam agree\b/i, reason: "Mengucapkan 'am agree' (seharusnya 'agree')" },
    { regex: /\bjoin with\b/i, reason: "Mengucapkan 'join with' (seharusnya 'join')" },
    { regex: /\bthanks before\b/i, reason: "Mengucapkan 'thanks before' (seharusnya 'thanks in advance')" },
  ];
  const detectedForbidden = forbiddenList.filter((f) => f.regex.test(lowerInput));
  const isHighMatch = recall >= 0.85 && detectedForbidden.length === 0;

  const prompt = `Anda adalah Master AI Validator Fonetik & Bahasa Inggris untuk aplikasi Malesan (khas kreator Indonesia).
Tugas Anda adalah memvalidasi suara pelafalan pengguna asli terhadap target kalimat ujian tahap kelulusan secara cerdas, realistis, dan berbobot dengan gaya khas Malesan (tanpa emoji, gunakan teks segar dan bernas).

DATA UJIAN:
- Tahap: ${stageTitle} (Tahap ID: ${stageId})
- Fokus Fonetik Ujian: ${focusPhonetics}
- Target Kalimat yang Wajib Diucapkan: "${targetSentence}"
- Kalimat yang Terdengar dari Suara Pengguna (Transkripsi Whisper AI): "${textInput}"

ANALISIS KECOCOKAN KATA (GROUND TRUTH PROGRAMATIK):
- Persentase kata target yang terucap: ${(recall * 100).toFixed(0)}%
- Terdeteksi pola terlarang: ${detectedForbidden.length > 0 ? detectedForbidden.map((d) => d.reason).join(", ") : "TIDAK ADA (Aman)"}
${isHighMatch ? ">>> PERHATIAN WAJIB: Pengguna mengucapkan kalimat target secara LENGKAP dan TEPAT! WAJIB berikan skor LULUS (skor 88 - 98, isPassed: true). DILARANG KERAS menyalahkan kata yang MEMANG TERTULIS di Target Kalimat (seperti kata 'with' pada 'I agree with you')! <<<" : ""}

ATURAN WAJIB PENILAIAN FONETIK & NORMALISASI SPEECH-TO-TEXT (STT):
1. ATURAN KEBENARAN TARGET (GROUND TRUTH):
   - Kata-kata yang tertulis di "Target Kalimat yang Wajib Diucapkan" adalah 100% BENAR.
   - Contoh: Jika Target Kalimat tertulis "I agree with you, please join us and thanks in advance.", maka kata "with" setelah "agree" ADALAH KATA YANG BENAR DAN WAJIB DIUCAPKAN! Dilarang menganggap kata "with" itu salah.
2. NORMALISASI STT WHISPER (SANGAT PENTING):
   - Model Speech-To-Text (Whisper) otomatis mengubah bunyi kata "eitch" atau "aitch" (pelafalan huruf H) menjadi karakter teks "H". Jika transkripsi tertulis "The letter H is pronounced H...", itu artinya pengguna SUDAH melafalkan bunyi "eitch" / "aitch" dengan benar! Jangan salahkan pengguna untuk normalisasi simbol ini.
   - Pelafalan huruf "R" sering ditulis sebagai "R" atau "are" oleh STT.
   - Abaikan trailing noise atau desahan nafas minor di akhir rekaman (seperti suara "O", "oh", "uh", atau klik mikrofon) saat pengguna melepas tombol rekam.
3. PENILAIAN INTI FONETIK:
   - Jika materi Fonetik/Huruf Bisu (Tahap 1): Pastikan pengguna tidak membaca huruf bisu (contoh: "island" dibaca "eye-land", "doubt" dibaca "da-ut"), bunyi V bergetar bukan P, dan bunyi TH berdesis bukan D/T.
   - Jika materi Connected Speech (Tahap 2): Pastikan penyambungan kata (hold on -> hol-don, gonna, wanna).
   - Jika materi Larangan Indoglish (Tahap 3): Pastikan tidak ada "I am agree", "join with us", atau "thanks before".
4. SKOR AKURASI (0 sampai 100):
   - Skor >= 70: LULUS (isPassed: true).
   - Skor < 70: TIDAK LULUS (isPassed: false).
5. Buat "humorRoast": Komentar evaluasi tajam, akurat, suportif, dan diselingi sedikit humor khas Malesan (contoh: "Mantap bos, pelafalan lo udah bersih dan lancar. Siap lanjut ke langkah berikutnya!").
6. Format output WAJIB HANYA JSON MURNI tanpa markdown wrap \`\`\`json:
{
  "score": 85,
  "isPassed": true,
  "transcribedText": "${textInput.replace(/"/g, '\\"')}",
  "targetSentence": "${targetSentence.replace(/"/g, '\\"')}",
  "phoneticBreakdown": [
    { "word": "Kata", "isCorrect": true, "feedback": "Pelafalan jelas." }
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

    // Guard against LLM hallucination when user pronounced exact target words
    if (isHighMatch) {
      result.isPassed = true;
      result.score = Math.max(88, result.score || 90);
      if (/with|belum lulus|ketinggalan|irit|gagal|salah/i.test(result.humorRoast) && result.score < 80) {
        result.humorRoast = "Mantap banget! Pelafalan lo udah sangat presisi, jelas, dan mengalir fasih ala penutur asli.";
      }
    }

    return json({ data: result });
  } catch (err) {
    console.error("[validate-voice] Gemini parse error:", err);
    const isClose = isHighMatch || textInput.toLowerCase().includes(targetSentence.slice(0, 10).toLowerCase());
    return json({
      data: {
        score: isClose ? 88 : 55,
        isPassed: isClose,
        transcribedText: textInput,
        targetSentence,
        phoneticBreakdown: [
          {
            word: "Pelafalan",
            isCorrect: isClose,
            feedback: isClose ? "Pelafalan sangat akurat sesuai target." : "Pelafalan masih belum terdengar akurat.",
          },
        ],
        humorRoast: isClose
          ? "Mantap bos, pelafalan lo udah bersih dan lancar. Siap lanjut ke langkah berikutnya!"
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
