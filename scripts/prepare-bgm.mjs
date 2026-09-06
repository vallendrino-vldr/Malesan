import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const TRACKS = [
  {
    id: "lofi",
    title: "Perspective",
    artist: "Sappheiros",
    license: "CC-BY 3.0",
    url: "https://upload.wikimedia.org/wikipedia/commons/0/09/Sappheiros_-_Perspective_%28Lofi_Hip_Hop%29.ogg",
    duration: 65,
    startOffset: 0,
  },
  {
    id: "upbeat",
    title: "Carefree",
    artist: "Kevin MacLeod",
    license: "CC-BY 3.0",
    url: "https://upload.wikimedia.org/wikipedia/commons/5/58/Kevin_MacLeod_-_Carefree.ogg",
    duration: 65,
    startOffset: 0,
  },
  {
    id: "inspiratif",
    title: "Dreams Become Real",
    artist: "Kevin MacLeod",
    license: "CC-BY 3.0",
    url: "https://upload.wikimedia.org/wikipedia/commons/c/cd/Dreams_Become_Real_%28ISRC_USUAN1500027%29.mp3",
    duration: 65,
    startOffset: 15, // Skip intro silence to get right into the uplifting theme
  },
  {
    id: "suspense",
    title: "Hitman",
    artist: "Kevin MacLeod",
    license: "CC-BY 3.0",
    url: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Hitman_%28ISRC_USUAN1300013%29.mp3",
    duration: 65,
    startOffset: 0,
  },
  {
    id: "komedi",
    title: "Monkeys Spinning Monkeys",
    artist: "Kevin MacLeod",
    license: "CC-BY 3.0",
    url: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Monkeys_Spinning_Monkeys_%28ISRC_USUAN1400011%29.mp3",
    duration: 65,
    startOffset: 0,
  },
];

const OUT_DIR = path.resolve("public/audio/bgm");
const TEMP_DIR = path.resolve(".temp-bgm");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

async function processTrack(track) {
  const tempInput = path.join(TEMP_DIR, `${track.id}_raw${path.extname(new URL(track.url).pathname)}`);
  const finalOutput = path.join(OUT_DIR, `${track.id}.mp3`);

  console.log(`[BGM] Downloading ${track.title} by ${track.artist}...`);
  const res = await fetch(track.url, {
    headers: {
      "User-Agent": "MalesanVideoEditor/1.0 (creative@malesan.my.id; audio-fetch)",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${track.url}: ${res.status} ${res.statusText}`);
  }

  const arrayBuf = await res.arrayBuffer();
  fs.writeFileSync(tempInput, Buffer.from(arrayBuf));
  console.log(`[BGM] Downloaded ${track.title} (${(arrayBuf.byteLength / 1024 / 1024).toFixed(2)} MB)`);

  const dur = track.duration;
  const fadeOutStart = (dur - 0.6).toFixed(1);
  const filter = `afade=t=in:ss=0:d=0.4,afade=t=out:st=${fadeOutStart}:d=0.6,loudnorm=I=-16:TP=-1.5:LRA=11`;

  console.log(`[BGM] Converting with ffmpeg to 128k MP3 (${dur}s loop)...`);
  const cmd = `ffmpeg -y -ss ${track.startOffset} -t ${dur} -i "${tempInput}" -af "${filter}" -c:a libmp3lame -b:a 128k -ar 44100 "${finalOutput}"`;
  execSync(cmd, { stdio: "inherit" });

  const finalStat = fs.statSync(finalOutput);
  console.log(`[BGM] Done! Saved ${finalOutput} (${(finalStat.size / 1024).toFixed(1)} KB)\n`);
}

async function main() {
  console.log("=== Malesan Royalty-Free BGM Asset Pipeline ===\n");
  for (const t of TRACKS) {
    await processTrack(t);
  }
  // Cleanup temp files
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch {}
  console.log("=== All 5 BGM tracks successfully created in public/audio/bgm! ===");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
