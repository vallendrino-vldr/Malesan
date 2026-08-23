import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CompanionHero } from "@/components/landing/CompanionHero";
import { CreatorJourney } from "@/components/landing/CreatorJourney";
import { CreatorActivityTicker } from "@/components/landing/CreatorActivityTicker";
import { CompactCTA } from "@/components/landing/CompactCTA";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-x-hidden bg-obsidian text-[#f4efe8]">
      {/* Ambient warm lighting bloom behind header */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(60%_100%_at_50%_0%,var(--ambient-glow-strong),transparent_70%)]"
      />

      {/* Clean Global Header with Breathing Room */}
      <header className="relative z-20 border-b border-hairline/60 bg-obsidian/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 lg:h-[72px] w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            href="/"
            aria-label="Malesan — AI Creative Companion"
            className="flex shrink-0 items-center overflow-visible transition-opacity hover:opacity-95"
          >
            <Logo markClass="h-[36px] sm:h-[40px] lg:h-[44px]" />
          </Link>

          <nav className="hidden md:flex items-center gap-6 font-display text-xs font-semibold text-muted">
            <a href="#journey" className="transition-colors hover:text-ink">
              Cara Kerja
            </a>
            <Link href="/masuk" className="transition-colors hover:text-ink">
              Mulai Gratis
            </Link>
          </nav>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/masuk"
              className="flex h-10 items-center justify-center rounded-full border border-hairline/80 bg-surface/80 px-5 font-display text-xs sm:text-sm font-semibold text-ink shadow-xs transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ember-lo"
            >
              Masuk
            </Link>
          </div>
        </div>
      </header>

      {/* Main Living Companion Experience (Compact 1.5–2 Viewports Total) */}
      <main className="relative z-10 flex-1">
        {/* Section 1: Hero Experience (Living AI Studio Workspace + Headline + CTA) */}
        <CompanionHero />

        {/* Section 2: Interactive Creator Journey (0% -> 33% -> 66% -> 100%) */}
        <CreatorJourney />

        {/* Section 3: Live Creator Activity Stream */}
        <CreatorActivityTicker />

        {/* Section 4: Final Conversion CTA with Mascot Reaction */}
        <CompactCTA />
      </main>

      {/* Spacious Minimal Footer */}
      <footer className="relative z-10 border-t border-hairline/70 bg-obsidian py-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <Logo markClass="h-7" />
            <span className="text-hairline hidden sm:inline">|</span>
            <p className="text-micro text-muted">
              AI Creative Companion untuk kreator konten Indonesia.
            </p>
          </div>

          <div className="flex items-center gap-5 text-xs text-muted">
            <Link href="/privasi" className="transition-colors hover:text-ink">
              Privasi
            </Link>
            <Link href="/ketentuan" className="transition-colors hover:text-ink">
              Ketentuan
            </Link>
            <span className="text-micro text-muted/60">
              © {new Date().getFullYear()} Malesan.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
