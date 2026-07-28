"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Google is the only sign-in method. No email/password, no magic links — that
 * is an anti-abuse decision (DECISIONS.md), not a default.
 */
export function GoogleSignInButton({ next = "/" }: { next?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      // Say what broke and what to do. Never apologise. DESIGN.md §6.
      setError(`Gagal nyambung ke Google: ${error.message}. Coba lagi.`);
      setPending(false);
    }
    // On success the browser navigates away, so `pending` stays true on purpose.
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className="glow-ember inline-flex w-full items-center justify-center gap-3 rounded-xl bg-ember px-6 py-3.5 font-display text-[15px] font-bold text-obsidian transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0">
          <path
            fill="currentColor"
            d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95S8.78 6.28 12 6.28c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.53 2.8 12 2.8 6.98 2.8 2.9 6.88 2.9 11.9S6.98 21 12 21c5.2 0 8.65-3.66 8.65-8.8 0-.6-.07-1.05-.3-1.1Z"
          />
        </svg>
        {pending ? "Lagi nyambungin..." : "Lanjut pakai Google"}
      </button>

      {error && (
        <p role="alert" className="text-sm leading-relaxed text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
