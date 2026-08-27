import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spendCredits } from "@/lib/credits";
import { getVideoCostPerMin, isVideoEnabled } from "@/lib/config";
import { transcribeAudio, TranscribeError } from "@/lib/transcribe";
import { refineTranscriptWithAI } from "@/lib/video/refine-transcript";
import { aiRateLimit } from "@/lib/rate-limit";
import { notifyGeneration } from "@/lib/telegram";

/**
 * Word-level transcription for the video Auto-CC editor.
 *
 * The client extracts audio from the uploaded video in the browser (ffmpeg.wasm)
 * and posts only that audio here — the video itself never leaves the user's
 * machine. This route forwards the audio to Groq Whisper, charges credits by the
 * real audio length, and returns per-word timings.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_DURATION_SEC = 600; // 10 minutes
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

const GRACE_SEC = 1.5;
const billedMinutes = (sec: number) => Math.max(1, Math.ceil((sec - GRACE_SEC) / 60));

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sesi lo udah habis. Masuk lagi ya." }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, credits_free, credits_paid")
    .eq("id", user.id)
    .single();

  if (!profile) return json({ error: "Profil gak ketemu." }, 404);
  if (profile.is_banned) return json({ error: "Akun lo lagi dibekuin." }, 403);

  const limited = await aiRateLimit(user.id, "video_transcribe", 4);
  if (limited) return limited;

  if (!(await isVideoEnabled())) {
    return json({ error: "Fitur video lagi dimatiin sementara. Coba lagi nanti ya." }, 503);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Uploadnya gak kebaca. Coba ulang." }, 400);
  }

  const audio = form.get("audio");
  const filename = audio instanceof File && audio.name ? audio.name : "audio.wav";
  const language = String(form.get("language") || "id").trim().toLowerCase();
  const clientDuration = Number(form.get("durationSec") ?? 0);

  if (!(audio instanceof Blob) || audio.size === 0) {
    return json({ error: "Audionya kosong. Coba pilih videonya lagi." }, 400);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return json(
      { error: "Videonya kepanjangan buat sekali proses. Potong dulu di bawah ~10 menit ya." },
      413,
    );
  }
  if (!/^[a-z]{2}$/.test(language)) {
    return json({ error: "Bahasa videonya gak dikenali." }, 400);
  }
  if (!Number.isFinite(clientDuration) || clientDuration <= 0) {
    return json({ error: "Durasi videonya gak kebaca. Pilih videonya lagi ya." }, 400);
  }
  if (clientDuration > MAX_DURATION_SEC) {
    return json({ error: "Maksimal 10 menit per video buat sekarang." }, 413);
  }

  const perMin = await getVideoCostPerMin();

  // Soft pre-check against the client's own duration so we do not spend a Groq
  // call on someone who plainly cannot afford the result. The authoritative
  // charge happens after, on the real duration.
  const estMinutes = billedMinutes(clientDuration || 60);
  const estCost = estMinutes * perMin;
  if (profile.credits_free + profile.credits_paid < estCost) {
    return json(
      {
        error: `Perlu sekitar ${estCost} kredit buat video ini. Kredit lo kurang — top up dulu ya.`,
        needed: estCost,
      },
      402,
    );
  }

  let transcript;
  try {
    // Leave enough time for a clean response before Vercel's 60-second hard
    // ceiling. Credits are charged only after this returns successfully.
    transcript = await transcribeAudio(audio, filename, {
      language,
      signal: AbortSignal.timeout(48_000),
    });
  } catch (err) {
    if (err instanceof TranscribeError) {
      console.error("transcribe provider failed", {
        status: err.status,
        retryable: err.retryable,
        message: err.message,
      });
      return json(
        {
          error: err.retryable
            ? "Layanan subtitle lagi padat. Kredit lo belum dipotong — coba lagi sebentar."
            : "Audio ini belum bisa diproses. Coba video lain atau cek lagi format suaranya.",
        },
        err.status === 429 ? 429 : err.status === 503 ? 503 : 502,
      );
    }
    console.error("transcribe failed", err);
    return json({ error: "Transkripsi gagal. Coba lagi bentar lagi." }, 502);
  }

  if (!transcript.words.length) {
    // Nothing was charged yet, so nothing to refund — just tell them plainly.
    return json(
      { error: "Gak kedengeran ada omongan di videonya. Pastiin ada suara/narasi." },
      422,
    );
  }

  // Refine misheard phonetics & colloquial speech using Indonesian contextual AI
  let finalWords = transcript.words;
  let finalText = transcript.text;
  if (language === "id" && finalWords.length > 0) {
    const refined = await refineTranscriptWithAI(finalWords, finalText);
    finalWords = refined.words;
    finalText = refined.text;
  }

  // The real charge, on the model's own duration.
  const minutes = billedMinutes(transcript.duration);
  const cost = minutes * perMin;
  const spend = await spendCredits(user.id, cost, "video_auto_cc");
  if (!spend.ok) {
    return json(
      { error: spend.message },
      spend.reason === "insufficient" ? 402 : 500,
    );
  }

  // Notify owner via Telegram silently
  try {
    await notifyGeneration({
      email: user.email || "user@malesan",
      moduleName: "Video Auto-CC",
      creditsSpent: cost,
      details: `Durasi: ${Math.round(transcript.duration)}s (${finalWords.length} kata)`,
    });
  } catch (teleErr) {
    console.warn("[transcribe] Telegram notification error:", teleErr);
  }

  return json(
    {
      text: finalText,
      duration: transcript.duration,
      words: finalWords,
      creditsSpent: cost,
    },
    200,
  );
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
