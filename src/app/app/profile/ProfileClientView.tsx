"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CopyField } from "@/components/CopyField";
import { PersonaManager, CtaSettings } from "@/components/PersonaManager";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Persona } from "@/lib/supabase/database.types";

interface ProfileClientViewProps {
  profile: {
    display_name?: string | null;
    email?: string | null;
    is_pro?: boolean;
    credits_free: number;
    credits_paid: number;
    referral_code?: string | null;
  };
  referralCount: number;
  referralLink: string;
  avatar: string | null;
  personas: Persona[];
  dna: {
    cta_url?: string | null;
    cta_label?: string | null;
    cta_enabled?: boolean | null;
  } | null;
  totalCredits: number;
}

export function ProfileClientView({
  profile,
  referralCount,
  referralLink,
  avatar,
  personas,
  dna,
  totalCredits,
}: ProfileClientViewProps) {
  const { language, dict } = useLanguage();
  const pr = dict.profile;
  const isEn = language === "en";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#08080a] text-ink">
      {/* Top Malesan Header Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0c0c0e]/85 backdrop-blur-xl px-4 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/app" className="flex items-center gap-2">
              <Logo />
            </Link>
            <span className="hidden sm:inline-block text-xs text-muted">/</span>
            <span className="hidden sm:inline-block font-display text-xs font-bold text-muted">
              {pr.navProfileAndPrefs}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-surface-raised px-3 py-1 text-xs font-bold text-ink">
              <span className="size-1.5 rounded-full bg-ember" />
              <span>{pr.navTotalCredits(totalCredits)}</span>
            </div>

            <Link
              href="/app?tab=profil"
              prefetch={true}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-surface px-3.5 text-xs font-semibold text-ink backdrop-blur-md transition-all hover:border-ember/40 hover:text-ember active:scale-[0.98]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>{pr.navBackToStudio}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {/* Page Title */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-ember animate-pulse" />
            <span className="font-display text-xs font-bold uppercase tracking-wider text-ember">
              {pr.settingsEyebrow}
            </span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            {pr.settingsHeading}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-muted max-w-xl">
            {pr.settingsSubtitle}
          </p>
        </div>

        {/* Settings Cards */}
        <div className="space-y-6">
          {/* 1. Account & Status Banner */}
          <div className="surface-card rounded-3xl border border-white/[0.08] bg-gradient-to-b from-surface-raised/90 via-surface to-[#0e0e11] p-5 sm:p-6 shadow-xl backdrop-blur-xl">
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
                    <h2 className="font-display text-base sm:text-lg font-bold text-ink">
                      {profile.display_name ?? (isEn ? "Malesan Creator" : "Kreator Malesan")}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] bg-surface px-2.5 py-0.5 text-micro font-bold text-ink">
                      <span className="size-1.5 rounded-full bg-ember" />
                      {profile.is_pro ? pr.memberBadgePro : pr.memberBadgeFree}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted">{profile.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/app/topup"
                  className="btn-ember inline-flex h-10 items-center justify-center rounded-xl px-4 font-display text-xs font-bold text-obsidian shadow-xs"
                >
                  {pr.topupBtn}
                </Link>
                <Link
                  href="/app/onboarding"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-surface-raised px-4 text-xs font-bold text-ink hover:border-ember/40 hover:text-ember transition-all"
                >
                  <span>{pr.profileSetupBtn}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4">
              <div className="rounded-2xl border border-white/[0.08] bg-[#09090b] p-3.5">
                <dt className="text-micro font-bold text-muted">{pr.freeCredits}</dt>
                <dd className="mt-1 font-display text-xl font-bold text-ink">{profile.credits_free}</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#09090b] p-3.5">
                <dt className="text-micro font-bold text-muted">{pr.paidCredits}</dt>
                <dd className="mt-1 font-display text-xl font-bold text-ink">{profile.credits_paid}</dd>
              </div>
            </dl>
          </div>

          {/* 2. Persona Voices Manager */}
          <PersonaManager personas={personas ?? []} />

          {/* 3. Smart CTA Link Injection */}
          <CtaSettings
            initial={{
              url: dna?.cta_url ?? "",
              label: dna?.cta_label ?? "",
              enabled: dna?.cta_enabled ?? false,
            }}
          />

          {/* 4. Referral Program Card */}
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
                <h2 className="font-display text-lg font-bold text-ink">
                  {pr.referralTitle}
                </h2>
                <p className="text-xs sm:text-sm text-muted">
                  {pr.referralSubtitle}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <CopyField value={referralLink} label={pr.referralUniqueLink} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/[0.08] bg-[#09090b] p-4 shadow-inner">
                <div className="font-display text-micro font-bold uppercase tracking-wider text-muted">
                  {pr.friendsJoined}
                </div>
                <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-ink">
                  {referralCount}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-inner">
                <div className="font-display text-micro font-bold uppercase tracking-wider text-emerald-400">
                  {pr.referralBonusEarned}
                </div>
                <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-emerald-400">
                  {referralCount * 10}{" "}
                  <span className="text-xs font-normal text-emerald-400/70">
                    {isEn ? "credits" : "kredit"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
