import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { AppShell, type TabKey } from "@/components/AppShell";
import { MascotStage } from "@/components/MascotStage";
import { getCost, getDashboardNotice, getVideoCostPerMin, getVideoNoWatermarkCost } from "@/lib/config";
import { HistoryList, type HistoryItem } from "@/components/HistoryList";
import { TextScale } from "@/components/TextScale";
import { LowCreditNotice } from "@/components/CreditNudge";
import { StudioPanel, StudioHeroCard, StudioTile, StudioWideTile, StudioAutoClipWideTile } from "@/components/StudioPanel";
import { LiveRefresh } from "@/components/LiveRefresh";
import { RecycleBanner } from "@/components/RecycleBanner";
import { CopyField } from "@/components/CopyField";
import { jakartaDayKey } from "@/lib/time";
import { isStudioModule } from "@/lib/studio-modules";
import { BannedGuard } from "@/components/BannedGuard";

const PipelineBoard = dynamic(() => import("@/components/PipelineBoard").then((m) => m.PipelineBoard), {
  loading: () => (
    <div className="w-full rounded-2xl border border-hairline bg-surface p-8 flex flex-col items-center justify-center gap-3 min-h-[360px]">
      <div className="size-8 rounded-full border-2 border-ember border-t-transparent animate-spin" />
      <span className="text-xs font-semibold text-muted">Memuat Pipeline Kanban...</span>
    </div>
  ),
});

const VibeCodingStudio = dynamic(() => import("@/components/VibeCodingStudio").then((m) => m.VibeCodingStudio), {
  loading: () => (
    <div className="w-full rounded-2xl border border-hairline bg-surface p-8 flex flex-col items-center justify-center gap-3 min-h-[360px]">
      <div className="size-8 rounded-full border-2 border-ember border-t-transparent animate-spin" />
      <span className="text-xs font-semibold text-muted">Memuat Vibe Studio...</span>
    </div>
  ),
});

const PersonaManager = dynamic(() => import("@/components/PersonaManager").then((m) => m.PersonaManager), {
  loading: () => (
    <div className="w-full rounded-2xl border border-hairline bg-surface p-6 flex flex-col items-center justify-center gap-2">
      <div className="size-6 rounded-full border-2 border-ember border-t-transparent animate-spin" />
      <span className="text-micro font-semibold text-muted">Memuat Suara Persona...</span>
    </div>
  ),
});

