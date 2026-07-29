import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { IdeHariIni } from "@/components/IdeHariIni";
import { IdeaEngine } from "@/components/IdeaEngine";
import { CreditDisplay } from "@/components/CreditDisplay";
import { PipelineBoard } from "@/components/PipelineBoard";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Malesan App",
  robots: { index: false },
};

export default async function AppPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const params = await searchParams;
  const tab = params?.tab || "studio";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/masuk?next=%2Fapp");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .single();

  if (error || !profile) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-5 py-20">
        <h1 className="font-display text-2xl font-bold tracking-display-md text-ink">
          Profil lo belum kebentuk.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Ini bukan salah lo. Coba keluar terus masuk lagi — kalau masih gini,
          berarti trigger di database gak jalan.
        </p>
        <SignOutButton />
      </main>
    );
  }

  // Onboarding Gate: If they have generated at least 1 thing and haven't completed onboarding, redirect.
  if (!profile.onboarding_completed) {
    const { count, error: countError } = await supabase
      .from("generations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (!countError && count && count >= 1) {
      redirect("/app/onboarding");
    }
  }

  // Claim daily refill on session load
  const serviceRole = createServiceRoleClient();
  let totalCredits = profile.credits_free + profile.credits_paid;
  
  try {
    const { data: refilledCredits, error: refillError } = await serviceRole.rpc("claim_daily_refill", {
      p_user: user.id
    });
    if (!refillError && typeof refilledCredits === 'number') {
      totalCredits = refilledCredits;
    }
  } catch (err: unknown) {
    // If it fails, we just use the current balance
  }

  // Fetch Pipeline Cards
  const { data: pipelineCards } = await supabase
    .from("pipeline_cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-full w-full bg-obsidian">
      {/* App Header */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-obsidian/80 px-5 py-4 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <Link href="/app" className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-ember shadow-[0_0_10px_2px_color-mix(in_oklab,var(--color-ember)_60%,transparent)]"
            />
            <span className="font-display text-[17px] font-bold tracking-display-sm text-ink">
              malesan
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            {profile.role === "admin" && (
              // Was `text-emerald-400` — a stock Tailwind colour that exists
              // nowhere in DESIGN.md. Off-palette accents are the fastest way to
              // make a considered design look like a template.
              <Link
                href="/admin"
                className="eyebrow rounded-full border border-hairline px-2.5 py-1.5 text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember-lo"
              >
                Admin
              </Link>
            )}
            <CreditDisplay credits={totalCredits} />
            <Link href="/app/profile" className="h-8 w-8 overflow-hidden rounded-full border border-hairline bg-surface transition-transform hover:scale-105">
              {profile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-xs font-bold text-muted">
                  {profile.display_name?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
            </Link>
            <SignOutButton compact />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
        <div className="mb-8 flex border-b border-hairline">
          <Link
            href="/app?tab=studio"
            className={`px-4 py-3 font-display text-sm font-bold transition-colors ${
              tab === "studio"
                ? "border-b-2 border-ember text-ember"
                : "text-muted hover:text-ink"
            }`}
          >
            Studio
          </Link>
          <Link
            href="/app?tab=pipeline"
            className={`px-4 py-3 font-display text-sm font-bold transition-colors ${
              tab === "pipeline"
                ? "border-b-2 border-ember text-ember"
                : "text-muted hover:text-ink"
            }`}
          >
            Pipeline
          </Link>
        </div>

        <div className="reveal space-y-12">
          {tab === "studio" ? (
            <div className="mx-auto max-w-3xl space-y-12">
              <IdeHariIni />
              <IdeaEngine />
            </div>
          ) : (
            <PipelineBoard initialCards={pipelineCards || []} />
          )}
        </div>
      </main>
    </div>
  );
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className={`font-display font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:text-ink ${
          compact ? "text-xs" : "rounded-xl border border-hairline bg-surface px-5 py-3 text-sm hover:bg-surface-raised mt-10 text-ink"
        }`}
      >
        Keluar
      </button>
    </form>
  );
}
