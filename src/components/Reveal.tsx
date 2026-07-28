import type { CSSProperties, ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Stagger position. Each step adds 60ms to the entrance delay. */
  index?: number;
  className?: string;
};

/**
 * Entrance wrapper: 240ms, 8px upward translate, eased on --ease-heat.
 * DESIGN.md §4.
 *
 * A server component on purpose. The animation is pure CSS (`.reveal` in
 * globals.css), so there is no client bundle, no hydration boundary, and the
 * content is never left invisible if JavaScript fails to load. Reduced motion
 * is handled in CSS too — the translate is dropped, the fade is kept.
 */
export function Reveal({ children, index = 0, className }: RevealProps) {
  return (
    <div
      className={className ? `reveal ${className}` : "reveal"}
      style={{ "--reveal-delay": `${index * 60}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
