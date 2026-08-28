"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { STUDIO_MODULES, type StudioModule as Mod } from "@/lib/studio-modules";

function StudioSkeleton({ label }: { label: string }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-hairline bg-surface p-5 sm:p-7"
      role="status"
      aria-live="polite"
      aria-label={`Menyiapkan ${label}`}
    >
      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ember/10 to-transparent animate-shimmer-sweep" />
      <div className="relative space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="size-9 shrink-0 rounded-xl bg-surface-raised animate-shimmer-sweep" />
            <div className="min-w-0 space-y-1.5">
              <div className="h-4 w-32 max-w-full rounded-md bg-surface-raised animate-shimmer-sweep" />
              <div className="h-2.5 w-44 max-w-full rounded-md bg-surface-raised/60 animate-shimmer-sweep" />
            </div>
          </div>
          <div className="h-6 w-16 shrink-0 rounded-full bg-surface-raised animate-shimmer-sweep" />
        </div>
        <div className="flex h-40 w-full flex-col items-center justify-center gap-3 rounded-xl border border-hairline/60 bg-surface-raised/30">
          <div className="relative size-8 rounded-full border border-ember/30">
            <div className="absolute inset-1 rounded-full border-2 border-ember border-t-transparent animate-spin" />
          </div>
          <span className="text-center text-micro font-semibold text-muted">Menyiapkan {label}...</span>
        </div>
      </div>
    </div>
  );
}

const IdeHariIni = dynamic(() => import("./IdeHariIni").then((m) => m.IdeHariIni), {
  loading: () => <StudioSkeleton label="Ide Hari Ini" />,
});
const IdeaEngine = dynamic(() => import("./IdeaEngine").then((m) => m.IdeaEngine), {
  loading: () => <StudioSkeleton label="Idea Engine" />,
});
const ModuleRunner = dynamic(() => import("./ModuleRunner").then((m) => m.ModuleRunner), {
  loading: () => <StudioSkeleton label="Studio Module" />,
});
const ClipEngine = dynamic(() => import("./ClipEngine").then((m) => m.ClipEngine), {
  loading: () => <StudioSkeleton label="Clip Engine" />,
});
const ThreadEngine = dynamic(() => import("./ThreadEngine").then((m) => m.ThreadEngine), {
  loading: () => <StudioSkeleton label="Thread Engine" />,
});
const VideoEditor = dynamic(() => import("./VideoEditor").then((m) => m.VideoEditor), {
  loading: () => <StudioSkeleton label="Video Auto-CC Editor" />,
});
const AffiliateEngine = dynamic(() => import("./AffiliateEngine").then((m) => m.AffiliateEngine), {
  loading: () => <StudioSkeleton label="Affiliate Engine" />,
});
const CarouselGenerator = dynamic(() => import("./CarouselGenerator").then((m) => m.CarouselGenerator), {
  loading: () => <StudioSkeleton label="AI Carousel Studio" />,
});
const LancarBahasa = dynamic(() => import("./LancarBahasa").then((m) => m.LancarBahasa), {
  loading: () => <StudioSkeleton label="Lancar Inggris" />,
});

export type StudioCosts = {
  ide: number;
  idea: number;
  hook: number;
  script: number;
  repurpose: number;
  clip?: number;
  thread?: number;
  video?: number;
  videoNoWm?: number;
  affiliate?: number;
  carousel?: number;
  lancar_bahasa?: number;
};

export function StudioPanel({
  initialMod,
  costs,
  credits,
  home,
}: {
  initialMod: Mod | null;
  costs: StudioCosts;
  credits: number;
  home: ReactNode;
}) {
  const [mod, setMod] = useState<Mod | null>(initialMod);

  useEffect(() => {
    const open = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      if (!STUDIO_MODULES.includes(next as Mod)) return;
      setMod(next as Mod);
      window.history.replaceState(null, "", `/app?tab=studio&m=${next}`);
      document.querySelector("main")?.scrollTo({ top: 0 });
    };
    const handleTabSwitch = (e: Event) => {
      const target = (e as CustomEvent<string>).detail;
      if (target === "studio") {
        setMod(null);
        document.querySelector("main")?.scrollTo({ top: 0 });
      }
    };
    window.addEventListener("malesan:open-module", open);
    window.addEventListener("malesan:switch-tab", handleTabSwitch);
    return () => {
      window.removeEventListener("malesan:open-module", open);
      window.removeEventListener("malesan:switch-tab", handleTabSwitch);
    };
  }, []);

  const back = () => {
    setMod(null);
    window.history.replaceState(null, "", "/app");
    document.querySelector("main")?.scrollTo({ top: 0 });
  };

  const clipCost = costs.clip ?? 4;
  const threadCost = costs.thread ?? 3;
  const videoCost = costs.video ?? 2;
  const videoNoWmCost = costs.videoNoWm ?? 5;
  const affiliateCost = costs.affiliate ?? 3;

  if (!mod) {
    return <>{home}</>;
  }

  return (
    <div className="reveal space-y-2.5 sm:space-y-4">
      <button
        onClick={back}
        className="flex h-7.5 sm:h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline/80 bg-surface/80 px-2.5 sm:px-3 text-xs font-semibold text-muted transition-all duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember shadow-xs"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
          <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6 4.6-4.6Z" />
        </svg>
        Balik ke Studio
      </button>

      {mod === "ide" ? (
        <IdeHariIni cost={costs.ide} />
      ) : mod === "idea" ? (
        <IdeaEngine />
      ) : mod === "clip" ? (
        <ClipEngine cost={clipCost} />
      ) : mod === "thread" ? (
        <ThreadEngine cost={threadCost} />
      ) : mod === "video" ? (
        <VideoEditor cost={videoCost} noWatermarkCost={videoNoWmCost} />
      ) : mod === "affiliate" ? (
        <AffiliateEngine cost={affiliateCost} />
      ) : mod === "carousel" ? (
        <CarouselGenerator cost={costs.carousel ?? 3} credits={credits} />
      ) : mod === "lancar_bahasa" ? (
        <LancarBahasa cost={costs.lancar_bahasa ?? 2} credits={credits} />
      ) : (
        <ModuleRunner moduleKey={mod} cost={costs[mod]} credits={credits} />
      )}
    </div>
  );
}

