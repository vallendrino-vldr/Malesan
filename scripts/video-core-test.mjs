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

const merged = yt.mergeSegments(
  [
    { start: 0, end: 2, text: "halo" },
    { start: 2, end: 4, text: "semua" },
    { start: 30, end: 32, text: "lanjut" },
  ],
  15,
);
assert.equal(merged.length, 2, "cues within the block window must merge");
assert.equal(merged[0].text, "halo semua");

const clips = yt.normalizeClips(
  [
    { viralScore: 900, hookTitle: "A", startTime: 10, endTime: 60, reason: "r" },
    { viralScore: 80, hookTitle: "B", startTime: 20, endTime: 55, reason: "r" }, // overlaps A
    { viralScore: 70, hookTitle: "C", startTime: 100, endTime: 103, reason: "r" }, // too short
    { viralScore: 60, hookTitle: "", startTime: 200, endTime: 240, reason: "r" }, // no hook
    { viralScore: 50, hookTitle: "D", startTime: 300, endTime: 340, reason: "r" },
  ],
  600,
);
assert.deepEqual(
  clips.map((c) => c.hookTitle),
  ["A", "D"],
  "overlapping, too-short and unlabelled clips must be dropped",
);
assert.equal(clips[0].viralScore, 100, "viral score must be clamped to 100");

console.log("Video/time core: pacing, timing, sizing, pricing day boundary verified");
