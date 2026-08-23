"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error boundary caught:", error);
  }, [error]);

  return (
    <main className="grid min-h-[100dvh] w-full place-items-center bg-obsidian px-5">
      <div className="w-full max-w-sm text-center">
        <Logo markClass="mx-auto h-8" />
        <p className="mt-6 font-display text-4xl font-bold text-ember">Waduh!</p>
        <h1 className="mt-2 font-display text-xl font-bold text-ink">
          Ada yang nyangkut bentar
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Sistem lagi agak ngambek. Tenang, coba klik tombol di bawah buat muat ulang.
        </p>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-ember inline-flex min-h-11 items-center justify-center rounded-xl px-5 font-display text-sm font-bold text-obsidian"
          >
            Coba muat ulang
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-hairline bg-surface px-5 font-display text-sm font-semibold text-ink hover:bg-surface-raised"
          >
            Balik ke beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
