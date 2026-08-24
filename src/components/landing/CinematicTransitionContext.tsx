"use client";

import React, { createContext, useContext } from "react";
import { useRouter } from "next/navigation";

interface CinematicTransitionContextValue {
  isTransitioning: boolean;
  transitionStage: "idle";
  startTransitionTo: (href: string) => void;
}

const CinematicTransitionContext = createContext<CinematicTransitionContextValue>({
  isTransitioning: false,
  transitionStage: "idle",
  startTransitionTo: () => {},
});

export function useCinematicTransition() {
  return useContext(CinematicTransitionContext);
}

export function CinematicTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const startTransitionTo = (href: string) => {
    router.push(href);
  };

  return (
    <CinematicTransitionContext.Provider
      value={{
        isTransitioning: false,
        transitionStage: "idle",
        startTransitionTo,
      }}
    >
      <div className="relative min-h-full flex-1 flex flex-col">
        {children}
      </div>
    </CinematicTransitionContext.Provider>
  );
}
