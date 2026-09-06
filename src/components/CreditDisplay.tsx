"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function CreditDisplay({ credits }: { credits: number }) {
  const { t } = useLanguage();

  return (
    <Link
      href="/app/topup"
      title={t("header.credits", "Beli atau kelola kredit")}
      className="flex h-8 sm:h-9 shrink-0 items-center gap-1.5 sm:gap-2 rounded-full border border-hairline/80 bg-surface/60 px-2.5 sm:px-3.5 shadow-xs transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised"
    >
      <span className="size-2 rounded-full bg-ember animate-pulse" />
      <span className="tabular font-mono text-xs sm:text-sm font-bold text-ink">{credits}</span>
      <span className="hidden text-micro font-medium text-muted sm:inline">{t("header.credits", "kredit")}</span>
    </Link>
  );
}
