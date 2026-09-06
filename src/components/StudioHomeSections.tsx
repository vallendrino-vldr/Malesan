"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function StudioGreeting({
  displayName,
  isDemoMode = false,
}: {
  displayName?: string | null;
  isDemoMode?: boolean;
}) {
  const { language, dict } = useLanguage();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const heroDict = dict.studio?.hero;

    if (language === "en") {
      let timeGreet = "GOOD MORNING";
      if (h < 4) timeGreet = "UP LATE";
      else if (h < 12) timeGreet = heroDict?.greetingPagi || "GOOD MORNING";
      else if (h < 18) timeGreet = heroDict?.greetingSiang || "GOOD AFTERNOON";
      else timeGreet = heroDict?.greetingMalam || "GOOD EVENING";

      const targetName = isDemoMode
        ? heroDict?.greetingDemo || "CREATOR"
        : displayName?.split(" ")[0]?.toUpperCase() || heroDict?.greetingDemo || "CREATOR";

      return {
        eyebrow: `${timeGreet}, ${targetName}`,
        title: heroDict?.title || "What are you creating today?",
        subtitle: heroDict?.subtitle || "Pick the fastest workflow. Zero prompt engineering required.",
      };
    }

    // Default: Indonesian
    let timeGreet = "PAGI";
    if (h < 4) timeGreet = "BELUM TIDUR";
    else if (h < 11) timeGreet = heroDict?.greetingPagi || "PAGI";
    else if (h < 15) timeGreet = heroDict?.greetingSiang || "SIANG";
    else if (h < 18) timeGreet = heroDict?.greetingSore || "SORE";
    else timeGreet = heroDict?.greetingMalam || "MALAM";

    const targetName = isDemoMode
      ? heroDict?.greetingDemo || "KREATOR"
      : displayName?.split(" ")[0]?.toUpperCase() || heroDict?.greetingDemo || "KREATOR";

    return {
      eyebrow: `${timeGreet}, ${targetName}`,
      title: heroDict?.title || "Mau bikin konten apa hari ini?",
      subtitle: heroDict?.subtitle || "Pilih cara paling cepat. Tanpa mikir prompt rumit.",
    };
  }, [language, dict, displayName, isDemoMode]);

  return (
    <div className="min-w-0">
      <p className="eyebrow text-ember font-bold tracking-wider">
        {greeting.eyebrow}
      </p>
      <h1 className="mt-0.5 font-display text-xl sm:text-2xl font-bold tracking-display-sm text-ink leading-tight">
        {greeting.title}
      </h1>
      <p className="mt-1 text-micro sm:text-xs text-muted leading-relaxed">
        {greeting.subtitle}
      </p>
    </div>
  );
}

export function StudioToolsHeader({ count = 11 }: { count?: number }) {
  const { language, dict } = useLanguage();

  const title = dict.studio?.toolsHeader?.title || (language === "en" ? "ALL CREATIVE TOOLS" : "SEMUA ALAT KREATIF");
  const subtitle = dict.studio?.toolsHeader?.subtitle || (language === "en" ? `${count} tools ready to use` : `${count} fitur siap pakai`);

  return (
    <div className="flex items-center justify-between px-0.5">
      <h2 className="eyebrow text-muted font-bold">{title}</h2>
      <span className="text-micro font-mono text-muted">{subtitle}</span>
    </div>
  );
}

export function StudioDraftTile() {
  const { language, dict } = useLanguage();

  const title = dict.studio?.draft?.title || (language === "en" ? "Freeform Draft" : "Draf Bebas");
  const subtitle = dict.studio?.draft?.subtitle || (language === "en" ? "Writing & AI Tab" : "Nulis & AI Tab");
  const badge = dict.studio?.draft?.badge || (language === "en" ? "Free" : "Gratis");

  return (
    <Link
      href="/app/draft"
      className="surface-card surface-card-interactive group relative flex w-full flex-col justify-between rounded-xl sm:rounded-2xl border border-hairline p-3 sm:p-3.5 lg:p-4 text-left transition-all duration-[var(--duration-standard)] ease-heat hover:border-ember/45 hover:shadow-xs min-h-[84px] sm:min-h-[92px]"
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-lg bg-surface-raised border border-hairline text-ember shadow-xs transition-colors group-hover:bg-ember/15 group-hover:border-ember/40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </span>
          <span className="shrink-0 font-mono text-[10px] sm:text-[11px] font-semibold text-muted bg-surface-raised px-2 py-0.5 rounded-md border border-hairline">
            {badge}
          </span>
        </div>

        <div className="mt-2 min-w-0">
          <span className="block font-display text-xs sm:text-sm font-bold leading-tight text-ink group-hover:text-ember truncate">
            {title}
          </span>
          <span className="block mt-0.5 text-[11px] sm:text-xs text-muted truncate">
            {subtitle}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function StudioValueStrip() {
  const { language, dict } = useLanguage();

  const items = dict.studio?.valueStrip || (
    language === "en"
      ? [
          { k: "RELEVANT", v: "Matches your unique persona voice" },
          { k: "FRESH", v: "Tapped into today's creator trends" },
          { k: "READY", v: "Production-ready content in seconds" },
        ]
      : [
          { k: "NYAMBUNG", v: "Ngikutin gaya persona lo" },
          { k: "UPDATE", v: "Tau tren kreator hari ini" },
          { k: "PRAKTIS", v: "Langsung jadi konten siap pake" },
        ]
  );

  return (
    <div className="rounded-2xl border border-hairline/70 bg-surface/60 backdrop-blur-xs p-3.5 sm:p-4 shadow-xs">
      <ul className="grid grid-cols-3 divide-x divide-hairline/60">
        {items.map((x) => (
          <li
            key={x.k}
            className="flex flex-col items-center justify-center text-center px-1.5 sm:px-3 min-w-0 first:pl-0 last:pr-0"
          >
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
  );
}
