import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { DraftWorkspace } from "@/components/DraftEditor";

/**
 * The drafts screen.
 *
 * Same chrome as /app/topup and /app/profile rather than AppShell: those are the
 * two other full-page routes under /app, and neither can mount the shell,
 * because AppShell owns 100dvh with its own scroll container and its tab bar
 * only knows the four dashboard tabs. What they do instead is carry a real way
 * back — an installed PWA has no address bar, so a screen with no exit is a
 * screen you have to force-quit out of.
 */

export const metadata: Metadata = {
  title: "Draf · Malesan",
  robots: { index: false },
};

export default async function DraftPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=%2Fapp%2Fdraft");

  // Scoped by user_id on top of RLS, and the error is inspected: a discarded
  // error here would render "Belum ada draf" over a failed read, and the user
  // would reasonably conclude their writing was gone.
  const { data: drafts, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-obsidian">
      <header className="sticky top-0 z-20 shrink-0 border-b border-hairline/70 bg-obsidian/90">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 py-2.5">
          <Link
            href="/app"
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-hairline pl-2 pr-3.5 text-mini font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
              <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6 4.6-4.6Z" />
            </svg>
            Balik
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-display text-base font-bold text-ink">
            Draf lo
          </h1>
          <Logo markClass="h-6" className="shrink-0" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-6">
        {error ? (
          <p className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            Gagal ngambil daftar draf lo. Refresh dulu — tulisan lo aman, cuma
            daftarnya yang gak kebaca.
          </p>
        ) : (
          <DraftWorkspace initialDrafts={drafts ?? []} userId={user.id} />
        )}
      </main>
    </div>
  );
}
