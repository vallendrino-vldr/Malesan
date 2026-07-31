import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LiveRefresh } from "@/components/LiveRefresh";
import { RefreshButton } from "@/components/RefreshButton";

/**
 * Admin shell.
 *
 * The previous version was a fixed `w-64` sidebar next to `flex-1` content with
 * no mobile branch at all. On a 360px phone that leaves ~96px for the actual
 * page, which is why the admin area read as "missing" rather than "broken" —
 * it was reachable and unusable at the same time.
 *
 * Same rules as AppShell: the page itself does not scroll, only the content
 * region does, and the nav is a bottom bar on phones / a sidebar from `md` up.
 */

/**
 * Icons, not bare words. The first version's bottom bar was four text labels at
 * 11.5px with no glyphs and a 3px vertical pad — under the minimum touch target,
 * visually flat, and the labels clipped against the browser's own bottom
 * chrome. It read as unfinished because it was.
 */
const LINKS: {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Carries the pending-top-up badge. */
  counted?: boolean;
}[] = [
  {
    href: "/admin",
    label: "Ringkasan",
    icon: <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z" />,
  },
  {
    href: "/admin/users",
    label: "User",
    icon: (
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-8 2-8 4.5V21h16v-2.5C20 16 16 14 12 14Z" />
    ),
  },
  {
    href: "/admin/topups",
    label: "Topup",
    icon: <path d="M3 6h18v4H3V6Zm0 6h18v6H3v-6Zm2 2v2h6v-2H5Z" />,
    // The one nav item that can be *waiting on you*. Everything else is
    // something you go and look at; this one is a person who has paid.
    counted: true,
  },
  {
    href: "/admin/vouchers",
    label: "Voucher",
    icon: (
      <path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4V7Zm6 2v6h2V9H9Z" />
    ),
  },
  {
    href: "/admin/stats",
    label: "Grafik",
    icon: <path d="M4 20h16v-2H6V4H4v16Zm4-4h2v-5H8v5Zm4 0h2V7h-2v9Zm4 0h2v-7h-2v7Z" />,
  },
  {
    href: "/admin/errors",
    label: "Error",
    icon: (
      <path d="M12 2 1 21h22L12 2Zm0 4.5L19.5 19h-15L12 6.5ZM11 10v4h2v-4h-2Zm0 5v2h2v-2h-2Z" />
    ),
  },
  {
    href: "/admin/config",
    label: "Otak AI",
    icon: (
      <path d="M12 2a5 5 0 0 0-5 5v1.1A4 4 0 0 0 5 15v2a5 5 0 0 0 5 5h4a5 5 0 0 0 5-5v-2a4 4 0 0 0-2-6.9V7a5 5 0 0 0-5-5Zm0 2a3 3 0 0 1 3 3v2h2a2 2 0 0 1 2 2v2a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3v-2a2 2 0 0 1 2-2h2V7a3 3 0 0 1 1-3Z" />
    ),
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/masuk");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/app");
  }

  // Pending top-ups are money already sent, sitting unacknowledged. Counting it
  // in the shell means the number is on screen from whichever admin page you
  // happen to be on — you no longer have to open the Topup tab to discover that
  // someone is waiting. `is_admin()` covers this read; no service role needed.
  const { count: pendingTopups } = await supabase
    .from("topups")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const waiting = pendingTopups ?? 0;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-obsidian md:flex-row">
      {/* Keeps the badge honest while the tab sits open. */}
      <LiveRefresh tables={["topups"]} label="Ada topup baru masuk" />
      {/* ---------- sidebar (md+) ---------- */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-obsidian md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <Logo markClass="size-6" />
          <span className="eyebrow text-ember-lo">admin</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {LINKS.map((l) => {
            const badge = l.counted ? waiting : 0;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center justify-between gap-2 rounded-lg px-4 py-2 text-sm text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-surface hover:text-ink"
              >
                <span>{l.label}</span>
                {badge > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-ember px-1.5 py-0.5 font-mono text-micro font-bold text-obsidian">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-hairline p-4">
          <RefreshButton />
          <Link
            href="/app"
            className="block text-sm text-muted transition-colors hover:text-ink"
          >
            &larr; Balik ke app
          </Link>
        </div>
      </aside>

      {/* ---------- mobile header ---------- */}
      <header className="shrink-0 border-b border-hairline/70 bg-obsidian/85 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Logo markClass="size-6" />
            <span className="eyebrow text-ember-lo">admin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <RefreshButton variant="icon" />
            <Link
              href="/app"
              className="eyebrow flex min-h-11 items-center rounded-full border border-hairline px-3 text-muted"
            >
              Balik
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- content: the only scrollable region ---------- */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-4xl px-4 py-5 pb-8">{children}</div>
      </main>

      {/* ---------- mobile bottom nav ---------- */}
      <nav
        aria-label="Navigasi admin"
        className="shrink-0 skeu-bar border-t border-hairline/70 bg-obsidian/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="flex">
          {LINKS.map((l) => {
            const badge = l.counted ? waiting : 0;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-label={badge > 0 ? `${l.label} — ${badge} nunggu` : l.label}
                className="group flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 py-2 text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:text-ember"
              >
                <span className="relative">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[19px] fill-current">
                    {l.icon}
                  </svg>
                  {badge > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2.5 -top-2 grid min-w-[17px] place-items-center rounded-full bg-ember px-1 font-mono text-micro font-bold leading-[17px] text-obsidian"
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span className="text-micro font-semibold leading-none">{l.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
