/**
 * The figure.
 *
 * Deliberately the same construction language as the rest of the product — a
 * rounded slab body, a visor, one ember accent — rather than a stock robot.
 * The arms only type while text is arriving; when the stream pauses they rest,
 * so the animation carries information instead of decorating a wait.
 *
 * Lived inside GenerationProgress and had no export, so the one thing in this
 * product that looks like a character could only ever appear during a
 * generation. It is the same drawing in both places on purpose: a mascot that
 * is redrawn per surface stops being a mascot.
 *
 * Not a favicon. It is built from ten-odd shapes and a 10px visor; at 16px it
 * collapses into a smudge. `LogoMark` is three circles and an arc precisely so
 * it survives that size — see DECISIONS.md on the wordmark.
 */
export function Mascot({
  working = false,
  /**
   * Easter-egg state. Nothing in the product sets this during normal use — it
   * is reached by tapping the idle figure, and it resets itself.
   */
  awake = false,
  className = "size-16",
}: {
  working?: boolean;
  awake?: boolean;
  className?: string;
}) {
  // The visor holds exactly one of three faces. Working wins over awake: a
  // generation in flight is information, the easter egg is a joke.
  const face = working ? "scan" : awake ? "awake" : "idle";

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={`${className} shrink-0`}
      // Non-decorative meaning is in the text next to it; this is the flourish.
    >
      <g className={working ? "mascot-body" : ""}>
        {/* antenna */}
        <line x1="32" y1="8" x2="32" y2="14" stroke="var(--color-hairline)" strokeWidth="2" />
        <circle
          cx="32"
          cy="7"
          r="2"
          fill="var(--color-ember)"
          className={working ? "mascot-led" : ""}
          opacity={working || awake ? undefined : 0.35}
        />

        {/* head */}
        <rect
          x="17"
          y="14"
          width="30"
          height="21"
          rx="7"
          fill="var(--color-surface-raised)"
          stroke="var(--color-hairline)"
          strokeWidth="1.5"
        />
        {/* visor — clipped so the scan line cannot escape the face */}
        <clipPath id="ml-visor">
          <rect x="21" y="19" width="22" height="10" rx="5" />
        </clipPath>
        <g clipPath="url(#ml-visor)">
          <rect x="21" y="19" width="22" height="10" rx="5" fill="var(--color-obsidian)" />
          {face === "scan" && (
            <rect
              x="21"
              y="19"
              width="6"
              height="10"
              fill="var(--color-ember)"
              opacity="0.55"
              className="mascot-scan"
            />
          )}
          {face === "idle" && (
            <>
              <circle cx="27" cy="24" r="1.8" fill="var(--color-ember)" opacity="0.7" />
              <circle cx="37" cy="24" r="1.8" fill="var(--color-ember)" opacity="0.7" />
            </>
          )}
          {/* Wide eyes and a small grin. The whole gag is that the lazy one is
              briefly, visibly awake — so it has to be legible at a glance. */}
          {face === "awake" && (
            <>
              <circle cx="27" cy="23.5" r="2.6" fill="var(--color-ember)" />
              <circle cx="37" cy="23.5" r="2.6" fill="var(--color-ember)" />
              <path
                d="M28 27.5q4 2.4 8 0"
                fill="none"
                stroke="var(--color-ember)"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </>
          )}
        </g>

        {/* body */}
        <rect
          x="21"
          y="37"
          width="22"
          height="17"
          rx="5"
          fill="var(--color-surface-raised)"
          stroke="var(--color-hairline)"
          strokeWidth="1.5"
        />
        <rect x="27" y="42" width="10" height="2" rx="1" fill="var(--color-hairline)" />
        <rect x="27" y="46" width="6" height="2" rx="1" fill="var(--color-hairline)" />

        {/* arms — the typing */}
        <g className={working ? "mascot-arm-a" : ""}>
          <rect
            x="12"
            y="39"
            width="8"
            height="3.5"
            rx="1.75"
            fill="var(--color-ember)"
            opacity="0.9"
          />
        </g>
        <g className={working ? "mascot-arm-b" : ""}>
          <rect
            x="44"
            y="39"
            width="8"
            height="3.5"
            rx="1.75"
            fill="var(--color-ember)"
            opacity="0.9"
          />
        </g>

        {/* desk */}
        <rect x="10" y="54" width="44" height="2.5" rx="1.25" fill="var(--color-hairline)" />
      </g>
    </svg>
  );
}
