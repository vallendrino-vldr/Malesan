"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error boundary caught:", error);
  }, [error]);

  return (
    <main className="grid min-h-[65vh] w-full place-items-center bg-obsidian px-5 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-ember/30 bg-ember/10 text-ember shadow-lg shadow-ember/5">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 7.5h.008v.008H12v-.008z"
            />
          </svg>
        </div>

        <p className="eyebrow text-ember">Admin Error</p>
        <h1 className="mt-1.5 font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
          Ada kendala di panel admin
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
          Terjadi kesalahan saat memuat data atau komponen admin. Coba muat ulang halaman atau kembali ke ringkasan.
        </p>

        {error?.message && (
          <details className="mt-4 rounded-xl border border-hairline bg-surface/60 p-3 text-left">
            <summary className="cursor-pointer text-micro font-medium text-muted hover:text-ink">
              Detail kendala teknis (klik untuk melihat)
            </summary>
            <p className="mt-2 font-mono text-micro break-words text-danger/90">
              {error.message}
            </p>
            {error.digest && (
              <p className="mt-1 font-mono text-micro text-muted">
                Digest: {error.digest}
              </p>
            )}
          </details>
        )}

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-ember inline-flex h-10 items-center justify-center rounded-xl px-5 font-display text-xs font-bold text-obsidian transition-transform active:scale-[0.98] sm:text-sm"
          >
            Coba lagi
          </button>
          <Link
            href="/admin"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-hairline bg-surface px-5 font-display text-xs font-semibold text-ink transition hover:border-hairline-strong hover:bg-surface-raised active:scale-[0.98] sm:text-sm"
          >
            Kembali ke ringkasan
          </Link>
        </div>
      </div>
    </main>
  );
}
