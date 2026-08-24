"use client";

import React, { useState } from "react";
import { useCinematicTransition } from "./CinematicTransitionContext";

interface TransitionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
  onClick,
  ...props
}: TransitionButtonProps) {
  const { startTransitionTo } = useCinematicTransition();
  const [clicked, setClicked] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) onClick(e);
    if (!e.defaultPrevented) {
      setClicked(true);
      startTransitionTo(href);
    }
  };

  let baseStyle = "";
  if (variant === "primary") {
    baseStyle =
      "relative inline-flex items-center justify-center gap-2 rounded-xl bg-ember px-7 py-3.5 font-display text-sm sm:text-base font-bold text-obsidian shadow-sm transition-all duration-300 hover:bg-ember-lo hover:shadow-[0_4px_28px_rgba(255,138,61,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer";
  } else if (variant === "header") {
    baseStyle =
      "flex h-10 items-center justify-center rounded-full border border-hairline/80 bg-surface/80 px-6 font-display text-xs sm:text-sm font-semibold text-ink shadow-xs transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ember-lo cursor-pointer";
  } else if (variant === "secondary") {
    baseStyle =
      "inline-flex items-center justify-center rounded-xl border border-hairline/80 bg-surface/60 px-6 py-3.5 font-display text-sm sm:text-base font-semibold text-ink backdrop-blur-md transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised hover:text-ember-lo active:scale-[0.99] cursor-pointer";
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${baseStyle} ${clicked ? "scale-95 shadow-[0_0_40px_rgba(255,138,61,0.9)] ring-2 ring-ember" : ""} ${className}`}
      {...props}
    >
      {children}
      {clicked && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-xl bg-ember/30 animate-ping pointer-events-none"
        />
      )}
    </button>
  );
}
