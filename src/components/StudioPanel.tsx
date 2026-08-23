"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { IdeHariIni } from "./IdeHariIni";
import { IdeaEngine } from "./IdeaEngine";
import { ModuleRunner } from "./ModuleRunner";
import { ClipEngine } from "./ClipEngine";
import { ThreadEngine } from "./ThreadEngine";
import { VideoEditor } from "./VideoEditor";

type Mod = "ide" | "idea" | "hook" | "script" | "repurpose" | "clip" | "thread" | "video";
const MODS: Mod[] = ["ide", "idea", "hook", "script", "repurpose", "clip", "thread", "video"];

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
      if (!MODS.includes(next as Mod)) return;
      setMod(next as Mod);
      window.history.replaceState(null, "", `/app?tab=studio&m=${next}`);
      document.querySelector("main")?.scrollTo({ top: 0 });
    };
    window.addEventListener("malesan:open-module", open);
    return () => window.removeEventListener("malesan:open-module", open);
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

  if (!mod) {
    return <>{home}</>;
  }

  return (
    <div className="reveal space-y-4">
      <button
        onClick={back}
        className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-hairline bg-surface pl-2 pr-3.5 text-mini font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
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
      ) : (
        <ModuleRunner moduleKey={mod} cost={costs[mod]} credits={credits} />
      )}
    </div>
  );
}

/**
 * 1. COMPACT HERO ACTION: 1-Click Creative Magic
 */
export function StudioHero({
  mod = "ide",
  cost,
}: {
  mod?: Mod;
  cost: number;
}) {
  return (
    <div className="surface-card relative overflow-hidden rounded-2xl border border-ember/40 bg-gradient-to-r from-surface via-surface to-ember/10 p-4 sm:p-4.5 text-left shadow-xs transition-all duration-[var(--duration-standard)] ease-heat">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/15 px-2.5 py-0.5 text-[10px] font-bold text-ember border border-ember/30">
              <span className="size-1.5 rounded-full bg-ember animate-pulse" />
              1-Click Instan
            </span>
            <span className="font-mono text-[10px] font-bold text-muted">
              {cost} kredit
            </span>
          </div>
          <h2 className="mt-1 font-display text-base sm:text-lg font-bold tracking-display-sm text-ink truncate">
            Cari 3 Ide Konten Hari Ini
          </h2>
          <p className="mt-0.5 text-micro sm:text-xs text-muted leading-tight">
            Langsung dapet 3 ide segar siap posting + hook &amp; naskah video.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: mod }))
          }
          className="btn-ember shrink-0 inline-flex min-h-10 sm:min-h-11 items-center justify-center rounded-xl px-4 sm:px-5 font-display text-xs sm:text-sm font-bold text-obsidian shadow-sm transition-transform active:scale-[0.99] hover:brightness-105"
        >
          Kasih 3 Ide Sekarang →
        </button>
      </div>
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
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-raised border border-hairline text-ember shadow-xs transition-colors group-hover:bg-ember/15 group-hover:border-ember/40">
          {icon}
        </span>
        <span className="shrink-0 font-mono text-[10px] font-semibold text-muted bg-surface-raised/90 px-2 py-0.5 rounded-md border border-hairline/80">
          {typeof cost === "number" ? `${cost} kredit` : cost}
        </span>
      </div>

      <div className="mt-2 min-w-0">
        <span className="block font-display text-xs sm:text-sm font-bold leading-tight text-ink group-hover:text-ember truncate">
          {title}
        </span>
        {subtitle && (
          <span className="block mt-0.5 text-[11px] text-muted truncate">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );

  const cardClasses =
    "surface-card surface-card-interactive group relative flex w-full flex-col justify-between rounded-xl sm:rounded-2xl border border-hairline p-3 sm:p-3.5 text-left transition-all duration-[var(--duration-standard)] ease-heat hover:border-ember/45 hover:shadow-xs min-h-[86px] sm:min-h-[92px]";

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


