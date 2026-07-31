"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function OnboardingSuccessPage() {
  const [persona, setPersona] = useState<string | null>(null);

  useEffect(() => {
    // Retrieve the persona summary from sessionStorage
    const stored = sessionStorage.getItem("ai_persona_summary");
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPersona(stored);
      // Clean it up so it doesn't linger forever
      sessionStorage.removeItem("ai_persona_summary");
    }
  }, []);

  // dvh, not vh: on mobile Safari `100vh` is the viewport with the URL bar
  // hidden, so a vh-sized page is taller than what you can actually see.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-obsidian px-5 py-12">
      <main className="w-full max-w-xl reveal text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-ember/10 border border-ember/20">
          <svg
            className="h-10 w-10 text-ember"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        
        <h1 className="font-display text-4xl font-bold tracking-display-md text-ink">
          DNA Lo Udah Di-scan!
        </h1>
        
        <p className="mt-4 text-sm leading-relaxed text-muted">
          AI kita udah baca data lo dan ngerumusin *persona* unik lo. Semua
          ide konten ke depannya bakal di-<i>generate</i> pake patokan ini:
        </p>

        {persona ? (
          <div className="mt-8 rounded-2xl border border-hairline bg-surface p-6 shadow-[0_0_40px_var(--ambient-glow)]">
            <p className="font-display text-lg font-semibold italic text-ember leading-relaxed">
              &quot;{persona}&quot;
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-hairline bg-surface p-6">
            <p className="font-display text-lg font-semibold italic text-muted">
              &quot;Kreator misterius yang siap bikin gebrakan.&quot;
            </p>
          </div>
        )}

        <div className="mt-12">
          <Link
            href="/app"
            className="inline-block w-full sm:w-auto rounded-xl bg-ember px-8 py-4 font-display text-base font-bold text-obsidian transition-all duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo glow-ember"
          >
            Masuk ke Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
