import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyAppInstall } from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = (await request.json().catch(() => null)) as {
      appVersion?: string;
      deviceModel?: string;
      osVersion?: string;
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

    await notifyAppInstall({
      email: user?.email || null,
      deviceModel: deviceModel || "Android Mobile",
      osVersion: osVersion || "Android",
      appVersion: body?.appVersion || "2.1.8",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[telemetry/app-open] error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
