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

const translatedWords = captions.retimeTranslatedLines(lines, ["One two three", "four again"]);
assert.equal(translatedWords[0].start, lines[0].start, "translation must preserve line start");
assert.equal(translatedWords[2].end, lines[0].end, "translation must preserve first line end");
assert.equal(translatedWords.at(-1).end, lines.at(-1).end, "translation must preserve final line end");
assert.ok(
  translatedWords.every((word, i) => i === 0 || word.start >= translatedWords[i - 1].end),
  "translated word timings must stay ordered and non-overlapping",
);
assert.throws(
  () => captions.retimeTranslatedLines(lines, ["one line only"]),
  /Jumlah baris/,
  "mismatched model output must never corrupt caption timing",
);

const ass = captions.buildAss(lines, { ...captions.DEFAULT_STYLE, fontScale: 1.5 }, 1080, 1920);
assert.match(ass, /Style: CC,Anton,158,/, "ASS fallback must honor caption size");
const drawSource = readFileSync(resolve("src/lib/video/draw.ts"), "utf8");
assert.match(drawSource, /Math\.round\(targetMbps \* 1_000_000\)/);

assert.equal(time.jakartaDayKey("2026-08-22T18:00:00.000Z"), "2026-08-23");
assert.equal(time.startOfJakartaDay("2026-08-23T12:00:00.000Z").toISOString(), "2026-08-22T17:00:00.000Z");

const puncWords = [
  { word: "Selesai.", start: 0, end: 0.5 },
  { word: "Lanjut", start: 0.6, end: 0.9 },
];
const puncLines = captions.groupLines(puncWords, 4, 1.0);
assert.equal(puncLines.length, 2, "punctuation (.!?) must break line naturally");

const layout = await import(pathToFileURL(resolve("src/lib/video/layout.ts")));
const portrait = layout.frameSize(1920, 1080, "9:16");
assert.equal(portrait.W / portrait.H, 9 / 16, "portrait output ratio must be exact");
const square = layout.frameSize(1920, 1080, "1:1");
assert.deepEqual(square, { W: square.H, H: square.H }, "square output must have equal dimensions");
const leftCrop = layout.coverCrop(1920, 1080, 1080, 1920, "left");
const centerCrop = layout.coverCrop(1920, 1080, 1080, 1920, "center");
const rightCrop = layout.coverCrop(1920, 1080, 1080, 1920, "right");
assert.equal(leftCrop.sx, 0, "left focus must anchor source left edge");
assert.ok(centerCrop.sx > leftCrop.sx, "center focus must move crop window");
assert.ok(rightCrop.sx > centerCrop.sx, "right focus must anchor farther right");
assert.equal(layout.normalizedTimestampUs(0.133333, 0.133333), 0, "first decoded frame must mux at timestamp zero");
assert.equal(
  layout.normalizedTimestampUs(0.266666, 0.133333),
  133333,
  "later decoded frames must keep their relative timing",
);

const faceTrack = await import(pathToFileURL(resolve("src/lib/video/face-track.ts")));
const trajectory = faceTrack.buildCropTrajectory([
  { time: 0, faces: [{ x: 0.05, y: 0.2, width: 0.2, height: 0.3, score: 0.95 }] },
  { time: 0.2, faces: [{ x: 0.7, y: 0.2, width: 0.2, height: 0.3, score: 0.95 }] },
  { time: 0.4, faces: [] },
]);
assert.equal(trajectory.length, 3, "every analyzed sample must yield a crop keyframe");
assert.ok(Math.abs(trajectory[1].x - trajectory[0].x) < 0.35, "single-frame subject jump must be bounded");

// Deadband test: micro-movements within deadband threshold (<=0.07) must hold camera steady
const microTrajectory = faceTrack.buildCropTrajectory([
  { time: 0, faces: [{ x: 0.4, y: 0.2, width: 0.2, height: 0.3, score: 0.95 }] },
  { time: 0.2, faces: [{ x: 0.43, y: 0.2, width: 0.2, height: 0.3, score: 0.95 }] },
]);
assert.equal(microTrajectory[0].x, microTrajectory[1].x, "micro-movements within deadband must hold camera steady");

const midpoint = faceTrack.cropFocusAt(trajectory, 0.1);
assert.ok(midpoint.x >= trajectory[0].x && midpoint.x <= trajectory[1].x, "preview/export interpolation must stay between adjacent keyframes");
const trackedCrop = faceTrack.trackedCoverCrop(1920, 1080, 1080, 1920, { time: 0, x: 1, y: 1, confidence: 1 });
assert.ok(trackedCrop.sx >= 0 && trackedCrop.sx + trackedCrop.sw <= 1920, "tracked crop must never leave source width");
assert.ok(trackedCrop.sy >= 0 && trackedCrop.sy + trackedCrop.sh <= 1080, "tracked crop must never leave source height");

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

// Studio enhancements verification: BGM presets, natural filters, and tracking dampening
const bgmModule = await import(pathToFileURL(resolve("src/lib/video/bgm.ts")));
assert.ok(Array.isArray(bgmModule.BGM_PRESETS), "BGM_PRESETS must be an array");
assert.equal(bgmModule.BGM_PRESETS.length, 6, "Must provide 6 distinct BGM options");
assert.ok(bgmModule.BGM_PRESETS.some((p) => p.id === "none"));
assert.ok(bgmModule.BGM_PRESETS.some((p) => p.id === "lofi"));
assert.ok(bgmModule.BGM_PRESETS.some((p) => p.id === "inspiratif"));
assert.ok(bgmModule.BGM_PRESETS.some((p) => p.id === "upbeat"));
assert.ok(bgmModule.BGM_PRESETS.some((p) => p.id === "suspense"));
assert.ok(bgmModule.BGM_PRESETS.some((p) => p.id === "custom"));

const faceTrackSource = readFileSync(resolve("src/lib/video/face-track.ts"), "utf8");
assert.match(faceTrackSource, /DEADBAND_X\s*=\s*0\.09/, "Deadband X must be damped against minor twitching");
assert.match(faceTrackSource, /DEADBAND_Y\s*=\s*0\.08/, "Deadband Y must be damped against breathing motion");
assert.match(faceTrackSource, /0\.06/, "Smoothing alpha must support cinematic broadcast glide");

const drawCode = readFileSync(resolve("src/lib/video/draw.ts"), "utf8");
assert.match(drawCode, /filter === "clean_pro"/, "Clean pro studio filter must be supported");
assert.match(drawCode, /filter === "warm_creator"/, "Warm creator studio filter must be supported");
assert.match(drawCode, /filter === "cinematic"/, "Cinematic moody studio filter must be supported");
assert.match(drawCode, /layout\.filter \?\? "original"/, "Original 100% natural pixels must be the default");

console.log("Video/time core: pacing, timing, sizing, pricing day boundary, BGM presets, filters, face-tracking verified");

