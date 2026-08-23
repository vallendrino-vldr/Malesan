import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Malesan — AI Creative Companion",
    short_name: "Malesan",
    description: "Bikin konten tanpa ribet. Ide, script, dan workflow kreator dalam satu AI companion.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0a09",
    theme_color: "#0b0a09",
    lang: "id",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops launcher icons to its own shape. Without a maskable
      // variant carrying its own padding, the outer ring of the mark gets
      // sliced off on most launchers.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Ide Hari Ini", url: "/app?tab=studio&m=ide" },
      { name: "Vibe Coding", url: "/app?tab=vibe" },
    ],
  };
}
