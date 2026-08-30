"use client";

import { useEffect, useState } from "react";
import { getNativeShell } from "@/lib/native/bridge";

/**
 * Registers the service worker and surfaces two things the browser will not do
 * on its own:
 *
 *  1. An install button. Chrome fires `beforeinstallprompt` and then does
 *     nothing visible unless you catch it â€” which is why most PWAs are never
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

  const registerBrowserPwa = () => {
    let reg: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      // `updateViaCache: "none"` is the whole fix for "the installed app shows
      // old data". Without it the browser serves /sw.js from its own HTTP cache
      // for up to 24 hours, so the *old worker keeps running* and never even
      // learns a new build exists — the visibility check below was calling
      // update() against a cached copy and always concluding nothing changed.
      // The build stamp is what makes a deploy detectable at all: the browser
      // decides a worker is new by comparing the script, and a static sw.js is
      // byte-identical every time. A changing URL is the standard way to say
      // "this is a different worker". See next.config.ts.
      .register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`, {
        updateViaCache: "none",
      })
      .then((r) => {
        reg = r;
        const watch = (sw: ServiceWorker | null) => {
          if (!sw) return;
          const announceWhenInstalled = () => {
            sw?.addEventListener("statechange", () => {
              // controller present means this is an update, not a first install.
              if (sw.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateReady(true);
              }
            });
          };

          // register() can resolve after updatefound already fired. In that
          // race `r.installing` exists but the old listener never saw the event,
          // leaving a real waiting worker with no banner. Inspect the current
          // state first, then subscribe for what comes next.
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          } else {
            announceWhenInstalled();
          }
        };

        if (r.waiting) setUpdateReady(true);
        watch(r.installing);
        r.addEventListener("updatefound", () => {
          watch(r.installing);
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

    // Fallback: poll /api/version every 10 minutes when tab is visible
    // to support regular non-PWA browser sessions.
    let initialVersion: string | null = null;
    const checkApiVersion = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.version || data.version === "dev") return;
        if (!initialVersion) {
          initialVersion = data.version;
        } else if (initialVersion !== data.version) {
          setUpdateReady(true);
        }
      } catch {}
    };

    checkApiVersion();
    const versionInterval = setInterval(checkApiVersion, 10 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeinstallprompt", onInstall);
      clearInterval(versionInterval);
    };
  };

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void (async () => {
      const nativeShell = await getNativeShell();
      if (cancelled) return;
      if (nativeShell) {
        const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
        await Promise.all(registrations.map((registration) => registration.unregister()));
        return;
      }
      cleanup = registerBrowserPwa();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  async function applyUpdate() {
    // Flush any unsaved drafts before reloading
    try {
      window.dispatchEvent(new CustomEvent("malesan:save-drafts"));
    } catch {}

    const reg = await navigator.serviceWorker?.getRegistration().catch(() => null);
    const waiting = reg?.waiting;
    if (!waiting) {
      window.location.reload();
      return;
    }

    // Reload only after the new worker owns this page.
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        navigator.serviceWorker.removeEventListener("controllerchange", finish);
        resolve();
      };
      const timer = window.setTimeout(finish, 5_000);
      navigator.serviceWorker.addEventListener("controllerchange", finish);
      waiting.postMessage({ type: "SKIP_WAITING" });
    });
    window.location.reload();
  }

  if (updateReady) {
    return (
      <Banner
        text="Versi sistem baru siap."
        action="Muat ulang"
        onAction={applyUpdate}
        onClose={() => setUpdateReady(false)}
      />
    );
  }

  if (installEvent && !dismissed) {
    return (
      <Banner
        text="Pasang Malesan ke layar utama."
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
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.8rem)] sm:bottom-6 z-50 px-3 flex justify-center animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl border border-ember/40 bg-surface/95 px-3.5 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="size-2 rounded-full bg-ember animate-pulse shrink-0" />
          <p className="text-xs font-medium text-ink leading-tight flex-1 whitespace-normal">{text}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onAction}
            className="btn-ember h-8 shrink-0 rounded-xl px-3 font-display text-xs font-bold text-obsidian shadow-sm transition-all hover:brightness-105 active:scale-[0.98] cursor-pointer"
          >
            {action}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-obsidian hover:text-ink cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
