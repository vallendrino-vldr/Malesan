"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IdeHariIni } from "./IdeHariIni";
import { IdeaEngine } from "./IdeaEngine";
import { ModuleRunner } from "./ModuleRunner";
import { ClipEngine } from "./ClipEngine";
import { ThreadEngine } from "./ThreadEngine";
import { VideoEditor } from "./VideoEditor";

/**
 * The Studio tab and its five modules, all switched in the browser.
 *
 * Opening Hook Lab used to be a real navigation to `/app?m=hook`. That page had
 * to run the middleware's `auth.getUser()`, the page's own `auth.getUser()`, a
 * profile read and the config reads — all against a database in Singapore —
 * before it could render a single pixel. Seconds of nothing on mobile data,
 * which is both the reported "delay" and the reason people tapped twice.
 *
 * None of that work was ever needed. Every one of these modules is already a
 * client component; the only thing they take from the server is a credit cost,
 * and those are already in memory by the time the Studio renders. So the whole
 * round trip existed to fetch data the browser was holding.
 *
 * Switching is now local and instant. The URL is kept in step with
 * `replaceState` so a refresh or a shared link still lands in the right place,
 * without that being what drives the change.
 *
 * `replaceState`, not `pushState`, for the same reason the tab bar uses it: a
 * module is a view, not a step in history. Back should leave the app rather
 * than walking someone backwards through every tile they tried.
 */

type Mod = "ide" | "idea" | "hook" | "script" | "repurpose" | "clip" | "thread" | "video";
const MODS: Mod[] = ["ide", "idea", "hook", "script", "repurpose", "clip", "thread", "video"];

export type StudioCosts = {
  ide: number;
  idea: number;
  hook: number;
  script: number;
  repurpose: number;
  /**
   * Optional because the dashboard's server pass does not read them yet. When it
   * does, drop the `??` fallbacks below — until then these mirror FALLBACK_COST
   * in lib/config so the tile never advertises a price the route will not charge.
   */
  clip?: number;
  thread?: number;
  /** Credits per MINUTE, not flat — the video editor charges by audio length. */
  video?: number;
  /** Extra credits to remove the export watermark. */
  videoNoWm?: number;
};

export function StudioPanel({
  initialMod,
  costs,
  credits,
  home,
}: {
  /** From `?m=` on first load, so a deep link still opens the right module. */
  initialMod: Mod | null;
  costs: StudioCosts;
  credits: number;
  /** The tiles and hero, rendered on the server and passed in as a slot. */
  home: ReactNode;
}) {
  const [mod, setMod] = useState<Mod | null>(initialMod);

  // The tiles live inside `home`, which is server-rendered, so they cannot call
  // setMod directly. They dispatch instead — one listener, no prop drilling
  // through a server boundary that would not survive it anyway.
  useEffect(() => {
    const open = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      if (!MODS.includes(next as Mod)) return;
      setMod(next as Mod);
      window.history.replaceState(null, "", `/app?tab=studio&m=${next}`);
      // A module opened from halfway down the tile grid would otherwise start
      // mid-page. The scroll container is the shell's <main>.
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

import Link from "next/link";

/**
 * A goal-oriented module card with disciplined SaaS metrics and uniform sizing.
 */
export function StudioTile({
  mod,
  href,
  title,
  body,
  cost,
  icon,
  badge,
  full = false,
}: {
  mod?: Mod;
  href?: string;
  title: string;
  body?: string;
  cost: number | string;
  icon?: ReactNode;
  badge?: string;
  full?: boolean;
}) {
  const inner = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-raised border border-hairline text-ember shadow-xs transition-colors group-hover:border-ember/40 group-hover:bg-ember/10">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <span className="block font-display text-sm font-bold leading-tight text-ink group-hover:text-ember truncate">
                {title}
              </span>
              {badge && (
                <span className="inline-block mt-0.5 rounded px-1.5 py-0.2 text-[10px] font-semibold bg-ember/15 text-ember">
                  {badge}
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 rounded-md bg-surface-raised/80 px-2 py-0.5 font-mono text-[11px] font-medium text-ember border border-hairline whitespace-nowrap">
            {typeof cost === "number" ? `${cost} kredit` : cost}
          </span>
        </div>
        {body && (
          <p className="mt-2.5 text-micro leading-snug text-muted line-clamp-2">
            {body}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end">
        <span className="text-[11px] font-semibold text-muted/80 group-hover:text-ember flex items-center gap-1 transition-colors">
          Buka <span>→</span>
        </span>
      </div>
    </div>
  );

  const cardClasses = `surface-card surface-card-interactive group relative flex w-full flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-[var(--duration-standard)] ease-heat hover:border-ember/45 hover:shadow-sm min-h-[125px] sm:min-h-[135px] ${
    full ? "border-ember/35" : "border-hairline"
  }`;

  if (href) {
    return (
      <Link href={href} className={cardClasses}>
        {inner}
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
      {inner}
    </button>
  );
}

/**
 * The hero headline module tile.
 */
export function StudioTileBig({
  mod,
  title,
  body,
  cost,
  badge = "Paling Populer & Cepat",
  ctaText = "Kasih 3 Ide Sekarang →",
  primary = false,
}: {
  mod: Mod;
  title: string;
  body: string;
  cost: number;
  badge?: string;
  ctaText?: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`surface-card relative overflow-hidden rounded-2xl border p-4 sm:p-5 text-left transition-all duration-[var(--duration-standard)] ease-heat ${
        primary ? "border-ember/50 shadow-md bg-gradient-to-br from-surface via-surface to-ember/5" : "border-hairline"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="eyebrow text-ember flex items-center gap-1.5 font-bold">
          <span className="size-2 rounded-full bg-ember animate-pulse" />
          {badge}
        </span>
        <span className="rounded-full bg-ember/15 px-2.5 py-0.5 font-mono text-xs font-bold text-ember border border-ember/30">
          {cost} kredit
        </span>
      </div>

      <h2 className="mt-2 font-display text-lg font-bold tracking-display-sm text-ink sm:text-xl">
        {title}
      </h2>
      <p className="mt-1 text-xs sm:text-sm leading-relaxed text-muted">{body}</p>

      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: mod }))
        }
        className="btn-ember mt-3.5 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 font-display text-sm font-bold text-obsidian shadow-sm transition-transform active:scale-[0.99] hover:brightness-105"
      >
        {ctaText}
      </button>
    </div>
  );
}


