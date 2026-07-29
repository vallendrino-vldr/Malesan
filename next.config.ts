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
};

export default nextConfig;
