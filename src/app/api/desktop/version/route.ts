import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    version: "2.1.1",
    name: "Malesan Studio Desktop",
    releaseDate: "2026-09-03",
    minSupportedVersion: "2.0.0",
    downloadUrl: "https://malesan.my.id/Malesan-Setup.exe",
    fileSizeMb: 226,
    sha256: "",
    changelog: [
      "Studio Video Engine Overhaul: Warna asli 100% natural, filter Studio Clean Pro, Warm Creator, & Cinematic Moody",
      "Fitur Trim & Cut Video: Potong durasi video presisi frame demi frame",
      "Musik Latar Bebas Hak Cipta: 5 preset musik instrumen AI tanpa copyright strike",
      "Auto Face Tracking Broadcast: Gerakan kamera halus sinematik tanpa goyang patah-patah",
      "Kalibrator Lip-Sync Suara & Subtitle: Offset pas dengan bibir pembicara",
      "Sistem Auto-Update & Restart 1-Klik langsung dari aplikasi tanpa perlu reinstall manual"
    ],
    mandatory: false
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
