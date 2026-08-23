import { Mascot } from "./Mascot";
import { Logo } from "./Logo";

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
 * Full-viewport Premium AI Companion Splash Screen for route-level loading.
 */
export function MascotSplashScreen({
  title = "Malesan lagi nyiapin workspace lo...",
  subtitle = "AI Creative Companion siap nemenin lo bikin konten.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex min-h-[100dvh] w-full flex-col items-center justify-between bg-obsidian p-6 sm:p-8 select-none overflow-hidden"
    >
      {/* Background Ambient Warmth Glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-72 sm:size-96 rounded-full bg-ember/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 size-40 sm:size-56 rounded-full bg-ember/20 blur-2xl" />

      {/* Top Brand Anchor */}
      <div className="relative z-10 pt-2 opacity-80 transition-opacity hover:opacity-100">
        <Logo markClass="size-6" size="0.95rem" />
      </div>

      {/* Centerpiece: Animated Mascot Companion Stage */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="relative grid place-items-center">
          {/* Subtle Stage Halo Rings */}
          <div className="absolute size-36 sm:size-44 rounded-full border border-ember/25 bg-gradient-to-b from-surface-raised/40 via-surface/30 to-transparent shadow-[0_0_35px_-5px_rgba(255,138,61,0.25)]" />
          <div className="absolute size-28 sm:size-32 rounded-full border border-hairline/80 bg-surface/60 backdrop-blur-sm" />

          {/* Thinking Badge */}
          <div className="absolute -top-3.5 right-1 flex items-center gap-1.5 rounded-full bg-surface-raised/90 border border-ember/35 px-2.5 py-0.5 shadow-xs">
            <span className="size-1.5 rounded-full bg-ember animate-pulse" />
            <span className="font-mono text-[10px] font-semibold text-ember">Lagi mikir</span>
          </div>

          {/* Animated Working Mascot */}
          <div className="relative size-20 sm:size-24 z-10 grid place-items-center">
            <Mascot working={true} className="size-full" />
          </div>
        </div>

        {/* Companion Status Text */}
        <div className="mt-8 text-center max-w-xs sm:max-w-sm px-4">
          <h2 className="font-display text-base sm:text-lg font-bold text-ink tracking-display-sm">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs text-muted leading-relaxed">
              {subtitle}
            </p>
          )}

          {/* Modern Progress Bar */}
          <div className="mt-4 mx-auto w-32 sm:w-36 h-1 overflow-hidden rounded-full bg-surface-raised border border-hairline/60">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-ember to-transparent animate-pulse" />
          </div>
        </div>
      </div>

      {/* Bottom Subtle Whisper */}
      <div className="relative z-10 pb-2">
        <span className="font-mono text-[10px] text-muted/60 tracking-wider uppercase">
          Malesan AI · Creative Companion
        </span>
      </div>
    </div>
  );
}

/** Legacy wrapper mapped to MascotSplashScreen */
export function LavaScreen({ label }: { label: string }) {
  return <MascotSplashScreen title={label} />;
}