const CtaSettings = dynamic(() => import("@/components/PersonaManager").then((m) => m.CtaSettings));
const FeedbackModal = dynamic(() => import("@/components/FeedbackModal").then((m) => m.FeedbackModal));
const OnboardingWelcomeModal = dynamic(() => import("@/components/OnboardingWelcomeModal").then((m) => m.OnboardingWelcomeModal));

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
  const mod = isStudioModule(params.m) ? params.m : null;

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

  if (profile.is_banned) {
    return <BannedGuard reason={profile.ban_reason} />;
  }

  // Profil konten is guidance, not a gate. The old count-based redirect fired
  // during router.refresh() right after somebody's first successful result,
  // replacing that result with the onboarding form before it could be copied
  // or saved. Keep the app usable and surface the setup where people expect it:
  // at the top of the Profil tab below.

  // Everything below used to run in sequence on every single tab change: a
  // write to claim the refill, a full pipeline read, and five separate config
  // lookups — each its own round-trip to a database that is not in the same
  // region as the function. That is what made switching tabs feel broken.
  const serviceRole = createServiceRoleClient();
  let totalCredits = profile.credits_free + profile.credits_paid;

  // The refill is a WRITE, and it was firing on every navigation. It can only
  // do anything once per WIB day, so skip it entirely when today's is claimed.
  const todayWib = jakartaDayKey();
  const needsRefill = profile.last_refill_date !== todayWib;

  const cookieStore = await cookies();
  const isDemoMode = cookieStore.get("malesan_demo_mode")?.value === "1";
  const isAdmin = isDemoMode ? false : profile.role === "admin";

  // Check if user came from watching the demo video on landing page
  const hasPendingBonus = cookieStore.get("malesan_pending_demo_bonus")?.value === "1";
  if (hasPendingBonus) {
    try {
      const { grantDemoBonusToUser } = await import("@/app/actions/tutorial");
      const bonusRes = await grantDemoBonusToUser(user.id);
      if (bonusRes.success) {
        totalCredits += bonusRes.creditsAdded;
      }
    } catch {}
  }
  const [
    refillResult,
    pipelineResult,
    costs,
    waitingTopups,
    monthlyGens,
    personasResult,
    dnaResult,
    referralsResult,
    historyResult,
  ] = await Promise.all([
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

    // Loaded unconditionally.
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
      getCost("clip"),
      getCost("thread"),
      getVideoCostPerMin(),
      getVideoNoWatermarkCost(),
      getCost("affiliate"),
      getCost("carousel"),
      getCost("speaking_coach").catch(() => 2),
    ]),

    // Owner-only pending topups
    isAdmin
      ? serviceRole
          .from("topups")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .then((r) => r.count ?? 0)
      : Promise.resolve(0),

    // Monthly milestone generations
    supabase
      .from("generations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString())
      .then((r) => r.count ?? 0),

    // Personas for inline profile management
    supabase
      .from("personas")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .then((r) => r.data ?? []),

    // Creator DNA for smart CTA injection
    supabase
      .from("creator_dna")
      .select("cta_url, cta_label, cta_enabled")
      .eq("user_id", user.id)
      .maybeSingle()
      .then((r) => r.data),

    // Referral count
    supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", user.id)
      .then((r) => r.count ?? 0),

    // History is independent of every query above. Starting it here removes
    // one full database round-trip from the critical server-render path.
    supabase
      .from("generations")
      .select("id, module, created_at, credits_spent, performance_rating, output")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25)
      .then((r) => r.data ?? []),
  ]);

  if (typeof refillResult === "number") totalCredits = refillResult;
  const pipelineCards = pipelineResult ?? [];

  // Referral link resolution from request headers
  const reqHeaders = await headers();
  const reqHost = reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host") ?? "localhost:3000";
  const reqProto = reqHeaders.get("x-forwarded-proto") ?? (reqHost.startsWith("localhost") ? "http" : "https");
  const referralLink = `${reqProto}://${reqHost}/masuk?ref=${profile.referral_code}`;

  // Smart Content Recycle: posted pieces, oldest first, derived from the pipeline
  // read already in flight — no extra query. The 30-day age cut is applied in the
  // banner (a client component) so this server render stays pure (no Date.now()).
  // `created_at` is the proxy for posting age (there is no posted_at column yet).
  const postedCards = pipelineCards
    .filter((c) => c.status === "posted")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 8)
    .map((c) => ({ id: c.id, title: c.title ?? "", created_at: c.created_at }));
  const [costIde, costIdea, costHook, costScript, costRepurpose, costVibe, costClip, costThread, costVideo, costVideoNoWm, costAffiliate, costCarousel, costLancarBahasa] =
    costs;

  // Owner's live announcement. Same config cache the costs above just warmed, so
  // this is a map read, not a round trip.
  const notice = await getDashboardNotice();

  // History stays available for client-side profile tab switches and has already
  // loaded in parallel above, so this mapping adds no network waterfall.
  const history: HistoryItem[] = historyResult.map((g) => {
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
    avatarUrl: isDemoMode ? null : avatar,
    initial: isDemoMode ? "K" : (profile.display_name?.charAt(0).toUpperCase() ?? "?"),
  };

  // The module sub-view branch that used to live here is gone. It re-rendered
  // the entire page on the server — auth, profile, config, all against
  // Singapore — to show a component that was already in the browser. StudioPanel
  // switches locally instead; `mod` now only seeds its initial state.

  // All four panels render once; the shell swaps them in the browser with no
  // network at all. This is what removes the multi-second tab delay.
  return (
    <>
      <OnboardingWelcomeModal show={!isDemoMode && !profile.onboarding_completed} />
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
              clip: costClip,
              thread: costThread,
              video: costVideo,
              videoNoWm: costVideoNoWm,
              affiliate: costAffiliate,
              carousel: costCarousel,
              lancar_bahasa: costLancarBahasa,
            }}
            home={
        <div className="reveal relative flex flex-col gap-4 py-1">
          <div className="relative z-10 flex flex-col gap-4">
          {notice && (
            <p className="rounded-xl border border-ember/30 bg-ember/10 px-4 py-2.5 text-sm leading-relaxed text-ember-lo">
              {notice}
            </p>
          )}

          <LiveRefresh tables={["profiles"]} label="Kredit lo udah masuk" />

          <LowCreditNotice
            credits={totalCredits}
            mostExpensive={Math.max(costIde, costIdea, costHook, costScript, costRepurpose, costVibe)}
          />

          <RecycleBanner cards={postedCards} />

          {/* LEVEL 1: HERO SPOTLIGHT EXPERIENCE (AI Creative Companion) */}
          <section className="relative rounded-3xl border border-ember/35 bg-gradient-to-b from-surface-raised/90 via-surface to-obsidian p-5 sm:p-6 lg:p-7 shadow-lg transition-all">
            {/* Ambient Warmth Glow (Isolated overflow container so mascot popups float without clipping) */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 size-72 sm:size-96 rounded-full bg-ember/15 blur-3xl" />
            </div>

            <div className="relative z-10 grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-12 lg:items-center">
              {/* [ LEFT AREA: Mascot + Greeting + Thesis ] (lg:col-span-5) */}
              <div className="flex flex-col items-center text-center lg:items-start lg:text-left lg:col-span-5">
                <div className="flex flex-col items-center lg:flex-row lg:items-center gap-3.5 lg:gap-5">
                  <div className="size-20 sm:size-24 lg:size-28 shrink-0">
                    <MascotStage className="size-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="eyebrow text-ember font-bold tracking-wider">
                      {greet().toUpperCase()}, {isDemoMode ? "KREATOR" : (profile.display_name?.split(" ")[0]?.toUpperCase() ?? "KREATOR")}
                    </p>
                    <h1 className="mt-0.5 font-display text-xl sm:text-2xl font-bold tracking-display-sm text-ink leading-tight">
                      Mau bikin konten apa hari ini?
                    </h1>
                    <p className="mt-1 text-micro sm:text-xs text-muted leading-relaxed">
                      Pilih cara paling cepat. Tanpa mikir prompt rumit.
                    </p>
                  </div>
                </div>
              </div>

              {/* [ RIGHT AREA: Spotlight Hero Card ] (lg:col-span-7) */}
              <div className="w-full lg:col-span-7">
                <StudioHeroCard cost={costIde} />
              </div>
            </div>
          </section>

          {/* LEVEL 2: CREATIVE COMMAND TILES (10 Fitur Kompak) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="eyebrow text-muted font-bold">Semua Alat Kreatif</h2>
              <span className="text-micro font-mono text-muted">11 fitur siap pakai</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-5">
              <StudioTile
                mod="script"
                title="Naskah Video"
                subtitle="Script siap syuting"
                cost={costScript}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                }
              />
              <StudioTile
                mod="affiliate"
                title="Naskah Affiliate"
                subtitle="TikTok & Shopee"
                cost={costAffiliate}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                }
              />
              <StudioTile
                mod="carousel"
                title="Slide Gambar"
                subtitle="Ekspor gambar IG & LI"
                cost="Gratis"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M7 3v18" />
                    <path d="M17 3v18" />
                  </svg>
                }
              />
              <StudioTile
                mod="video"
                title="Subtitle Video"
                subtitle="Auto caption video"
                cost={`${costVideo}/mnt`}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <rect width="20" height="15" x="2" y="4.5" rx="3" />
                    <path d="M7 15h3a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H7v6z" />
                    <path d="M14 15h3a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-3v6z" />
                  </svg>
                }
              />
              <StudioTile
                mod="hook"
                title="Bikin Hook"
                subtitle="10 kalimat pembuka"
                cost={costHook}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                  </svg>
                }
              />
              <StudioTile
                mod="clip"
                title="Potong Momen"
                subtitle="Deteksi part seru"
                cost={costClip}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <circle cx="6" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <line x1="20" y1="4" x2="8.12" y2="15.88" />
                    <line x1="14.47" y1="14.48" x2="20" y2="20" />
                    <line x1="8.12" y1="8.12" x2="12" y2="12" />
                  </svg>
                }
              />
              <StudioTile
                mod="repurpose"
                title="Ubah Format"
                subtitle="TikTok, IG, X, LI"
                cost={costRepurpose}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                }
              />
              <StudioTile
                mod="idea"
                title="Matengin Ide"
                subtitle="Ide kasar jadi konsep"
                cost={costIdea}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                  </svg>
                }
              />
              <StudioTile
                mod="thread"
                title="Bikin Utas"
                subtitle="Thread di X & Threads"
                cost={costThread}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <line x1="8" y1="9" x2="16" y2="9" />
                    <line x1="8" y1="13" x2="13" y2="13" />
                  </svg>
                }
              />
              <StudioTile
                href="/app/draft"
                title="Draft Bebas"
                subtitle="Nulis & AI Tab"
                cost="Gratis"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                }
              />

              {/* WIDE FLAGSHIP CARD: LANCAR INGGRIS (Client Component, Server/Client boundary safe) */}
              <StudioWideTile mod="lancar_bahasa" cost={costLancarBahasa} />

              {/* WIDE FLAGSHIP CARD: AUTO CLIP YOUTUBE (Flagship Feature directly under Lancar Inggris) */}
              <StudioAutoClipWideTile cost={Math.max(10, costVideo * 2)} />
            </div>
          </section>

          {/* LEVEL 3: VALUE STRIP */}
          <div className="rounded-2xl border border-hairline/70 bg-surface/60 backdrop-blur-xs p-3.5 sm:p-4 shadow-xs">
            <ul className="grid grid-cols-3 divide-x divide-hairline/60">
              {[
                { k: "NYAMBUNG", v: "Ngikutin gaya persona lo" },
                { k: "UPDATE", v: "Tau tren kreator hari ini" },
                { k: "PRAKTIS", v: "Langsung jadi konten siap pake" },
              ].map((x) => (
                <li key={x.k} className="flex flex-col items-center justify-center text-center px-1.5 sm:px-3 min-w-0 first:pl-0 last:pr-0">
                  <p className="eyebrow text-ember font-bold tracking-wider text-[10px] sm:text-xs">
                    {x.k}
                  </p>
                  <p className="mt-1 text-[11px] sm:text-xs leading-snug text-muted font-medium break-words text-balance">
                    {x.v}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          </div>
        </div>
            }
          />
        ),

        vibe: <VibeCodingStudio cost={costVibe} />,

        pipeline: <PipelineBoard initialCards={pipelineCards || []} />,

        profil: (
        <div className="reveal space-y-6">
          {/* LEVEL 1: CREATOR ACHIEVEMENT & MILESTONE (TOP) */}
          <section className="surface-card rounded-3xl border border-ember/35 bg-gradient-to-br from-surface-raised/90 via-surface to-obsidian p-5 sm:p-6 shadow-md">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-ember/15 px-2.5 py-0.5 text-micro font-bold tracking-wider text-ember border border-ember/30 uppercase">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-ember">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
                <span>Pencapaian Kreator</span>
              </div>
              <span className="font-mono text-micro text-ember font-semibold bg-surface-raised px-2 py-0.5 rounded border border-hairline">Bulan Ini</span>
            </div>
            <p className="mt-3 font-display text-xl sm:text-2xl font-bold text-ink leading-tight">
              {monthlyGens > 0
                ? `Lo udah bikin ${monthlyGens} konten bulan ini!`
                : "Mulai bikin konten pertama lo bulan ini!"}
            </p>
            <p className="mt-1.5 text-xs sm:text-sm text-muted leading-relaxed max-w-2xl">
              {monthlyGens >= 20
                ? "Konsistensi lo gokil banget! Ide lo makin berkembang & akun lo siap terbang."
                : monthlyGens >= 5
                ? "Langkah awal yang mantap. Tiap konten bikin lo makin terbiasa dan pede."
                : "Konsisten adalah kunci. Kalau butuh lebih banyak ruang buat berkarya, tambah kredit kapan aja."}
            </p>
          </section>

          {/* LEVEL 2: ACCOUNT OVERVIEW & CREDITS */}
          <section className="surface-card rounded-3xl border border-white/[0.08] bg-gradient-to-b from-surface-raised/90 via-surface to-[#0e0e11] p-5 sm:p-6 shadow-xl backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="size-12 shrink-0 overflow-hidden rounded-full border border-white/[0.15] bg-surface-raised">
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center font-display text-base font-bold text-muted">
                      {profile.display_name?.charAt(0).toUpperCase() ?? "?"}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-display text-base font-bold text-ink">
                      {profile.display_name ?? "Kreator"}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] bg-surface px-2 py-0.5 text-[10px] font-bold text-ink">
                      <span className="size-1.5 rounded-full bg-ember" />
                      {profile.is_pro ? "Pro" : "Free"}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted">{profile.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/app/topup"
                  className="btn-ember inline-flex h-11 sm:h-10 items-center justify-center rounded-xl px-4 font-display text-xs font-bold text-obsidian shadow-xs"
                >
                  Top Up Kredit
                </Link>
                <Link
                  href={profile.onboarding_completed ? "/app/profile" : "/app/onboarding"}
                  className="inline-flex h-11 sm:h-10 items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-surface-raised px-4 text-xs font-bold text-ink hover:border-ember/40 hover:text-ember transition-all"
                >
                  <span>{profile.onboarding_completed ? "Profil konten lo" : "Atur Profil Utama"}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Kredit Gratis (Harian)" value={profile.credits_free} />
              <Stat label="Kredit Permanen (Bonus/Beli)" value={profile.credits_paid} />
            </dl>
          </section>

          {/* LEVEL 3: INLINE PERSONA VOICES MANAGER */}
          <PersonaManager personas={personasResult} />

          {/* LEVEL 4: INLINE SMART CTA LINK INJECTION */}
          <CtaSettings
            initial={{
              url: dnaResult?.cta_url ?? "",
              label: dnaResult?.cta_label ?? "",
              enabled: dnaResult?.cta_enabled ?? false,
            }}
          />

          {/* LEVEL 5: INLINE REFERRAL PROGRAM */}
          <div className="surface-card rounded-3xl border border-white/[0.08] bg-gradient-to-b from-surface-raised/90 via-surface to-[#0e0e11] p-5 sm:p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-xs">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <polyline points="20 12 20 22 4 22 4 12" />
                  <rect width="20" height="5" x="2" y="7" />
                  <line x1="12" x2="12" y1="22" y2="7" />
                  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-display text-base sm:text-lg font-bold text-ink">
                  Program Referral Kreator
                </h3>
                <p className="text-xs text-muted">
                  Ajak teman pakai link lo. Begitu dia bikin konten pertama, lo dan teman lo otomatis dapet +10 kredit permanen!
                </p>
              </div>
            </div>

            <div className="mt-4">
              <CopyField value={referralLink} label="Link Referral Lo" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/[0.08] bg-[#09090b] p-4 shadow-inner">
                <div className="font-display text-micro font-bold uppercase tracking-wider text-muted">
                  Teman Bergabung
                </div>
                <div className="mt-1 font-display text-2xl font-bold text-ink">
                  {referralsResult}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-inner">
                <div className="font-display text-micro font-bold uppercase tracking-wider text-emerald-400">
                  Bonus Kredit Didapat
                </div>
                <div className="mt-1 font-display text-2xl font-bold text-emerald-400">
                  {referralsResult * 10}{" "}
                  <span className="text-xs font-normal text-emerald-400/70">kredit</span>
                </div>
              </div>
            </div>
          </div>

          {/* LEVEL 6: CREATOR ACTIVITY TIMELINE (HISTORY) */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-0.5">
              <h3 className="eyebrow text-muted font-bold tracking-wider">Aktivitas &amp; Riwayat Konten</h3>
              <span className="text-micro font-mono text-muted">{history.length} hasil tersimpan</span>
            </div>
            <HistoryList items={history} />
          </section>

          {/* LEVEL 7: FOOTER CONTROLS & UTILITIES */}
          <div className="space-y-3 pt-2">
            <section className="surface-card rounded-2xl border border-hairline p-4">
              <TextScale />
            </section>

            <FeedbackModal />

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline/80 bg-surface/50 px-5 py-3.5 text-xs sm:text-sm font-semibold text-muted transition-all duration-200 hover:border-danger/40 hover:bg-danger/5 hover:text-danger cursor-pointer active:scale-[0.99]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Keluar dari Akun</span>
              </button>
            </form>
          </div>
        </div>
        ),
      }}
    />
    </>
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

