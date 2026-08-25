"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { DemoBypassModal } from "@/components/DemoBypassModal";

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
 * Includes a built-in 5-click easter egg that triggers the Creator Demo & Test Bypass modal.
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
  const [showDemoModal, setShowDemoModal] = useState(false);
  const clickCountRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  function handleLogoClick(e: React.MouseEvent) {
    clickCountRef.current += 1;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (clickCountRef.current >= 5) {
      e.preventDefault();
      e.stopPropagation();
      clickCountRef.current = 0;
      setShowDemoModal(true);
      return;
    }

    // If rapidly clicking (more than once), suppress parent link navigation
    if (clickCountRef.current > 1) {
      e.preventDefault();
      e.stopPropagation();
    }

    timerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 2000);
  }

  return (
    <>
      <span
        onClick={handleLogoClick}
        className={`inline-flex items-center ${
          centered ? "justify-center" : "justify-start"
        } select-none transition-opacity duration-200 hover:opacity-90 cursor-pointer ${className}`}
      >
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

      {showDemoModal && (
        <DemoBypassModal
          isOpen={showDemoModal}
          onClose={() => setShowDemoModal(false)}
        />
      )}
    </>
  );
}
