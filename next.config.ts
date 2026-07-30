import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
