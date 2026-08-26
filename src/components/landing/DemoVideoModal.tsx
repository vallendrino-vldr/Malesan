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

      {/* Modal Dialog Container with Unified Header */}
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/[0.15] bg-[#0c0c0e] shadow-2xl animate-scaleUp">
        <TutorialVideoPlayer
          videoSrc="/tutorial/tutorial-demo.mp4"
          autoPlay={true}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
