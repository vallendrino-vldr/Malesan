import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CompanionHero } from "@/components/landing/CompanionHero";
import { StorySection } from "@/components/landing/StorySection";
import { CapabilitiesSection } from "@/components/landing/CapabilitiesSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-x-hidden bg-obsidian text-[#f4efe8]">
      {/* Ambient warm lighting bloom behind header */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(60%_100%_at_50%_0%,var(--ambient-glow-strong),transparent_70%)]"
      />

      {/* Header Bar */}
      <header className="relative z-20 border-b border-hairline/60 bg-obsidian/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 lg:h-[76px] w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            href="/"
            aria-label="Malesan — AI Creative Companion"
            className="flex shrink-0 items-center overflow-visible transition-opacity hover:opacity-95"
          >
            <Logo markClass="h-[36px] sm:h-[40px] lg:h-[48px]" />
          </Link>

          <nav className="hidden md:flex items-center gap-6 font-display text-xs font-semibold text-muted">
            <a href="#alur" className="transition-colors hover:text-ink">
              Cara Kerja
            </a>
            <a href="#kemampuan" className="transition-colors hover:text-ink">
              Kemampuan AI
            </a>
            <a href="#beda" className="transition-colors hover:text-ink">
              Kenapa Beda
            </a>
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

      {/* Main Content Sections */}
      <main className="relative z-10 flex-1">
        {/* 1. Hero Experience (Interactive Mascot 3D Stage) */}
        <CompanionHero />

        {/* 2. Storytelling Section (Transformation Pipeline) */}
        <StorySection />

        {/* 3. AI Capabilities Grid */}
        <CapabilitiesSection />

        {/* 4. Comparison & Pre-Footer CTA Banner */}
        <ComparisonSection />
      </main>

      {/* Public Footer */}
      <footer className="relative z-10 border-t border-hairline/70 bg-obsidian py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-8">
          <div className="flex flex-col items-center sm:items-start gap-2">
            <Logo markClass="h-7 sm:h-8" />
            <p className="text-micro text-muted">
              AI Creative Companion untuk kreator konten Indonesia.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted">
            <a href="#alur" className="transition-colors hover:text-ink">
              Alur Kerja
            </a>
            <a href="#kemampuan" className="transition-colors hover:text-ink">
              Fitur
            </a>
            <Link
              href="/privasi"
              className="transition-colors hover:text-ink"
            >
              Privasi
            </Link>
            <Link
              href="/ketentuan"
              className="transition-colors hover:text-ink"
            >
              Ketentuan
            </Link>
          </div>

          <p className="text-micro text-muted/70">
            © {new Date().getFullYear()} Malesan. Hak cipta dilindungi.
          </p>
        </div>
      </footer>
    </div>
  );
}
