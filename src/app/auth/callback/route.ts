import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyNewUser } from "@/lib/telegram";

/**
 * OAuth redirect target. Google sends the user back here with a `code`, which
 * is exchanged for a session cookie.
 *
 * The profiles row is NOT created here — the `on_auth_user_created` trigger on
 * `auth.users` already did it, inside the same transaction as the signup. Doing
 * it here as well would race with the trigger and duplicate the work.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  // `next` is attacker-controllable, so only same-origin relative paths are
  // honoured. Without this check it is an open redirect.
  const requested = searchParams.get("next") ?? "/";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  const refCode = searchParams.get("ref");

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/masuk?error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/masuk?error=${encodeURIComponent("Kode login gak ada. Coba ulang dari awal.")}`,
    );
  }

  const supabase = await createClient();
  const { error, data: sessionData } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/masuk?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Notify owner via Telegram with await
  if (sessionData?.user) {
    try {
      await notifyNewUser({
        email: sessionData.user.email || "user@malesan",
        name: sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || null,
        provider: sessionData.user.app_metadata?.provider || "Google OAuth",
      });
    } catch (teleErr) {
      console.warn("[auth-callback] Telegram notification error:", teleErr);
    }
  }

  // If there's a ref code, update the user's profile with referred_by
  if (refCode && sessionData.user) {
    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const serviceRole = createServiceRoleClient();
    
    // Check who owns the referral code
    const { data: referrerProfile } = await serviceRole
      .from("profiles")
      .select("id")
      .eq("referral_code", refCode)
      .single();
      
    if (referrerProfile && referrerProfile.id !== sessionData.user.id) {
      // Only set referred_by if it's currently null (don't overwrite)
      await serviceRole
        .from("profiles")
        .update({ referred_by: referrerProfile.id })
        .eq("id", sessionData.user.id)
        .is("referred_by", null);
    }
  }

  // If user previously completed the demo video before logging in, auto-grant the +10 bonus
  const hasPendingBonus = request.cookies.get("malesan_pending_demo_bonus")?.value === "1";
  if (hasPendingBonus && sessionData.user) {
    try {
      const { grantDemoBonusToUser } = await import("@/app/actions/tutorial");
      await grantDemoBonusToUser(sessionData.user.id);
    } catch (e) {
      console.error("auto-grant demo bonus on auth callback failed:", e);
    }
  }

  // If requested from desktop app, return dual-channel HTML bridge (loopback HTTP + malesan:// deep-link)
  const isDesktopAuth = searchParams.get("desktop") === "1" || next.includes("desktop=1");
  if (isDesktopAuth) {
    if (sessionData.user) {
      try {
        const { notifyDesktopLogin } = await import("@/lib/telegram");
        await notifyDesktopLogin({
          email: sessionData.user.email || null,
          name: sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || null,
          provider: sessionData.user.app_metadata?.provider || "Google OAuth (System Browser)",
        });
      } catch (teleErr) {
        console.warn("[auth-callback] Telegram desktop login notify error:", teleErr);
      }
    }

    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const authCookies = cookieStore
      .getAll()
      .filter((c) => c.name.startsWith("sb-") || c.name.startsWith("malesan_"))
      .map((c) => ({ name: c.name, value: c.value }));

    const { createDesktopTicket } = await import("@/lib/auth/desktop-ticket");
    const ticket = createDesktopTicket(authCookies);

    const bridgeHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Login Berhasil - Malesan Studio</title>
  <style>
    body { background: #0c0a09; color: #f2ede7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #161412; border: 1px solid rgba(255,107,0,0.3); padding: 36px 44px; border-radius: 24px; text-align: center; box-shadow: 0 24px 48px rgba(0,0,0,0.8); max-width: 440px; }
    h1 { color: #ff6b00; margin: 0 0 12px; font-size: 22px; font-weight: 700; }
    p { color: #a8a29e; font-size: 14px; margin: 0 0 24px; line-height: 1.6; }
    .btn { display: inline-block; background: #ff6b00; color: #ffffff; padding: 12px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 4px 14px rgba(255,107,0,0.4); }
    .badge { display: inline-block; background: rgba(52,211,153,0.15); color: #34d399; border: 1px solid rgba(52,211,153,0.4); padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">✓ Terverifikasi</div>
    <h1>Login Berhasil!</h1>
    <p>Sesi kamu sedang dihubungkan ke aplikasi Malesan Studio Desktop...</p>
    <a id="btnOpen" class="btn" href="malesan://auth?ticket=${ticket}">Buka Aplikasi Desktop</a>
  </div>
  <script>
    const ticket = "${ticket}";
    fetch("http://127.0.0.1:48215/callback?ticket=" + ticket)
      .then(() => {
        setTimeout(() => { try { window.close(); } catch {} }, 1200);
      })
      .catch(() => {});

    try {
      window.location.href = "malesan://auth?ticket=" + ticket;
    } catch {}

    setTimeout(() => { try { window.close(); } catch {} }, 4000);
  </script>
</body>
</html>`;

    const desktopResponse = new NextResponse(bridgeHtml, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

    if (hasPendingBonus) {
      desktopResponse.cookies.delete("malesan_pending_demo_bonus");
    }
    return desktopResponse;
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  if (hasPendingBonus) {
    response.cookies.delete("malesan_pending_demo_bonus");
  }
  return response;
}
