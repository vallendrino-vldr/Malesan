import { NextRequest, NextResponse } from "next/server";
import { normalizeIndonesianSpeech } from "@/lib/speech-cleaner";

export const maxDuration = 30;

const PERSONA_POLLY_MAP: Record<string, string> = {
  david: "Matthew", // Authentic US Male Executive
  alex: "Joey",     // Authentic US Male Upbeat
  sarah: "Amy",     // Authentic UK Female
  emma: "Joanna",   // Authentic US Female
};

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

/** Synthesizes authentic English male/female voices via Amazon Polly */
async function synthesizeWithPolly(text: string, speaker: string): Promise<ArrayBuffer | null> {
  try {
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
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.Error || !data.URL) return null;

    const audioRes = await fetch(data.URL, { signal: AbortSignal.timeout(6000) });
    if (!audioRes.ok) return null;

    return await audioRes.arrayBuffer();
  } catch (err) {
    console.warn("Polly synthesis fallback triggered:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText = typeof body.text === "string" ? body.text : "";
    const lang = typeof body.lang === "string" ? body.lang : "id";
    const persona = typeof body.persona === "string" ? body.persona.toLowerCase() : "";

    if (!rawText.trim()) {
      return NextResponse.json({ error: "Teks tidak boleh kosong" }, { status: 400 });
    }

    // 1. High-fidelity Persona Voice Synthesis (Authentic Male for David/Alex, Female for Sarah/Emma)
    if (persona && PERSONA_POLLY_MAP[persona]) {
      const pollySpeaker = PERSONA_POLLY_MAP[persona];
      const audioBuffer = await synthesizeWithPolly(rawText.trim(), pollySpeaker);

      if (audioBuffer && audioBuffer.byteLength > 0) {
        return new Response(audioBuffer, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(audioBuffer.byteLength),
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
          },
        });
      }
    }

    // 2. Standard / Fallback Google TTS (Used for Indonesian and fallback)
    const cleanText = lang.startsWith("id") ? normalizeIndonesianSpeech(rawText) : rawText.trim();
    const chunks = splitIntoChunks(cleanText, 160);

    if (chunks.length === 0) {
      return NextResponse.json({ error: "Teks kosong setelah dinormalisasi" }, { status: 400 });
    }

    const activeChunks = chunks.slice(0, 12);
    const audioBuffers: ArrayBuffer[] = [];

    for (const chunk of activeChunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        chunk,
      )}&tl=${encodeURIComponent(lang)}&client=tw-ob`;

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
      { error: err instanceof Error ? err.message : "Gagal memproses suara audio" },
      { status: 500 },
    );
  }
}
