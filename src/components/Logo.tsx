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
 * Uses /branding/logo-header.png without destructive image scaling transforms.
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
    <span className={`inline-flex items-center ${centered ? "justify-center" : "justify-start"} select-none transition-opacity duration-200 hover:opacity-90 ${className}`}>
      <Image
        src="/branding/logo-header.png"
        alt="Malesan — AI Creative Companion"
        width={217}
        height={72}
        priority
        unoptimized
        className={`${markClass} w-auto object-contain`}
      />
    </span>
  );
}
