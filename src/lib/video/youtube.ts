/**
 * YouTube Smart Ingest.
 *
 * We never download the video. Vercel's datacenter IPs get bot-walled by
 * YouTube's media endpoints, serverless has a 60s ceiling, and a 300MB pull
 * would blow the bandwidth budget anyway. What we actually need to find viral
 * moments is the *words plus their timestamps* — and YouTube already publishes
 * those as a caption track, a few dozen KB of JSON.
 *
 * So: read the watch page once, lift the caption track list out of the embedded
 * player response, fetch one track. Playback stays client-side in an embed.
 */

export type TranscriptSegment = { start: number; end: number; text: string };

export type YouTubeMeta = {
  videoId: string;
  title: string;
  durationSec: number;
};

export type YouTubeIngest = YouTubeMeta & {
  lang: string;
  segments: TranscriptSegment[];
};

export type YouTubeErrorCode =
  | "bad_url"
  | "unavailable"
  | "blocked"
  | "no_transcript"
  | "too_long";

export class YouTubeError extends Error {
  code: YouTubeErrorCode;

  constructor(code: YouTubeErrorCode, message: string) {
    super(message);
    this.name = "YouTubeError";
    this.code = code;
  }
}

/** Hard ceiling on what we will scan. Longer than this and the prompt costs
 *  more than the clip is worth. */
export const MAX_VIDEO_SEC = 90 * 60;

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

type CaptionTrack = { baseUrl: string; languageCode?: string; kind?: string };

async function getWatchPage(videoId: string): Promise<string> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=id`, {
    headers: {
      // Without a browser UA YouTube serves a stripped page with no player
      // response at all, which reads as "no transcript" and is a lie.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (res.status === 404) {
    throw new YouTubeError("unavailable", "Videonya gak ketemu. Cek lagi linknya ya.");
  }
  if (!res.ok) {
    throw new YouTubeError("blocked", "YouTube lagi nolak permintaan kita. Coba lagi bentar.");
  }
  return res.text();
}

function readMeta(html: string, videoId: string): YouTubeMeta {
  if (/"status":"(LOGIN_REQUIRED|UNPLAYABLE|ERROR)"/.test(html)) {
    throw new YouTubeError(
      "unavailable",
      "Video ini private / dibatasi umur, jadi gak bisa dibaca. Coba video publik.",
    );
  }
  const title =
    html.match(/"videoDetails":\{.*?"title":"(.*?)"/)?.[1] ??
    html.match(/<meta name="title" content="([^"]*)"/)?.[1] ??
    "Video YouTube";
  const durationSec = Number(html.match(/"lengthSeconds":"(\d+)"/)?.[1] ?? 0);
  return {
    videoId,
    // The title is JSON-escaped inside the page source.
    title: JSON.parse(`"${title.replace(/"/g, '\\"')}"`) as string,
    durationSec,
  };
}

function pickTrack(html: string): CaptionTrack {
  const block = html.match(/"captionTracks":(\[.*?\])/)?.[1];
  if (!block) {
    throw new YouTubeError(
      "no_transcript",
      "Video ini gak punya subtitle sama sekali, jadi AI gak bisa baca isinya.",
    );
  }
  let tracks: CaptionTrack[];
  try {
    tracks = JSON.parse(block) as CaptionTrack[];
  } catch {
    throw new YouTubeError("no_transcript", "Subtitle videonya gak kebaca formatnya.");
  }
  const usable = tracks.filter((t) => t?.baseUrl);
  // Prefer a real Indonesian track, then real English, then whatever auto-caption
  // exists — auto captions are messier but still carry the timings we need.
  const byLang = (lang: string, auto: boolean) =>
    usable.find(
      (t) => t.languageCode?.startsWith(lang) && (auto ? t.kind === "asr" : t.kind !== "asr"),
    );
  const track =
    byLang("id", false) ?? byLang("en", false) ?? byLang("id", true) ?? usable[0];
  if (!track) {
    throw new YouTubeError("no_transcript", "Video ini gak punya subtitle yang bisa dipakai.");
  }
  return track;
}

type Json3 = {
  events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[];
};

async function getSegments(track: CaptionTrack): Promise<TranscriptSegment[]> {
  const url = `${track.baseUrl.replace(/&fmt=\w+/, "")}&fmt=json3`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!res.ok) throw new YouTubeError("no_transcript", "Gagal ngambil subtitle videonya.");
  const data = (await res.json().catch(() => null)) as Json3 | null;

  const segments: TranscriptSegment[] = [];
  for (const ev of data?.events ?? []) {
    const text = (ev.segs ?? [])
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || typeof ev.tStartMs !== "number") continue;
    const start = ev.tStartMs / 1000;
    segments.push({ start, end: start + (ev.dDurationMs ?? 4000) / 1000, text });
  }
  if (!segments.length) {
    throw new YouTubeError("no_transcript", "Subtitle videonya kosong, gak ada omongan kebaca.");
  }
  return segments;
}

/**
 * Glue tiny caption cues into ~15s blocks.
 *
 * Auto-captions arrive as two- or three-word fragments; a one-hour video is
 * thousands of them. Merging cuts the prompt by roughly 10x while keeping
 * timestamps accurate to well inside a clip boundary.
 */
export function mergeSegments(segments: TranscriptSegment[], blockSec = 15): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (last && s.end - last.start <= blockSec) {
      last.end = s.end;
      last.text = `${last.text} ${s.text}`;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

export async function ingestYouTube(videoId: string): Promise<YouTubeIngest> {
  const html = await getWatchPage(videoId);
  const meta = readMeta(html, videoId);
  if (meta.durationSec > MAX_VIDEO_SEC) {
    throw new YouTubeError("too_long", "Maksimal 90 menit per video buat sekarang.");
  }
  const track = pickTrack(html);
  const segments = mergeSegments(await getSegments(track));
  return {
    ...meta,
    // Fall back to the last cue's end when the page hides lengthSeconds.
    durationSec: meta.durationSec || Math.ceil(segments[segments.length - 1].end),
    lang: track.languageCode ?? "id",
    segments,
  };
}

export type ViralClip = {
  viralScore: number;
  hookTitle: string;
  startTime: number;
  endTime: number;
  reason: string;
};

/**
 * Make the model's answer safe to render.
 *
 * An LLM will happily return an end before its start, a score of 1200, a clip
 * running past the end of the video, or five copies of the same moment. The UI
 * seeks a player to these numbers, so they get clamped here rather than trusted.
 */
export function normalizeClips(raw: unknown, durationSec: number, max = 5): ViralClip[] {
  if (!Array.isArray(raw)) return [];
  const clips: ViralClip[] = [];

  for (const item of raw) {
    const c = item as Partial<ViralClip>;
    const start = Math.max(0, Math.min(Number(c.startTime), durationSec - 5));
    const end = Math.min(Number(c.endTime), durationSec);
    const hookTitle = String(c.hookTitle ?? "").trim();
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (end - start < 8 || end - start > 180) continue;
    if (!hookTitle) continue;
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
