import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spendCredits } from "@/lib/credits";
import { getVideoCostPerMin, isVideoEnabled } from "@/lib/config";
import { generate } from "@/lib/gemini/client";
import { aiRateLimit } from "@/lib/rate-limit";
import { notifyGeneration } from "@/lib/telegram";
import {
  fetchYouTubeMeta,
  MAX_SCAN_SEC,
  normalizeClips,
  parseYouTubeId,
  SCAN_FPS,
  YouTubeError,
} from "@/lib/video/youtube";

/**
 * AI Viral Radar for a pasted YouTube link.
 *
 * Nothing here downloads video, and nothing here reads a transcript: YouTube
 * bot-walls datacenter IPs, and its caption endpoints now demand a token only
 * its own player can mint. Instead Gemini is handed the YouTube URL and watches
 * the video on Google's side, which sidesteps the wall entirely and has the
 * bonus of the model seeing the visuals, not just the words.
 *
 * Priced as a flat two minutes of the video rate: one Gemini pass regardless of
 * length, so per-minute billing would punish exactly the long videos this is
 * most useful for. The scan window cap is what keeps that flat price honest.
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

  // oEmbed doubles as an existence check: a private or deleted video fails here
  // for a few hundred bytes instead of after a full video-token Gemini call.
  let meta;
  try {
    meta = await fetchYouTubeMeta(videoId);
  } catch (err) {
    if (err instanceof YouTubeError) {
      return json({ error: err.message }, err.code === "unavailable" ? 404 : 502);
    }
    console.error("youtube meta failed", err);
    return json({ error: "Gagal baca videonya. Coba lagi bentar ya." }, 502);
  }

  const effectiveScanDuration = meta.durationSec && meta.durationSec > 0
    ? Math.min(MAX_SCAN_SEC, meta.durationSec)
    : MAX_SCAN_SEC;

  const durationNotice = meta.durationSec && meta.durationSec > 0
    ? `\nINFORMASI DURASI: Total panjang video ini adalah ${Math.floor(meta.durationSec / 60)} menit ${meta.durationSec % 60} detik (${meta.durationSec} detik). Semua potongan startTime dan endTime WAJIB berada di dalam rentang 0 sampai ${meta.durationSec} detik.`
    : "";

  const prompt = `Kamu editor konten viral Indonesia. Tonton video YouTube ini berjudul "${meta.title}".${durationNotice}

Cari 3 sampai 5 potongan PALING BERPOTENSI VIRAL kalau dipotong jadi konten pendek (TikTok/Reels/Shorts).

Aturan keras:
1. startTime dan endTime dalam DETIK (angka bulat), dihitung dari awal video. Wajib akurat sesuai isi video dan TIDAK BOLEH melebihi total durasi video (${effectiveScanDuration} detik).
2. Durasi tiap potongan antara 20 sampai 90 detik. Potongan harus berdiri sendiri: mulai dari kalimat pembuka yang nyantol, selesai di kalimat penutup yang tuntas.
3. Potongan tidak boleh saling tumpang tindih.
4. hookTitle: judul clickbait bahasa Indonesia santai, maksimal 8 kata, tanpa tanda kutip.
5. reason: satu kalimat bahasa Indonesia kenapa ini nempel (emosi / kontroversi / solusi praktis / cerita).
6. viralScore: 1-100, makin nempel makin tinggi.
7. WAJIB semua teks dalam Bahasa Indonesia.

Balas HANYA JSON array.`;

  let clips: ReturnType<typeof normalizeClips> = [];
  try {
    const raw = await generate({
      prompt,
      tier: "free",
      provider: "gemini",
      video: {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        fps: SCAN_FPS,
        startSec: 0,
        endSec: effectiveScanDuration,
      },
      signal: AbortSignal.timeout(52_000),
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
    clips = normalizeClips(JSON.parse(raw), effectiveScanDuration);
  } catch (err) {
    console.error("viral scan primary failed, attempting fallback prompt", err);
    try {
      const fallbackRaw = await generate({
        prompt: `${prompt}\n\nPENTING: Keluarkan HANYA raw JSON array valid tanpa formatting markdown apapun. Contoh: [{"viralScore":95,"hookTitle":"Judul Hook Menarik","startTime":10,"endTime":45,"reason":"Alasan kuat"}]`,
        tier: "free",
        provider: "gemini",
        video: {
          url: `https://www.youtube.com/watch?v=${videoId}`,
          fps: SCAN_FPS,
          startSec: 0,
          endSec: effectiveScanDuration,
        },
        signal: AbortSignal.timeout(52_000),
      });
      const cleaned = fallbackRaw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      clips = normalizeClips(JSON.parse(cleaned), effectiveScanDuration);
    } catch (fallbackErr) {
      console.error("viral scan fallback also failed", fallbackErr);
      return json(
        { error: "AI sedang sibuk atau video ini memiliki batasan pemutaran dari YouTube. Kredit lo belum kepotong — coba lagi bentar ya." },
        502,
      );
    }
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
      details: `${meta.title} — ${clips.length} clip`,
    });
  } catch (teleErr) {
    console.warn("[youtube-clip] Telegram notification error:", teleErr);
  }

  return json(
    {
      videoId,
      title: meta.title,
      author: meta.author,
      duration: meta.durationSec,
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
