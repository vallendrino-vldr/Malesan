/**
 * Malesan service worker.
 *
 * Deliberately network-first for navigations and same-origin requests, with the
 * cache used only as an offline fallback.
 *
 * The usual PWA default is cache-first, which is faster but means a user who
 * installed the app last week keeps seeing last week's build until they clear
 * storage. For a product under active daily development that is the single most
 * confusing failure mode there is: "I fixed that yesterday" versus "it's still
 * broken on my phone". Freshness beats a few hundred milliseconds here.
 *
 * skipWaiting + clients.claim mean a new build takes over on the next load
 * rather than waiting for every tab to close.
 */
const CACHE = "malesan-v1";
const OFFLINE_URL = "/";

/**
 * No skipWaiting() here on purpose.
 *
 * skipWaiting() on install + clients.claim() on activate means a new worker
 * seizes control of a page that is already running, mid-life. Combined with an
 * update check on every mount and every foreground, that is the documented
 * recipe for a page that keeps getting taken over — which is what "ngedip terus
 * tiap persekian milidetik" looks like from the outside.
 *
 * The new worker now waits. The update banner posts SKIP_WAITING only when the
 * user taps "Muat ulang", so a takeover is always something they asked for.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache from a previous version so stale assets cannot survive.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      // claim() is safe here: without skipWaiting() we only reach activate after
      // the user chose to reload, so there is no live page to surprise.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache auth or API traffic — a cached session or a cached generation
  // would be both wrong and a privacy problem.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        // Skip anything with a query string. RSC payloads (`?_rsc=...`) mint a
        // new key per navigation, so caching them grew storage without ever
        // producing a hit.
        const cacheable = !url.search && fresh && fresh.status === 200 && fresh.type === "basic";
        if (cacheable) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const fallback = await caches.match(OFFLINE_URL);
          if (fallback) return fallback;
        }
        throw new Error("offline");
      }
    })(),
  );
});

// The update banner posts this so a waiting worker can take over immediately
// instead of lingering until every tab is closed.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
