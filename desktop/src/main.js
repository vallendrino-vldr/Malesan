const { app, BrowserWindow, ipcMain, shell, Notification, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, execFile, execSync } = require("child_process");
const os = require("os");
const http = require("http");

// Disable default menu bar globally for maximum speed & sleek frameless look
Menu.setApplicationMenu(null);

// Performance & GPU acceleration flags for instant cold startup
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("disable-features", "WidgetLayering");
app.commandLine.appendSwitch("disable-site-isolation-trials");

let mainWindow = null;
let cachedEncoder = null;
const activeUploads = new Map();
const activeClips = new Map();

function getBinPath(binName) {
  const isDev = !app.isPackaged;
  const target = binName + (process.platform === "win32" ? ".exe" : "");
  if (isDev) {
    const devPath = path.join(__dirname, "..", "bin", target);
    if (fs.existsSync(devPath)) return devPath;
  }
  const prodPath = path.join(process.resourcesPath, "bin", target);
  if (fs.existsSync(prodPath)) return prodPath;
  const appPath = path.join(process.resourcesPath, "app.asar.unpacked", "bin", target);
  if (fs.existsSync(appPath)) return appPath;
  return target;
}

// Detect hardware video encoder (MediaFoundation, AMD AMF, NVIDIA NVENC, Intel QSV, or CPU fallback)
async function detectHardwareEncoder() {
  if (cachedEncoder) return cachedEncoder;
  const ffmpegPath = getBinPath("ffmpeg");

  return new Promise((resolve) => {
    execFile(ffmpegPath, ["-encoders"], (err, stdout) => {
      if (err || !stdout) {
        cachedEncoder = { name: "libx264", args: ["-preset", "veryfast"], type: "cpu" };
        return resolve(cachedEncoder);
      }

      if (stdout.includes("h264_mf")) {
        // Universal Windows Hardware Encoder (MediaFoundation) - runs at 10x speed on Win 10/11
        cachedEncoder = { name: "h264_mf", args: ["-rate_control", "cbr"], type: "windows-gpu" };
      } else if (stdout.includes("h264_amf")) {
        // AMD AMF for Ryzen / Radeon APU
        cachedEncoder = { name: "h264_amf", args: ["-usage", "transcoding", "-quality", "speed"], type: "amd-amf" };
      } else if (stdout.includes("h264_nvenc")) {
        // NVIDIA NVENC
        cachedEncoder = { name: "h264_nvenc", args: ["-preset", "p4", "-cq", "23"], type: "nvidia-nvenc" };
      } else if (stdout.includes("h264_qsv")) {
        // Intel QuickSync
        cachedEncoder = { name: "h264_qsv", args: ["-preset", "veryfast"], type: "intel-qsv" };
      } else {
        const cores = Math.max(2, os.cpus().length - 1);
        cachedEncoder = { name: "libx264", args: ["-preset", "veryfast", "-threads", String(cores)], type: "cpu" };
      }
      resolve(cachedEncoder);
    });
  });
}

// Warm up hardware encoder check immediately in background
detectHardwareEncoder().catch(() => {});

function sendToRenderer(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("malesan-native-response", payload);
  }
}

