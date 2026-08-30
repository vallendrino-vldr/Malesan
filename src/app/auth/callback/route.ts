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

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>Membuka Malesan...</title>
  <style>
    * { box-sizing: border-box; }
    body { background: #0B0A09; color: #F5F5F5; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
    .card { background: #141210; border: 1px solid rgba(255,122,0,0.3); border-radius: 28px; padding: 36px 24px; max-width: 380px; width: 100%; box-shadow: 0 24px 48px rgba(0,0,0,0.8); }
    .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,122,0,0.2); border-top-color: #FF7A00; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 20px; margin: 0 0 8px; color: #F5F5F5; font-weight: 800; }
    p { font-size: 13px; color: #A0A0A0; margin: 0 0 24px; line-height: 1.5; }
    .btn { display: flex; align-items: center; justify-content: center; width: 100%; height: 48px; background: #FF7A00; color: #0B0A09; font-weight: 800; font-size: 14px; border-radius: 14px; text-decoration: none; box-shadow: 0 4px 14px rgba(255,122,0,0.4); transition: transform 0.1s; }
    .btn:active { transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Berhasil Masuk!</h2>
    <p>Membuka ruang kerja Malesan di HP kamu...</p>
    <a href="malesan://app" class="btn">Buka Aplikasi Malesan</a>
  </div>
  <script>
    try { window.location.href = "malesan://app"; } catch(e) {}
    setTimeout(function() {
      window.location.href = "${origin}${next}";
    }, 1200);
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
