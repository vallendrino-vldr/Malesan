import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spendCredits } from "@/lib/credits";
import { getVideoCostPerMin, isVideoEnabled } from "@/lib/config";
import { generate } from "@/lib/gemini/client";
import { aiRateLimit } from "@/lib/rate-limit";
import { notifyGeneration } from "@/lib/telegram";
import {
  ingestYouTube,
  normalizeClips,
  parseYouTubeId,
  YouTubeError,
} from "@/lib/video/youtube";

/**
 * AI Viral Radar for a pasted YouTube link.
 *
 * Nothing here downloads video. We read the published caption track (a few
 * dozen KB) and let the model find the moments worth cutting; the browser then
 * plays those ranges straight from YouTube. That is what makes a one-hour
 * podcast scannable inside a 60-second serverless budget.
 *
 * Priced as a flat two minutes of the video rate: one Gemini pass regardless of
 * length, so per-minute billing would punish exactly the long videos this is
 * most useful for.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const SCAN_MINUTES = 2;

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

  const limited = await aiRateLimit(user.id, "video_youtube_clip", 6);
  if (limited) return limited;

  if (!(await isVideoEnabled())) {
    return json({ error: "Fitur video lagi dimatiin sementara. Coba lagi nanti ya." }, 503);
  }

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const videoId = typeof body?.url === "string" ? parseYouTubeId(body.url) : null;
  if (!videoId) {
    return json({ error: "Link YouTube-nya gak valid. Paste link share-nya ya." }, 400);
  }

  const cost = SCAN_MINUTES * (await getVideoCostPerMin());
  if (profile.credits_free + profile.credits_paid < cost) {
    return json(
      { error: `Perlu ${cost} kredit buat scan video ini. Top up dulu ya.`, needed: cost },
      402,
    );
  }

  let ingest;
  try {
    ingest = await ingestYouTube(videoId);
  } catch (err) {
    if (err instanceof YouTubeError) {
      return json({ error: err.message }, err.code === "no_transcript" ? 422 : 400);
    }
    console.error("youtube ingest failed", err);
    return json({ error: "Gagal baca videonya. Coba lagi bentar ya." }, 502);
  }

  const script = ingest.segments
    .map((s) => `[${Math.round(s.start)}] ${s.text}`)
    .join("\n");

  const prompt = `Kamu editor konten viral Indonesia. Di bawah ini transkrip video YouTube berjudul "${ingest.title}" (durasi ${ingest.durationSec} detik). Tiap baris diawali [detik-mulai].

${script}

Cari 3 sampai 5 potongan PALING BERPOTENSI VIRAL kalau dipotong jadi konten pendek (TikTok/Reels/Shorts).

Aturan keras:
1. startTime dan endTime dalam DETIK (angka), diambil dari penanda [detik] di transkrip.
2. Durasi tiap potongan antara 20 sampai 90 detik. Potongan harus berdiri sendiri: mulai dari kalimat pembuka yang nyantol, selesai di kalimat penutup yang tuntas.
3. Potongan tidak boleh saling tumpang tindih.
4. hookTitle: judul clickbait bahasa Indonesia santai, maksimal 8 kata, tanpa tanda kutip.
5. reason: satu kalimat kenapa ini nempel (emosi / kontroversi / solusi praktis / cerita).
6. viralScore: 1-100, makin nempel makin tinggi.

Balas HANYA JSON array.`;

  let clips;
  try {
    const raw = await generate({
      prompt,
      tier: "free",
      signal: AbortSignal.timeout(45_000),
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            viralScore: { type: "number" },
            hookTitle: { type: "string" },
            startTime: { type: "number" },
            endTime: { type: "number" },
            reason: { type: "string" },
          },
          required: ["viralScore", "hookTitle", "startTime", "endTime", "reason"],
        },
      },
    });
    clips = normalizeClips(JSON.parse(raw), ingest.durationSec);
  } catch (err) {
    console.error("viral scan failed", err);
    return json(
      { error: "AI-nya lagi ngadat pas baca video ini. Kredit lo belum kepotong — coba lagi." },
      502,
    );
  }

  if (!clips.length) {
    return json(
      { error: "AI gak nemu momen yang layak dipotong dari video ini. Coba video lain." },
      422,
    );
  }

  const spend = await spendCredits(user.id, cost, "video_youtube_clip");
  if (!spend.ok) {
    return json({ error: spend.message }, spend.reason === "insufficient" ? 402 : 500);
  }

  try {
    await notifyGeneration({
      email: user.email || "user@malesan",
      moduleName: "Clip Radar YouTube",
      creditsSpent: cost,
      details: `${ingest.title} — ${clips.length} clip`,
    });
  } catch (teleErr) {
    console.warn("[youtube-clip] Telegram notification error:", teleErr);
  }

  return json(
    {
      videoId: ingest.videoId,
      title: ingest.title,
      durationSec: ingest.durationSec,
      clips,
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
