import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LiveRefresh } from "@/components/LiveRefresh";
import { RefreshButton } from "@/components/RefreshButton";
import { AdminNav } from "@/components/admin/AdminNav";

/**
 * Admin Shell — Pusat Kendali Owner Malesan
 *
 * Responsif menyeluruh:
 * - Desktop (md+): Sidebar 3 grup terstruktur, indikator rute aktif, badge topup live
 * - Mobile (<md): Header minimalis + bar 4 tab harian + Drawer slide-up 10 alat lengkap
 * - Zero emoji norak, zero scrollbar abu-abu browser, tinggi sentuhan >= 44px
 */
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

  // Hitung topup yang sedang pending (kreator menunggu persetujuan bukti transfer)
  const { count: pendingTopups } = await supabase
    .from("topups")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const waiting = pendingTopups ?? 0;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-obsidian md:flex-row">
      {/* Realtime listener jika ada bukti transfer baru yang diupload kreator */}
      <LiveRefresh tables={["topups"]} label="Ada topup baru masuk" />

      {/* Navigasi Desktop Sidebar & Mobile Bottom Bar / Drawer */}
      <AdminNav waiting={waiting} />

      {/* Kontainer Utama */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile Header (<md) */}
        <header className="shrink-0 border-b border-hairline/80 bg-obsidian/90 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo markClass="h-6" />
              <span className="rounded-full bg-ember/15 border border-ember/30 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-ember">
                Admin
              </span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshButton variant="icon" />
              <Link
                href="/app"
                className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-hairline bg-surface px-3 text-[11px] font-semibold text-muted hover:text-ink transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                <span>App Kreator</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Content Region: Scrollable dengan padding bawah ramah mobile & bebas scrollbar abu-abu */}
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 md:pb-8 custom-scrollbar [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:[scrollbar-width:auto] md:[&::-webkit-scrollbar]:block">
          <div className="mx-auto w-full max-w-5xl px-3.5 py-4 sm:px-6 sm:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
