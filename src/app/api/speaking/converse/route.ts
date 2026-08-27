import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spendCredits } from "@/lib/credits";
import { getCost } from "@/lib/config";
import { generate } from "@/lib/gemini/client";
import { aiRateLimit } from "@/lib/rate-limit";
import { transcribeAudio } from "@/lib/transcribe";

export const runtime = "nodejs";
export const maxDuration = 45;

const PERSONA_POLLY_MAP: Record<string, string> = {
  david: "Matthew",
  alex: "Joey",
  sarah: "Amy",
  emma: "Joanna",
};

async function getPollyAudio(text: string, persona: string): Promise<{ audioUrl: string | null; audioDataUri: string | null }> {
  try {
    const speaker = PERSONA_POLLY_MAP[persona] || "Matthew";
    const form = new URLSearchParams();
    form.append("msg", text);
    form.append("lang", speaker);
    form.append("source", "ttsmp3");

    const res = await fetch("https://ttsmp3.com/makemp3_new.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Origin: "https://ttsmp3.com",
        Referer: "https://ttsmp3.com/",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return { audioUrl: null, audioDataUri: null };
    const data = await res.json();
    if (!data.URL) return { audioUrl: null, audioDataUri: null };

    // Fetch the audio bytes directly on the server to embed into payload for 0ms client decoding
    const audioRes = await fetch(data.URL, { signal: AbortSignal.timeout(4000) });
    if (audioRes.ok) {
      const buf = Buffer.from(await audioRes.arrayBuffer());
      return {
        audioUrl: data.URL,
        audioDataUri: `data:audio/mpeg;base64,${buf.toString("base64")}`,
      };
    }

    return { audioUrl: data.URL || null, audioDataUri: null };
  } catch (e) {
    console.warn("[speaking-converse] Polly audio error:", e);
    return { audioUrl: null, audioDataUri: null };
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: "Sesi lo udah habis. Masuk lagi ya." }, 401);
  }

  const limited = await aiRateLimit(user.id, "speaking_converse", 10);
  if (limited) return limited;

  let textInput = "";
  let persona = "sarah";
  let level = "intermediate";
  let scenario = "daily";
  let history: Array<{ role: "user" | "assistant"; text: string }> = [];

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const audioFile = formData.get("audio");
      persona = String(formData.get("persona") || "sarah");
      level = String(formData.get("level") || "intermediate");
      scenario = String(formData.get("scenario") || "daily");
      const historyRaw = formData.get("history");
      if (historyRaw) {
        history = JSON.parse(String(historyRaw));
      }

      if (audioFile instanceof Blob) {
        const transcriptRes = await transcribeAudio(audioFile, "user_voice.webm", { language: "en" });
        textInput = transcriptRes.text.trim();
      } else {
        textInput = String(formData.get("text") || "").trim();
      }
    } catch (err) {
      console.error("[speaking-converse] FormData parse error:", err);
      return json({ error: "Gagal memproses rekaman suara." }, 400);
    }
  } else {
    try {
      const body = await request.json();
      textInput = String(body.text || "").trim();
      persona = String(body.persona || "sarah");
      level = String(body.level || "intermediate");
      scenario = String(body.scenario || "daily");
      history = body.history || [];
    } catch {
      return json({ error: "Permintaan tidak valid." }, 400);
    }
  }

  if (!textInput) {
    return json({ error: "Suara atau teks tidak terdengar. Coba bicara lagi." }, 400);
  }

  // Deduct credits server-side
  const cost = await getCost("speaking_coach").catch(() => 1);
  const spend = await spendCredits(user.id, cost, "speaking_coach");
  if (!spend.ok) {
    return json({ error: spend.message }, spend.reason === "insufficient" ? 402 : 500);
  }

  // Persona instructions
  const personaPrompts: Record<string, string> = {
    sarah: "Kamu adalah Sarah, penutur asli bahasa Inggris asal London yang ramah, santai, dan ekspresif. Gunakan gaya British kasual yang sopan.",
    alex: "Kamu adalah Alex, pemuda santai asal California yang kasual, banyak menggunakan ungkapan modern, ceria, dan bersahabat.",
    david: "Kamu adalah David, Senior Tech Recruiter and Executive Interviewer. Bersikap profesional, tajam, namun mendukung kandidat dalam wawancara kerja.",
    emma: "Kamu adalah Emma, IELTS & TOEFL Master Coach. Berikan pertanyaan terstruktur, melatih alur berpikir kritis dan kelancaran bahasa Inggris.",
  };

  const levelRules: Record<string, string> = {
    beginner: "Pengguna adalah PEMULA. Gunakan kosakata sederhana, kalimat pendek, dan bicara dengan tempo ramah yang mudah dimengerti.",
    intermediate: "Pengguna adalah MENENGAH. Gunakan percakapan normal mengalir, variasikan struktur kalimat, dan latih transisi alami.",
    advanced: "Pengguna adalah TINGKAT MAHIR. Gunakan idiom, bahasa profesional, kosakata kaya, dan diskusikan topik secara mendalam.",
  };

  const personaContext = personaPrompts[persona] || personaPrompts.sarah;
  const levelContext = levelRules[level] || levelRules.intermediate;

  const historyContext = history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "User" : "Partner"}: "${h.text}"`)
    .join("\n");

  const prompt = `${personaContext}
${levelContext}
Konteks Skenario: ${scenario}

