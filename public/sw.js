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

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache from a previous version so stale assets cannot survive.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
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
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
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