/**
 * 1. HERO SPOTLIGHT CARD: 1-Click Creative Magic
 */
export function StudioHeroCard({
  cost,
  mod = "ide",
}: {
  cost: number;
  mod?: Mod;
}) {
  return (
    <div className="w-full rounded-2xl border border-ember/45 bg-gradient-to-br from-surface via-surface to-ember/10 p-4 sm:p-5 text-left shadow-sm transition-all hover:border-ember/65">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/15 px-2.5 py-0.5 text-micro font-bold tracking-wider text-ember border border-ember/30 uppercase">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3 text-ember">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          1-Click Instan
        </span>
        <span className="rounded-md bg-surface-raised px-2.5 py-0.5 font-mono text-micro font-bold text-ember border border-hairline">
          {cost} kredit
        </span>
      </div>

      <div className="mt-2">
        <h2 className="font-display text-base sm:text-lg lg:text-xl font-bold text-ink">
          Cari 3 Ide Konten Hari Ini
        </h2>
        <p className="mt-0.5 text-micro sm:text-xs text-muted leading-relaxed">
          Gak usah ngetik prompt apa pun. Langsung dapet 3 ide segar siap posting lengkap dengan hook &amp; naskah video.
        </p>
      </div>

      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: mod }))
        }
        className="btn-ember mt-3.5 inline-flex min-h-11 sm:min-h-12 w-full items-center justify-center rounded-xl px-5 font-display text-sm sm:text-base font-bold text-obsidian shadow-md transition-transform active:scale-[0.99] hover:brightness-105"
      >
        Kasih 3 Ide Sekarang →
      </button>
    </div>
  );
}

/**
 * 2. COMPACT TOOL TILE: Ultra Clean, Uniform 8-Tool Grid Card
 */
export function StudioTile({
  mod,
  href,
  title,
  subtitle,
  cost,
  icon,
}: {
  mod?: Mod;
  href?: string;
  title: string;
  subtitle?: string;
  cost: number | string;
  icon: ReactNode;
}) {
  const content = (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-lg bg-surface-raised border border-hairline text-ember shadow-xs transition-colors group-hover:bg-ember/15 group-hover:border-ember/40">
          {icon}
        </span>
        <span className="shrink-0 font-mono text-[10px] sm:text-[11px] font-semibold text-muted bg-surface-raised px-2 py-0.5 rounded-md border border-hairline">
          {typeof cost === "number" ? `${cost} kredit` : cost}
        </span>
      </div>

      <div className="mt-2 min-w-0">
        <span className="block font-display text-xs sm:text-sm font-bold leading-tight text-ink group-hover:text-ember truncate">
          {title}
        </span>
        {subtitle && (
          <span className="block mt-0.5 text-[11px] sm:text-xs text-muted truncate">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );

  const cardClasses =
    "surface-card surface-card-interactive group relative flex w-full flex-col justify-between rounded-xl sm:rounded-2xl border border-hairline p-3 sm:p-3.5 lg:p-4 text-left transition-all duration-[var(--duration-standard)] ease-heat hover:border-ember/45 hover:shadow-xs min-h-[84px] sm:min-h-[92px]";

  if (href) {
    return (
      <Link href={href} className={cardClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (mod) {
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: mod }));
        }
      }}
      className={cardClasses}
    >
      {content}
    </button>
  );
}

/**
 * 3. WIDE FLAGSHIP STUDIO TILE: Spans full width for symmetry and high-end visual presence
 */
export function StudioWideTile({
  mod = "lancar_bahasa",
  cost = 2,
}: {
  mod?: Mod;
  cost?: number;
}) {
  return (
    <div className="col-span-2 lg:col-span-5">
      <button
        type="button"
        onClick={() => {
          if (mod) {
            window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: mod }));
          }
        }}
        className="group relative w-full overflow-hidden rounded-2xl border border-ember/35 bg-gradient-to-r from-surface-raised via-surface to-ember/10 p-3.5 sm:p-4 text-left shadow-xs transition-all duration-200 hover:border-ember/65 hover:shadow-md active:scale-[0.995]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl border border-ember/40 bg-ember/15 text-ember transition-transform group-hover:scale-105">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 sm:size-5">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="font-display text-xs sm:text-sm font-bold text-ink group-hover:text-ember transition-colors">
                  Lancar Inggris
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-ember/30 bg-ember/15 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-ember uppercase tracking-wider">
                  AI Master
                </span>
                <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-[9px] sm:text-[10px] font-bold text-ember border border-hairline">
                  {cost} kredit
                </span>
              </div>
              <p className="mt-0.5 text-[11px] sm:text-xs text-muted leading-tight truncate sm:whitespace-normal">
                Speaking AI native, roleplay skenario nyata, kuis interaktif &amp; evaluasi esai.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-micro font-bold text-muted group-hover:text-ember transition-colors hidden md:inline">
              Buka Studio
            </span>
            <span className="inline-flex size-6 sm:size-7 items-center justify-center rounded-lg bg-surface border border-hairline text-muted group-hover:border-ember group-hover:bg-ember group-hover:text-obsidian transition-all">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3 sm:size-3.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}


