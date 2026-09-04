"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { STUDIO_MODULES, type StudioModule as Mod } from "@/lib/studio-modules";
import { haptic } from "@/lib/haptics";

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
  const [visitedMods, setVisitedMods] = useState<Set<Mod>>(() => new Set(initialMod ? [initialMod] : []));

  useEffect(() => {
    const open = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      if (!STUDIO_MODULES.includes(next as Mod)) return;
      haptic.tap();
      setMod(next as Mod);
      setVisitedMods((prev) => new Set([...prev, next as Mod]));
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
    haptic.tap();
    setMod(null);
    window.history.replaceState(null, "", "/app");
    document.querySelector("main")?.scrollTo({ top: 0 });
  };

  const clipCost = costs.clip ?? 4;
  const threadCost = costs.thread ?? 3;
  const videoCost = costs.video ?? 5;
  const videoNoWmCost = costs.videoNoWm ?? 10;
  const affiliateCost = costs.affiliate ?? 3;

  if (!mod) {
    return <>{home}</>;
  }

  const renderModule = (m: Mod) => {
    if (m === "ide") return <IdeHariIni cost={costs.ide} />;
    if (m === "idea") return <IdeaEngine />;
    if (m === "clip") return <ClipEngine cost={clipCost} />;
    if (m === "thread") return <ThreadEngine cost={threadCost} />;
    if (m === "auto_clip") return <VideoEditor cost={videoCost} noWatermarkCost={videoNoWmCost} mode="auto_clip" />;
    if (m === "video") return <VideoEditor cost={videoCost} noWatermarkCost={videoNoWmCost} mode="subtitle" />;
    if (m === "affiliate") return <AffiliateEngine cost={affiliateCost} />;
    if (m === "carousel") return <CarouselGenerator cost={costs.carousel ?? 3} credits={credits} />;
    if (m === "lancar_bahasa") return <LancarBahasa cost={costs.lancar_bahasa ?? 2} credits={credits} />;
    return <ModuleRunner moduleKey={m} cost={costs[m]} credits={credits} />;
  };

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

      {/* Keep-Alive Active Module Cache: Visited tools remain in memory for 0ms re-entry */}
      <div className="relative">
        {Array.from(visitedMods).map((m) => (
          <div
            key={m}
            className={m === mod ? "block animate-fade-in" : "hidden"}
            aria-hidden={m !== mod}
          >
            {renderModule(m)}
          </div>
        ))}
      </div>
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

export function StudioAutoClipWideTile({
  cost = 10,
}: {
  cost?: number;
}) {
  return (
    <div className="col-span-2 lg:col-span-5 relative group">
      {/* 1. LAYER UNDERNEATH: Radiant Magma Atmosphere Glow */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-600/35 via-rose-600/25 to-amber-500/25 blur-lg opacity-65 transition-opacity duration-300 group-hover:opacity-100 animate-flame-breathe" 
      />

      {/* 2. LAYER BORDER: Flowing Molten Plasma Flame Perimeter */}
      <div className="relative overflow-hidden rounded-2xl p-[1.5px] animate-flame-border animate-flame-glow transition-all duration-300 group-hover:scale-[1.008]">
        {/* 3. LAYER CARD INTERIOR: Smoldering Obsidian Coal Bed */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: "auto_clip" }));
          }}
          className="relative flex w-full flex-col justify-between overflow-hidden rounded-[calc(1rem-1.5px)] bg-gradient-to-br from-[#140803]/98 via-[#180a04]/96 to-[#0d0502]/98 py-[13.5px] px-3.5 sm:py-[14.5px] sm:px-4 text-left backdrop-blur-md transition-all duration-200 group-hover:bg-[#1b0c05] active:scale-[0.995]"
        >
          {/* Subtle Warm Gradient Overlay with Heat Shimmer */}
          <div 
            aria-hidden="true" 
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,138,61,0.18),transparent_65%),radial-gradient(ellipse_at_bottom_right,rgba(239,68,68,0.15),transparent_70%)]" 
          />

          {/* Microscopic Rising Ember Sparks (Bara Api Melayang Elegan) */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className="absolute bottom-1 left-[18%] size-1 rounded-full bg-amber-300 shadow-[0_0_6px_#ff8a3d] animate-ember-1" />
            <span className="absolute bottom-2 left-[52%] size-1.5 rounded-full bg-orange-400 shadow-[0_0_8px_#ff4500] animate-ember-2" />
            <span className="absolute bottom-1 left-[82%] size-1 rounded-full bg-amber-200 shadow-[0_0_7px_#ffb067] animate-ember-3" />
          </div>

          <div className="relative z-10 flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-3 min-w-0">
              {/* Burning Fiery Icon Container */}
              <div className="relative flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/60 bg-gradient-to-br from-amber-500/30 via-rose-600/25 to-amber-950/70 text-amber-300 shadow-[0_0_18px_rgba(255,110,20,0.45)] transition-transform duration-300 group-hover:scale-105">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 sm:size-5 text-amber-300 drop-shadow-[0_0_6px_rgba(255,180,60,0.8)]">
                  <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                  <polygon points="10 15 15 12 10 9 10 15" fill="currentColor" fillOpacity="0.4" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="font-display text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-1 shrink truncate group-hover:text-amber-300 transition-colors">
                    <span className="truncate">Auto Clip YouTube</span>
                    {/* Fiery Flame Stroke Icon (Clean SVG, No cheap emoji) */}
                    <svg viewBox="0 0 24 24" fill="url(#malesan-flame-grad)" stroke="#ff8a3d" strokeWidth="1.6" className="size-3.5 sm:size-4 shrink-0 animate-flame-flicker">
                      <defs>
                        <linearGradient id="malesan-flame-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                          <stop offset="0%" stopColor="#ff4500" />
                          <stop offset="60%" stopColor="#ff8a3d" />
                          <stop offset="100%" stopColor="#ffd000" />
                        </linearGradient>
                      </defs>
                      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                    </svg>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/50 bg-gradient-to-r from-amber-500/25 to-rose-600/25 px-1.5 sm:px-2 py-0.5 text-[8.5px] sm:text-[10px] font-bold text-amber-200 uppercase tracking-wider shadow-[0_0_10px_rgba(255,120,30,0.3)]">
                    AI Flagship
                  </span>
                  <span className="shrink-0 rounded-md bg-[#230f07] px-1.5 sm:px-2 py-0.5 font-mono text-[8.5px] sm:text-[10px] font-bold text-amber-400 border border-amber-500/40 shadow-xs">
                    {cost} kredit
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] sm:text-xs text-[#d2b4a3] leading-tight truncate sm:whitespace-normal">
                  Tempel link YouTube, AI otomatis potong momen viral, tempel subtitle &amp; auto face track 9:16.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-micro font-bold text-amber-400/80 group-hover:text-amber-300 transition-colors hidden md:inline">
                Buka Studio
              </span>
              <span className="inline-flex size-6 sm:size-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/25 to-rose-600/25 border border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(255,100,20,0.3)] group-hover:border-amber-400 group-hover:bg-gradient-to-r group-hover:from-amber-500 group-hover:to-rose-500 group-hover:text-obsidian group-hover:shadow-[0_0_20px_rgba(255,120,30,0.6)] transition-all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-3 sm:size-3.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}


