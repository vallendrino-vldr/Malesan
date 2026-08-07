import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { AppShell, type TabKey } from "@/components/AppShell";
import { MascotStage } from "@/components/MascotStage";
import { PipelineBoard } from "@/components/PipelineBoard";
import { VibeCodingStudio } from "@/components/VibeCodingStudio";
import { getCost } from "@/lib/config";
import { HistoryList, type HistoryItem } from "@/components/HistoryList";
import { RefreshButton } from "@/components/RefreshButton";
import { TextScale } from "@/components/TextScale";
import { LowCreditNotice } from "@/components/CreditNudge";
import { StudioPanel, StudioTile, StudioTileBig } from "@/components/StudioPanel";
import { LiveRefresh } from "@/components/LiveRefresh";

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
  const MODS = ["ide", "idea", "hook", "script", "repurpose"] as const;
  const mod = MODS.includes(params.m as (typeof MODS)[number])
    ? (params.m as (typeof MODS)[number])
    : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/masuk?next=%2Fapp");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    // Scoped by id, not left to RLS. `.single()` errors when the query returns
    // more than one row, and an admin policy on `profiles` lets an admin read
    // every row — so the moment a second person signed up, this threw and the
    // app told its own owner "profil lo belum kebentuk". It worked locally only
    // because there was exactly one profile in the table.
    .eq("id", user.id)
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

  // Everything below used to run in sequence on every single tab change: a
  // write to claim the refill, a full pipeline read, and five separate config
  // lookups — each its own round-trip to a database that is not in the same
  // region as the function. That is what made switching tabs feel broken.
  const serviceRole = createServiceRoleClient();
  let totalCredits = profile.credits_free + profile.credits_paid;

  // The refill is a WRITE, and it was firing on every navigation. It can only
  // do anything once per WIB day, so skip it entirely when today's is claimed.
  const todayWib = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const needsRefill = profile.last_refill_date !== todayWib;

  const isAdmin = profile.role === "admin";

  const [refillResult, pipelineResult, costs, waitingTopups] = await Promise.all([
    // Supabase's builder is a PromiseLike, not a Promise, so it has no
    // `.catch` — wrap it before attaching one. Never block the app on a
    // refill failure.
    needsRefill
      ? (async () => {
          try {
            const { data } = await serviceRole.rpc("claim_daily_refill", {
              p_user: user.id,
            });
            return data;
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null),

    // Loaded unconditionally. Skipping this unless `tab === "pipeline"` made
    // sense when each tab was its own navigation; once tabs became client-side
    // the server only ever renders once, so the conditional meant the pipeline
    // board and the history list were permanently empty for anyone who landed
    // on /app and then tapped across. A regression I introduced.
    supabase
      .from("pipeline_cards")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then((r) => r.data),

    // Five `await getCost(...)` calls inline in JSX resolved one after another.
    // They share one 30s cache, so in parallel they cost a single lookup.
    Promise.all([
      getCost("ide_hari_ini"),
      getCost("idea"),
      getCost("hook"),
      getCost("script"),
      getCost("repurpose"),
      getCost("vibe"),
    ]),

    // Owner-only. A bank transfer lands in `topups` and then waits for someone
    // to look at it — and nothing anywhere told the owner it had arrived unless
    // they happened to open the admin panel. Counting it here puts the number
    // on the admin pill in the header of the app they actually use all day.
    isAdmin
      ? serviceRole
          .from("topups")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .then((r) => r.count ?? 0)
      : Promise.resolve(0),
  ]);

  if (typeof refillResult === "number") totalCredits = refillResult;
  const pipelineCards = pipelineResult ?? [];
  const [costIde, costIdea, costHook, costScript, costRepurpose, costVibe] = costs;

  // Same regression as the pipeline query above: gated on `tab === "profil"`,
  // which is never true when the profile tab is reached by a client-side switch.
  const history: HistoryItem[] = (
    (
      await supabase
        .from("generations")
        .select("id, module, created_at, credits_spent, performance_rating, output")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25)
    ).data ?? []
  ).map((g) => {
          const o = g.output as Record<string, unknown> | null;
          const ideas = o?.ideas as { title?: string }[] | undefined;
          const hooks = o?.hooks as { text?: string }[] | undefined;
          return {
            id: g.id as string,
            module: g.module as string,
            created_at: g.created_at as string,
            credits_spent: (g.credits_spent as number) ?? 0,
            performance_rating: (g.performance_rating as number | null) ?? null,
            // Each module shapes its output differently. Vibe kits carry a
            // `project_name` and no ideas/hooks/caption, so they were all
            // showing "(tanpa judul)" in the history list.
            gist: String(
              ideas?.[0]?.title ||
                hooks?.[0]?.text ||
                (typeof o?.project_name === "string"
                  ? `${o.project_name}${typeof o.one_liner === "string" ? ` — ${o.one_liner}` : ""}`
                  : "") ||
                (typeof o?.caption === "string" ? o.caption : "") ||
                (typeof o?.tiktok === "string" ? o.tiktok : "") ||
                "(tanpa judul)",
            ).slice(0, 160),
          };
        });

  const avatar =
    profile.avatar_url ??
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  const shellProps = {
    active: tab,
    credits: totalCredits,
    isAdmin,
    pendingTopups: waitingTopups,
    avatarUrl: avatar,
    initial: profile.display_name?.charAt(0).toUpperCase() ?? "?",
  };

  // The module sub-view branch that used to live here is gone. It re-rendered
  // the entire page on the server — auth, profile, config, all against
  // Singapore — to show a component that was already in the browser. StudioPanel
  // switches locally instead; `mod` now only seeds its initial state.

  // All four panels render once; the shell swaps them in the browser with no
  // network at all. This is what removes the multi-second tab delay.
  return (
    <AppShell
      {...shellProps}
      panels={{
        studio: (
          <StudioPanel
            initialMod={mod}
            credits={totalCredits}
            costs={{
              ide: costIde,
              idea: costIdea,
              hook: costHook,
              script: costScript,
              repurpose: costRepurpose,
            }}
            home={
        // This used to force everything into `min-h-[calc(100dvh-9.5rem)]` with
        // `justify-center`, back when it held a hero and two tiles. It now holds
        // five tiles and a value strip, and squeezing that into a fixed height
        // is what made it read as cramped and colliding. Natural flow with real
        // spacing instead — scrolling a little beats crushing everything.
        <div className="reveal flex flex-col gap-4 py-1">
          {/* Credits arrive from outside this tab — an admin approving a top-up,
              the daily refill, a referral paying out. Until now the balance only
              moved on reload, so the moment someone paid was the moment the
              product looked broken. This page is a server component, so a
              refresh re-runs it and the pill recomputes with no client state to
              keep in sync. RLS scopes the subscription to the user's own row. */}
          <LiveRefresh tables={["profiles"]} label="Kredit lo udah masuk" />

          {/* A heads-up while they can still finish something, not a wall at
              zero. Hides itself entirely above the threshold. */}
          <LowCreditNotice
            credits={totalCredits}
            mostExpensive={Math.max(costIde, costIdea, costHook, costScript, costRepurpose, costVibe)}
          />

          <section className="surface-card relative overflow-hidden rounded-2xl border border-hairline px-5 pb-5 pt-5">
            <MascotStage className="mx-auto size-28 sm:size-40" />
            <div className="mt-1 text-center">
              <p className="eyebrow text-ember">
                {greet()}, {profile.display_name?.split(" ")[0] ?? "kreator"}
              </p>
              <h1 className="mt-2 font-display text-[1.3125rem] font-bold leading-tight tracking-display-md text-ink sm:text-2xl">
                Gak usah mikir. Tinggal pilih.
              </h1>
            </div>
          </section>

          <div className="grid gap-3">
            {/* Costs are admin-editable now, so reading them from config keeps
                the tile from advertising a price that is no longer charged. */}
            <StudioTileBig
              mod="ide"
              title="Ide Hari Ini"
              body="Gak usah ngetik apa-apa. Langsung dapet 3 ide buat hari ini."
              cost={costIde}
              primary
            />
            <StudioTileBig
              mod="idea"
              title="Idea Engine"
              body="Punya ide mentah? Lempar, balik jadi 5 yang udah mateng."
              cost={costIdea}
            />
          </div>

          {/* Hook Lab, Script Builder and Repurpose shipped in the backend from
              the start with no way in. Compact row so the dashboard still fits
              one screen — the two primaries stay the headline. */}
          <div className="grid grid-cols-3 gap-2">
            <StudioTile mod="hook" title="Hook Lab" cost={costHook} />
            <StudioTile mod="script" title="Script" cost={costScript} />
            <StudioTile mod="repurpose" title="Repurpose" cost={costRepurpose} />
          </div>

          {/* The dashboard never said what the product is good for. Three lines,
              no scroll added, and no swipes at anything else. */}
          {/* `truncate` was cutting these off on a 360px screen — three columns
              of clipped text is worse than no strip at all. Wrapping instead. */}
          <ul className="grid grid-cols-3 gap-2 rounded-xl border border-hairline bg-surface/50 px-3 py-3">
            {[
              { k: "Nyambung", v: "Ngikutin gaya lo" },
              { k: "Update", v: "Tau tren hari ini" },
              { k: "Kelar", v: "Sampai jadi script" },
            ].map((x) => (
              <li key={x.k} className="min-w-0 text-center">
                <p className="eyebrow text-ember">{x.k}</p>
                <p className="mt-1 text-micro leading-snug text-muted">{x.v}</p>
              </li>
            ))}
          </ul>
            </div>
            }
          />
        ),

        vibe: <VibeCodingStudio cost={costVibe} />,

        pipeline: <PipelineBoard initialCards={pipelineCards || []} />,

        profil: (
        <div className="reveal space-y-4">
          {/* Accessibility controls first: someone who needs larger text needs
              it before they can comfortably read anything else on the page. */}
          <section className="surface-card rounded-2xl p-4">
            <TextScale />
          </section>

          <section>
            <h2 className="eyebrow mb-2 ml-1 text-muted">Riwayat</h2>
            <HistoryList items={history} />
          </section>
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
              className="btn-ember grid place-items-center rounded-xl px-5 py-3.5 font-display text-[0.9375rem] font-bold text-obsidian"
            >
              Top up credit
            </Link>
            {/* Was a bare centred label with no icon and no press state, sitting
                next to a filled primary button — it read as a disabled twin
                rather than a secondary action. Same physics as the module tiles
                now: raised surface, chevron, and a press response. */}
            <Link
              href="/app/profile"
              className="skeu skeu-press flex items-center justify-center gap-2 rounded-xl border border-hairline bg-surface-raised px-5 py-3.5 font-display text-[0.9375rem] font-semibold text-ink hover:border-ember/40 hover:text-ember-lo"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0 fill-current">
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.6.1-.9-.1-.9 1.9-1.5-1.9-3.2-2.3.8a7.2 7.2 0 0 0-1.6-.9l-.3-2.4h-3.7l-.4 2.4a7.2 7.2 0 0 0-1.5.9l-2.3-.8L5.4 9.6l1.9 1.5-.1.9.1.9-1.9 1.5 1.8 3.2 2.3-.8c.5.4 1 .7 1.6.9l.3 2.4h3.7l.4-2.4c.5-.2 1-.5 1.5-.9l2.3.8 1.9-3.2-1.9-1.5Z" />
              </svg>
              Referral &amp; akun
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
        ),
      }}
    />
  );
}

/**
 * These read as three flat labels rather than three buttons — no affordance at
 * all. A chevron, a lifted surface and a pressed state make it obvious they are
 * tappable; `active:scale` gives the touch feedback that sells it on a phone,
 * where there is no hover to hint with.
 */

/**
 * Back and refresh as a matched pair.
 *
 * Back was a bare text link with no visual weight and there was no refresh at
 * all — on an installed PWA there is no browser chrome, so a stale screen had
 * no way out but closing the app. Both are pill buttons now, same height, same
 * border, sitting on one row.
 */
function ModuleBar() {
  return (
    <div className="flex items-center justify-between">
      <Link
        href="/app?tab=studio"
        className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3.5 py-2 text-mini font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/35 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
          <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6 4.6-4.6Z" />
        </svg>
        Balik
      </Link>
      <RefreshButton />
    </div>
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
  // 00:00-03:59 is not "pagi" to anyone awake at that hour — it was greeting
  // 2am with "Pagi" because everything below 11 fell into the same branch.
  if (wib < 4) return "Belum tidur";
  if (wib < 11) return "Pagi";
  if (wib < 15) return "Siang";
  if (wib < 18) return "Sore";
  return "Malam";
}

