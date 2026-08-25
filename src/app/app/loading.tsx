import { Logo } from "@/components/Logo";

/**
 * Route-level ultra-fast native loading UI for /app.
 * Renders a lightweight shell skeleton and top kinetic glowing bar
 * instead of a jarring full-screen splash takeover during transitions.
 */
export default function AppLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col h-[100dvh] w-full bg-obsidian text-ink overflow-hidden pointer-events-none">
      {/* Top Indeterminate Glowing Progress Line */}
      <div className="h-0.5 w-full bg-surface relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-ember to-transparent animate-shimmer-sweep" />
      </div>

      {/* Header Skeleton */}
      <header className="h-16 lg:h-[76px] border-b border-hairline/70 bg-obsidian flex items-center justify-between px-4 sm:px-6 shrink-0">
        <Logo markClass="h-[36px] sm:h-[40px] lg:h-[48px]" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 rounded-full bg-white/[0.04] animate-shimmer-sweep" />
          <div className="size-9 rounded-full bg-white/[0.06] animate-shimmer-sweep" />
        </div>
      </header>

      {/* Body Skeleton */}
      <main className="flex-1 overflow-hidden p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-5">
        <div className="h-44 sm:h-52 w-full rounded-3xl border border-ember/20 bg-surface/50 p-6 animate-shimmer-sweep" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-24 rounded-2xl border border-hairline bg-surface/40 p-4 animate-shimmer-sweep" />
          ))}
        </div>
      </main>

      {/* Bottom Bar Skeleton */}
      <nav className="h-14 border-t border-hairline/70 bg-obsidian flex items-center justify-around px-4 pb-[env(safe-area-inset-bottom)] shrink-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="size-5 rounded-md bg-white/[0.06]" />
            <div className="h-2 w-8 rounded bg-white/[0.04]" />
          </div>
        ))}
      </nav>
    </div>
  );
}
