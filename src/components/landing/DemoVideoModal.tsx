"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { TutorialVideoPlayer } from "@/components/tutorial/TutorialVideoPlayer";

export function DemoVideoModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      {/* Dim Ambient Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Container */}
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/[0.15] bg-[#0c0c0e] shadow-2xl animate-scaleUp">
        {/* Header with Title and Close Button */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5 bg-surface/50">
          <div className="flex items-center gap-2.5">
            <span className="flex size-2 rounded-full bg-ember animate-pulse" />
            <h3 className="font-display text-sm font-bold text-ink">
              Demo Praktis Malesan (Full HD)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-ink cursor-pointer"
            aria-label="Tutup"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Video Player */}
        <div className="p-3 sm:p-4">
          <TutorialVideoPlayer videoSrc="/tutorial/tutorial-demo.mp4" autoPlay={true} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
