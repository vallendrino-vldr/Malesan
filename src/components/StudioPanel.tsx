"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IdeHariIni } from "./IdeHariIni";
import { IdeaEngine } from "./IdeaEngine";
import { ModuleRunner } from "./ModuleRunner";
import { ClipEngine } from "./ClipEngine";
import { ThreadEngine } from "./ThreadEngine";

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

type Mod = "ide" | "idea" | "hook" | "script" | "repurpose" | "clip" | "thread";
const MODS: Mod[] = ["ide", "idea", "hook", "script", "repurpose", "clip", "thread"];

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

  if (!mod)
    return (
      <>
        {home}
        {/* The two niche engines, appended here rather than in the dashboard's
            server pass because that file belongs to another change in flight.
            Move these into the tile grid in app/page.tsx when it next opens —
            and delete this block then, or the Studio grows two of each. */}
        <div className="reveal relative z-10 mt-4 grid grid-cols-2 gap-2">
          <StudioTile mod="clip" title="Clip Engine" cost={clipCost} />
          <StudioTile mod="thread" title="Thread Engine" cost={threadCost} />
        </div>
      </>
    );

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
        <IdeHariIni />
      ) : mod === "idea" ? (
        <IdeaEngine />
      ) : mod === "clip" ? (
        <ClipEngine cost={clipCost} />
      ) : mod === "thread" ? (
        <ThreadEngine cost={threadCost} />
      ) : (
        <ModuleRunner moduleKey={mod} cost={costs[mod]} credits={credits} />
      )}
    </div>
  );
}

/**
 * A module tile.
 *
 * Renders as a button rather than a link because there is no navigation left to
 * make — the module is already loaded. That also removes the "tapped twice"
 * failure mode at its source: there is no pending state to sit through, because
 * there is no request.
 */
export function StudioTile({
  mod,
  title,
  cost,
}: {
  mod: Mod;
  title: string;
  cost: number;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: mod }))
      }
      className="skeu skeu-press group flex min-h-[68px] w-full cursor-pointer flex-col justify-center rounded-xl border border-hairline bg-surface-raised px-3 py-3 text-center transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/45"
    >
      <span className="flex items-center justify-center gap-1">
        <span className="truncate text-mini font-bold text-ink group-hover:text-ember-lo">
          {title}
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-3 shrink-0 fill-muted transition-colors group-hover:fill-ember"
        >
          <path d="M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6-1.4-1.4Z" />
        </svg>
      </span>
      <span className="mt-1 block font-mono text-micro text-ember-lo">{cost} kredit</span>
    </button>
  );
}

/**
 * The two headline modules. Same dispatch, more room to explain themselves.
 */
export function StudioTileBig({
  mod,
  title,
  body,
  cost,
  primary = false,
}: {
  mod: Mod;
  title: string;
  body: string;
  cost: number;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: mod }))
      }
      className={`surface-card surface-card-interactive group flex w-full cursor-pointer items-center gap-4 rounded-2xl border p-4 text-left ${
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
        <span className="block font-display text-[1rem] font-bold tracking-display-sm text-ink">
          {title}
        </span>
        <span className="mt-0.5 block text-mini leading-relaxed text-muted">{body}</span>
      </span>
      <span className="shrink-0 font-mono text-micro text-ember-lo">{cost} kredit</span>
    </button>
  );
}
