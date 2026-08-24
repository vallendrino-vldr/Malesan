import { NextRequest, NextResponse } from "next/server";
import { normalizeIndonesianSpeech } from "@/components/VoicePreview";

export const maxDuration = 30;

function splitIntoChunks(text: string, maxLen = 160): string[] {
  const sentences = text.match(/[^.!?…\n]+[.!?…\n]*/g) || [text];
  const chunks: string[] = [];
  let current = "";

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    if ((current + " " + trimmed).trim().length <= maxLen) {
      current = (current + " " + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      // If single sentence exceeds maxLen, split by commas or words
      if (trimmed.length > maxLen) {
        const words = trimmed.split(/\s+/);
        let sub = "";
        for (const w of words) {
          if ((sub + " " + w).trim().length <= maxLen) {
            sub = (sub + " " + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        if (sub) current = sub;
        else current = "";
      } else {
        current = trimmed;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText = typeof body.text === "string" ? body.text : "";
    if (!rawText.trim()) {
      return NextResponse.json({ error: "Teks tidak boleh kosong" }, { status: 400 });
    }

    const cleanText = normalizeIndonesianSpeech(rawText);
    const chunks = splitIntoChunks(cleanText, 160);

    if (chunks.length === 0) {
      return NextResponse.json({ error: "Teks kosong setelah dinormalisasi" }, { status: 400 });
    }

    // Limit to max 12 chunks (~2-3 minutes of voiceover preview)
    const activeChunks = chunks.slice(0, 12);

    const audioBuffers: ArrayBuffer[] = [];

    for (const chunk of activeChunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        chunk,
      )}&tl=id&client=tw-ob`;

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Referer: "https://translate.google.com/",
        },
      });

      if (!res.ok) {
        throw new Error(`TTS provider returned status ${res.status}`);
      }

      const buf = await res.arrayBuffer();
      audioBuffers.push(buf);
    }

    // Concatenate all audio MP3 byte buffers
    const totalLength = audioBuffers.reduce((acc, b) => acc + b.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const b of audioBuffers) {
      combined.set(new Uint8Array(b), offset);
      offset += b.byteLength;
    }

    return new Response(combined, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(totalLength),
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err: unknown) {
    console.error("TTS API Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memproses suara Bahasa Indonesia" },
      { status: 500 },
    );
  }
}
