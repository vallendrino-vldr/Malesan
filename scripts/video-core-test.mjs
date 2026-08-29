import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const captions = await import(pathToFileURL(resolve("src/lib/video/captions.ts")));
const time = await import(pathToFileURL(resolve("src/lib/time.ts")));

const words = [
  { word: "Satu", start: 0, end: 0.25 },
  { word: "dua", start: 0.3, end: 0.55 },
  { word: "tiga", start: 0.6, end: 0.9 },
  { word: "empat", start: 1.8, end: 2.1 },
];

const lines = captions.groupLines(words, 3, 0.6);
assert.equal(lines.length, 2, "caption pacing must split at word cap/pause");
assert.equal(captions.activeAt(lines, 0.35)?.wordIdx, 1, "active word timing must be stable");
assert.equal(captions.activeAt(lines, 5), null, "captions must disappear after their line");
assert.equal(captions.DEFAULT_STYLE.animation, "pop");

const ass = captions.buildAss(lines, { ...captions.DEFAULT_STYLE, fontScale: 1.5 }, 1080, 1920);
assert.match(ass, /Style: CC,Anton,158,/, "ASS fallback must honor caption size");
const drawSource = readFileSync(resolve("src/lib/video/draw.ts"), "utf8");
assert.match(drawSource, /style\.animation === "pop"/);
assert.match(drawSource, /Math\.max\(Math\.round\(mbps \* 1_000_000\), floor\)/);

assert.equal(time.jakartaDayKey("2026-08-22T18:00:00.000Z"), "2026-08-23");
assert.equal(time.startOfJakartaDay("2026-08-23T12:00:00.000Z").toISOString(), "2026-08-22T17:00:00.000Z");

const puncWords = [
  { word: "Selesai.", start: 0, end: 0.5 },
  { word: "Lanjut", start: 0.6, end: 0.9 },
];
const puncLines = captions.groupLines(puncWords, 4, 1.0);
assert.equal(puncLines.length, 2, "punctuation (.!?) must break line naturally");

assert.match(drawSource, /scale = 1080 \/ short/);

const yt = await import(pathToFileURL(resolve("src/lib/video/youtube.ts")));

assert.equal(yt.parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=42"), "dQw4w9WgXcQ");
assert.equal(yt.parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=X"), "dQw4w9WgXcQ");
assert.equal(yt.parseYouTubeId("https://m.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
assert.equal(yt.parseYouTubeId("https://vimeo.com/12345"), null, "non-YouTube host must be rejected");
assert.equal(yt.parseYouTubeId("https://www.youtube.com/watch?v=short"), null, "malformed id must be rejected");

// The video part is the whole feature: if its envelope is wrong, Gemini simply
// answers about nothing and the user sees "no moments found" instead of an error.
const providers = await import(pathToFileURL(resolve("src/lib/gemini/providers.ts")));
const req = providers.adapterFor("gemini").buildRequest({
  apiKey: "k",
  model: "m",
  prompt: "p",
  stream: false,
  video: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", fps: 0.2, startSec: 0, endSec: 1800 },
});
const sentParts = JSON.parse(req.body).contents[0].parts;
assert.equal(sentParts[0].file_data.file_uri, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
assert.equal(sentParts[0].video_metadata.fps, 0.2, "fps must be sent — it is 2x the token bill");
assert.equal(sentParts[0].video_metadata.end_offset, "1800s", "scan window must be bounded");
assert.equal(sentParts.at(-1).text, "p", "prompt must stay last so it reads as being about the video");

const clips = yt.normalizeClips(
  [
    { viralScore: 900, hookTitle: "A", startTime: 10, endTime: 60, reason: "r" },
    { viralScore: 80, hookTitle: "B", startTime: 20, endTime: 55, reason: "r" }, // overlaps A
    { viralScore: 70, hookTitle: "C", startTime: 100, endTime: 110, reason: "r" }, // short: padded
    { viralScore: 60, hookTitle: "", startTime: 200, endTime: 240, reason: "r" }, // no hook
    { viralScore: 50, hookTitle: "D", startTime: 300, endTime: 340, reason: "r" },
    { viralScore: 40, hookTitle: "E", startTime: 400, endTime: 399, reason: "r" }, // end before start
  ],
  600,
);
assert.deepEqual(
  clips.map((c) => c.hookTitle),
  ["A", "C", "D"],
  "overlapping, unlabelled and inverted clips must be dropped; short ones padded",
);
assert.equal(clips[0].viralScore, 100, "viral score must be clamped to 100");
const padded = clips.find((c) => c.hookTitle === "C");
assert.equal(padded.endTime - padded.startTime, 20, "a too-short clip must be padded, not dropped");

// Padding at the very end of the window must borrow from the front rather than
// run past it, or the player would seek somewhere that does not exist.
const tail = yt.normalizeClips(
  [{ viralScore: 90, hookTitle: "T", startTime: 592, endTime: 598, reason: "r" }],
  600,
);
assert.equal(tail[0].endTime, 600);
assert.equal(tail[0].startTime, 580, "padding must not run past the end of the scanned window");

console.log("Video/time core: pacing, timing, sizing, pricing day boundary verified");
