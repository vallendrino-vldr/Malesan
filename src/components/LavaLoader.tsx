/**
 * Liquid lava loader.
 *
 * Every navigation in this app is a server round-trip — auth, profile, credits,
 * and per-tab queries — and until now the screen simply froze for the duration
 * with nothing on it. A spinner alone would not fix that: people need to know
 * *what* is loading, not just that something is.
 *
 * So the label is required, not optional. "Lagi buka Pipeline" answers the
 * question the frozen screen was raising.
 *
 * The animation is pure CSS (see globals.css) and touches only border-radius,
 * transform and opacity, so it composites on the GPU. A loading indicator that
 * itself drops frames on a mid-range Android is worse than none.
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
      <p className="text-[12.5px] font-medium text-muted">{label}</p>
    </div>
  );
}

/** Full-viewport version for route-level `loading.tsx` files. */
export function LavaScreen({ label }: { label: string }) {
  return (
    <div className="grid min-h-[60dvh] w-full place-items-center px-6">
      <LavaLoader label={label} size={72} />
    </div>
  );
}
