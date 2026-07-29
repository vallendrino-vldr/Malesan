import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";

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
const LINKS = [
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

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-obsidian md:flex-row">
      {/* ---------- sidebar (md+) ---------- */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-obsidian md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <Logo markClass="size-6" />
          <span className="eyebrow text-ember-lo">admin</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block rounded-lg px-4 py-2 text-sm text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-surface hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-hairline p-4">
          <Link
            href="/app"
            className="text-sm text-muted transition-colors hover:text-ink"
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
          <Link href="/app" className="eyebrow rounded-full border border-hairline px-3 py-1.5 text-muted">
            Balik
          </Link>
        </div>
      </header>

      {/* ---------- content: the only scrollable region ---------- */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-4xl px-4 py-5 pb-8">{children}</div>
      </main>

      {/* ---------- mobile bottom nav ---------- */}
      <nav
        aria-label="Navigasi admin"
        className="shrink-0 border-t border-hairline/70 bg-obsidian/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 py-2 text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:text-ember"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[19px] fill-current">
                {l.icon}
              </svg>
              <span className="text-[10.5px] font-semibold leading-none">{l.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