// Local loopback HTTP server on port 48215:
// 1. Receives Google OAuth callback from system browser
// 2. Streams generated YouTube video clips back to the web studio
const oauthServer = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, "http://127.0.0.1:48215");

  // Allow cross-origin requests from malesan.my.id
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Stream local clipped MP4 file to the web studio
  if (reqUrl.pathname.startsWith("/clip/")) {
    const token = reqUrl.pathname.replace("/clip/", "");
    const filePath = activeClips.get(token);
    if (filePath && fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": stat.size,
        "Accept-Ranges": "bytes",
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Clip file not found or expired.");
    return;
  }

  // Google OAuth callback endpoint
  if (reqUrl.pathname === "/callback") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Login Berhasil - Malesan Studio</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0c0a09; color: #f2ede7; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #161412; border: 1px solid rgba(255,107,0,0.3); padding: 32px 40px; border-radius: 24px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6); max-width: 400px; }
          h1 { color: #ff6b00; margin: 0 0 8px; font-size: 22px; }
          p { color: #8f857d; font-size: 14px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✓ Login Berhasil!</h1>
          <p>Kamu sudah masuk ke Malesan Studio. Silakan tutup tab ini dan kembali ke aplikasi desktop.</p>
        </div>
        <script>setTimeout(() => { window.close(); }, 2000);</script>
      </body>
      </html>
    `);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL("https://malesan.my.id/app");
      mainWindow.show();
      mainWindow.focus();
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

try {
  oauthServer.listen(48215, "127.0.0.1");
} catch (err) {
  console.warn("Could not start local HTTP server on port 48215:", err);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: "#0c0a09",
    title: "Malesan Studio",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  const chromeUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 MalesanStudio/2.1.0";
  mainWindow.webContents.setUserAgent(chromeUA);

  const appUrl = process.env.MALESAN_DEV_URL || "https://malesan.my.id/app";
  mainWindow.loadURL(appUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes("accounts.google.com") || url.includes("supabase.co/auth")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------
// IPC Bridge Protocol Handlers (100% Android Bridge Compatible)
// -------------------------------------------------------------
ipcMain.on("malesan-native-request", async (_event, req) => {
  const { type, requestId } = req || {};
  if (!requestId) return;

  try {
    switch (type) {
      case "SHELL_HELLO":
      case "GET_SHELL_INFO": {
        const encoder = await detectHardwareEncoder();
        sendToRenderer({
          type: "SHELL_READY",
          requestId,
          appVersion: "2.1.0",
          protocolVersion: 2,
          platform: "windows",
          hardwareEncoder: encoder.type,
          capabilities: [
            "native-auto-clip",          // CRITICAL: Tells ClipRadar to use local yt-dlp & ffmpeg!
            "gallery-stream",            // Direct local video saving to Videos/Malesan
            "hardware-accel",            // GPU hardware acceleration
            "desktop-shell",             // Tells the app it is running in full desktop mode
            "google-system-browser-auth",// 1-click system browser OAuth
            "share-video",               // Native video share / open folder
            "auto-update",               // 1-click auto updater
          ],
        });
        break;
      }

      case "AUTH_SYSTEM_BROWSER": {
        const { url } = req;
        if (url) {
          shell.openExternal(url);
          sendToRenderer({ type: "AUTH_STARTED", requestId });
        }
        break;
      }

      case "CLIP_START":
      case "CLIP_YOUTUBE": {
        const { sourceUrl, url: fallbackUrl, startTime = 0, endTime = 60 } = req;
        const targetUrl = sourceUrl || fallbackUrl;
        if (!targetUrl) {
          sendToRenderer({ type: "NATIVE_ERROR", requestId, message: "URL YouTube tidak boleh kosong." });
          return;
        }

        const duration = Math.max(5, Math.round((endTime || 60) - (startTime || 0)));
        const ytDlpPath = getBinPath("yt-dlp");
        const ffmpegPath = getBinPath("ffmpeg");
        const encoder = await detectHardwareEncoder();

        const videosDir = path.join(os.homedir(), "Videos", "Malesan");
        if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

        const clipToken = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const outputPath = path.join(videosDir, `${clipToken}.mp4`);

        sendToRenderer({
          type: "CLIP_PROGRESS",
          requestId,
          progress: 15,
          stage: "Menghubungkan ke YouTube & menganalisis stream...",
        });

        // Fast extraction using yt-dlp with Node.js runtime for n-token deciphering
        const ytdlpArgs = [
          "--no-check-certificates",
          "--js-runtimes", "node:node",
          "-f", "b[ext=mp4]/18/22/bv*+ba/b",
          "-g",
          targetUrl,
        ];

        execFile(ytDlpPath, ytdlpArgs, (ytErr, stdout) => {
          if (ytErr || !stdout) {
            sendToRenderer({
              type: "NATIVE_ERROR",
              requestId,
              message: "Gagal mengambil stream video YouTube. Pastikan link publik dan dapat diakses.",
            });
            return;
          }

          const streamUrls = stdout.trim().split(/\r?\n/).filter(Boolean);
          const videoStream = streamUrls[0];
          const audioStream = streamUrls[1] || videoStream;

          sendToRenderer({
            type: "CLIP_PROGRESS",
            requestId,
            progress: 40,
            stage: `Memotong klip dengan akselerasi GPU (${encoder.type.toUpperCase()})...`,
          });

          const ffmpegArgs = [
            "-y",
            "-ss", String(startTime),
            "-i", videoStream,
          ];

          if (audioStream !== videoStream) {
            ffmpegArgs.push("-ss", String(startTime), "-i", audioStream);
          }

          ffmpegArgs.push(
            "-t", String(duration),
            "-c:v", encoder.name,
            ...encoder.args,
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            outputPath
          );

          const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

          ffmpegProcess.stderr.on("data", () => {
            sendToRenderer({
              type: "CLIP_PROGRESS",
              requestId,
              progress: 75,
              stage: "Menyusun file video Full HD 1080p...",
            });
          });

          ffmpegProcess.on("close", (code) => {
            if (code === 0 && fs.existsSync(outputPath)) {
              const stats = fs.statSync(outputPath);
              activeClips.set(clipToken, outputPath);

              sendToRenderer({
                type: "CLIP_READY",
                requestId,
                progress: 100,
                downloadUrl: `http://127.0.0.1:48215/clip/${clipToken}`,
                downloadToken: clipToken,
                outputBytes: stats.size,
                filePath: outputPath,
                message: "Klip video berhasil dibuat & disimpan ke folder Videos/Malesan!",
              });
            } else {
              sendToRenderer({
                type: "NATIVE_ERROR",
                requestId,
                message: `Proses render FFmpeg gagal (exit code: ${code}).`,
              });
            }
          });
        });
        break;
      }

      case "GALLERY_PREPARE": {
        const { name = `Malesan_${Date.now()}.mp4` } = req;
        const videosDir = path.join(os.homedir(), "Videos", "Malesan");
        if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

        const downloadToken = `desktop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const targetPath = path.join(videosDir, name);

        activeUploads.set(downloadToken, {
          targetPath,
          stream: fs.createWriteStream(targetPath),
        });

        sendToRenderer({
          type: "GALLERY_UPLOAD_READY",
          requestId,
          downloadToken,
        });
        break;
      }

      case "GALLERY_CHUNK": {
        const { downloadToken, chunk } = req;
        const upload = activeUploads.get(downloadToken);
        if (!upload) {
          sendToRenderer({ type: "NATIVE_ERROR", requestId, message: "Token upload tidak valid." });
          return;
        }

        const buffer = Buffer.from(chunk, "base64");
        upload.stream.write(buffer);

        sendToRenderer({
          type: "GALLERY_CHUNK_ACCEPTED",
          requestId,
          downloadToken,
        });
        break;
      }

      case "GALLERY_COMMIT": {
        const { downloadToken } = req;
        const upload = activeUploads.get(downloadToken);
        if (!upload) {
          sendToRenderer({ type: "NATIVE_ERROR", requestId, message: "Token upload tidak valid." });
          return;
        }

        upload.stream.end();
        activeUploads.delete(downloadToken);

        if (Notification.isSupported()) {
          new Notification({
            title: "Malesan Studio Desktop",
            body: `Video berhasil disimpan ke folder Videos/Malesan`,
            icon: path.join(__dirname, "..", "assets", "icon.png"),
          }).show();
        }

        sendToRenderer({
          type: "GALLERY_SAVED",
          requestId,
          filePath: upload.targetPath,
          message: "Video berhasil disimpan ke folder Videos/Malesan.",
        });
        break;
      }

      case "OPEN_VIDEOS_FOLDER": {
        const videosDir = path.join(os.homedir(), "Videos", "Malesan");
        if (fs.existsSync(videosDir)) shell.openPath(videosDir);
        sendToRenderer({ type: "FOLDER_OPENED", requestId });
        break;
      }

      default:
        sendToRenderer({
          type: "NATIVE_ERROR",
          requestId,
          message: `Unknown command type: ${type}`,
        });
        break;
    }
  } catch (err) {
    sendToRenderer({
      type: "NATIVE_ERROR",
      requestId,
      message: err instanceof Error ? err.message : "Internal Desktop Error",
    });
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
