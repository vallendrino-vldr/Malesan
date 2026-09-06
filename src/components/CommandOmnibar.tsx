"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { TabKey } from "./AppShell";
import { haptic } from "@/lib/haptics";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export interface CommandItem {
  id: string;
  title: string;
  category: string;
  subtitle?: string;
  badge?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

interface CommandOmnibarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: TabKey) => void;
  onOpenTutorial?: () => void;
  isAdmin?: boolean;
}

export function CommandOmnibar({
  isOpen,
  onClose,
  onSelectTab,
  onOpenTutorial,
  isAdmin = false,
}: CommandOmnibarProps) {
  const router = useRouter();
  const { dict } = useLanguage();
  const om = dict.omnibar;
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Define commands catalogue
  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Studio Tools
      {
        id: "studio-ide-hari-ini",
        title: om.commands.dailyIdeaTitle,
        category: om.categoryStudio,
        subtitle: om.commands.dailyIdeaSubtitle,
        badge: om.commands.dailyIdeaBadge,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("studio");
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: "ide" }));
          onClose();
        },
      },
      {
        id: "studio-naskah",
        title: om.commands.scriptTitle,
        category: om.categoryStudio,
        subtitle: om.commands.scriptSubtitle,
        badge: om.commands.scriptBadge,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("studio");
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: "script" }));
          onClose();
        },
      },
      {
        id: "studio-hook-lab",
        title: om.commands.hookTitle,
        category: om.categoryStudio,
        subtitle: om.commands.hookSubtitle,
        badge: om.commands.hookBadge,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("studio");
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: "hook" }));
          onClose();
        },
      },
      {
        id: "studio-carousel",
        title: om.commands.carouselTitle,
        category: om.categoryStudio,
        subtitle: om.commands.carouselSubtitle,
        badge: om.commands.carouselBadge,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M7 3v18M17 3v18" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("studio");
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: "carousel" }));
          onClose();
        },
      },
      {
        id: "studio-lancar-bahasa",
        title: om.commands.lancarBahasaTitle,
        category: om.categoryStudio,
        subtitle: om.commands.lancarBahasaSubtitle,
        badge: om.commands.lancarBahasaBadge,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("studio");
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: "lancar_bahasa" }));
          onClose();
        },
      },
      {
        id: "studio-auto-clip",
        title: om.commands.autoClipTitle,
        category: om.categoryStudio,
        subtitle: om.commands.autoClipSubtitle,
        badge: om.commands.autoClipBadge,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
            <polygon points="10 15 15 12 10 9 10 15" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("studio");
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: "auto_clip" }));
          onClose();
        },
      },
      {
        id: "studio-video-cc",
        title: om.commands.videoCcTitle,
        category: om.categoryStudio,
        subtitle: om.commands.videoCcSubtitle,
        badge: om.commands.videoCcBadge,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <rect width="20" height="15" x="2" y="4" rx="2" />
            <path d="M7 15h3M14 15h3M7 11h10" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("studio");
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: "video" }));
          onClose();
        },
      },
      {
        id: "studio-clip-engine",
        title: om.commands.clipTitle,
        category: om.categoryStudio,
        subtitle: om.commands.clipSubtitle,
        badge: om.commands.clipBadge,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("studio");
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: "clip" }));
          onClose();
        },
      },
      {
        id: "studio-affiliate",
        title: om.commands.affiliateTitle,
        category: om.categoryStudio,
        subtitle: om.commands.affiliateSubtitle,
        badge: om.commands.affiliateBadge,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("studio");
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: "affiliate" }));
          onClose();
        },
      },
      {
        id: "studio-repurpose",
        title: om.commands.repurposeTitle,
        category: om.categoryStudio,
        subtitle: om.commands.repurposeSubtitle,
        badge: om.commands.repurposeBadge,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("studio");
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: "repurpose" }));
          onClose();
        },
      },
      {
        id: "studio-thread-engine",
        title: om.commands.threadTitle,
        category: om.categoryStudio,
        subtitle: om.commands.threadSubtitle,
        badge: om.commands.threadBadge,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <line x1="4" x2="20" y1="9" y2="9" />
            <line x1="4" x2="20" y1="15" y2="15" />
            <line x1="10" x2="8" y1="3" y2="21" />
            <line x1="16" x2="14" y1="3" y2="21" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("studio");
          window.dispatchEvent(new CustomEvent("malesan:open-module", { detail: "thread" }));
          onClose();
        },
      },
      {
        id: "studio-vibe-coding",
        title: om.commands.vibeTitle,
        category: om.categoryStudio,
        subtitle: om.commands.vibeSubtitle,
        badge: om.commands.vibeBadge,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("vibe");
          onClose();
        },
      },

      // Pipeline Stages
      {
        id: "pipeline-view",
        title: om.commands.pipelineTitle,
        category: om.categoryPipeline,
        subtitle: om.commands.pipelineSubtitle,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ink/80">
            <rect width="6" height="14" x="4" y="5" rx="1" />
            <rect width="6" height="9" x="14" y="5" rx="1" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("pipeline");
          onClose();
        },
      },

      // Quick Actions & Navigation
      {
        id: "nav-topup",
        title: om.commands.topupTitle,
        category: om.categoryNav,
        subtitle: om.commands.topupSubtitle,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-emerald-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="16" />
            <line x1="8" x2="16" y1="12" y2="12" />
          </svg>
        ),
        onSelect: () => {
          onClose();
          router.push("/app/topup");
        },
      },
      {
        id: "nav-profil",
        title: om.commands.profileTitle,
        category: om.categoryNav,
        subtitle: om.commands.profileSubtitle,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ink/80">
            <circle cx="12" cy="8" r="5" />
            <path d="M20 21a8 8 0 0 0-16 0" />
          </svg>
        ),
        onSelect: () => {
          onSelectTab("profil");
          onClose();
        },
      },
    ];

    if (onOpenTutorial) {
      list.push({
        id: "nav-tutorial",
        title: om.commands.tutorialTitle,
        category: om.categoryNav,
        subtitle: om.commands.tutorialSubtitle,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ink/80">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="12.01" x2="17" y2="17" />
          </svg>
        ),
        onSelect: () => {
          onOpenTutorial();
          onClose();
        },
      });
    }

    if (isAdmin) {
      list.push({
        id: "nav-admin",
        title: om.commands.adminTitle,
        category: om.categoryNav,
        subtitle: om.commands.adminSubtitle,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
        ),
        onSelect: () => {
          onClose();
          router.push("/admin");
        },
      });
    }

    return list;
  }, [onSelectTab, onOpenTutorial, isAdmin, onClose, router, om]);

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q),
    );
  }, [commands, query]);

  const [prevQuery, setPrevQuery] = useState(query);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  // Sync state on query change (React 19 pattern)
  if (query !== prevQuery) {
    setPrevQuery(query);
    setSelectedIndex(0);
  }

  // Reset query and selectedIndex when modal opens
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        haptic.tick();
        setSelectedIndex((prev) => (prev + 1 < filteredCommands.length ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        haptic.tick();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredCommands.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          haptic.tap();
          filteredCommands[selectedIndex].onSelect();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[12vh] sm:pt-[15vh] backdrop-blur-md bg-black/70 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-[#12100E] shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 bg-obsidian">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5 text-ember shrink-0">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" x2="16.65" y1="21" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            id="command-omnibar-input"
            name="omnibar_query"
            aria-label={om.ariaLabel}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={om.placeholder}
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted/50 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono text-muted">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <ul
          ref={listRef}
          role="listbox"
          className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-white/[0.03]"
        >
          {filteredCommands.length === 0 ? (
            <li className="p-6 text-center text-xs text-muted">
              {om.noResults(query)}
            </li>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <li
                  key={cmd.id}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => cmd.onSelect()}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl p-2.5 transition-all ${
                    isSelected ? "bg-ember/15 text-ink shadow-xs" : "text-muted hover:text-ink"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
                      isSelected ? "border-ember/40 bg-ember/10" : "border-white/10 bg-white/[0.03]"
                    }`}>
                      {cmd.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold truncate ${isSelected ? "text-ink" : "text-ink/90"}`}>
                          {cmd.title}
                        </span>
                        <span className="text-[9px] font-mono tracking-wider uppercase text-muted/60">
                          {cmd.category}
                        </span>
                      </div>
                      {cmd.subtitle && (
                        <p className="text-[11px] text-muted truncate mt-0.5">
                          {cmd.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {cmd.badge && (
                    <span className="shrink-0 rounded-full border border-ember/30 bg-ember/10 px-2 py-0.5 font-mono text-[10px] font-bold text-ember">
                      {cmd.badge}
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ul>

        {/* Omnibar Footer Hints */}
        <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-4 py-2 text-[10px] font-medium text-muted/70">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono text-ink/80">↑↓</kbd> {om.navHint}</span>
            <span><kbd className="font-mono text-ink/80">↵</kbd> {om.selectHint}</span>
            <span><kbd className="font-mono text-ink/80">Esc</kbd> {om.closeHint}</span>
          </div>
          <span className="font-mono text-ember/80 font-bold">{om.titleMalesanOmnibar}</span>
        </div>
      </div>
    </div>
  );
}
