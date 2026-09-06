"use client";

import React, { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react";
import { type Language, type TranslationDictionary } from "./types";
import { TRANSLATIONS } from "./translations";
import { haptic } from "@/lib/haptics";
import { createClient } from "@/lib/supabase/client";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (path: string, fallback?: string) => string;
  dict: TranslationDictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "malesan-lang";

function getInitialLanguage(fallback: Language): Language {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "id") return saved;
      const htmlLang = document.documentElement.lang;
      if (htmlLang === "en" || htmlLang === "id") return htmlLang as Language;
    } catch {}
  }
  return fallback;
}

export function LanguageProvider({
  children,
  initialLanguage = "id",
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguageState] = useState<Language>(() => getInitialLanguage(initialLanguage));

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState((prev) => {
      if (prev === newLang) return prev;
      haptic.selection();

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, newLang);
          document.cookie = `${STORAGE_KEY}=${newLang}; path=/; max-age=31536000; SameSite=Lax`;
          document.documentElement.lang = newLang;
        } catch {}

        // Optional background sync to creator_dna if logged in
        void (async () => {
          try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase
                .from("creator_dna")
                .update({ output_language: newLang })
                .eq("user_id", user.id);
            }
          } catch {
            // Non-critical background sync
          }
        })();
      }

      return newLang;
    });
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next = prev === "id" ? "en" : "id";
      haptic.selection();
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, next);
          document.cookie = `${STORAGE_KEY}=${next}; path=/; max-age=31536000; SameSite=Lax`;
          document.documentElement.lang = next;
        } catch {}
      }
      return next;
    });
  }, []);

  const dict = useMemo(() => TRANSLATIONS[language] ?? TRANSLATIONS.id, [language]);

  const t = useCallback(
    (path: string, fallback?: string): string => {
      const keys = path.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let curr: any = dict;
      for (const key of keys) {
        if (curr && typeof curr === "object" && key in curr) {
          curr = curr[key];
        } else {
          return fallback ?? path;
        }
      }
      return typeof curr === "string" ? curr : (fallback ?? path);
    },
    [dict]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
      dict,
    }),
    [language, setLanguage, toggleLanguage, t, dict]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: "id",
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (p, fb) => fb ?? p,
      dict: TRANSLATIONS.id,
    };
  }
  return ctx;
}
