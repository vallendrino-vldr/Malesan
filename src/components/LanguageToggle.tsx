"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Pilih Bahasa / Language Selection"
      className={`inline-flex h-8 sm:h-9 shrink-0 items-center rounded-full border border-hairline/80 bg-surface/60 p-0.5 shadow-xs select-none transition-all hover:border-white/20 ${className}`}
    >
      <button
        type="button"
        onClick={() => setLanguage("id")}
        aria-pressed={language === "id"}
        aria-label="Bahasa Indonesia"
        className={`flex h-full items-center justify-center rounded-full px-2 sm:px-2.5 text-[11px] sm:text-xs font-bold transition-all duration-200 cursor-pointer ${
          language === "id"
            ? "bg-ember text-obsidian shadow-xs scale-100"
            : "text-muted hover:text-ink hover:bg-white/[0.04]"
        }`}
      >
        ID
      </button>

      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        aria-label="English"
        className={`flex h-full items-center justify-center rounded-full px-2 sm:px-2.5 text-[11px] sm:text-xs font-bold transition-all duration-200 cursor-pointer ${
          language === "en"
            ? "bg-ember text-obsidian shadow-xs scale-100"
            : "text-muted hover:text-ink hover:bg-white/[0.04]"
        }`}
      >
        EN
      </button>
    </div>
  );
}
