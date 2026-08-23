import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { AppShell, type TabKey } from "@/components/AppShell";
import { MascotStage } from "@/components/MascotStage";
import { PipelineBoard } from "@/components/PipelineBoard";
import { VibeCodingStudio } from "@/components/VibeCodingStudio";
import { getCost, getDashboardNotice, getVideoCostPerMin, getVideoNoWatermarkCost } from "@/lib/config";
import { HistoryList, type HistoryItem } from "@/components/HistoryList";
import { TextScale } from "@/components/TextScale";
import { LowCreditNotice } from "@/components/CreditNudge";
import { StudioPanel, StudioTile, StudioTileBig } from "@/components/StudioPanel";
import { LiveRefresh } from "@/components/LiveRefresh";
import { RecycleBanner } from "@/components/RecycleBanner";
import { FeedbackModal } from "@/components/FeedbackModal";
import { FirstTimeGuide } from "@/components/FirstTimeGuide";
import { jakartaDayKey } from "@/lib/time";

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
  // Keep this in sync with StudioPanel.Mod. Missing the three newer modules
  // made their URL update correctly, then reopen the Studio home after refresh.
  const MODS = ["ide", "idea", "hook", "script", "repurpose", "clip", "thread", "video"] as const;
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

  const isAdmin = profile.role === "admin";
  const [refillResult, pipelineResult, costs, waitingTopups, monthlyGens] = await Promise.all([
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
      getCost("clip"),
      getCost("thread"),
      getVideoCostPerMin(),
      getVideoNoWatermarkCost(),
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

    // Monthly milestone generations
    supabase
      .from("generations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString())
      .then((r) => r.count ?? 0),
  ]);

  if (typeof refillResult === "number") totalCredits = refillResult;
  const pipelineCards = pipelineResult ?? [];

  // Smart Content Recycle: posted pieces, oldest first, derived from the pipeline
  // read already in flight — no extra query. The 30-day age cut is applied in the
  // banner (a client component) so this server render stays pure (no Date.now()).
  // `created_at` is the proxy for posting age (there is no posted_at column yet).
  const postedCards = pipelineCards
    .filter((c) => c.status === "posted")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 8)
    .map((c) => ({ id: c.id, title: c.title ?? "", created_at: c.created_at }));
  const [costIde, costIdea, costHook, costScript, costRepurpose, costVibe, costClip, costThread, costVideo, costVideoNoWm] =
    costs;

  // Owner's live announcement. Same config cache the costs above just warmed, so
  // this is a map read, not a round trip.
  const notice = await getDashboardNotice();

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
              clip: costClip,
              thread: costThread,
              video: costVideo,
              videoNoWm: costVideoNoWm,
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

          {/* Header Sapaan & Maskot */}
          <section className="surface-card relative overflow-hidden rounded-2xl border border-hairline px-5 py-4 text-center">
            <MascotStage className="mx-auto size-24 sm:size-32" />
            <div className="mt-1">
              <p className="eyebrow text-ember">
                {greet()}, {profile.display_name?.split(" ")[0] ?? "kreator"}
              </p>
              <h1 className="mt-1 font-display text-lg font-bold tracking-display-md text-ink sm:text-xl">
                Males mikirnya. Bukan bikinnya.
              </h1>
            </div>
          </section>

          {/* Panduan Kilat Khusus Pemula */}
          <FirstTimeGuide />

          {/* 1. HERO CTA UTAMA: Cari Ide Konten */}
          <StudioTileBig
            mod="ide"
            title="Cari 3 Ide Konten Hari Ini"
            body="Gak usah ngetik apa-apa. Langsung dapet 3 ide segar siap posting lengkap dengan hook & naskah."
            cost={costIde}
            badge="Paling Populer & Cepat"
            ctaText="Kasih 3 Ide Sekarang →"
            primary
          />

          {/* 2. MENU TUJUAN KREATIF */}
          <section>
            <div className="mb-2 flex items-center justify-between px-0.5">
              <h2 className="eyebrow text-muted">Mau Bikin Bagian Apa?</h2>
              <span className="text-micro text-muted">Pilih tujuan lo</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <StudioTile
                mod="idea"
                title="Matengin Ide Mentah"
                body="Punya ide kasar? Lempar, balik jadi 5 konsep mateng."
                cost={costIdea}
                icon="💡"
              />
              <StudioTile
                mod="hook"
                title="Bikin Hook Nangkep"
                body="10 kalimat pembuka biar penonton betah & gak scroll."
                cost={costHook}
                icon="🪝"
              />
              <StudioTile
                mod="script"
                title="Naskah Video Lengkap"
                body="Script per-scene siap syuting + arahan visual & CTA."
                cost={costScript}
                icon="📝"
              />
              <StudioTile
                mod="repurpose"
                title="Ubah Format Konten"
                body="1 materi jadi video TikTok, carousel IG, thread X, & LinkedIn."
                cost={costRepurpose}
                icon="♻️"
              />
              <StudioTile
                mod="video"
                title="Subtitle Video Otomatis"
                body="Auto caption animasi kata-per-kata, export MP4 jernih."
                cost={`${costVideo}/m`}
                icon="🎬"
                badge="Tools Video"
              />
              <StudioTile
                mod="clip"
                title="Potong Momen Video"
                body="Deteksi part paling seru & engaging dari video lo."
                cost={costClip}
                icon="✂️"
              />
              <StudioTile
                mod="thread"
                title="Bikin Utas / Thread"
                body="Rangkai cerita jadi thread yang enak dibaca di X & Threads."
                cost={costThread}
                icon="💬"
              />
            </div>
          </section>

          {/* 3. DRAFT & CATATAN BEBAS */}
          <Link
            href="/app/draft"
            className="group flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/35"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-obsidian border border-hairline text-ember text-sm">
                ✍️
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="block text-sm font-semibold text-ink group-hover:text-ember-lo">Draft & Catatan Bebas</span>
                  <span className="rounded px-1.5 py-0.2 text-[10px] font-semibold bg-surface-raised border border-hairline text-muted">Gratis</span>
                </div>
                <span className="mt-0.5 block text-micro leading-snug text-muted">
                  Nulis sendiri, kesimpen otomatis. Mentok? Tekan Tab, biar gue terusin.
                </span>
              </div>
            </div>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-4 shrink-0 fill-muted transition-colors duration-[var(--duration-standard)] ease-heat group-hover:fill-ember"
            >
              <path d="M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6-1.4-1.4Z" />
            </svg>
          </Link>

          {/* 4. VALUE STRIP */}
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
        </div>
            }
          />
        ),

        vibe: <VibeCodingStudio cost={costVibe} />,

        pipeline: <PipelineBoard initialCards={pipelineCards || []} />,

        profil: (
        <div className="reveal space-y-4">
          {/* PENCAPAIAN BULAN INI (Soft Sell / Milestone Progress) */}
          <section className="surface-card rounded-2xl border border-ember/30 bg-ember/5 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-ember">🔥 Pencapaian Lo</span>
              <span className="font-mono text-micro text-ember font-semibold">Bulan Ini</span>
            </div>
            <p className="mt-2 font-display text-lg font-bold text-ink sm:text-xl">
              {monthlyGens > 0
                ? `Lo udah bikin ${monthlyGens} konten bulan ini!`
                : "Mulai bikin konten pertama lo bulan ini!"}
            </p>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              {monthlyGens >= 20
                ? "Konsistensi lo gokil banget! Algoritma suka kreator yang aktif kayak lo."
                : monthlyGens >= 5
                ? "Langkah awal yang keren. Lanjutin terus biar makin terbiasa bikin konten."
                : "Konsisten adalah kunci. Satu ide sehari bisa bawa akun lo terbang."}
            </p>
          </section>

          <section className="surface-card overflow-hidden rounded-2xl border border-ember/30 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow text-ember">Profil konten lo</p>
                <h2 className="mt-2 font-display text-lg font-bold text-ink">
                  {profile.onboarding_completed ? "Malesan udah kenal gaya lo" : "Biar hasilnya makin berasa lo"}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  Simpan niche, cara ngomong, dan siapa yang mau lo ajak ngobrol.
                  Bisa punya profil terpisah buat akun pribadi, bisnis, atau klien.
                </p>
              </div>
              <span
                className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-1 text-micro font-semibold ${
                  profile.onboarding_completed
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-ember/30 bg-ember/10 text-ember"
                }`}
              >
                {profile.onboarding_completed ? "Siap" : "Belum lengkap"}
              </span>
            </div>
            <Link
              href={profile.onboarding_completed ? "/app/profile" : "/app/onboarding"}
              className="btn-ember mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-display text-sm font-bold text-obsidian"
            >
              {profile.onboarding_completed ? "Kelola profil konten" : "Kenalin gaya gue"}
            </Link>
          </section>

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
              <Stat label="Kredit gratis" value={profile.credits_free} />
              <Stat label="Kredit berbayar" value={profile.credits_paid} />
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
              Top up kredit
            </Link>
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

          <div className="pt-1">
            <FeedbackModal />
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

