"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresh.
 *
 * An installed PWA has no address bar, so there is no pull-to-refresh and no
 * reload button — a stale screen has no way out short of force-quitting the app.
 *
 * The first version called only `router.refresh()`, which re-runs the server
 * components and pulls fresh credits, pipeline state and config. That fixes
 * stale *data*. It cannot fix a stale *build*: the JavaScript already running
 * in the page is whatever the service worker handed over at launch, so after a
 * deploy the installed app keeps running last week's code and none of the new
 * features appear no matter how many times you press refresh. That is the
 * "kok fiturnya belum ada" case, and it is a different problem with a different
 * fix.
 *
 * So this now does both, in order:
 *
 *   1. Ask the service worker to check the server for a new build.
 *   2. If one is waiting, tell it to take over and do a real page load. The new
 *      code is now running.
 *   3. If there is no new build, just re-fetch the data.
 *
 * Step 1 is a network round trip, so the control reports which of the two it
 * did instead of looking identical either way.
 */

const NEW_BUILD_WAIT_MS = 3500;

/** Resolves to true when a new build is installed and waiting to take over. */
async function findWaitingBuild(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    if (reg.waiting) return reg;

    await reg.update();
    if (reg.waiting) return reg;

    // update() resolves once the check is *dispatched*; a worker that is still
    // downloading shows up shortly after. Wait briefly rather than declaring
    // "already up to date" before the answer has arrived.
    if (!reg.installing) return null;
    return await new Promise((resolve) => {
      const done = setTimeout(() => resolve(null), NEW_BUILD_WAIT_MS);
      reg.installing?.addEventListener("statechange", function onState(this: ServiceWorker) {
        if (this.state === "installed") {
          clearTimeout(done);
          resolve(reg.waiting ? reg : null);
        }
        if (this.state === "redundant") {
          clearTimeout(done);
          resolve(null);
        }
      });
    });
  } catch {
    return null;
  }
}

export function RefreshButton({
  label,
  variant = "pill",
}: {
  label?: string;
  /** `icon` for the desktop bar, `chip` for the phone strip, `pill` in a page. */
  variant?: "pill" | "icon" | "chip";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setNote("");

    const reg = await findWaitingBuild();
    if (reg?.waiting) {
      // A real reload, not router.refresh() — the point is to drop the old
      // JavaScript bundle, which a soft refresh keeps.
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      setNote("Versi baru — memuat ulang");
      setTimeout(() => window.location.reload(), 250);
      return;
    }

    startTransition(() => router.refresh());
    setNote("Data terbaru");
    setTimeout(() => {
      setBusy(false);
      setNote("");
    }, 1400);
  };

  const spinning = busy || pending;

  const spinner = (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`size-4 fill-current ${spinning ? "animate-spin" : ""}`}
    >
      <path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z" />
    </svg>
  );

  if (variant === "chip") {
    return (
      <button
        onClick={go}
        disabled={spinning}
        className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-hairline/60 bg-surface/40 px-3.5 text-micro font-medium text-muted transition-colors hover:border-ember/30 hover:bg-surface hover:text-ink disabled:opacity-50 cursor-pointer"
        aria-label="Muat ulang"
      >
        {spinner}
        <span className="truncate">{note || "Muat ulang"}</span>
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={go}
          disabled={spinning}
          aria-label="Muat ulang"
          title="Muat ulang"
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-hairline/60 bg-surface/40 px-3 text-xs font-medium text-muted/80 transition-all duration-200 hover:border-ember/35 hover:bg-surface-raised hover:text-ink disabled:opacity-50"
        >
          {spinner}
          <span className="hidden xl:inline">{note || "Refresh"}</span>
        </button>
        {note && (
          <span
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 top-20 z-40 mx-auto w-fit rounded-full border border-ember/35 bg-ember/15 px-3 py-1.5 text-micro font-semibold text-ember-lo shadow-lg"
          >
            {note}
          </span>
        )}
      </>
    );
  }

  return (
    <button
      onClick={go}
      disabled={spinning}
      aria-label="Muat ulang"
      title="Muat ulang"
      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-hairline bg-surface px-3.5 text-mini font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/35 hover:text-ember-lo disabled:opacity-70"
    >
      {spinner}
      {note || label || "Refresh"}
    </button>
  );
}
