"use client";

import { useSyncExternalStore } from "react";
import { TEXT_KEY as KEY } from "@/lib/boot-scripts";

/**
 * Lets the reader pick a comfortable text size.
 *
 * Browser zoom already exists, but it scales the whole layout — on a phone that
 * pushes the fixed bottom tab bar off screen and turns a working app into a
 * broken one. This moves type only: chrome, tap targets and spacing stay put.
 *
 * It works by setting the root font-size, and every size in the product is
 * written in rem, so one value moves the entire scale coherently rather than
 * needing a parallel set of type tokens.
 *
 * Four steps rather than a slider. A slider invites fiddling and produces
 * half-pixel sizes that render badly; four named steps are a decision someone
 * makes once.
 */

type Scale = "sm" | "md" | "lg" | "xl";
const STEPS: { id: Scale; label: string; hint: string }[] = [
  { id: "sm", label: "Kecil", hint: "Muat lebih banyak" },
  { id: "md", label: "Normal", hint: "Bawaan" },
  { id: "lg", label: "Besar", hint: "Lebih enak dibaca" },
  { id: "xl", label: "Gede", hint: "Paling jelas" },
];

const TEXT_EVENT = "malesan:text-change";
const subscribe = (notify: () => void) => {
  window.addEventListener(TEXT_EVENT, notify);
  return () => window.removeEventListener(TEXT_EVENT, notify);
};
const currentScale = (): Scale => {
  const current = document.documentElement.getAttribute("data-text") as Scale | null;
  return current && STEPS.some((step) => step.id === current) ? current : "md";
};

export function TextScale() {
  const scale = useSyncExternalStore(subscribe, currentScale, () => "md");

  const pick = (next: Scale) => {
    // "md" is the default, so it clears the attribute rather than writing one.
    // Keeps the DOM honest about what is actually overridden.
    if (next === "md") document.documentElement.removeAttribute("data-text");
    else document.documentElement.setAttribute("data-text", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private browsing refuses storage; the choice still applies this session.
    }
    window.dispatchEvent(new Event(TEXT_EVENT));
  };

  return (
    <div>
      <p className="text-sm font-semibold text-ink">Ukuran teks</p>
      <p className="mt-0.5 text-micro leading-relaxed text-muted">
        Cuma tulisannya yang berubah — tombol dan menu tetap di tempatnya.
      </p>
      <div
        role="radiogroup"
        aria-label="Ukuran teks"
        className="mt-2.5 grid grid-cols-4 gap-1.5"
      >
        {STEPS.map((s) => {
          const on = scale === s.id;
          return (
            <button
              key={s.id}
              role="radio"
              aria-checked={on}
              onClick={() => pick(s.id)}
              title={s.hint}
              className={`skeu-press flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl border transition-colors duration-[var(--duration-standard)] ease-heat ${
                on
                  ? "border-ember/45 bg-ember/10 text-ember"
                  : "border-hairline bg-surface-raised text-muted hover:text-ink"
              }`}
            >
              {/* The glyph previews the size it selects, so the control
                  demonstrates its own effect before you commit to it. */}
              <span
                aria-hidden="true"
                className="font-display font-bold leading-none"
                style={{ fontSize: { sm: 11, md: 13, lg: 15, xl: 17 }[s.id] }}
              >
                A
              </span>
              <span className="mt-1 text-micro font-semibold leading-none">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
