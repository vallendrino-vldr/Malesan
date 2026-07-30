"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker and surfaces two things the browser will not do
 * on its own:
 *
 *  1. An install button. Chrome fires `beforeinstallprompt` and then does
 *     nothing visible unless you catch it — which is why most PWAs are never
 *     actually installed.
 *  2. An update prompt. A service worker that finds a new build sits in
 *     "waiting" until every tab closes, so an installed app can show yesterday's
 *     code indefinitely. We detect the waiting worker and offer a reload.
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaProvider() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      // `updateViaCache: "none"` is the whole fix for "the installed app shows
      // old data". Without it the browser serves /sw.js from its own HTTP cache
      // for up to 24 hours, so the *old worker keeps running* and never even
      // learns a new build exists — the visibility check below was calling
      // update() against a cached copy and always concluding nothing changed.
      .register("/sw.js", { updateViaCache: "none" })
      .then((r) => {
        reg = r;
        if (r.waiting) setUpdateReady(true);
        r.addEventListener("updatefound", () => {
          const sw = r.installing;
          sw?.addEventListener("statechange", () => {
            // controller present means this is an update, not a first install.
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => {
        // A failed registration must never break the app.
      });

    // Check for a new build when the app returns to the foreground, but no more
    // than once an hour. An update() on every single foreground event was one
    // half of the takeover loop; the worker no longer skip-waits, and this no
    // longer hammers it.
    let lastCheck = 0;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastCheck < 60 * 60 * 1000) return;
      lastCheck = now;
      reg?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);

    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstall);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  async function applyUpdate() {
    const reg = await navigator.serviceWorker.getRegistration();
    reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  }

  if (updateReady) {
    return (
      <Banner
        text="Ada versi baru."
        action="Muat ulang"
        onAction={applyUpdate}
        onClose={() => setUpdateReady(false)}
      />
    );
  }

  if (installEvent && !dismissed) {
    return (
      <Banner
        text="Pasang di layar utama biar kayak aplikasi."
        action="Pasang"
        onAction={install}
        onClose={() => setDismissed(true)}
      />
    );
  }

  return null;
}

function Banner({
  text,
  action,
  onAction,
  onClose,
}: {
  text: string;
  action: string;
  onAction: () => void;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.6rem)] z-40 px-4">
      <div className="surface-card pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-xl border border-ember/30 px-4 py-3">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{text}</p>
        <button
          type="button"
          onClick={onAction}
          className="btn-ember shrink-0 rounded-lg px-3.5 py-2 font-display text-[13px] font-bold text-obsidian"
        >
          {action}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="shrink-0 text-muted transition-colors hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
            <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
