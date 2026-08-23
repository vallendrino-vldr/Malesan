"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Logo } from "./Logo";
import { AmbientField } from "./AmbientField";
import { CreditDisplay } from "./CreditDisplay";
import { RefreshButton } from "./RefreshButton";
import { ThemeToggle } from "./ThemeToggle";
import { TutorialSheet } from "./TutorialSheet";

/**
 * Native-app shell.
 *
 * The page itself never scrolls — `h-[100dvh]` with `overflow-hidden`, a fixed
 * header, a single scroll container in the middle, and a bottom tab bar. That
 * is what makes a web app stop feeling like a web page on a phone: the chrome
 * stays put and only content moves, exactly like a native app.
 *
 * 100dvh rather than 100vh on purpose. On mobile Safari and Chrome, 100vh is
 * the viewport with the URL bar *hidden*, so a 100vh layout is taller than the
 * visible area on first paint and the bottom bar sits below the fold — the
 * single most common reason a mobile web app feels broken.
 *
 * `pb-[env(safe-area-inset-bottom)]` keeps the tab bar clear of the iPhone home
 * indicator; without it the last row of buttons is half-swallowed.
 */

export type TabKey = "studio" | "vibe" | "pipeline" | "profil";

const TABS: { key: TabKey; label: string; icon: ReactNode }[] = [
  {
    key: "studio",
    label: "Studio",
    icon: (
      <path d="M12 3 4 8v8l8 5 8-5V8l-8-5Zm0 2.3L18 9v6l-6 3.7L6 15V9l6-3.7Z" />
    ),
  },
  {
    key: "vibe",
    label: "Bikin App",
    icon: (
      <path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4Zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4Z" />
    ),
  },
  {
    key: "pipeline",
    label: "Alur",
    icon: (
      <path d="M4 5h6v14H4V5Zm10 0h6v9h-6V5ZM6 7v10h2V7H6Zm10 0v5h2V7h-2Z" />
    ),
  },
  {
    key: "profil",
    label: "Profil",
    icon: (
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-8 2-8 4.5V21h16v-2.5C20 16 16 14 12 14Z" />
    ),
  },
];

/**
 * Tabs switch in the browser, not on the server.
 *
 * Each tab used to be `<Link href="/app?tab=...">` — a full RSC navigation per
 * tap. On the deployed setup that meant the middleware's `auth.getUser()`, the
 * page's `auth.getUser()`, and the profile read all crossing from the Vercel
 * function to a Supabase project in ap-southeast-1, in sequence, before
 * anything could render. Three trans-Pacific round trips plus a possible cold
 * start is the 5-second tab change.
 *
 * All four panels are rendered once by the server and swapped here with state.
 * Switching costs no network at all. The URL is kept in sync with
 * `history.replaceState` so refresh and deep links still land on the right tab
 * without triggering a navigation.
 *
 * `panels` rather than `children`: passing server-rendered nodes as props into
 * a client component is the standard slot pattern and keeps every panel a
 * server component — none of this ships their data-fetching to the browser.
 */
