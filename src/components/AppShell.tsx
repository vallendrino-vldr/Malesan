"use client";

import Link from "next/link";
import { useState, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { getNativeShell } from "@/lib/native/bridge";
import { Logo } from "./Logo";
import { AmbientField } from "./AmbientField";
import { CreditDisplay } from "./CreditDisplay";
import { RefreshButton } from "./RefreshButton";
import { TutorialSheet } from "./TutorialSheet";
import { CommandOmnibar } from "./CommandOmnibar";
import { GlobalStudioProcessingOverlay } from "./studio/AIProcessingOverlay";
import { InstallAppModal } from "./InstallAppModal";

const emptySubscribe = () => () => {};
const getIsStandaloneSnapshot = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
};

export type TabKey = "studio" | "vibe" | "pipeline" | "profil";
const VALID_TABS: TabKey[] = ["studio", "vibe", "pipeline", "profil"];

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
    label: "Ngoding",
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
  pendingTopups?: number;
  avatarUrl?: string | null;
  initial: string;
  panels?: Partial<Record<TabKey, ReactNode>>;
  railLeft?: ReactNode;
  railRight?: ReactNode;
  children?: ReactNode;
}) {
  const [current, setCurrent] = useState<TabKey>(active);
  const [isOmnibarOpen, setIsOmnibarOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isNativeApk, setIsNativeApk] = useState(false);

  const browserStandalone = useSyncExternalStore(emptySubscribe, getIsStandaloneSnapshot, () => false);
  const isStandalone = browserStandalone || isNativeApk;

  useEffect(() => {
    let active = true;
    void getNativeShell().then((shell) => {
      if (active) setIsNativeApk(Boolean(shell));
    });
    return () => {
      active = false;
    };
  }, []);

  // A module sub-view (?m=hook) owns the whole content area, so tab state does
  // not apply — fall back to server-driven navigation for those.
  const clientTabs = Boolean(panels);
  const shown = clientTabs ? current : active;

  const go = (key: TabKey) => {
    setCurrent(key);
    // Instant tab switch with URL synchronization without triggering a full page navigation
    window.history.replaceState(null, "", key === "studio" ? "/app" : `/app?tab=${key}`);
    window.dispatchEvent(new CustomEvent("malesan:switch-tab", { detail: key }));
  };

  // Sync state with popstate and custom tab switch events
  useEffect(() => {
    const handleSwitch = (e: Event) => {
      const next = (e as CustomEvent<TabKey>).detail;
      if (VALID_TABS.includes(next)) {
        setCurrent(next);
        window.history.replaceState(null, "", next === "studio" ? "/app" : `/app?tab=${next}`);
      }
    };

    const handlePopState = () => {
      const url = new URL(window.location.href);
      const tabParam = url.searchParams.get("tab") as TabKey;
      if (tabParam && VALID_TABS.includes(tabParam)) {
        setCurrent(tabParam);
      } else {
        setCurrent("studio");
      }
    };

    window.addEventListener("malesan:switch-tab", handleSwitch);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("malesan:switch-tab", handleSwitch);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Global shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOmnibarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="magazine relative w-full bg-obsidian">
      {/* Warm drifting glow behind the whole app */}
      <AmbientField />

      {/* ---------- header ---------- */}
      <header className="area-header relative z-20 border-b border-hairline/70 bg-obsidian">
        <div className="mx-auto flex h-16 lg:h-[76px] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo & Brand Identity (Instant Client Tab or Prefetched Link) */}
          {clientTabs ? (
            <button
              type="button"
              onClick={() => go("studio")}
              aria-label="Malesan"
              className="flex h-11 sm:h-auto shrink-0 items-center overflow-visible transition-opacity hover:opacity-95 cursor-pointer"
            >
              <Logo markClass="h-[36px] sm:h-[40px] lg:h-[48px]" />
            </button>
          ) : (
            <Link
              href="/app"
              prefetch={true}
              aria-label="Malesan"
              className="flex shrink-0 items-center overflow-visible transition-opacity hover:opacity-95"
            >
              <Logo markClass="h-[36px] sm:h-[40px] lg:h-[48px]" />
            </Link>
          )}

          {/* Center/Right Omnibar search trigger */}
          <button
            type="button"
            onClick={() => setIsOmnibarOpen(true)}
            aria-label="Buka Command Omnibar (Cmd+K)"
            className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-muted hover:border-ember/40 hover:bg-ember/10 hover:text-ink transition-all cursor-pointer shadow-xs"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
            <span className="font-medium">Cari alat & perintah...</span>
            <kbd className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-muted">
              ⌘K
            </kbd>
          </button>

          {/* Right utility & user cluster */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            {isNativeApk ? (
              <div
                title="Malesan Native APK Engine Aktif"
                className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 sm:px-3 text-xs font-bold text-amber-400 shadow-xs"
              >
                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>APK Pro</span>
              </div>
            ) : !isStandalone ? (
              <button
                type="button"
                onClick={() => setIsInstallModalOpen(true)}
                aria-label="Pasang aplikasi Malesan di HP"
                className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 sm:px-3 text-xs font-semibold text-muted hover:border-ember/40 hover:bg-ember/10 hover:text-ink transition-all cursor-pointer shadow-xs"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
                  <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
                <span className="hidden sm:inline">Pasang App</span>
                <span className="sm:hidden">App</span>
              </button>
            ) : null}

            <div className="hidden items-center gap-2 sm:flex">
              <RefreshButton variant="icon" />
              <TutorialSheet />
            </div>

            {isAdmin && (
              <Link
                href={pendingTopups > 0 ? "/admin/topups" : "/admin"}
                prefetch={true}
                aria-label={
                  pendingTopups > 0
                    ? `Panel admin — ${pendingTopups} topup nunggu di-approve`
                    : "Panel admin"
                }
                className={`relative flex h-11 sm:h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors duration-[var(--duration-standard)] ease-heat ${
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

            {/* Avatar Profile Trigger (Instant Client Tab or Prefetched Link) */}
            {clientTabs ? (
              <button
                type="button"
                onClick={() => go("profil")}
                aria-label="Profil"
                className="flex h-11 w-11 sm:h-10 sm:w-10 shrink-0 items-center justify-center cursor-pointer"
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
              </button>
            ) : (
              <Link
                href="/app?tab=profil"
                prefetch={true}
                aria-label="Profil"
                className="flex h-11 w-11 sm:h-10 sm:w-10 shrink-0 items-center justify-center"
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
            )}
          </div>
        </div>
      </header>

      {/* Mobile utility strip */}
      <div className="area-nav relative z-20 flex items-center justify-between gap-2 border-b border-hairline/60 bg-obsidian px-4 py-1.5 sm:hidden">
        <TutorialSheet variant="chip" />
        <RefreshButton variant="chip" />
      </div>

      {/* Content scroll area */}
      <main className="area-main relative z-10">
        <div
          className={`mx-auto w-full px-4 pt-2.5 pb-4 sm:py-6 sm:px-6 ${
            shown === "pipeline" ? "max-w-[1600px]" : "max-w-6xl"
          }`}
        >
          {clientTabs
            ? TABS.map((t) => (
                <div key={t.key} hidden={t.key !== shown}>
                  {panels?.[t.key]}
                </div>
              ))
            : children}
        </div>
      </main>

      {/* ---------- magazine rails ---------- */}
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
        <div className="mx-auto flex w-full max-w-3xl items-center justify-around px-2">
          {TABS.map((t) => {
            const on = t.key === shown;
            const inner = (
              <div className="relative flex flex-col items-center justify-center w-full min-h-[48px] py-1">
                {/* Top Precision Laser Indicator */}
                {on && (
                  <span
                    aria-hidden="true"
                    className="kinetic-node pointer-events-none absolute -top-1 left-1/2 w-6 h-[2px] rounded-full bg-ember animate-tab-laser"
                  />
                )}

                {/* Cyber-Glass Pill Capsule */}
                <div
                  className={`relative flex flex-col items-center justify-center gap-0.5 w-full max-w-[68px] sm:max-w-[80px] py-1 px-2 rounded-xl transition-all duration-200 ${
                    on
                      ? "kinetic-node bg-ember/[0.08] border border-ember/30 animate-tab-pill overflow-hidden"
                      : "hover:bg-white/[0.03]"
                  }`}
                >
                  {/* Idle Liquid Shimmer Layer on Active */}
                  {on && (
                    <div
                      aria-hidden="true"
                      className="kinetic-node pointer-events-none absolute inset-0 rounded-xl animate-tab-shimmer"
                    />
                  )}

                  {/* Icon */}
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className={`relative z-10 size-5 transition-all duration-[var(--duration-standard)] ease-heat ${
                      on ? "fill-ember scale-105" : "fill-muted/75 group-hover:fill-ink"
                    }`}
                  >
                    {t.icon}
                  </svg>

                  {/* Label */}
                  <span
                    className={`relative z-10 text-[11px] leading-none transition-colors duration-[var(--duration-standard)] ease-heat ${
                      on
                        ? "text-ember font-bold tracking-tight"
                        : "text-muted/75 font-medium group-hover:text-ink"
                    }`}
                  >
                    {t.label}
                  </span>
                </div>
              </div>
            );

            const cls =
              "group relative flex flex-1 cursor-pointer flex-col items-center justify-center py-0.5 active:scale-95 transition-transform duration-[var(--duration-standard)] ease-heat select-none";

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
                prefetch={true}
                aria-current={on ? "page" : undefined}
                className={cls}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Command Omnibar Palette (Cmd+K / Ctrl+K) */}
      <CommandOmnibar
        isOpen={isOmnibarOpen}
        onClose={() => setIsOmnibarOpen(false)}
        onSelectTab={(tab) => go(tab)}
        isAdmin={isAdmin}
      />

      {/* Global Studio AI Processing Overlay (Always mounted, butter-smooth exit) */}
      <GlobalStudioProcessingOverlay />

      {/* Luxury PWA & Android Install Modal */}
      <InstallAppModal
        open={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
}
