"use client";

import React, { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface CinematicTransitionContextValue {
  isTransitioning: boolean;
  transitionStage: "idle" | "ignite" | "bloom" | "zoom" | "void";
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
  const [, startReactTransition] = useTransition();
  const [transitionStage, setTransitionStage] = useState<"idle" | "ignite" | "bloom" | "zoom" | "void">("idle");

  const startTransitionTo = (href: string) => {
    if (transitionStage !== "idle") return;

    // 0ms: Ignite CTA & slight initial blur
    setTransitionStage("ignite");

    // 300ms: Ambient orange bloom sweeps out
    setTimeout(() => {
      setTransitionStage("bloom");
    }, 300);

    // 600ms: Cinematic page zoom & deep blur
    setTimeout(() => {
      setTransitionStage("zoom");
    }, 600);

    // 900ms: Full dark void screen
    setTimeout(() => {
      setTransitionStage("void");
    }, 900);

    // 1050ms: Push to destination
    setTimeout(() => {
      startReactTransition(() => {
        router.push(href);
      });
    }, 1050);
  };

  const isTransitioning = transitionStage !== "idle";

  return (
    <CinematicTransitionContext.Provider
      value={{
        isTransitioning,
        transitionStage,
        startTransitionTo,
      }}
    >
      {/* Target Container with GPU Accelerated Morph */}
      <div
        className={`relative min-h-full flex-1 flex flex-col transition-all duration-500 ease-out ${
          transitionStage === "ignite"
            ? "filter blur-[2px]"
            : transitionStage === "bloom"
            ? "filter blur-[6px] scale-[1.02]"
            : transitionStage === "zoom"
            ? "filter blur-[14px] scale-[1.08]"
            : transitionStage === "void"
            ? "filter blur-[20px] scale-[1.1] opacity-0"
            : ""
        }`}
      >
        {children}
      </div>

      {/* Cinematic Transition Overlay Layers */}
      {isTransitioning && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
        >
          {/* Radial Orange Expanding Shockwave / Bloom (300ms - 900ms) */}
          <div
            className={`absolute inset-0 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_40%,rgba(255,138,61,0.45)_0%,rgba(255,138,61,0.15)_40%,transparent_70%)] ${
              transitionStage === "bloom" || transitionStage === "zoom"
                ? "opacity-100 scale-125 transition-transform duration-700 ease-out"
                : "opacity-0 scale-75"
            }`}
          />

          {/* Deep Dark Void Transition Curtain (900ms+) */}
          <div
            className={`absolute inset-0 bg-[#080808] transition-opacity duration-300 ${
              transitionStage === "void" ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Center subtle glowing orb / mascot pulse in void */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="size-3 rounded-full bg-ember shadow-[0_0_24px_#ff8a3d] animate-ping" />
              <span className="font-mono text-micro font-medium tracking-widest text-ember/80 uppercase animate-pulse">
                Membuka Ruang Kerja Malesan...
              </span>
            </div>
          </div>
        </div>
      )}
    </CinematicTransitionContext.Provider>
  );
}
