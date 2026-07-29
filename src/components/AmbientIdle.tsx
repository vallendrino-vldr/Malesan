import { LogoMark } from "./Logo";

/**
 * The idle centrepiece. Two orbital rings on different 3D axes around a
 * breathing ember, with the mark floating at the centre.
 *
 * It is decorative and therefore `aria-hidden`, but it is not noise: it is the
 * only thing on the dashboard that moves when the user is doing nothing, and
 * "moves slowly while idle" is the brand argument made visually. Revolutions
 * take 34s and 44s — fast enough to notice, slow enough that it never reads as
 * a loading spinner.
 *
 * Pure CSS transforms, no JavaScript, no canvas. See globals.css.
 */
export function AmbientIdle({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`ambient-idle pointer-events-none relative grid place-items-center ${className}`}
    >
      <div className="ambient-idle__shell relative grid size-full place-items-center">
        {/* Warm floor glow so the rings sit in something rather than on top of it */}
        <div className="absolute size-[85%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-ember)_20%,transparent),transparent_68%)] blur-xl" />

        <div className="ambient-idle__ring absolute size-[92%]" />
        <div className="ambient-idle__ring ambient-idle__ring--b absolute size-[68%]" />

        <div className="ambient-idle__core absolute size-[46%] rounded-full blur-md" />

        <LogoMark className="relative size-[34%] drop-shadow-[0_0_18px_color-mix(in_oklab,var(--color-ember)_55%,transparent)]" />
      </div>
    </div>
  );
}