Riwayat Percakapan Sebelumnya:
${historyContext || "(Baru memulai percakapan)"}

Pesan Pengguna Baru:
"${textInput}"

TUGAS KAMU:
1. Berikan respons percakapan balasan dalam bahasa Inggris (replyEn) yang alami, relevan, dan mengajak pengguna terus berbicara (1-3 kalimat).
2. Terjemahkan respons bahasa Inggris kamu ke dalam bahasa Indonesia (translateId) yang luwes dan natural agar pemula bisa langsung memahami artinya.
3. Berikan 3 CONTEKAN JAWABAN CEPAT (suggestedReplies) yang bisa diucapkan/dikirim pengguna berikutnya dalam bahasa Inggris beserta arti singkat Indonesianya.
4. Periksa ucapan pengguna: Apakah ada kesalahan grammar, pilihan kata, atau kebiasaan buruk?
   - Jika ADA kesalahan, buat tip koreksi halus (correctionTip) dalam bahasa Indonesia yang ringkas (contoh: "Gunakan 'went' untuk masa lampau: I went to the store").
   - Identifikasi KATEGORI KELEMAHAN (pitfallTag) yang ringkas (misal: "Past Tense (V2)", "Preposition (in/at/on)", "Subject-Verb Agreement", "Vocabulary Choice", "Pronunciation Hint").
   - Jika BENAR, kosongkan (null).
5. HUMOR & ROASTING ENGINE (Wajib ada jika ada kesalahan konyol / bahasa Indonesia):
   - Jika pengguna membuat kesalahan lucu (seperti salah tenses parah, pakai bahasa Indonesia dicampur Inggris ga pas, atau idiom aneh), buat 1 kalimat roasting santai & lucu dalam bahasa Indonesia sehari-hari yang menghibur (roastComment).
   - Jika pengguna bicara lancar dan bagus, berikan pujian santai tanpa lebay.
6. Berikan estimasi skor kelancaran percakapan ini (fluencyScore: 1-100).
7. Sebutkan 1 kosakata atau frasa keren yang relevan dengan topik ini (newVocab).
8. Jika ini skenario simulasi, periksa apakah tujuan percakapan sudah tercapai (missionAccomplished: boolean).

ATURAN FORMATTING KETAT:
- DILARANG MENGGUNAKAN EMOJI APAPUN.
- Kembalikan HANYA format JSON sesuai skema.`;

  const schema = {
    type: "OBJECT",
    properties: {
      userTranscribedText: { type: "STRING" },
      replyEn: { type: "STRING" },
      translateId: { type: "STRING" },
      suggestedReplies: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            en: { type: "STRING" },
            id: { type: "STRING" },
          },
          required: ["en", "id"],
        },
        minItems: 3,
        maxItems: 3,
      },
      correctionTip: { type: "STRING" },
      pitfallTag: { type: "STRING" },
      roastComment: { type: "STRING" },
      fluencyScore: { type: "NUMBER" },
      newVocab: { type: "STRING" },
      missionAccomplished: { type: "BOOLEAN" },
    },
    required: ["replyEn", "translateId", "suggestedReplies", "fluencyScore"],
  };

  try {
    const rawAi = await generate({ prompt, schema, tier: "free" });
    const parsed = JSON.parse(rawAi.trim());
    const audioData = await getPollyAudio(replyEn, persona);
    const audioUrl = audioData.audioDataUri || audioData.audioUrl || null;

    return json({
      ok: true,
      userTranscribedText: textInput,
      replyEn,
      audioUrl,
      translateId: parsed.translateId || "Itu sangat menarik! Ceritakan lebih banyak tentang hal itu.",
      suggestedReplies: Array.isArray(parsed.suggestedReplies) && parsed.suggestedReplies.length > 0
        ? parsed.suggestedReplies
        : [
            { en: "I would like to know more.", id: "Saya ingin tahu lebih lanjut." },
            { en: "That makes a lot of sense.", id: "Itu sangat masuk akal." },
            { en: "Could you explain that again?", id: "Bisakah kamu jelaskan lagi?" },
          ],
      correctionTip: parsed.correctionTip || null,
      pitfallTag: parsed.pitfallTag || null,
      roastComment: parsed.roastComment || null,
      fluencyScore: parsed.fluencyScore || 80,
      newVocab: parsed.newVocab || null,
      missionAccomplished: Boolean(parsed.missionAccomplished),
      creditsSpent: cost,
    });
  } catch (err) {
    console.error("[speaking-converse] AI error:", err);
    return json(
      {
        ok: true,
        userTranscribedText: textInput,
        replyEn: "I hear you! That sounds really interesting. What do you think we should explore next?",
        translateId: "Aku mendengarmu! Itu terdengar sangat menarik. Apa yang ingin kita bahas berikutnya?",
        suggestedReplies: [
          { en: "Let us talk about daily hobbies.", id: "Mari kita bicara tentang hobi sehari-hari." },
          { en: "I want to improve my speaking confidence.", id: "Saya ingin meningkatkan kepercayaan diri berbicara." },
          { en: "Can we practice a job interview?", id: "Bisakah kita latihan wawancara kerja?" },
        ],
        correctionTip: null,
        pitfallTag: null,
        roastComment: null,
        fluencyScore: 75,
        newVocab: null,
        missionAccomplished: false,
        creditsSpent: cost,
      },
      200,
    );
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
