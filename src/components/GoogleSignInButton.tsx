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

    // Check if Tester / Demo Bypass Mode is activated (via 5-click easter egg)
    const isTestMode =
      typeof window !== "undefined" &&
      (document.cookie.includes("malesan_test_mode=1") ||
        localStorage.getItem("malesan_test_mode") === "1");

    if (isTestMode) {
      try {
        const res = await fetch("/api/auth/demo-bypass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "vadlyvldr" }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data.error || "Gagal masuk mode tester. Coba lagi.");
          setPending(false);
          return;
        }

        const targetUrl = next?.startsWith("/") && !next.startsWith("//") ? next : "/app";
        window.location.href = targetUrl;
        return;
      } catch {
        setError("Koneksi gagal. Coba lagi.");
        setPending(false);
        return;
      }
    }

    // Standard Google OAuth for real users
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
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
        </span>

        {/* Action Label */}
        <span>{pending ? "Menghubungkan..." : "Lanjutkan dengan Google"}</span>

        {/* Subtle arrow cue */}
        <span
          aria-hidden="true"
          className="text-xs transition-transform duration-300 group-hover:translate-x-1"
        >
          →
        </span>
      </button>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-center text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
