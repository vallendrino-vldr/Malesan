/**
 * YouTube Smart Ingest.
 *
 * We never download the video. Vercel's datacenter IPs get bot-walled by
 * YouTube's media endpoints, serverless has a 60s ceiling, and a 300MB pull
 * would blow the bandwidth budget anyway.
 *
 * The first version of this file scraped the caption track out of the watch
 * page. That is dead: YouTube now returns `LOGIN_REQUIRED` to datacenter IPs,
 * and even when a signed caption `baseUrl` does come back, fetching it returns
 * HTTP 200 with zero bytes unless the request carries a proof-of-origin token
 * minted by their player. Verified against three videos from two networks —
 * this is a wall, not a flaky call, so there is nothing to retry.
 *
 * What replaced it: Gemini accepts a YouTube URL as a `file_data` part and
 * watches the video itself. Google-to-Google, so YouTube's bot defences never
 * enter the picture, and the model sees the visuals rather than only the words.
 * Metadata comes from the public oEmbed endpoint, which is not walled.
 */

export type YouTubeMeta = {
  videoId: string;
  title: string;
  author: string;
};

export type YouTubeErrorCode = "bad_url" | "unavailable" | "blocked" | "no_transcript";

export class YouTubeError extends Error {
  code: YouTubeErrorCode;

  constructor(code: YouTubeErrorCode, message: string) {
    super(message);
    this.name = "YouTubeError";
    this.code = code;
  }
}

/**
 * How much of a video we hand to the model.
 *
 * Video tokens scale linearly with the watched span: ~34k tokens for 15 minutes
 * at 0.2fps, measured. Without a ceiling a three-hour podcast would cost ~50x a
 * short one for the same flat credit price, so we cap the scan window and say so
 * in the UI rather than quietly billing for it.
 */
export const MAX_SCAN_SEC = 30 * 60;

/**
 * Frames per second handed to the model.
 *
 * 1fps (the default) costs ~80k tokens on a 15-minute video; 0.2fps costs ~34k
 * for the same clip picks. We are hunting for topic changes measured in tens of
 * seconds, not individual frames, so the extra resolution buys nothing.
 */
export const SCAN_FPS = 0.2;

/**
 * Pull the 11-char id out of any shape of YouTube link a person might paste:
 * watch?v=, youtu.be/, /shorts/, /embed/, /live/, with or without extra query
 * params (&t=, &list=, tracking junk). Returns null for anything else.
 */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // A bare id, pasted on its own.
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "").toLowerCase();
  const ok = (id: string | undefined | null) =>
    id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;

  if (host === "youtu.be") return ok(url.pathname.slice(1).split("/")[0]);
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;

  const v = url.searchParams.get("v");
  if (v) return ok(v);

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && ["shorts", "embed", "live", "v"].includes(parts[0])) {
    return ok(parts[1]);
  }
  return null;
}

/**
 * Title and channel via oEmbed.
 *
 * This endpoint answers datacenter IPs happily (the watch page does not) and
 * doubles as an existence check: a private, deleted or bogus id returns 401/404
 * here, which lets us fail before spending a Gemini call on it. It does not
 * expose duration — nothing public does anymore — which is why the scan window
 * is capped by policy instead of measured.
 */
export async function fetchYouTubeMeta(videoId: string): Promise<YouTubeMeta> {
  let res: Response;
  try {
    res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(8_000), cache: "no-store" },
    );
  } catch {
    throw new YouTubeError("blocked", "Gagal nyambung ke YouTube. Coba lagi bentar ya.");
  }
  if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 400) {
    throw new YouTubeError(
      "unavailable",
      "Videonya gak ketemu atau private. Pastikan videonya publik ya.",
    );
  }
  if (!res.ok) {
    throw new YouTubeError("blocked", "YouTube lagi nolak permintaan kita. Coba lagi bentar.");
  }
  const data = (await res.json().catch(() => null)) as {
    title?: string;
    author_name?: string;
  } | null;

  return {
    videoId,
    title: data?.title?.trim() || "Video YouTube",
    author: data?.author_name?.trim() || "",
  };
}

export type ViralClip = {
  viralScore: number;
  hookTitle: string;
  startTime: number;
  endTime: number;
  reason: string;
};

/** A clip shorter than this is not postable; longer than this is not a Short. */
export const MIN_CLIP_SEC = 20;
export const MAX_CLIP_SEC = 180;

/**
 * Make the model's answer safe to render.
 *
 * An LLM will happily return an end before its start, a score of 1200, a clip
 * running past the window we asked it to watch, or five copies of the same
 * moment. The UI seeks a player to these numbers, so they get clamped here
 * rather than trusted.
 */
export function normalizeClips(raw: unknown, durationSec: number, max = 5): ViralClip[] {
  if (!Array.isArray(raw)) return [];
  const clips: ViralClip[] = [];

  for (const item of raw) {
    const c = item as Partial<ViralClip>;
    let start = Math.max(0, Math.min(Number(c.startTime), durationSec - 5));
    let end = Math.min(Number(c.endTime), durationSec);
    const hookTitle = String(c.hookTitle ?? "").trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    if (end - start > MAX_CLIP_SEC) continue;
    if (!hookTitle) continue;

    // The model marks the exact quote, which is often ~10s — correct, but too
    // short to post. Pad it out instead of dropping it: the highest-scoring
    // moment in a video is frequently the tersest one, and a viewer would
    // rather trim a little tail than lose the pick entirely.
    if (end - start < MIN_CLIP_SEC) {
      end = Math.min(durationSec, start + MIN_CLIP_SEC);
      // Ran into the end of the window — take the missing seconds from the front.
      if (end - start < MIN_CLIP_SEC) start = Math.max(0, end - MIN_CLIP_SEC);
    }

    // Drop a moment that overlaps one we already took by more than half.
    if (
      clips.some(
        (p) => Math.min(p.endTime, end) - Math.max(p.startTime, start) > (end - start) / 2,
      )
    ) {
      continue;
    }
    clips.push({
      viralScore: Math.max(1, Math.min(100, Math.round(Number(c.viralScore) || 70))),
      hookTitle: hookTitle.slice(0, 90),
      startTime: Math.round(start),
      endTime: Math.round(end),
      reason: String(c.reason ?? "").trim().slice(0, 200) || "Momen paling nempel di video ini.",
    });
  }

  return clips.sort((a, b) => b.viralScore - a.viralScore).slice(0, max);
}
