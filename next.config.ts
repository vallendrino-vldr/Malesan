import type { NextConfig } from "next";

/**
 * A stamp that changes on every deployment.
 *
 * The service worker is a static file, so its bytes were identical after every
 * deploy. A browser decides whether a worker changed by byte-comparing the
 * script, so it concluded "no update" every single time — the waiting worker and
 * the update banner in PwaProvider could never fire, and an installed app only
 * picked up new code by accident, when a navigation happened to fetch fresh HTML.
 *
 * Registering `/sw.js?v=<stamp>` makes the URL itself change, which is what the
 * browser treats as a new worker. The worker reads the same stamp back out of
 * its own URL and names its cache after it, so a deploy also purges the previous
 * build's cached assets instead of accumulating them forever.
 *
 * Vercel sets VERCEL_GIT_COMMIT_SHA; locally the build time is fine.
 */
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? `dev-${Date.now().toString(36)}`;

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },

  /**
   * The dev server is reached through a Cloudflare quick tunnel so the app can
   * be opened on a phone. Next refuses cross-origin dev requests unless the
   * host is listed here, and without it HMR and the dev asset routes fail with
   * a cross-origin warning.
   *
   * `*.trycloudflare.com` covers the rotating quick-tunnel hostnames. This has
   * no effect on a production build.
   */
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.io"],

  /**
   * The service worker must never be served from cache.
   *
   * Files under /public are sent with long-lived caching by default. Applied to
   * sw.js that is self-defeating: the browser keeps handing back the old worker
   * script, so the old worker stays in control and the installed app keeps
   * rendering a build from whenever it was installed. `updateViaCache: "none"`
   * on the registration covers browsers that honour it; this header covers the
   * rest and the initial fetch.
   */
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
