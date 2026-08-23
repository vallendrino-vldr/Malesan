import Image from "next/image";

/**
 * The official Malesan App Icon Mark.
 * Sourced from /branding/app-icon.png.
 */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <Image
      src="/branding/app-icon.png"
      alt="Malesan"
      width={128}
      height={128}
      priority
      unoptimized
      className={`${className} object-contain rounded-xl shadow-xs`}
    />
  );
}

/**
 * The official Malesan Header Brand Logo.
 * Uses /branding/logo-header.png with responsive scaling and crisp presentation.
 */
export function Logo({
  className = "",
  markClass = "h-[30px] sm:h-[32px] lg:h-[42px]",
}: {
  className?: string;
  markClass?: string;
  showWord?: boolean;
  size?: string;
}) {
  return (
    <span className={`inline-flex items-center select-none ${className}`}>
      <Image
        src="/branding/logo-header.png"
        alt="Malesan — AI Creative Companion"
        width={217}
        height={72}
        priority
        unoptimized
        className={`${markClass} w-auto object-contain transition-all duration-200 hover:drop-shadow-[0_0_16px_rgba(255,138,61,0.3)] hover:scale-[1.02]`}
      />
    </span>
  );
}
