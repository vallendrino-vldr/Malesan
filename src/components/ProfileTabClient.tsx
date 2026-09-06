"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { CopyField } from "@/components/CopyField";
import { HistoryList, type HistoryItem } from "@/components/HistoryList";
import { TextScale } from "@/components/TextScale";
import type { Persona } from "@/lib/supabase/database.types";

const PersonaManager = dynamic(
  () => import("@/components/PersonaManager").then((m) => m.PersonaManager),
  {
    loading: () => (
      <div className="w-full rounded-2xl border border-hairline bg-surface p-6 flex flex-col items-center justify-center gap-2">
        <div className="size-6 rounded-full border-2 border-ember border-t-transparent animate-spin" />
        <span className="text-micro font-semibold text-muted">...</span>
      </div>
    ),
  },
);

const CtaSettings = dynamic(() =>
  import("@/components/PersonaManager").then((m) => m.CtaSettings),
);
const FeedbackModal = dynamic(() =>
  import("@/components/FeedbackModal").then((m) => m.FeedbackModal),
);

interface ProfileTabClientProps {
  profile: {
    display_name?: string | null;
    email?: string | null;
    is_pro?: boolean;
    credits_free: number;
    credits_paid: number;
    onboarding_completed?: boolean;
  };
  avatar: string | null;
  monthlyGens: number;
  personasResult: Persona[];
  dnaResult: {
    cta_url?: string | null;
    cta_label?: string | null;
    cta_enabled?: boolean | null;
  } | null;
  referralsResult: number;
  referralLink: string;
  history: HistoryItem[];
}

export function ProfileTabClient({
  profile,
  avatar,
  monthlyGens,
  personasResult,
  dnaResult,
  referralsResult,
  referralLink,
  history,
}: ProfileTabClientProps) {
  const { language, dict } = useLanguage();
  const pr = dict.profile;
  const isEn = language === "en";

  return (
    <div className="reveal space-y-6">
      {/* LEVEL 1: CREATOR ACHIEVEMENT & MILESTONE (TOP) */}
      <section className="surface-card rounded-3xl border border-ember/35 bg-gradient-to-br from-surface-raised/90 via-surface to-obsidian p-5 sm:p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-ember/15 px-2.5 py-0.5 text-micro font-bold tracking-wider text-ember border border-ember/30 uppercase">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5 text-ember"
            >
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
            <span>{pr.milestoneBadge}</span>
          </div>
          <span className="font-mono text-micro text-ember font-semibold bg-surface-raised px-2 py-0.5 rounded border border-hairline">
            {pr.milestonePeriod}
          </span>
        </div>
        <p className="mt-3 font-display text-xl sm:text-2xl font-bold text-ink leading-tight">
          {monthlyGens > 0 ? pr.milestoneTitleActive(monthlyGens) : pr.milestoneTitleEmpty}
        </p>
        <p className="mt-1.5 text-xs sm:text-sm text-muted leading-relaxed max-w-2xl">
          {monthlyGens >= 20
            ? pr.milestoneDescHigh
            : monthlyGens >= 5
            ? pr.milestoneDescMed
            : pr.milestoneDescLow}
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
                  {profile.display_name ?? (isEn ? "Creator" : "Kreator")}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] bg-surface px-2 py-0.5 text-[10px] font-bold text-ink">
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
              className="btn-ember inline-flex h-11 sm:h-10 items-center justify-center rounded-xl px-4 font-display text-xs font-bold text-obsidian shadow-xs"
            >
              {pr.topupBtn}
            </Link>
            <Link
              href={profile.onboarding_completed ? "/app/profile" : "/app/onboarding"}
              className="inline-flex h-11 sm:h-10 items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-surface-raised px-4 text-xs font-bold text-ink hover:border-ember/40 hover:text-ember transition-all"
            >
              <span>
                {profile.onboarding_completed ? pr.profileContentBtn : pr.profileSetupBtn}
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <Stat label={pr.freeCredits} value={profile.credits_free} />
          <Stat label={pr.paidCredits} value={profile.credits_paid} />
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
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect width="20" height="5" x="2" y="7" />
              <line x1="12" x2="12" y1="22" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
          </div>
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-ink">
              {pr.referralTitle}
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              {pr.referralDesc}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <CopyField value={referralLink} label={pr.referralLink} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-[#09090b] p-4 shadow-inner">
            <div className="font-display text-micro font-bold uppercase tracking-wider text-muted">
              {pr.friendsJoined}
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-ink">
              {referralsResult}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-inner">
            <div className="font-display text-micro font-bold uppercase tracking-wider text-emerald-400">
              {pr.bonusEarned}
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-emerald-400">
              {referralsResult * 10}{" "}
              <span className="text-xs font-normal text-emerald-400/70">
                {isEn ? "credits" : "kredit"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* LEVEL 6: CREATOR ACTIVITY TIMELINE (HISTORY) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="eyebrow text-muted font-bold tracking-wider">{pr.historyTitle}</h3>
          <span className="text-micro font-mono text-muted">{pr.historySaved(history.length)}</span>
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
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>{pr.signOut}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-hairline bg-obsidian px-4 py-3">
      <dt className="text-micro text-muted font-medium truncate">{label}</dt>
      <dd className="mt-1 font-mono text-xl sm:text-2xl font-bold text-ink">{value}</dd>
    </div>
  );
}
