import Image from "next/image";
import { Mascot } from "./Mascot";

/**
 * Liquid lava loader for small inline panels.
 */
export function LavaLoader({
  label,
  size = 64,
  className = "",
}: {
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <span
        className="lava"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
      <p className="text-mini font-medium text-muted">{label}</p>
    </div>
  );
}

/**
 * Full-viewport Premium AI Creative Companion Splash Screen for route-level loading.
 */
export function MascotSplashScreen({
  title = "Malesan sedang menyiapkan workspace kreatif kamu.",
  subtitle = "AI Creative Companion siap nemenin lo bikin ide, hook, dan naskah viral.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex min-h-[100dvh] w-full flex-col items-center justify-between bg-obsidian p-6 sm:p-10 select-none overflow-hidden"
    >
      {/* Cinematic Ambient Atmosphere Glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[420px] sm:size-[560px] rounded-full bg-ember/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 size-60 sm:size-72 rounded-full bg-ember/20 blur-2xl animate-pulse" />

      {/* Subtle Floating Ambient Particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
        <div className="absolute top-1/4 left-1/4 size-1 rounded-full bg-ember animate-ping" />
        <div className="absolute top-1/3 right-1/4 size-1.5 rounded-full bg-ember/80 animate-pulse delay-300" />
        <div className="absolute bottom-1/3 left-1/3 size-1 rounded-full bg-ember/60 animate-pulse delay-700" />
        <div className="absolute top-2/3 right-1/3 size-1 rounded-full bg-ember/90 animate-ping delay-500" />
      </div>

      {/* TOP: Header Logo */}
      <div className="relative z-10 pt-2 opacity-85 transition-opacity hover:opacity-100">
        <Image
          src="/branding/logo-header.png"
          alt="Malesan"
          width={217}
          height={72}
          priority
          unoptimized
          className="h-6 sm:h-7.5 w-auto object-contain"
        />
      </div>

      {/* CENTER: Mascot Working Stage + Holographic Creative Floating Elements */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto w-full max-w-2xl">
        <div className="relative grid place-items-center w-full min-h-[190px] sm:min-h-[230px]">
          
          {/* Hologram Stage Platform & Glow Rings */}
          <div className="absolute size-44 sm:size-56 rounded-full border border-ember/30 bg-gradient-to-b from-surface-raised/60 via-surface/40 to-transparent shadow-[0_0_50px_-10px_rgba(255,138,61,0.35)]" />
          <div className="absolute size-32 sm:size-40 rounded-full border border-hairline/90 bg-surface/70" />
          <div className="absolute size-56 sm:size-72 rounded-full border border-dashed border-ember/15 animate-[spin_24s_linear_infinite]" />

          {/* Floating Hologram Idea Card Left (Desktop & Tablet) */}
          <div className="hidden sm:flex absolute -left-2 top-2 z-20 items-center gap-2 rounded-xl border border-ember/30 bg-surface/85 px-3 py-2 shadow-lg backdrop-blur-md animate-[float-a_4.5s_ease-in-out_infinite]">
            <div className="grid size-6 place-items-center rounded-lg bg-ember/15 text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <p className="font-mono text-[9px] font-bold text-ember uppercase tracking-wider">Hook 3 Detik</p>
              <p className="text-[11px] font-medium text-ink">Stop scrolling, tonton ini!</p>
            </div>
          </div>

          {/* Floating Hologram Script Card Right (Desktop & Tablet) */}
          <div className="hidden sm:flex absolute -right-2 bottom-4 z-20 items-center gap-2 rounded-xl border border-ember/30 bg-surface/85 px-3 py-2 shadow-lg backdrop-blur-md animate-[float-b_5.2s_ease-in-out_infinite]">
            <div className="grid size-6 place-items-center rounded-lg bg-ember/15 text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <p className="font-mono text-[9px] font-bold text-ember uppercase tracking-wider">Naskah Video</p>
              <p className="text-[11px] font-medium text-ink">Format 45s · Santai &amp; Rapi</p>
            </div>
          </div>

          {/* AI Processing Status Pill */}
          <div className="absolute -top-4 sm:-top-5 z-20 flex items-center gap-1.5 rounded-full border border-ember/40 bg-surface-raised/95 px-3 py-1 shadow-md backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-ember animate-pulse" />
            <span className="font-mono text-[10px] font-bold tracking-wider text-ember uppercase">AI Creative Companion</span>
          </div>

          {/* Animated Working Mascot with Breathing & Subtle Bounce */}
          <div className="relative size-24 sm:size-32 z-10 grid place-items-center animate-[bounce-gentle_3s_ease-in-out_infinite]">
            <Mascot working={true} className="size-full drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)]" />
          </div>
        </div>

        {/* Text & Status Copy */}
        <div className="mt-8 text-center max-w-sm sm:max-w-md px-4">
          <h2 className="font-display text-base sm:text-lg lg:text-xl font-bold text-ink tracking-display-sm leading-snug">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1.5 text-xs sm:text-sm text-muted leading-relaxed">
              {subtitle}
            </p>
          )}

          {/* Holographic Laser Progress Beam */}
          <div className="relative mt-5 mx-auto w-40 sm:w-52 h-1 overflow-hidden rounded-full bg-surface-raised border border-hairline/80">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-ember to-transparent animate-[shimmer_1.8s_infinite]" />
          </div>
        </div>
      </div>

      {/* BOTTOM: Subtle Brand Identity Whisper */}
      <div className="relative z-10 pb-2">
        <span className="font-mono text-[10px] text-muted/60 tracking-widest uppercase">
          MALESAN · AI CREATIVE COMPANION
        </span>
      </div>
    </div>
  );
}

/** Legacy wrapper mapped to MascotSplashScreen */
export function LavaScreen({ label }: { label: string }) {
  return <MascotSplashScreen title={label} />;
}
