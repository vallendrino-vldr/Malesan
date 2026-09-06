"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { RefreshButton } from "@/components/RefreshButton";

export interface AdminNavItem {
  href: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: (props: { className?: string }) => React.ReactNode;
  counted?: boolean;
}

export interface AdminNavGroup {
  groupTitle: string;
  items: AdminNavItem[];
}

function LayoutDashboardIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function SparklesIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 3-1.9 6.1L4 11l6.1 1.9L12 19l1.9-6.1L20 11l-6.1-1.9L12 3z" />
      <path d="m19 16-.9 2.1L16 19l2.1.9.9 2.1.9-2.1 2.1-.9-2.1-.9-.9-2.1z" />
    </svg>
  );
}

function CreditCardIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function UsersIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function TicketIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </svg>
  );
}

function MessageSquareIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CpuIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="16" height="16" x="4" y="4" rx="2" />
      <rect width="6" height="6" x="9" y="9" rx="1" />
      <path d="M9 1v3" />
      <path d="M15 1v3" />
      <path d="M9 20v3" />
      <path d="M15 20v3" />
      <path d="M20 9h3" />
      <path d="M20 14h3" />
      <path d="M1 9h3" />
      <path d="M1 14h3" />
    </svg>
  );
}

function BarChartIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </svg>
  );
}

function SlidersIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="1" x2="7" y1="14" y2="14" />
      <line x1="9" x2="15" y1="8" y2="8" />
      <line x1="17" x2="23" y1="16" y2="16" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

function MenuIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function XIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    groupTitle: "Operasional Utama",
    items: [
      {
        href: "/admin",
        label: "Ringkasan",
        shortLabel: "Ringkasan",
        description: "Finansial, metrik, aktivitas real-time",
        icon: LayoutDashboardIcon,
      },
      {
        href: "/admin/asisten",
        label: "Asisten AI",
        shortLabel: "Asisten",
        description: "Tanya data, cek anomali & saran bisnis",
        icon: SparklesIcon,
      },
      {
        href: "/admin/topups",
        label: "Konfirmasi Topup",
        shortLabel: "Topup",
        description: "Validasi bukti transfer kreator",
        icon: CreditCardIcon,
        counted: true,
      },
    ],
  },
  {
    groupTitle: "Komunitas & Kreator",
    items: [
      {
        href: "/admin/users",
        label: "User & Saldo",
        shortLabel: "User",
        description: "Kelola kuota, saldo, status Pro",
        icon: UsersIcon,
      },
      {
        href: "/admin/vouchers",
        label: "Voucher Promo",
        shortLabel: "Voucher",
        description: "Kode diskon & bonus kredit",
        icon: TicketIcon,
      },
      {
        href: "/admin/feedback",
        label: "Masukan Kreator",
        shortLabel: "Feedback",
        description: "Saran & kendala pengguna",
        icon: MessageSquareIcon,
      },
    ],
  },
  {
    groupTitle: "Sistem & Intelijen",
    items: [
      {
        href: "/admin/ai",
        label: "Otak AI",
        shortLabel: "Otak AI",
        description: "Pilih model aktif, fallback & biaya token",
        icon: CpuIcon,
      },
      {
        href: "/admin/stats",
        label: "Statistik & Biaya",
        shortLabel: "Grafik",
        description: "Tren margin, pemakaian token & revenue",
        icon: BarChartIcon,
      },
      {
        href: "/admin/config",
        label: "Pengaturan Sistem",
        shortLabel: "Pengaturan",
        description: "Harga kredit, saklar modul & nomor rekening",
        icon: SlidersIcon,
      },
      {
        href: "/admin/errors",
        label: "Pusat Error",
        shortLabel: "Error",
        description: "Diagnosa kendala & auto-recovery",
        icon: AlertTriangleIcon,
      },
    ],
  },
];

const MOBILE_PRIMARY_HREFS = ["/admin", "/admin/topups", "/admin/users", "/admin/ai"];

