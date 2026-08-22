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

console.log("Video/time core: pacing, timing, sizing, pricing day boundary verified");
