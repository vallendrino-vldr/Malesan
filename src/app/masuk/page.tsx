import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Masuk — Malesan",
  robots: { index: false },
};

export default async function MasukPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; ref?: string }>;
}) {
  const { error, next, ref } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/app");
  }

  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/app";

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-x-hidden bg-obsidian px-5 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,var(--ambient-glow),transparent_70%)]"
      />

      <main className="reveal relative z-10 w-full max-w-sm">
        <Link
          href="/"
          className="font-display text-lg font-extrabold tracking-display-sm text-ink"
        >
          malesan
        </Link>

        <h1 className="mt-8 font-display text-3xl font-bold leading-tight tracking-display-md text-ink">
          Masuk dulu.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Cuma lewat Google. Gak ada email-password, gak ada verifikasi email —
          biar yang bikin akun ganda males duluan.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm leading-relaxed text-ink"
          >
            {error}
          </p>
        )}

        <div className="mt-8">
          <GoogleSignInButton next={safeNext} referralCode={ref} />
        </div>

        <p className="mt-6 font-mono text-micro leading-relaxed text-muted">
          Masuk pertama kali langsung dapet 5 credit. Tiap hari nambah 10 lagi.
        </p>
      </main>
    </div>
  );
}
