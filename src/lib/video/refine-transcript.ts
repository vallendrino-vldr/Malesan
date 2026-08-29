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
async function refineChunk(chunkWords: Word[]): Promise<Word[]> {
  if (!chunkWords.length) return chunkWords;
  const chunkText = chunkWords.map((w) => w.word).join(" ");
  const prompt = `Kamu adalah model AI korektor fonetik speech-to-text khusus video konten kreator Indonesia (percakapan kasual, bahasa gaul, dan bilingual / campur Inggris).
Tugas kamu adalah memperbaiki kata-kata yang SALAH DENGAR (misheard phonetics / acoustic errors).

Aturan & Karakteristik:
1. PERTAHANKAN istilah bahasa Inggris yang wajar diucapkan kreator (misal: "mystery box", "unboxing", "review", "worth it", "gameplay", "content creator", "aesthetic", "subscribe", "literally", "guys"). JANGAN terjemahkan istilah Inggris ke bahasa Indonesia jika memang diucapkan dalam bahasa Inggris!
2. Perbaiki fonetik salah dengar bahasa Indonesia (misal: "dulu ngapa" -> "bilang apa", "alas-alas" -> "elus-elus").
3. Pertahankan tanda baca asli pada posisi yang sesuai.
4. Jumlah kata output HARUS PERSIS ${chunkWords.length} item.
5. Output HANYA JSON array string murni. Contoh: ["kata1", "kata2", "kata3"]

Kalimat mentah yang didengar:
"${chunkText}"

Daftar kata terdeteksi:
${chunkWords.map((w, i) => `${i}: "${w.word}"`).join(", ")}`;

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
    if (Array.isArray(parsed) && parsed.length === chunkWords.length) {
      return chunkWords.map((w, i) => ({
        ...w,
        word: typeof parsed[i] === "string" && parsed[i].trim() ? parsed[i].trim() : w.word,
      }));
    }
  } catch (err) {
    console.warn("refineChunk failed, falling back to raw words", err);
  }
  return chunkWords;
}

export async function refineTranscriptWithAI(
  words: Word[],
  rawText: string,
): Promise<{ words: Word[]; text: string }> {
  if (!words.length || !rawText.trim()) {
    return { words, text: rawText };
  }

  // Chunk into batches of up to 20 words for maximum LLM attention & speed
  const CHUNK_SIZE = 20;
  const chunks: Word[][] = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    chunks.push(words.slice(i, i + CHUNK_SIZE));
  }

  const refinedChunks = await Promise.all(chunks.map((c) => refineChunk(c)));
  const refinedWords = refinedChunks.flat();
  const refinedText = refinedWords.map((w) => w.word).join(" ");

  return { words: refinedWords, text: refinedText };
}
