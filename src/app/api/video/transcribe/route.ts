import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spendCredits } from "@/lib/credits";
import { getVideoCostPerMin, isVideoEnabled } from "@/lib/config";
import { transcribeAudio, TranscribeError } from "@/lib/transcribe";

/**
 * Word-level transcription for the video Auto-CC editor.
 *
 * The client extracts audio from the uploaded video in the browser (ffmpeg.wasm)
 * and posts only that audio here — the video itself never leaves the user's
 * machine. This route forwards the audio to Groq Whisper, charges credits by the
 * real audio length, and returns per-word timings.
 *
 * Credits are charged on the model's reported duration, not the client's claim,
 * because the client controls the number it sends and this one costs money.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel Hobby caps a serverless request body at ~4.5MB, and long audio is also
// slow to transcribe on a free tier, so the editor is bounded to short-form —
// which is exactly what Auto-CC is for. The client must extract 16kHz mono to
// stay under this for the full window.
const MAX_DURATION_SEC = 600; // 10 minutes
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, credits_free, credits_paid")
    .eq("id", user.id)
    .single();
  if (!profile) return json({ error: "Profil gak ketemu." }, 404);
  if (profile.is_banned) return json({ error: "Akun lo lagi dibekuin." }, 403);

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
  const language = (form.get("language") as string) || "id";
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
  if (clientDuration > MAX_DURATION_SEC) {
    return json({ error: "Maksimal 10 menit per video buat sekarang." }, 413);
  }

  const perMin = await getVideoCostPerMin();

  // Soft pre-check against the client's own duration so we do not spend a Groq
  // call on someone who plainly cannot afford the result. The authoritative
  // charge happens after, on the real duration.
  const estMinutes = Math.max(1, Math.ceil((clientDuration || 60) / 60));
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
    transcript = await transcribeAudio(audio, "audio.m4a", { language });
  } catch (err) {
    if (err instanceof TranscribeError) {
      return json({ error: err.message }, err.status === 503 ? 503 : 502);
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

  // The real charge, on the model's own duration.
  const minutes = Math.max(1, Math.ceil(transcript.duration / 60));
  const cost = minutes * perMin;
  const spend = await spendCredits(user.id, cost, "video_auto_cc");
  if (!spend.ok) {
    return json(
      { error: spend.message },
      spend.reason === "insufficient" ? 402 : 500,
    );
  }

  return json(
    {
      text: transcript.text,
      duration: transcript.duration,
      words: transcript.words,
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
