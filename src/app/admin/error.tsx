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
    <main className="grid min-h-[60vh] w-full place-items-center bg-obsidian px-5">
      <div className="w-full max-w-sm text-center">
        <p className="font-display text-4xl font-bold text-ember">Admin Error</p>
        <h1 className="mt-2 font-display text-xl font-bold text-ink">
          Ada error di panel admin
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Terjadi kesalahan saat memuat data admin. Coba refresh atau periksa log error.
        </p>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-ember inline-flex min-h-11 items-center justify-center rounded-xl px-5 font-display text-sm font-bold text-obsidian"
          >
            Coba lagi
          </button>
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-hairline bg-surface px-5 font-display text-sm font-semibold text-ink hover:bg-surface-raised"
          >
            Kembali ke ringkasan
          </Link>
        </div>
      </div>
    </main>
  );
}
