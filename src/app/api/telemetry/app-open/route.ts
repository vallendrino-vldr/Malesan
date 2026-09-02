import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyAppInstall, notifyDesktopAppOpen } from "@/lib/telegram";
import { checkApkUpdate } from "@/lib/native/version";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = (await request.json().catch(() => null)) as {
      appVersion?: string;
      versionCode?: number;
      deviceModel?: string;
      osVersion?: string;
      platform?: string;
    } | null;

    const userAgent = request.headers.get("user-agent") || "";
    let deviceModel = body?.deviceModel;
    let osVersion = body?.osVersion;

    if (!deviceModel && userAgent.includes("Android")) {
      const match = userAgent.match(/Android\s+([\d.]+);\s*([^;)]+)/i);
      if (match) {
        osVersion = `Android ${match[1]}`;
        deviceModel = match[2].trim();
      }
    }

    let isBanned = false;
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_banned")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.is_banned) {
        isBanned = true;
      }
    }

    const { data: lockdownConfig } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "apk_emergency_lockdown")
      .maybeSingle();

    const isLockdown = lockdownConfig?.value === "true";
    const updateInfo = checkApkUpdate(body?.versionCode, body?.appVersion);
    const isDesktop = body?.platform === "desktop" || userAgent.includes("MalesanStudio");

    if (isDesktop) {
      await notifyDesktopAppOpen({
        email: user?.email || null,
        deviceModel: deviceModel || "Windows PC / Desktop",
        osVersion: osVersion || "Windows 10/11",
        appVersion: body?.appVersion || "2.1.0",
      });
    } else {
      await notifyAppInstall({
        email: user?.email || null,
        deviceModel: deviceModel || "Android Mobile",
        osVersion: osVersion || "Android",
        appVersion: body?.appVersion || updateInfo.latestVersion,
      });
    }

    return NextResponse.json({
      ok: true,
      isBanned,
      lockdown: isLockdown,
      update: updateInfo,
    });
  } catch (error) {
    console.error("[telemetry/app-open] error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
