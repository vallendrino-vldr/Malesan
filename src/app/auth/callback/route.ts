import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/masuk?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
