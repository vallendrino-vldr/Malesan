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
        {/* =========================================================================
            CONTINUOUS FULL-PAGE AMBIENT LIGHTING & SEAMLESS MESH SYSTEM
            Spans from top to bottom — zero blank void, zero harsh divider lines
           ========================================================================= */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
          {/* Top Hero Ambient Bloom */}
          <div className="absolute -top-[10%] left-1/2 -translate-x-1/2 w-[700px] sm:w-[1000px] h-[550px] bg-[radial-gradient(circle_at_center,rgba(255,138,61,0.14)_0%,rgba(255,138,61,0.03)_50%,transparent_75%)] blur-3xl" />
          
          {/* Mid-Page Right Atmospheric Glow (Journey Section) */}
          <div className="absolute top-[35%] -right-[15%] w-[600px] sm:w-[850px] h-[650px] bg-[radial-gradient(circle_at_center,rgba(255,138,61,0.09)_0%,transparent_65%)] blur-3xl" />

          {/* Mid-Page Left Soft Complementary Glow */}
          <div className="absolute top-[55%] -left-[15%] w-[550px] sm:w-[750px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(255,184,108,0.06)_0%,transparent_65%)] blur-3xl" />

          {/* Bottom Conversion Ambient Glow */}
          <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 w-[650px] sm:w-[900px] h-[450px] bg-[radial-gradient(circle_at_center,rgba(255,138,61,0.11)_0%,transparent_70%)] blur-3xl" />

          {/* Seamless Subtle Background Grid Mesh */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_80%_at_50%_40%,black_40%,transparent_95%)]" />
        </div>

        {/* Clean Translucent Header — Seamless with Background */}
        <header className="relative z-20 bg-obsidian/40 backdrop-blur-md">
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

        {/* Main Continuous Experience — Zero Separator Lines */}
        <main className="relative z-10 flex-1">
          {/* Section 1: Hero Experience (Living AI Studio Workspace + Headline + Magic Bar + CTA) */}
          <CompanionHero />

          {/* Section 2: Interactive Creator Journey (0% -> 33% -> 66% -> 100%) */}
          <CreatorJourney />

          {/* Section 3: Live Creator Activity Stream */}
          <CreatorActivityTicker />

          {/* Section 4: Final Conversion CTA with Mascot Reaction */}
          <CompactCTA />
        </main>

        {/* =========================================================================
            PRECISION FOOTER (PERFECT HORIZONTAL BASELINE ALIGNMENT)
           ========================================================================= */}
        <footer className="relative z-10 bg-transparent pt-12 pb-16 sm:pt-16 sm:pb-20">
          <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
            
            {/* Row 1: Brand Logo (Left on desktop, true center on mobile) */}
            <div className="flex justify-center sm:justify-start">
              <Logo markClass="h-8 sm:h-9" centered />
            </div>

            {/* Row 2: Tagline (Left) perfectly sejajar with Nav Links (Right) on Desktop */}
            <div className="mt-3.5 flex flex-col items-center justify-between gap-5 sm:flex-row sm:items-center">
              <p className="text-xs text-muted text-center sm:text-left leading-normal">
                AI Creative Companion untuk kreator konten Indonesia.
              </p>

              {/* Navigation & Legal Links */}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted">
                <a href="#journey" className="transition-colors hover:text-ink">
                  Cara Kerja
                </a>
                <Link href="/masuk" className="transition-colors hover:text-ink">
                  Mulai Gratis
                </Link>
                <Link href="/masuk" className="transition-colors hover:text-ink">
                  Masuk
                </Link>
                <Link href="/privasi" className="transition-colors hover:text-ink">
                  Privasi
                </Link>
                <Link href="/ketentuan" className="transition-colors hover:text-ink">
                  Ketentuan
                </Link>
              </div>
            </div>

            {/* Row 3: Symmetrical Copyright & Origin */}
            <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-hairline/30 pt-6 text-micro text-muted/70 sm:flex-row sm:text-xs">
              <p className="text-center sm:text-left">
                © {new Date().getFullYear()} Malesan. Hak cipta dilindungi.
              </p>
              <p className="text-center sm:text-right">
                Dibuat untuk kreator konten Indonesia 🇮🇩
              </p>
            </div>

          </div>
        </footer>
      </div>
    </CinematicTransitionProvider>
  );
}
