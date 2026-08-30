import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const next = searchParams.get("next") ?? "/app";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(`${origin}/masuk`);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error("[session-sync] Failed to set session:", error.message);
      return NextResponse.redirect(`${origin}/masuk?error=${encodeURIComponent(error.message)}`);
    }

    return NextResponse.redirect(`${origin}${safeNext}`);
  } catch (err) {
    console.error("[session-sync] Exception during session sync:", err);
    return NextResponse.redirect(`${origin}/masuk`);
  }
}