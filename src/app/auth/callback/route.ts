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

  const accessToken = sessionData.session?.access_token ?? "";
  const refreshToken = sessionData.session?.refresh_token ?? "";
  const appSchemeUrl = `malesan://auth-session?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&next=${encodeURIComponent(next)}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Login Berhasil — Malesan</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0B0A09; color: #F5F5F5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
    .card { background: #141210; border: 1px solid rgba(255,122,0,0.35); border-radius: 28px; padding: 36px 24px; max-width: 380px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.9); }
    .icon { width: 56px; height: 56px; background: rgba(255,122,0,0.15); border: 1px solid rgba(255,122,0,0.4); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: #FF7A00; font-size: 24px; font-weight: bold; }
    h2 { font-size: 20px; font-weight: 800; color: #F5F5F5; margin-bottom: 8px; }
    p { font-size: 13px; color: #A0A0A0; margin-bottom: 24px; line-height: 1.5; }
    .btn { display: flex; align-items: center; justify-content: center; width: 100%; height: 52px; background: #FF7A00; color: #0B0A09; font-weight: 800; font-size: 15px; border-radius: 14px; text-decoration: none; box-shadow: 0 4px 20px rgba(255,122,0,0.4); transition: transform 0.1s; }
    .btn:active { transform: scale(0.97); }
    .hint { font-size: 11px; color: #666; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h2>Login Berhasil!</h2>
    <p>Ketuk tombol di bawah untuk langsung membuka ruang kerja di aplikasi Malesan.</p>
    <a href="${appSchemeUrl}" id="openAppBtn" class="btn">🚀 Buka di Aplikasi Malesan</a>
    <div class="hint">Jika tidak otomatis terbuka, klik tombol di atas.</div>
  </div>
  <script>
    try {
      window.location.href = "${appSchemeUrl}";
    } catch(e) {}
    setTimeout(function() {
      var btn = document.getElementById("openAppBtn");
      if (btn) {
        btn.click();
      }
    }, 300);
  </script>
</body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

  if (hasPendingBonus) {
    response.cookies.delete("malesan_pending_demo_bonus");
  }
  return response;
}
