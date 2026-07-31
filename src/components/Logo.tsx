/**
 * The Malesan mark.
 *
 * A bead of heat at rest. The outer ring is cold obsidian, the core glows, and
 * a crescent of shadow sits across it like something half-asleep — the brand is
 * "males", not "mati". It reads at 20px in a header and at 512px as an app
 * icon, which is why it is built from three circles and an arc rather than
 * anything clever.
 *
 * Pure SVG: no image request, no layout shift, and it inherits currentColor for
 * the wordmark so one component serves the header, the splash and the icon.
 */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Malesan"
      fill="none"
    >
      <defs>
        <radialGradient id="ml-core" cx="50%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#FFD9B0" />
          <stop offset="38%" stopColor="#FFB067" />
          <stop offset="72%" stopColor="#FF8A3D" />
          <stop offset="100%" stopColor="#C2521A" />
        </radialGradient>
        <linearGradient id="ml-ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3A3128" />
          <stop offset="100%" stopColor="#1A1611" />
        </linearGradient>
      </defs>

      {/* Cold shell */}
      <circle cx="16" cy="16" r="15" fill="url(#ml-ring)" />
      <circle cx="16" cy="16" r="15" stroke="#2A241D" strokeWidth="1" />

      {/* The ember */}
      <circle cx="16" cy="16" r="9.5" fill="url(#ml-core)" />

      {/* Half-lidded crescent — heat at rest, not heat gone */}
      <path
        d="M6.5 16a9.5 9.5 0 0 0 19 0c-2.6 2.4-6 3.7-9.5 3.7S9.1 18.4 6.5 16Z"
        fill="#120E0A"
        fillOpacity="0.55"
      />

      {/* Specular highlight: the single detail that stops it looking flat */}
      <ellipse cx="12.6" cy="11.4" rx="3.1" ry="2.1" fill="#FFF3E4" fillOpacity="0.5" />
    </svg>
  );
}

export function Logo({
  className = "",
  markClass = "size-7",
  showWord = true,
}: {
  className?: string;
  markClass?: string;
  showWord?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClass} />
      {showWord && (
        <span className="font-display text-[1.0625rem] font-bold tracking-display-sm text-ink">
          malesan
        </span>
      )}
    </span>
  );
}
