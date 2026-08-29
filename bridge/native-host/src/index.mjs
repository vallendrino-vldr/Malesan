import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdir, rm, stat } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const API_ORIGINS = new Set(["https://malesan.my.id", "https://www.malesan.my.id", "http://localhost:3000"]);
const UUID = /^[0-9a-f-]{36}$/i;
const TOKEN = /^[A-Za-z0-9_-]{40,128}$/;
let input = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  input = Buffer.concat([input, chunk]);
  while (input.length >= 4) {
    const size = input.readUInt32LE(0);
    if (size > 1024 * 1024) return failProtocol("Pesan Bridge terlalu besar.");
    if (input.length < size + 4) return;
    const payload = input.subarray(4, size + 4).toString("utf8");
    input = input.subarray(size + 4);
    void handle(payload);
  }
});

function reply(value) {
  const body = Buffer.from(JSON.stringify(value));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([header, body]));
}
function failProtocol(error) { reply({ ok: false, error }); process.exitCode = 1; }

async function handle(raw) {
  let message;
  try { message = JSON.parse(raw); } catch { return reply({ ok: false, error: "Pesan Bridge rusak." }); }
  if (message?.type !== "MALESAN_AUTO_CLIP" || !API_ORIGINS.has(message.apiOrigin)) {
    return reply({ ok: false, error: "Permintaan Bridge ditolak." });
  }
  if (!UUID.test(message.jobId ?? "") || !TOKEN.test(message.claimToken ?? "")) {
    return reply({ ok: false, error: "Token Auto Clip gak valid." });
  }

  const root = join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "Malesan", "Bridge");
  const work = join(root, `${message.jobId}-${randomBytes(8).toString("hex")}`);
  await mkdir(work, { recursive: true });
  try {
    const claim = await api(message.apiOrigin, "/api/bridge/auto-clip/claim", {
      jobId: message.jobId, claimToken: message.claimToken,
    });
    const { job, workerToken } = claim;
    const ytDlp = findTool("yt-dlp", process.env.MALESAN_YTDLP_PATH);
    const ffmpeg = findTool("ffmpeg", process.env.MALESAN_FFMPEG_PATH);
    const output = join(work, "clip.mp4");
    await run(ytDlp, [
      "--no-update", "--no-playlist", "--no-warnings", "--max-filesize", "2G",
      "--extractor-args", "youtube:player_client=android,web",
      "-f", "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
      "--format-sort", "res:1080,fps:60,vcodec:h264,acodec:m4a,res,size",
      "--merge-output-format", "mp4",
      "--download-sections", `*${job.startTime}-${job.endTime}`,
      "--force-keyframes-at-cuts", "--ffmpeg-location", ffmpeg,
      "-o", output, job.sourceUrl,
    ], work);
    if (!existsSync(output) || (await stat(output)).size === 0) throw new Error("Output video kosong.");
    const outputBytes = (await stat(output)).size;
    await api(message.apiOrigin, "/api/bridge/auto-clip/acquired", {
      jobId: job.id, workerToken, outputBytes,
    });
    const served = await serveOnce(output, message.apiOrigin, work);
    await progress(message.apiOrigin, job.id, workerToken, "ready", 100, "Potongan sumber siap diedit", {
      outputName: `${safeName(job.clipTitle)}.mp4`, outputBytes: (await stat(output)).size,
    });
    reply({ ok: true, jobId: job.id, downloadUrl: served.url, downloadToken: served.token });
  } catch (error) {
    await rm(work, { recursive: true, force: true }).catch(() => {});
    reply({ ok: false, error: error instanceof Error ? error.message : "Bridge gagal memproses clip." });
  }
}

function findTool(name, configured) {
  if (configured && existsSync(configured)) return configured;
  return process.platform === "win32" ? `${name}.exe` : name;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-4000); });
    child.on("error", () => reject(new Error(`${command} belum terpasang. Jalankan installer Malesan Bridge lagi.`)));
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `${command} gagal (${code}).`)));
  });
}

async function api(origin, path, body) {
  const response = await fetch(`${origin}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Malesan API gagal (${response.status}).`);
  return data;
}
function progress(origin, jobId, workerToken, status, percent, stage, output = {}) {
  return api(origin, "/api/bridge/auto-clip/progress", {
    jobId, workerToken, status, progress: percent, stage,
    errorCode: null, errorMessage: null, outputName: null, outputBytes: null, ...output,
  });
}

function serveOnce(file, allowedOrigin, work) {
  return new Promise((resolve, reject) => {
    const token = randomBytes(32).toString("base64url");
    const timer = setTimeout(() => { server.close(); void rm(work, { recursive: true, force: true }); }, 10 * 60_000);
    const server = createServer((request, response) => {
      response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      if (request.method !== "GET" || request.url !== `/clip/${token}` || request.headers.origin !== allowedOrigin) {
        response.writeHead(403).end(); return;
      }
      response.writeHead(200, { "Content-Type": "video/mp4" });
      createReadStream(file).pipe(response).on("finish", () => {
        clearTimeout(timer); server.close(); void rm(work, { recursive: true, force: true });
      });
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Port lokal Bridge gagal dibuat."));
      resolve({ url: `http://127.0.0.1:${address.port}/clip/${token}`, token });
    });
  });
}

function safeName(value) { return String(value).replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim().slice(0, 80) || "malesan-auto-clip"; }
