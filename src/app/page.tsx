import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CompanionHero } from "@/components/landing/CompanionHero";
import { CreatorJourney } from "@/components/landing/CreatorJourney";
import { CreatorActivityTicker } from "@/components/landing/CreatorActivityTicker";
import { CompactCTA } from "@/components/landing/CompactCTA";
import { CinematicTransitionProvider } from "@/components/landing/CinematicTransitionContext";
import { TransitionButton } from "@/components/landing/TransitionButton";

export default function Home() {
  return (
    <CinematicTransitionProvider>
      <div className="relative flex min-h-full flex-1 flex-col overflow-x-hidden bg-obsidian text-[#f4efe8]">
        {/* Ambient warm lighting bloom behind header */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(60%_100%_at_50%_0%,var(--ambient-glow-strong),transparent_70%)]"
        />

        {/* Clean Global Header — Seamless Dark Cinematic Navbar */}
        <header className="relative z-20 border-b border-hairline/50 bg-obsidian/60 backdrop-blur-md">
          <div className="mx-auto flex h-16 lg:h-[72px] w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
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
              <TransitionButton
                href="/masuk"
                variant="custom"
                className="transition-colors hover:text-ink cursor-pointer"
              >
                Mulai Gratis
              </TransitionButton>
            </nav>

            <div className="flex items-center gap-3">
              <TransitionButton href="/masuk" variant="header">
                Masuk
              </TransitionButton>
            </div>
          </div>
        </header>

        {/* Main Living Companion Experience */}
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
        <footer className="relative z-10 border-t border-hairline/70 bg-obsidian py-10 sm:py-12">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-8">
            {/* Brand & Tagline with comfortable spacing */}
            <div className="flex flex-col items-center sm:items-start gap-2.5 text-center sm:text-left">
              <Logo markClass="h-8" />
              <p className="text-xs text-muted max-w-sm">
                AI Creative Companion untuk kreator konten Indonesia.
              </p>
            </div>

            {/* Links & Copyright */}
            <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-6 text-xs text-muted">
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
    </CinematicTransitionProvider>
  );
}
