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
 * 1. HERO ACTION: The Single Most Obvious 1-Click Creative Task
 */
export function StudioHero({
  mod = "ide",
  cost,
}: {
  mod?: Mod;
  cost: number;
}) {
  return (
    <div className="surface-card relative overflow-hidden rounded-2xl border border-ember/45 bg-gradient-to-br from-surface via-surface to-ember/10 p-5 sm:p-6 text-left shadow-sm transition-all duration-[var(--duration-standard)] ease-heat">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/15 px-3 py-1 text-micro font-bold text-ember border border-ember/30">
          <span className="size-2 rounded-full bg-ember animate-pulse" />
          ⚡ 1-Click Instan
        </span>
        <span className="rounded-full bg-surface-raised px-3 py-1 font-mono text-xs font-bold text-ember border border-hairline">
          {cost} kredit
        </span>
      </div>

      <div className="mt-3">
        <h2 className="font-display text-xl font-bold tracking-display-sm text-ink sm:text-2xl">
          Kasih 3 Ide Konten Hari Ini
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-muted">
          Gak perlu mikir prompt apa pun. Langsung dapet 3 ide segar siap posting lengkap dengan hook &amp; naskah video.
        </p>
      </div>

      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: mod }))
        }
        className="btn-ember mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 font-display text-sm sm:text-base font-bold text-obsidian shadow-sm transition-transform active:scale-[0.99] hover:brightness-105"
      >
        Bikin 3 Ide Sekarang →
      </button>
    </div>
  );
}

/**
 * 2. QUICK ACTION CARD: Top 3 Creator Essentials with Generous Breathing Room
 */
export function StudioQuickCard({
  mod,
  href,
  title,
  body,
  cost,
  icon,
  badge,
}: {
  mod?: Mod;
  href?: string;
  title: string;
  body: string;
  cost: number | string;
  icon: ReactNode;
  badge?: string;
}) {
  const content = (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <span className="grid size-11 sm:size-12 shrink-0 place-items-center rounded-xl bg-surface-raised border border-hairline text-ember shadow-xs group-hover:bg-ember/15 group-hover:border-ember/40 transition-colors">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm sm:text-base font-bold text-ink group-hover:text-ember transition-colors truncate">
              {title}
            </span>
            {badge && (
              <span className="rounded px-1.5 py-0.2 text-[10px] font-semibold bg-ember/15 text-ember border border-ember/20">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted leading-relaxed line-clamp-1 sm:line-clamp-2">
            {body}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-lg bg-surface-raised px-2.5 py-1 font-mono text-micro font-bold text-ember border border-hairline whitespace-nowrap">
          {typeof cost === "number" ? `${cost} kredit` : cost}
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-4 shrink-0 fill-muted transition-colors group-hover:fill-ember hidden sm:block"
        >
          <path d="M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6-1.4-1.4Z" />
        </svg>
      </div>
    </div>
  );

  const cardClass =
    "surface-card surface-card-interactive group w-full rounded-2xl border border-hairline p-4 sm:p-5 text-left transition-all duration-[var(--duration-standard)] ease-heat hover:border-ember/45 hover:shadow-sm";

  if (href) {
    return (
      <Link href={href} className={cardClass}>
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
      className={cardClass}
    >
      {content}
    </button>
  );
}

/**
 * 3. PROGRESSIVE DISCLOSURE: Expandable Specialized Creative Tools
 */
export function StudioMoreTools({
  children,
  count = 5,
}: {
  children: ReactNode;
  count?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3 pt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full min-h-12 items-center justify-between rounded-2xl border border-dashed border-hairline bg-surface/60 px-4 sm:px-5 py-3 text-xs font-semibold text-muted transition-all hover:border-ember/40 hover:bg-surface hover:text-ink shadow-xs"
      >
        <span className="flex items-center gap-2">
          <span>🛠️</span>
          <span>{open ? "Sembunyikan alat lainnya" : `Lihat ${count} alat kreatif lainnya`}</span>
        </span>
        <span className="font-mono text-micro text-ember font-bold">
          {open ? "Tutup ▴" : "Buka ▾"}
        </span>
      </button>

      {open && (
        <div className="reveal grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Tile helper for the secondary expanded drawer
 */
export function StudioTile({
  mod,
  href,
  title,
  body,
  cost,
  icon,
  badge,
}: {
  mod?: Mod;
  href?: string;
  title: string;
  body?: string;
  cost: number | string;
  icon?: ReactNode;
  badge?: string;
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
          <p className="mt-2 text-micro leading-relaxed text-muted line-clamp-2">
            {body}
          </p>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-end">
        <span className="text-[11px] font-semibold text-muted/80 group-hover:text-ember flex items-center gap-1 transition-colors">
          Buka <span>→</span>
        </span>
      </div>
    </div>
  );

  const cardClasses =
    "surface-card surface-card-interactive group relative flex w-full flex-col justify-between rounded-2xl border border-hairline p-3.5 text-left transition-all duration-[var(--duration-standard)] ease-heat hover:border-ember/45 hover:shadow-xs min-h-[110px]";

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


