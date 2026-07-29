import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { AppShell, type TabKey } from "@/components/AppShell";
import { AmbientIdle } from "@/components/AmbientIdle";
import { IdeHariIni } from "@/components/IdeHariIni";
import { IdeaEngine } from "@/components/IdeaEngine";
import { PipelineBoard } from "@/components/PipelineBoard";
import { VibeCodingStudio } from "@/components/VibeCodingStudio";

export const metadata: Metadata = {
  title: "Malesan",
  robots: { index: false },
};

const VALID_TABS: TabKey[] = ["studio", "vibe", "pipeline", "profil"];

export default async function AppPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; m?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const tab: TabKey = VALID_TABS.includes(params.tab as TabKey)
    ? (params.tab as TabKey)
    : "studio";
  const mod = params.m === "ide" || params.m === "idea" ? params.m : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=%2Fapp");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .single();

  if (error || !profile) {
    return (
      <main className="mx-auto grid min-h-[100dvh] w-full max-w-lg place-items-center px-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-display-md text-ink">
            Profil lo belum kebentuk.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Ini bukan salah lo. Coba keluar terus masuk lagi — kalau masih gini,
            berarti trigger di database gak jalan.
          </p>
          <form action="/auth/signout" method="post" className="mt-8">
            <button className="rounded-xl border border-hairline bg-surface px-5 py-3 font-display text-sm font-semibold text-ink">
              Keluar
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Onboarding gate: only after they have seen the product work once.
  if (!profile.onboarding_completed) {
    const { count } = await supabase
      .from("generations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (count && count >= 1) redirect("/app/onboarding");
  }

  const serviceRole = createServiceRoleClient();
  let totalCredits = profile.credits_free + profile.credits_paid;
  try {
    const { data: refilled } = await serviceRole.rpc("claim_daily_refill", {
      p_user: user.id,
    });
    if (typeof refilled === "number") totalCredits = refilled;
  } catch {
    // Keep the current balance if the refill call fails; never block the app.
  }

  const { data: pipelineCards } = await supabase
    .from("pipeline_cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const avatar =
    profile.avatar_url ??
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  return (
    <AppShell
      active={tab}
      credits={totalCredits}
      isAdmin={profile.role === "admin"}
      avatarUrl={avatar}
      initial={profile.display_name?.charAt(0).toUpperCase() ?? "?"}
    >
      {tab === "studio" && !mod && (
        // Fits one phone screen without scrolling. The hero is the idle
        // centrepiece; the two tiles are the only decisions on the page. Opening
        // a module swaps the whole view rather than growing this one, which is
        // what keeps the dashboard a dashboard.
        <div className="reveal flex min-h-[calc(100dvh-9.5rem)] flex-col justify-center gap-4 py-2">
          <section className="surface-card relative overflow-hidden rounded-2xl border border-hairline px-5 pb-5 pt-5">
            <AmbientIdle className="mx-auto size-36 sm:size-44" />
            <div className="mt-2 text-center">
              <p className="eyebrow text-ember">
                {greet()}, {profile.display_name?.split(" ")[0] ?? "kreator"}
              </p>
              <h1 className="mt-2 font-display text-[21px] font-bold leading-tight tracking-display-md text-ink sm:text-2xl">
                Gak usah mikir. Tinggal pilih.
              </h1>
            </div>
          </section>

          <div className="grid gap-3">
            <ModuleTile
              href="/app?tab=studio&m=ide"
              title="Ide Hari Ini"
              body="Gak usah ngetik apa-apa. Langsung dapet 3 ide buat hari ini."
              cost={1}
              primary
            />
            <ModuleTile
              href="/app?tab=studio&m=idea"
              title="Idea Engine"
              body="Punya ide mentah? Lempar, balik jadi 5 yang udah mateng."
              cost={1}
            />
          </div>
        </div>
      )}

      {tab === "studio" && mod === "ide" && (
        <div className="reveal space-y-4">
          <BackToStudio />
          <IdeHariIni />
        </div>
      )}

      {tab === "studio" && mod === "idea" && (
        <div className="reveal space-y-4">
          <BackToStudio />
          <IdeaEngine />
        </div>
      )}

      {tab === "vibe" && (
        <div className="reveal">
          <VibeCodingStudio />
        </div>
      )}

      {tab === "pipeline" && (
        <div className="reveal">
          <PipelineBoard initialCards={pipelineCards || []} />
        </div>
      )}

      {tab === "profil" && (
        <div className="reveal space-y-4">
          <section className="surface-card rounded-2xl border border-hairline p-5">
            <div className="flex items-center gap-4">
              <div className="size-14 shrink-0 overflow-hidden rounded-full border border-hairline bg-surface">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center font-display text-lg font-bold text-muted">
                    {profile.display_name?.charAt(0).toUpperCase() ?? "?"}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold tracking-display-sm text-ink">
                  {profile.display_name ?? "Kreator"}
                </p>
                <p className="truncate text-sm text-muted">{profile.email}</p>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              <Stat label="Credit gratis" value={profile.credits_free} />
              <Stat label="Credit berbayar" value={profile.credits_paid} />
            </dl>

            <div className="mt-4 rounded-xl border border-hairline bg-obsidian px-4 py-3">
              <p className="eyebrow text-muted">Kode referral</p>
              <p className="tabular mt-1.5 font-mono text-lg text-ember">
                {profile.referral_code}
              </p>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/app/topup"
              className="btn-ember grid place-items-center rounded-xl px-5 py-3.5 font-display text-[15px] font-bold text-obsidian"
            >
              Top up credit
            </Link>
            <Link
              href="/app/profile"
              className="grid place-items-center rounded-xl border border-hairline bg-surface px-5 py-3.5 font-display text-[15px] font-semibold text-ink transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember-lo"
            >
              Pengaturan lengkap
            </Link>
          </div>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full rounded-xl border border-hairline px-5 py-3 text-sm font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:text-danger"
            >
              Keluar
            </button>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function BackToStudio() {
  return (
    <Link
      href="/app?tab=studio"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
        <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6 4.6-4.6Z" />
      </svg>
      Balik ke Studio
    </Link>
  );
}

function ModuleTile({
  href,
  title,
  body,
  cost,
  primary = false,
}: {
  href: string;
  title: string;
  body: string;
  cost: number;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`surface-card surface-card-interactive group flex items-center gap-4 rounded-2xl border p-4 ${
        primary ? "border-ember/35" : "border-hairline"
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid size-11 shrink-0 place-items-center rounded-xl ${
          primary ? "btn-ember text-obsidian" : "border border-hairline bg-obsidian text-ember"
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-5 fill-current">
          <path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2Zm-2 18h4v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1Z" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[16px] font-bold tracking-display-sm text-ink">
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">
          {body}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="tabular block font-mono text-sm text-ink">{cost}</span>
        <span className="block text-[10px] text-muted">credit</span>
      </span>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-hairline bg-obsidian px-4 py-3">
      <dt className="eyebrow text-muted">{label}</dt>
      <dd className="tabular mt-1.5 font-display text-xl font-bold text-ink">
        {value}
      </dd>
    </div>
  );
}

/**
 * WIB, not the server's timezone. A greeting that says "selamat pagi" to
 * someone in Jakarta at 9pm is a small thing that makes a product feel foreign.
 */
function greet() {
  const wib = new Date(Date.now() + 7 * 3600 * 1000).getUTCHours();
  if (wib < 11) return "Pagi";
  if (wib < 15) return "Siang";
  if (wib < 18) return "Sore";
  return "Malam";
}