export function AppShell({
  active,
  credits,
  isAdmin,
  pendingTopups = 0,
  avatarUrl,
  initial,
  panels,
  railLeft,
  railRight,
  children,
}: {
  active: TabKey;
  credits: number;
  isAdmin: boolean;
  /**
   * Top-ups waiting for review. A payment that arrives while the owner is using
   * the product normally was invisible until they thought to open the admin
   * panel — so the badge has to live out here, not only in there.
   */
  pendingTopups?: number;
  avatarUrl?: string | null;
  initial: string;
  /** One node per tab. Omit to render `children` instead (module sub-views). */
  panels?: Partial<Record<TabKey, ReactNode>>;
  /**
   * Magazine rails. Absent by default, and absence is the point: an unrendered
   * grid area contributes no width, so the layout collapses to the plain
   * header/main/footer stack rather than reserving an empty column.
   *
   * Desktop only. The shell is pinned to 100dvh with `main` as the sole
   * scrolling region, so below `lg` a stacked rail does not flow below the fold
   * — it takes its height out of `main`. See the note in globals.css.
   */
  railLeft?: ReactNode;
  railRight?: ReactNode;
  children?: ReactNode;
}) {
  const [current, setCurrent] = useState<TabKey>(active);

  // A module sub-view (?m=hook) owns the whole content area, so tab state does
  // not apply — fall back to server-driven navigation for those.
  const clientTabs = Boolean(panels);
  const shown = clientTabs ? current : active;

  const go = (key: TabKey) => {
    setCurrent(key);
    // replaceState, not pushState: the tab bar is not history. Back should
    // leave the app, the way it does in a native shell.
    window.history.replaceState(null, "", key === "studio" ? "/app" : `/app?tab=${key}`);
  };

  return (
    <div className="magazine relative w-full bg-obsidian">
      {/* Warm drifting glow behind the whole app, at the shell level so it fills
          the black margins around every page's content instead of being trapped
          inside one column. `relative` on this root makes the field's `inset:0`
          resolve to the shell box; the chrome bars and `main` carry a z-index so
          they paint above it, and it is `pointer-events-none` so it never eats a
          tap. This is the layer that makes the product read as alive at rest. */}
      <AmbientField />

      {/* ---------- header ---------- */}
      {/* `backdrop-blur-xl` used to sit here and on the tab bar. Nothing ever
          renders behind either of them — `main` is a sibling with its own
          scroll box, so content scrolls *inside* main, never under the chrome.
          The filter was blurring the solid page background: a full-width
          compositing layer repainted on every scroll frame for no visible
          effect. `/85` over the same colour was likewise indistinguishable from
          solid. Both are gone; the bars look identical. */}
      <header className="area-header relative z-20 border-b border-hairline/70 bg-obsidian">
        <div className="mx-auto flex h-16 lg:h-[76px] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo & Brand Identity */}
          <Link
            href="/app"
            aria-label="Malesan"
            className="flex shrink-0 items-center overflow-visible transition-opacity hover:opacity-95"
          >
            <Logo markClass="h-[36px] sm:h-[40px] lg:h-[48px]" />
          </Link>

          {/* Right utility & user cluster */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <div className="hidden items-center gap-2 sm:flex">
              <RefreshButton variant="icon" />
              <ThemeToggle />
              <TutorialSheet />
            </div>

            {isAdmin && (
              <Link
                href={pendingTopups > 0 ? "/admin/topups" : "/admin"}
                aria-label={
                  pendingTopups > 0
                    ? `Panel admin — ${pendingTopups} topup nunggu di-approve`
                    : "Panel admin"
                }
                className={`relative flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors duration-[var(--duration-standard)] ease-heat ${
                  pendingTopups > 0
                    ? "border-ember bg-ember text-obsidian hover:bg-ember-lo"
                    : "border-ember/30 bg-surface/50 text-ember hover:border-ember hover:bg-surface-raised"
                }`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
                  <path d="M12 2 4 5.5v5.9c0 4.6 3.2 8.4 8 10.6 4.8-2.2 8-6 8-10.6V5.5L12 2Zm0 2.2 6 2.6v4.6c0 3.6-2.4 6.6-6 8.4-3.6-1.8-6-4.8-6-8.4V6.8l6-2.6Z" />
                </svg>
                <span className="eyebrow hidden sm:inline">
                  {pendingTopups > 0 ? `${pendingTopups} topup` : "Admin"}
                </span>
                {pendingTopups > 0 && (
                  <span
                    aria-hidden="true"
                    className="grid min-w-[18px] place-items-center rounded-full bg-obsidian px-1 font-mono text-micro font-bold leading-[18px] text-ember sm:hidden"
                  >
                    {pendingTopups > 9 ? "9+" : pendingTopups}
                  </span>
                )}
              </Link>
            )}

            <CreditDisplay credits={credits} />

            <Link
              href="/app?tab=profil"
              aria-label="Profil"
              className="flex h-10 w-10 shrink-0 items-center justify-center"
            >
              <span className="block size-9 overflow-hidden rounded-full border border-hairline/80 bg-surface transition-transform hover:scale-105 shadow-xs">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <span className="grid size-full place-items-center font-display text-xs font-bold text-muted">
                  {initial}
                </span>
              )}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile utility strip */}
      <div className="area-nav relative z-20 flex items-center justify-between gap-2 border-b border-hairline/60 bg-obsidian px-4 py-2 sm:hidden">
        <ThemeToggle variant="chip" />
        <TutorialSheet variant="chip" />
        <RefreshButton variant="chip" />
      </div>

      {/* Content scroll area */}
      <main className="area-main relative z-10">
        <div
          className={`mx-auto w-full px-4 py-4 sm:py-6 sm:px-6 ${
            shown === "pipeline" ? "max-w-[1600px]" : "max-w-6xl"
          }`}
        >
          {/* Inactive panels stay mounted but hidden. Re-rendering them on every
              switch would throw away scroll position and any in-progress form
              state — the thing that makes a web app feel unlike a native one. */}
          {clientTabs
            ? TABS.map((t) => (
                <div key={t.key} hidden={t.key !== shown}>
                  {panels?.[t.key]}
                </div>
              ))
            : children}
        </div>
      </main>

      {/* ---------- magazine rails ----------
          Nothing renders unless a rail is passed, so the grid tracks stay
          collapsed and the shell is byte-for-byte the old stack until one is. */}
      {railLeft && (
        <aside className="area-left border-r border-hairline/60 px-4 py-4">{railLeft}</aside>
      )}
      {railRight && (
        <aside className="area-right border-l border-hairline/60 px-4 py-4">{railRight}</aside>
      )}

      {/* ---------- bottom tab bar ---------- */}
      <nav
        aria-label="Navigasi utama"
        className="area-footer relative z-20 skeu-bar border-t border-hairline/70 bg-obsidian pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex w-full max-w-3xl">
          {TABS.map((t) => {
            const on = t.key === shown;
            const inner = (
              <>
                {/* The active tab is lit from above — the same heat language as
                    the rest of the product, rather than a generic underline. */}
                {on && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-4 top-0 h-px bg-ember shadow-[0_0_12px_2px_color-mix(in_oklab,var(--color-ember)_60%,transparent)]"
                  />
                )}
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className={`size-[21px] transition-colors duration-[var(--duration-standard)] ease-heat ${
                    on ? "fill-ember" : "fill-muted group-hover:fill-ink"
                  }`}
                >
                  {t.icon}
                </svg>
                <span
                  className={`text-micro font-semibold leading-none transition-colors duration-[var(--duration-standard)] ease-heat ${
                    on ? "text-ember" : "text-muted group-hover:text-ink"
                  }`}
                >
                  {t.label}
                </span>
              </>
            );

            const cls =
              "group relative flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5";

            // A button when tabs switch in the browser; a real link when they
            // drive a navigation. A link that does not navigate breaks
            // middle-click and "open in new tab" for no benefit.
            return clientTabs ? (
              <button
                key={t.key}
                type="button"
                onClick={() => go(t.key)}
                aria-current={on ? "page" : undefined}
                className={cls}
              >
                {inner}
              </button>
            ) : (
              <Link
                key={t.key}
                href={`/app?tab=${t.key}`}
                aria-current={on ? "page" : undefined}
                className={cls}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
