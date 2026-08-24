/**
 * The figure.
 *
 * Deliberately the same construction language as the rest of the product — a
 * rounded slab body, a visor, one ember accent — rather than a stock robot.
 * The arms only type while text is arriving; when the stream pauses they rest,
 * so the animation carries information instead of decorating a wait.
 *
 * Supports expressive companion moods: "sleepy", "thinking", "ideas", "script", "ready", "awake", "idle".
 */
export function Mascot({
  working = false,
  awake = false,
  mood,
  className = "size-16",
}: {
  working?: boolean;
  awake?: boolean;
  mood?: "sleepy" | "thinking" | "ideas" | "script" | "ready" | "awake" | "idle";
  className?: string;
}) {
  // Resolve effective mood from explicit mood or legacy working/awake props
  const effectiveMood = mood || (working ? "thinking" : awake ? "awake" : "idle");

  const isTyping = effectiveMood === "thinking" || effectiveMood === "script" || (working && !mood);
  const isSleepy = effectiveMood === "sleepy";
  const isReady = effectiveMood === "ready";
  const isIdeas = effectiveMood === "ideas";
  const isAwakeOrReady = effectiveMood === "awake" || effectiveMood === "ready";

  const ledColor = isReady ? "#6fcf97" : "#ff8a3d";

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={`${className} shrink-0 transition-transform duration-300`}
    >
      <g
        className={
          isTyping
            ? "mascot-body"
            : isSleepy
              ? "opacity-80"
              : isReady
                ? "animate-[bounce-gentle_2s_ease-in-out_infinite]"
                : "mascot-idle-body"
        }
      >
        {/* antenna */}
        <line x1="32" y1="8" x2="32" y2="14" stroke="var(--color-hairline)" strokeWidth="2" />
        <circle
          cx="32"
          cy="7"
          r="2"
          fill={ledColor}
          className={isTyping ? "mascot-led" : isSleepy ? "" : isReady ? "animate-pulse" : "mascot-idle-led"}
          opacity={isSleepy ? 0.2 : isTyping || isAwakeOrReady || isIdeas ? 1 : 0.4}
        />

        {/* head */}
        <rect
          x="17"
          y="14"
          width="30"
          height="21"
          rx="7"
          fill="var(--color-surface-raised)"
          stroke={isReady ? "rgba(111,207,151,0.4)" : "var(--color-hairline)"}
          strokeWidth="1.5"
        />
        {/* visor — clipped so the scan line cannot escape the face */}
        <clipPath id="ml-visor">
          <rect x="21" y="19" width="22" height="10" rx="5" />
        </clipPath>
        <g clipPath="url(#ml-visor)">
          <rect x="21" y="19" width="22" height="10" rx="5" fill="#0d0b08" />
          
          {/* Scanning Visor (Thinking / Scripting) */}
          {(effectiveMood === "thinking" || effectiveMood === "script") && (
            <rect
              x="21"
              y="19"
              width="6"
              height="10"
              fill="#ff8a3d"
              opacity="0.65"
              className="mascot-scan"
            />
          )}

          {/* Sleepy Standby Eyes (Half-closed slits) */}
          {isSleepy && (
            <g opacity="0.35">
              <line x1="25" y1="24.5" x2="29" y2="24.5" stroke="#ff8a3d" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="35" y1="24.5" x2="39" y2="24.5" stroke="#ff8a3d" strokeWidth="1.6" strokeLinecap="round" />
            </g>
          )}

          {/* Alert Ideas Eyes (Bright dots) */}
          {isIdeas && (
            <g className="animate-pulse">
              <circle cx="27" cy="24" r="2.2" fill="#ff8a3d" />
              <circle cx="37" cy="24" r="2.2" fill="#ff8a3d" />
              <circle cx="27.5" cy="23.5" r="0.8" fill="#ffffff" opacity="0.8" />
              <circle cx="37.5" cy="23.5" r="0.8" fill="#ffffff" opacity="0.8" />
            </g>
          )}

          {/* Idle Eyes */}
          {effectiveMood === "idle" && (
            <g className="mascot-idle-eyes">
              <circle cx="27" cy="24" r="1.8" fill="#ff8a3d" opacity="0.7" />
              <circle cx="37" cy="24" r="1.8" fill="#ff8a3d" opacity="0.7" />
            </g>
          )}

          {/* Awake / Ready Smile Face */}
          {isAwakeOrReady && (
            <g>
              <circle cx="27" cy="23.5" r="2.4" fill={isReady ? "#6fcf97" : "#ff8a3d"} />
              <circle cx="37" cy="23.5" r="2.4" fill={isReady ? "#6fcf97" : "#ff8a3d"} />
              <path
                d="M28 27.2q4 2.2 8 0"
                fill="none"
                stroke={isReady ? "#6fcf97" : "#ff8a3d"}
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </g>
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
          stroke={isReady ? "rgba(111,207,151,0.4)" : "var(--color-hairline)"}
          strokeWidth="1.5"
        />
        <rect x="27" y="42" width="10" height="2" rx="1" fill="var(--color-hairline)" />
        <rect x="27" y="46" width="6" height="2" rx="1" fill="var(--color-hairline)" />

        {/* arms — the typing */}
        <g className={isTyping ? "mascot-arm-a" : ""}>
          <rect
            x="12"
            y="39"
            width="8"
            height="3.5"
            rx="1.75"
            fill={isReady ? "#6fcf97" : "#ff8a3d"}
            opacity="0.9"
          />
        </g>
        <g className={isTyping ? "mascot-arm-b" : ""}>
          <rect
            x="44"
            y="39"
            width="8"
            height="3.5"
            rx="1.75"
            fill={isReady ? "#6fcf97" : "#ff8a3d"}
            opacity="0.9"
          />
        </g>

        {/* desk */}
        <rect x="10" y="54" width="44" height="2.5" rx="1.25" fill="var(--color-hairline)" />
      </g>
    </svg>
  );
}
