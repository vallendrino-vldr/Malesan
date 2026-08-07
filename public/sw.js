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
/**
 * Bumped to v2 so `activate` purges v1.
 *
 * The old worker cached every same-origin GET, including HTML pages. Those
 * entries survive a strategy change on their own — the new worker never writes
 * them, but it never removes them either, and a stale `/` sitting in the cache
 * is exactly what the offline fallback would serve. Renaming the cache is what
 * makes the switch a clean one.
 */
const CACHE = "malesan-v2";
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

  // Never touch auth or API traffic — a cached session or a cached generation
  // would be both wrong and a privacy problem.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  /**
   * Build assets: cache first, and never revalidate.
   *
   * Everything under /_next/static carries a content hash in its filename, so a
   * given URL's bytes can never change — a new build produces new URLs. That
   * makes "serve from cache, do not ask the network" not just safe but correct,
   * and it is the difference between an installed app starting instantly and
   * one that re-fetches its own JavaScript over mobile data every launch.
   */
  if (url.pathname.startsWith("/_next/static/")) {
    // The content-hash guarantee above only holds for a production build. The
    // Turbopack dev server serves /_next/static/ URLs whose bytes change after
    // every edit *without* the URL changing, so cache-first there serves stale
    // JS/CSS — the "I fixed it and the browser shows the old thing" trap, which
    // also surfaces as a hydration mismatch when fresh server HTML meets a stale
    // client bundle. On localhost, hand the request straight to the network so
    // dev is always fresh; keep cache-first everywhere else.
    const isDev =
      self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";
    if (isDev) return;
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        if (fresh.ok) (await caches.open(CACHE)).put(req, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  /**
   * Everything else: do not intercept at all.
   *
   * This is the fix for the installed app feeling sluggish. A fetch handler that
   * calls respondWith has to wake the worker first, and a worker that has gone
   * idle costs real milliseconds to boot — paid once per request, on every
   * request, including the ones where the handler did nothing but pass the
   * response straight through. Returning without calling respondWith hands the
   * request back to the browser's own network stack, which is both faster and
   * better at HTTP caching than anything reimplemented here.
   *
   * Navigations still get an offline fallback, because that is the one case
   * where the cache genuinely adds something.
   */
  if (req.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(req);
      } catch {
        const cached = await caches.match(OFFLINE_URL);
        if (cached) return cached;
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
