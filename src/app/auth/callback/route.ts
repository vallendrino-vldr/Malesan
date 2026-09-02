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

  // If requested from desktop app, redirect to local loopback server
  const isDesktopAuth = searchParams.get("desktop") === "1";
  if (isDesktopAuth) {
    const desktopResponse = NextResponse.redirect("http://127.0.0.1:48215/callback?success=1");
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
