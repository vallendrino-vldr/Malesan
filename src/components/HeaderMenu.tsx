"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshButton } from "./RefreshButton";
import { ThemeToggle } from "./ThemeToggle";
import { TutorialSheet } from "./TutorialSheet";

/**
 * The header's secondary controls, collapsed behind one button on phones.
 *
 * Measured before this existed: on an admin account the header row needed
 * 565px of horizontal space, at every phone width from 320 to 390. Everything
 * after the admin pill — the credit balance and the profile avatar — was simply
 * off the right edge, which is what "icon credit dan profil kepotong" was.
 *
 * Seven controls in a fixed row cannot be made to fit by shrinking them; four
 * of the seven have a 44px floor for a reason. So the three that are settings
 * rather than status — refresh, theme, how-to — move behind one control on
 * phones and stay inline from `sm` up, where there is room.
 *
 * Rendered through a portal for the same reason the tutorial sheet is: the
 * header is `backdrop-blur-xl`, and a `backdrop-filter` makes itself the
 * containing block for `position: fixed` children, so a dropdown anchored to
 * the viewport lays out against the header's own 68px strip instead.
 */
export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState({ top: 0, right: 0 });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btn.current?.getBoundingClientRect();
      if (r) setAnchor({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    place();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <>
      {/* From `sm` up there is room, so no menu — the controls sit in the bar
          where they are discoverable without a tap. */}
      <div className="hidden items-center gap-1 sm:flex">
        <RefreshButton variant="icon" />
        <ThemeToggle />
        <TutorialSheet />
      </div>

      <button
        ref={btn}
        onClick={() => setOpen((v) => !v)}
        aria-label="Pengaturan tampilan"
        aria-expanded={open}
        className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center sm:hidden"
      >
        <span className="skeu-press flex size-8 items-center justify-center rounded-full border border-hairline text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/45 hover:text-ember">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
            <path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
          </svg>
        </span>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[60] cursor-pointer sm:hidden" onClick={() => setOpen(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ top: anchor.top, right: anchor.right }}
              className="absolute w-56 overflow-hidden rounded-xl border border-hairline bg-surface-raised shadow-xl"
            >
              <Row label="Muat ulang">
                <RefreshButton variant="icon" />
              </Row>
              <Row label="Tema terang / gelap">
                <ThemeToggle />
              </Row>
              <Row label="Cara pakai">
                <TutorialSheet />
              </Row>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Each control keeps its own icon and behaviour; the row supplies the label it
 * never had room for in the bar. On a phone this is the first time these three
 * are named rather than guessed at from a glyph.
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-hairline px-3 last:border-b-0">
      <span className="text-mini font-semibold text-ink">{label}</span>
      {children}
    </div>
  );
}
