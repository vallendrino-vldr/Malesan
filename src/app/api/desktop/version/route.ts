import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    version: "2.1.0",
    name: "Malesan Studio Desktop",
    releaseDate: "2026-09-03",
    minSupportedVersion: "2.0.0",
    downloadUrl: "https://github.com/vallendrino-vldr/Malesan/releases/download/v2.1.0/Malesan-Setup.exe",
    fileSizeMb: 192,
    sha256: "",
    changelog: [
      "Peluncuran Resmi Malesan Studio Desktop v2.1.0 untuk Windows 10 & 11",
      "Bundled yt-dlp & FFmpeg lokal (Zero Bridge Setup - tanpa install Node.js/Python)",
      "Akselerasi Hardware GPU Otomatis (AMD AMF Radeon/Vega, Intel QSV, NVIDIA NVENC)",
      "Fitur Anti-Freeze Guard (proses render enteng, laptop tetap adem & hening)",
      "Studio Video Engine Cloud Otomatis (Trim & Cut, BGM AI, Face Tracking & Lip-Sync)",
      "Penyimpanan video langsung ke folder Videos/Malesan"
    ],
    mandatory: false
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
