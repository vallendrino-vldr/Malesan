import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Malesan",
  robots: { index: false },
};

/**
 * Step 2 only proves the loop: signed in -> profile row exists -> RLS returns
 * exactly that row. The real modules land in step 5. Deliberately plain.
 */
export default async function AppPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/masuk?next=%2Fapp");
  }

  // RLS means this can only ever return the caller's own row — there is no
  // `.eq('id', user.id)` filter and it still cannot leak anyone else's data.
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
        {error && (
          <p className="mt-4 font-mono text-xs text-danger">{error.message}</p>
        )}
        <SignOutButton />
      </main>
    );
  }

  const totalCredits = profile.credits_free + profile.credits_paid;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-16">
      <div className="reveal">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ember">
          Udah masuk
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-display-md text-ink">
          Halo, {profile.display_name ?? "kreator"}.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Belum ada apa-apa di sini. Modulnya nyusul — ini baru buktiin login,
          profil, sama RLS-nya jalan.
        </p>
      </div>

      <dl className="reveal mt-10 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2">
        <Stat label="Credit total" value={String(totalCredits)} hint={`${profile.credits_free} gratis + ${profile.credits_paid} berbayar`} />
        <Stat label="Kode referral" value={profile.referral_code} hint="Bagi ke temen lo" />
        <Stat label="Role" value={profile.role} hint={profile.role === "admin" ? "Bypass semua cek credit" : "User biasa"} />
        <Stat label="Onboarding" value={profile.onboarding_completed ? "selesai" : "belum"} hint="Creator DNA nyusul di step 6" />
      </dl>

      <SignOutButton />
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-surface p-5">
      <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd className="tabular mt-2 font-display text-xl font-bold tracking-display-sm text-ink">
        {value}
      </dd>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function SignOutButton() {
  return (
    <form action="/auth/signout" method="post" className="mt-10">
      <button
        type="submit"
        className="rounded-xl border border-hairline bg-surface px-5 py-3 font-display text-sm font-semibold text-ink transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-surface-raised"
      >
        Keluar
      </button>
    </form>
  );
}
