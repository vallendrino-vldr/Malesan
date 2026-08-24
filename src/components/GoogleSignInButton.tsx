"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface GoogleSignInButtonProps {
  next?: string;
  referralCode?: string | null;
  className?: string;
}

export function GoogleSignInButton({
  next = "/",
  referralCode,
  className = "",
}: GoogleSignInButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ""}`,
      },
    });

    if (error) {
      setError(`Gagal menghubungkan ke Google: ${error.message}. Silakan coba lagi.`);
      setPending(false);
    }
  }

  return (
    <div className={`flex w-full flex-col gap-3 ${className}`}>
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className="group relative inline-flex w-full items-center justify-center gap-3.5 rounded-2xl bg-gradient-to-r from-ember via-[#ff9b4e] to-ember bg-[length:200%_auto] px-6 py-4 font-display text-sm sm:text-base font-bold text-obsidian shadow-[0_0_24px_rgba(255,138,61,0.25)] transition-all duration-300 hover:-translate-y-1 hover:bg-[position:right_center] hover:shadow-[0_0_36px_rgba(255,138,61,0.45)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {/* Google G Logo inside crisp white circular chip */}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white shadow-xs transition-transform duration-300 group-hover:scale-110">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        </span>

        <span className="tracking-wide">
          {pending ? "Menghubungkan ke Google..." : "Masuk pakai Google"}
        </span>

        {/* Subtle arrow on hover */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>

      {error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-xs leading-relaxed text-danger text-center">
          {error}
        </p>
      )}
    </div>
  );
}