export function AdminNav({ waiting }: { waiting: number }) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Adjust state during render when pathname changes
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsDrawerOpen(false);
  }

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  const isLinkActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  const allItems = ADMIN_NAV_GROUPS.flatMap((g) => g.items);
  const mobilePrimaryItems = MOBILE_PRIMARY_HREFS.map(
    (href) => allItems.find((i) => i.href === href)!
  );
  const isAnyPrimaryActive = mobilePrimaryItems.some((item) => isLinkActive(item.href));
  const isSecondaryActive = !isAnyPrimaryActive && pathname.startsWith("/admin");
  const isMenuActive = isDrawerOpen || isSecondaryActive;

  return (
    <>
      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR (md+)                                                     */}
      {/* ========================================================================= */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-hairline bg-obsidian md:flex h-[100dvh]">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline/60">
          <Logo markClass="h-6 sm:h-7" />
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-ember/15 border border-ember/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ember">
              Admin
            </span>
          </div>
        </div>

        {/* Grouped Navigation Links */}
        <nav className="flex-1 space-y-5 p-3.5 overflow-y-auto custom-scrollbar">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.groupTitle} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted/80">
                {group.groupTitle}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isLinkActive(item.href);
                  const badge = item.counted ? waiting : 0;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs transition-all duration-[var(--duration-standard)] ease-heat ${
                        active
                          ? "bg-ember/15 text-ember border border-ember/30 font-semibold shadow-[0_0_15px_rgba(255,138,61,0.12)]"
                          : "text-muted hover:text-ink hover:bg-surface-raised/70 border border-transparent font-medium"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`size-4 shrink-0 transition-colors ${
                            active ? "text-ember" : "text-muted group-hover:text-ink"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {badge > 0 && (
                        <span className="grid min-w-[20px] place-items-center rounded-full bg-ember px-1.5 py-0.5 font-mono text-[10px] font-bold text-obsidian shadow-xs shrink-0">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Desktop Footer Quick Actions */}
        <div className="space-y-2 border-t border-hairline/60 p-3.5 bg-surface/30">
          <RefreshButton />
          <Link
            href="/app"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-ink border border-transparent hover:border-hairline"
          >
            <ChevronLeftIcon className="size-3.5" />
            <span>Kembali ke App Kreator</span>
          </Link>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION (md:hidden)                                      */}
      {/* ========================================================================= */}
      <nav
        aria-label="Navigasi admin mobile"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-hairline/80 bg-obsidian/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden shadow-[0_-4px_24px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-stretch justify-around px-1">
          {/* 4 Primary Quick Tabs */}
          {mobilePrimaryItems.map((item) => {
            const active = isLinkActive(item.href);
            const badge = item.counted ? waiting : 0;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={badge > 0 ? `${item.label} (${badge} menunggu)` : item.label}
                className={`relative flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors duration-[var(--duration-standard)] ease-heat ${
                  active ? "text-ember font-bold" : "text-muted hover:text-ink font-medium"
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon className={`size-5 transition-transform ${active ? "scale-110 text-ember" : "text-muted"}`} />
                  {badge > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 grid min-w-[17px] place-items-center rounded-full bg-ember px-1 font-mono text-[9px] font-bold leading-[17px] text-obsidian shadow-sm">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] leading-tight tracking-tight">
                  {item.shortLabel || item.label}
                </span>

                {/* Subtle active glow pill */}
                {active && (
                  <span className="absolute bottom-1 h-0.5 w-6 rounded-full bg-ember shadow-[0_0_8px_rgba(255,138,61,0.8)]" />
                )}
              </Link>
            );
          })}

          {/* 5th Button: Open Full Menu Drawer */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Buka semua menu admin"
            className={`relative flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors duration-[var(--duration-standard)] ease-heat ${
              isMenuActive ? "text-ember font-bold" : "text-muted hover:text-ink font-medium"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <MenuIcon className={`size-5 transition-transform ${isMenuActive ? "scale-110 text-ember" : "text-muted"}`} />
            </div>
            <span className="text-[10px] leading-tight tracking-tight">Menu</span>

            {/* Subtle active glow pill */}
            {isMenuActive && (
              <span className="absolute bottom-1 h-0.5 w-6 rounded-full bg-ember shadow-[0_0_8px_rgba(255,138,61,0.8)]" />
            )}
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* MOBILE FULL MENU DRAWER MODAL                                             */}
      {/* ========================================================================= */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[99999] md:hidden">
          {/* Backdrop with blur */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-Up Bottom Sheet */}
          <div className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-hairline/90 bg-obsidian pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_35px_rgba(0,0,0,0.8)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Grabber Bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-hairline/80" />
            </div>

            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-hairline/60">
              <div className="flex items-center gap-2">
                <Logo markClass="h-5" />
                <span className="text-xs font-bold text-ink">Semua Fitur Admin</span>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="flex size-8 items-center justify-center rounded-full border border-hairline bg-surface text-muted hover:text-ink"
                aria-label="Tutup menu"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {/* Grouped Tools List */}
            <div className="p-4 space-y-4">
              {ADMIN_NAV_GROUPS.map((group) => (
                <div key={group.groupTitle} className="space-y-1.5">
                  <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-ember">
                    {group.groupTitle}
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {group.items.map((item) => {
                      const active = isLinkActive(item.href);
                      const badge = item.counted ? waiting : 0;
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsDrawerOpen(false)}
                          className={`flex items-center justify-between gap-3 rounded-xl p-3 text-xs transition-colors ${
                            active
                              ? "bg-ember/15 text-ember border border-ember/30 font-semibold shadow-xs"
                              : "bg-surface/70 text-ink border border-hairline hover:bg-surface-raised"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
                                active
                                  ? "bg-ember/20 border-ember/40 text-ember"
                                  : "bg-obsidian border-hairline text-muted"
                              }`}
                            >
                              <Icon className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{item.label}</p>
                              <p className="text-[11px] text-muted truncate">{item.description}</p>
                            </div>
                          </div>

                          {badge > 0 && (
                            <span className="grid min-w-[22px] place-items-center rounded-full bg-ember px-1.5 py-0.5 font-mono text-[10px] font-bold text-obsidian shrink-0">
                              {badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Drawer Bottom Quick Actions */}
              <div className="pt-2 pb-4 space-y-2 border-t border-hairline/60">
                <Link
                  href="/app"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-xs font-semibold text-ink hover:bg-surface-raised"
                >
                  <ChevronLeftIcon className="size-4 text-muted" />
                  <span>Kembali ke Dashboard Kreator</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
