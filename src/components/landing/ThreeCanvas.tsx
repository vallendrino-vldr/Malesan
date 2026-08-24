/**
 * Living Ambient Light & Hologram Depth Backdrop.
 * 100% purposeful: soft ember focal bloom and living atmospheric drift at 60 FPS.
 */
export function ThreeCanvas({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
    >
      {/* Primary Living Focal Bloom with subtle 12s breath cycle */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[520px] sm:size-[720px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,138,61,0.13)_0%,rgba(255,138,61,0.03)_50%,transparent_70%)] blur-3xl transition-transform duration-1000 ease-out"
        style={{
          animation: "pulse 10s ease-in-out infinite alternate",
        }}
      />

      {/* Secondary Living Stage Atmosphere */}
      <div
        className="hidden lg:block absolute top-1/2 right-[12%] -translate-y-1/2 size-[440px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,138,61,0.09)_0%,transparent_65%)] blur-2xl"
        style={{
          animation: "pulse 14s ease-in-out infinite alternate-reverse",
        }}
      />
    </div>
  );
}
