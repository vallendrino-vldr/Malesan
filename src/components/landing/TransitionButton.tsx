import React from "react";
import Link from "next/link";

interface TransitionButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "header" | "custom";
  className?: string;
}

export function TransitionButton({
  href,
  children,
  variant = "primary",
  className = "",
  ...props
}: TransitionButtonProps) {
  let baseStyle = "";
  if (variant === "primary") {
    baseStyle =
      "relative inline-flex items-center justify-center gap-2 rounded-xl bg-ember px-7 py-3.5 font-display text-sm sm:text-base font-bold text-obsidian shadow-xs transition-all duration-200 hover:bg-ember-lo active:scale-[0.98] cursor-pointer";
  } else if (variant === "header") {
    baseStyle =
      "flex h-10 items-center justify-center rounded-full border border-hairline/80 bg-surface/80 px-6 font-display text-xs sm:text-sm font-semibold text-ink shadow-xs transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ember-lo cursor-pointer";
  } else if (variant === "secondary") {
    baseStyle =
      "inline-flex items-center justify-center rounded-xl border border-hairline/80 bg-surface/60 px-6 py-3.5 font-display text-sm sm:text-base font-semibold text-ink backdrop-blur-md transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ember-lo active:scale-[0.99] cursor-pointer";
  }

  return (
    <Link
      href={href}
      className={`${baseStyle} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}
