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
 * Uses /branding/logo-header.png with scale compensation for PNG whitespace.
 */
export function Logo({
  className = "",
  markClass = "h-[36px] sm:h-[40px] lg:h-[48px]",
  centered = false,
}: {
  className?: string;
  markClass?: string;
  showWord?: boolean;
  size?: string;
  centered?: boolean;
}) {
  return (
    <span className={`inline-flex items-center justify-center overflow-visible select-none ${className}`}>
      <div className="relative overflow-visible flex items-center justify-center py-1">
        <Image
          src="/branding/logo-header.png"
          alt="Malesan — AI Creative Companion"
          width={217}
          height={72}
          priority
          unoptimized
          className={`${markClass} w-auto object-contain scale-[1.22] ${
            centered ? "origin-center" : "origin-left"
          } transition-all duration-200 hover:drop-shadow-[0_0_20px_rgba(255,138,61,0.35)] hover:scale-[1.26]`}
        />
      </div>
    </span>
  );
}
