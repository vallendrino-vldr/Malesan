"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Full-screen blocking overlay while a video is being rendered.
 *
 * The export walks the video frame by frame and can take minutes on a phone. Two
 * things go wrong without this: the user taps around, changes a style or picks
 * another video mid-render, and the export is either corrupted or silently
 * abandoned — and, worse, a screen that does not visibly move reads as a hang, so
 * they close the tab a minute before the file was ready.
 *
 * So it covers everything, eats every pointer and key event, and shows a real
 * frame-accurate percentage rather than a spinner. Portalled to <body> because an
 * ancestor with `backdrop-filter` becomes the containing block for
 * `position: fixed` — a fixed overlay rendered inside one lays itself out inside
 * that element instead of the viewport.
 */
export function ExportOverlay({
  open,
  progress,
  stage,
}: {
  open: boolean;
  /** 0..100 */
  progress: number;
  stage: string;
}) {
  // Freeze the page behind it: no scrolling, and no keyboard route to the
  // controls underneath.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const swallow = (e: KeyboardEvent) => {
      // Everything except the browser's own shortcuts; Tab in particular must not
      // walk focus into the blocked UI behind the overlay.
      if (!e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", swallow, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", swallow, true);
    };
  }, [open]);

  // A render in flight should also survive a stray back-swipe or tab close by at
  // least asking first.
  useEffect(() => {
    if (!open) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Lagi nge-render video"
      aria-busy="true"
      // Every pointer event dies here, so nothing behind it can be tapped.
      onPointerDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-[100] flex touch-none select-none items-center justify-center bg-obsidian/92 px-6 backdrop-blur-sm"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl border border-ember/30 bg-ember/10">
          {/* Compositor-only spin, and it stops for reduced-motion users. */}
          <span className="export-spin block size-7 rounded-full border-2 border-ember/25 border-t-ember" />
        </div>

        <p className="font-display text-lg font-bold tracking-display-sm text-white">
          Lagi nge-render videonya
        </p>
        <p className="mt-1 text-sm leading-relaxed text-white/65">
          {stage || "Nyiapin"} — jangan tutup atau pindah tab dulu ya. Tiap frame
          digambar satu-satu biar hasilnya mulus dan captionnya pas.
        </p>

        <div
          className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-white/12"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-ember transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="tabular mt-2.5 font-mono text-2xl font-bold text-ember" aria-live="polite">
          {pct}%
        </p>
        <p className="mt-1 text-micro text-white/45">
          Makin panjang videonya makin lama. Layar sengaja dikunci biar rendernya gak keganggu.
        </p>
      </div>
    </div>,
    document.body,
  );
}
