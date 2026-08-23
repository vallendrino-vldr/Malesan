/**
 * Pure Ambient Light & Hologram Depth Backdrop.
 * 100% purposeful: soft ember focal bloom and subtle depth aura.
 * Zero random particle collision or clutter.
 */
export function ThreeCanvas({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
    >
      {/* Primary Warm Focal Bloom */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[520px] sm:size-[680px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,138,61,0.12)_0%,rgba(255,138,61,0.03)_50%,transparent_70%)] blur-3xl" />

      {/* Secondary Subtle Right Stage Glow */}
      <div className="hidden lg:block absolute top-1/2 right-[15%] -translate-y-1/2 size-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,138,61,0.08)_0%,transparent_65%)] blur-2xl" />
    </div>
  );
}
