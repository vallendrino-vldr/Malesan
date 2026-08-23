"use client";

import Link from "next/link";
import { Mascot } from "@/components/Mascot";

export function CompactCTA() {
  return (
    <section className="relative border-t border-hairline/60 bg-obsidian py-12 sm:py-16">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8 text-center flex flex-col items-center">
        
        {/* Companion Mini Avatar & Dialogue Bubble */}
        <div className="inline-flex items-center gap-3 rounded-full border border-hairline/80 bg-surface/60 px-4 py-2 shadow-xs backdrop-blur-md">
          <div className="size-8 shrink-0">
            <Mascot working={false} className="size-full" />
          </div>
          <span className="text-xs sm:text-sm font-medium text-ink">
            &ldquo;Udah punya ide tapi masih bengong? Mulai aja dulu. Sisanya biar Malesan.&rdquo;
          </span>
        </div>

        {/* Closing Invitation Headline */}
        <h2 className="mt-4 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-tight">
          Siap bikin konten pertama lo?
        </h2>
        
        <p className="mt-2 text-xs sm:text-base text-muted max-w-md">
          Ga perlu prompt ribet. 10 kredit gratis langsung aktif di akun lo tiap hari.
        </p>

        {/* Clean Solid CTA Button */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
          <Link
            href="/masuk"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-ember px-8 py-3.5 font-display text-base font-bold text-obsidian shadow-sm transition-all duration-200 hover:bg-ember-lo hover:shadow-[0_4px_20px_rgba(255,138,61,0.25)] hover:scale-[1.01] active:scale-[0.99]"
          >
            <span>Mulai gratis</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>

        <p className="mt-3 text-micro text-muted/70">
          Masuk dengan akun Google · Tanpa kartu kredit
        </p>
      </div>
    </section>
  );
}
