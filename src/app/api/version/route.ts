import { NextResponse } from "next/server";
import {
  LATEST_APK_VERSION,
  LATEST_APK_VERSION_CODE,
  LATEST_APK_SIZE_MB,
  LATEST_APK_DISPLAY_SIZE,
  LATEST_APK_DOWNLOAD_URL,
  LATEST_APK_CHANGELOG,
} from "@/lib/native/version";

export const dynamic = "force-dynamic";

export async function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    "dev";

  return NextResponse.json(
    {
      version: version.slice(0, 12),
      timestamp: Date.now(),
      status: "online",
      apk: {
        latestVersion: LATEST_APK_VERSION,
        latestVersionCode: LATEST_APK_VERSION_CODE,
        sizeMB: LATEST_APK_SIZE_MB,
        displaySize: LATEST_APK_DISPLAY_SIZE,
        downloadUrl: LATEST_APK_DOWNLOAD_URL,
        changelog: LATEST_APK_CHANGELOG,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    },
  );
}

