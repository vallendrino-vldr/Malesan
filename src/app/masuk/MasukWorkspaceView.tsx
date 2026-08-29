"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Mascot } from "@/components/Mascot";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const AI_THOUGHTS = [
  "Masih ada ide yang belum jadi konten?",
  "Tenang, kita mulai dari satu ide dulu.",
  "Udah siap bikin sesuatu hari ini?",
  "Sini masuk, gue temenin dari nol sampai siap tayang.",
];

const emptySubscribe = () => () => {};
const useMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false);

interface MasukWorkspaceViewProps {
  safeNext: string;
  referralCode?: string | null;
  serverError?: string;
}

export function MasukWorkspaceView({
  safeNext,
  referralCode,
  serverError,
}: MasukWorkspaceViewProps) {
  const [thoughtIndex, setThoughtIndex] = useState(0);
  const [fadeThought, setFadeThought] = useState(true);
  const [standbyMessage, setStandbyMessage] = useState("Lagi nunggu ide lo...");
  const isMounted = useMounted();

  useEffect(() => {
    // Thought bubble rotation timer every 6s
    const thoughtInterval = setInterval(() => {
      setFadeThought(false);
      setTimeout(() => {
        setThoughtIndex((prev) => (prev + 1) % AI_THOUGHTS.length);
        setFadeThought(true);
      }, 400);
    }, 6000);

    // Standby message alternation every 4s
    const standbyInterval = setInterval(() => {
      setStandbyMessage((prev) =>
        prev === "Lagi nunggu ide lo..."
          ? "Siap bantu bikin konten."
          : "Lagi nunggu ide lo..."
      );
    }, 4500);

    return () => {
      clearInterval(thoughtInterval);
      clearInterval(standbyInterval);
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden bg-[#080808] text-[#F5F5F5] selection:bg-ember selection:text-obsidian">
      {/* =========================================================================
          AMBIENT ATMOSPHERIC LIGHTING & SUBTLE FLOATING PARTICLES
         ========================================================================= */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {/* Top-center ambient warm ember bloom */}
        <div className="absolute -top-[120px] left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(255,138,61,0.18)_0%,rgba(255,138,61,0.05)_45%,transparent_70%)] blur-3xl animate-pulse" style={{ animationDuration: "8s" }} />

        {/* Left side living workspace glow */}
        <div className="absolute top-1/3 -left-[150px] w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(255,138,61,0.12)_0%,transparent_60%)] blur-3xl" />

        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_85%)] opacity-40" />
      </div>

      {/* =========================================================================
          TOP NAV BAR: Seamless Logo + Back Link
         ========================================================================= */}
      <header className="relative z-20 w-full border-b border-white/[0.06] bg-[#080808]/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 sm:h-[72px] w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            aria-label="Malesan — Kembali ke Beranda"
            className="flex shrink-0 items-center overflow-visible transition-opacity hover:opacity-90"
          >
            <Logo markClass="h-9 sm:h-10" />
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface/60 px-4 py-1.5 text-xs font-semibold text-muted transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ink cursor-pointer"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-3.5"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Beranda</span>
          </Link>
        </div>
      </header>

      {/* =========================================================================
          MAIN CINEMATIC AI WORKSPACE CONTAINER (DESKTOP 2-COL / MOBILE STACK)
         ========================================================================= */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-5 py-8 sm:py-12 sm:px-8">
        <div className={`grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-14 transition-all duration-700 ease-out ${
          isMounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-[0.98]"
        }`}>

          {/* =======================================================================
              LEFT COLUMN: Living AI Companion Scene (7 Cols Desktop, Order 2 on Mobile)
             ======================================================================= */}
          <div className="relative flex flex-col items-center lg:col-span-7 order-2 lg:order-1">
            <div className="relative w-full overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#141210]/90 to-[#0d0c0a]/95 p-5 sm:p-8 lg:p-10 shadow-2xl backdrop-blur-2xl">
              {/* Internal Ambient Radial Lighting */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-20 -left-20 size-80 rounded-full bg-[radial-gradient(circle,rgba(255,138,61,0.2)_0%,transparent_70%)] blur-2xl"
              />

              {/* Top Scene Bar: Workspace Status & Live Indicator */}
              <div className="relative z-10 flex items-center justify-between border-b border-white/[0.06] pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-ember opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-ember" />
                  </span>
                  <span className="font-mono text-micro font-bold tracking-wider text-ember uppercase">
                    Ruang Kerja Malesan
                  </span>
                </div>

                <span className="rounded-full border border-white/[0.08] bg-surface/80 px-2.5 py-0.5 font-mono text-[10px] font-medium text-muted">
                  AI STANDBY
                </span>
              </div>

              {/* Central Living Mascot Hologram Stage */}
              <div className="relative my-4 sm:my-8 flex flex-col items-center justify-center">
                {/* Slow Rotating Orbit Rings */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute size-44 sm:size-64 rounded-full border border-dashed border-ember/20 animate-[spin_40s_linear_infinite]"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute size-36 sm:size-52 rounded-full border border-ember/15 animate-[spin_25s_linear_infinite_reverse]"
                />

                {/* Floating AI Speech Thought Bubble with Beak Pointer */}
                <div
                  className={`relative z-20 mb-3 sm:mb-6 max-w-xs sm:max-w-sm rounded-2xl border border-ember/30 bg-surface/95 px-4 py-2.5 sm:py-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300 ${
                    fadeThought ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-2 scale-95"
                  }`}
                >
                  <p className="text-center font-display text-xs sm:text-sm font-medium text-[#F5F5F5] leading-snug">
                    &ldquo;{AI_THOUGHTS[thoughtIndex]}&rdquo;
                  </p>
                  {/* Triangle Beak pointing down */}
                  <div
                    aria-hidden="true"
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 size-0 border-x-[7px] border-x-transparent border-t-[8px] border-t-surface"
                  />
                </div>

                {/* Living Mascot with continuous breathing motion */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="size-24 sm:size-36 lg:size-40 animate-[bounce-gentle_3s_ease-in-out_infinite] drop-shadow-[0_12px_28px_rgba(255,138,61,0.25)]">
                    <Mascot mood="ready" className="size-full" />
                  </div>

                  {/* Holographic Glowing Base Pedestal */}
                  <div
                    aria-hidden="true"
                    className="mt-2 h-2.5 w-24 sm:w-36 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,138,61,0.7)_0%,transparent_75%)] blur-[2px]"
                  />
                </div>
              </div>

              {/* Bottom Mascot Dynamic State Footer */}
              <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2.5 rounded-2xl border border-white/[0.06] bg-black/40 px-4 py-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-ember animate-pulse" />
                  <span className="font-mono text-muted text-micro font-medium uppercase">
                    Status Companion:
                  </span>
                  <span className="font-display font-semibold text-[#F5F5F5] transition-all duration-300">
                    {standbyMessage}
                  </span>
                </div>

                <span className="font-mono text-[11px] text-ember/80 hidden sm:inline">
                  ⚡ 10 Kredit Harian
                </span>
              </div>
            </div>
          </div>

          {/* =======================================================================
              RIGHT COLUMN: Immersive Login Panel (5 Cols Desktop, Order 1 on Mobile)
             ======================================================================= */}
          <div className="relative flex flex-col lg:col-span-5 order-1 lg:order-2">
            <div className="relative w-full rounded-3xl border border-white/[0.08] bg-surface/70 p-6 sm:p-8 lg:p-9 shadow-2xl backdrop-blur-2xl">
              {/* Subtle top ember glow inside card */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-14 right-0 size-48 rounded-full bg-[radial-gradient(circle,rgba(255,138,61,0.15)_0%,transparent_70%)] blur-2xl"
              />

              {/* Small Category Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-3.5 py-1 text-micro font-bold tracking-wide text-ember uppercase">
                <span className="size-1.5 rounded-full bg-ember animate-pulse" />
                AI Creative Companion
              </div>

              {/* Compelling Destination Headline */}
              <h1 className="mt-4 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F5F5] leading-tight">
                Masuk ke ruang kerja Malesan.
              </h1>

              {/* Subtitle */}
              <p className="mt-2.5 text-sm leading-relaxed text-muted">
                Ambil lagi ide, script, dan workflow kreatif lo. Teman AI lo udah standby di dalam.
              </p>

              {/* Server Error Alert if any */}
              {serverError && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-xs leading-relaxed text-danger"
                >
                  {serverError}
                </div>
              )}

              {/* Primary High-Conversion Google OAuth Action */}
              <div className="mt-7">
                <GoogleSignInButton
                  next={safeNext}
                  referralCode={referralCode}
                />
              </div>

              {/* Free Credits Trust Badge */}
              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <div className="flex items-start gap-2 text-xs text-muted">
                  <span className="text-ember font-bold text-sm leading-none">✓</span>
                  <p className="leading-snug">
                    <strong className="text-[#F5F5F5] font-semibold">10 kredit gratis</strong> langsung masuk tiap hari. Tanpa perlu kartu kredit.
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between text-micro text-muted/70">
                  <span>Belum punya akun? <strong className="text-ember font-medium">Mulai gratis otomatis.</strong></span>
                  <span className="font-mono">Google 1-Klik</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* =========================================================================
          FOOTER: Clean & Minimal Legal Links
         ========================================================================= */}
      <footer className="relative z-10 w-full border-t border-white/[0.06] bg-[#080808] py-5">
        <div className="mx-auto flex w-full max-w-6xl flex-col sm:flex-row items-center justify-between gap-3 px-5 sm:px-8 text-xs text-muted">
          <span>© {new Date().getFullYear()} Malesan. AI Creative Companion.</span>
          <div className="flex items-center gap-5">
            <Link href="/privasi" className="transition-colors hover:text-ink">
              Privasi
            </Link>
            <Link href="/ketentuan" className="transition-colors hover:text-ink">
              Ketentuan
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
