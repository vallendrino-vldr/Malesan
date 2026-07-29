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

const LINKS = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/users", label: "User" },
  { href: "/admin/topups", label: "Topup" },
  { href: "/admin/vouchers", label: "Voucher" },
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
        <div className="mx-auto w-full max-w-4xl px-4 py-5">{children}</div>
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
              className="flex-1 py-3 text-center text-[11.5px] font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:text-ember"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
