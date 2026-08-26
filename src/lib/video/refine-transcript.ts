import "server-only";
import { generate } from "@/lib/gemini/client";
import type { Word } from "@/lib/transcribe";

/**
 * AI-powered phonetic & semantic transcript refiner for Indonesian spoken speech.
 *
 * Speech-to-text models (Whisper) frequently mishear acoustic vowels and consonants
 * in quiet/whispered mobile recordings (e.g. "dulu ngapa" -> "bilang apa", "alas-alas" -> "elus-elus").
 *
 * This module uses Gemini to phonetically and semantically correct misheard words
 * while strictly preserving word counts and millisecond timestamps.
 */
export async function refineTranscriptWithAI(
  words: Word[],
  rawText: string,
): Promise<{ words: Word[]; text: string }> {
  if (!words.length || !rawText.trim()) {
    return { words, text: rawText };
  }

  const prompt = `Kamu adalah model AI korektor fonetik speech-to-text khusus bahasa Indonesia lisan / percakapan sehari-hari.
Tugas kamu adalah memperbaiki kata-kata yang SALAH DENGAR (misheard phonetics / acoustic errors) dari audio mikrofon HP yang bervolume rendah atau berbisik.

Karakteristik kesalahan dengar fonetik bahasa Indonesia:
1. Huruf b/d tertukar (misal: "dulu ngapa" / "lu ngapa" sebenarnya adalah "bilang apa").
2. Huruf vokal e (schwa) tertukar dengan a/u (misal: "alas-alas" / "alus-alus" sebenarnya adalah "elus-elus").
3. Frasa pengulangan kata kerja (misal: "elus-elus", "jalan-jalan", "tanya-tanya").
4. Bahasa gaul, kasual, romantis, atau santai sehari-hari antar teman / pasangan.

Kalimat mentah yang didengar:
"${rawText}"

Daftar kata terdeteksi:
${words.map((w, i) => `${i}: "${w.word}"`).join(", ")}

Instruksi:
1. Analisis kalimat secara semantik dan fonetik: apa kalimat wajar yang sebenarnya diucapkan oleh manusia dalam konteks percakapan tersebut?
2. Perbaiki kata-kata yang keliru dengar menjadi kata bahasa Indonesia yang tepat dan masuk akal.
3. Pertahankan tanda baca asli pada posisi yang sesuai.
4. Jumlah kata output HARUS PERSIS ${words.length} item.
5. Output HANYA JSON array string murni. Contoh: ["kata1", "kata2", "kata3"]`;

  try {
    const rawRes = await generate({
      prompt,
      tier: "free",
      schema: {
        type: "array",
        items: { type: "string" },
      },
    });

    const parsed = JSON.parse(rawRes) as string[];
    if (Array.isArray(parsed) && parsed.length === words.length) {
      const refinedWords = words.map((w, i) => ({
        ...w,
        word: typeof parsed[i] === "string" && parsed[i].trim() ? parsed[i].trim() : w.word,
      }));
      const refinedText = refinedWords.map((w) => w.word).join(" ");
      return { words: refinedWords, text: refinedText };
    }
  } catch (err) {
    // Fail-soft: if LLM refinement fails or timeouts, return raw Whisper words
    console.warn("refineTranscriptWithAI failed, falling back to raw words", err);
  }

  return { words, text: rawText };
}
