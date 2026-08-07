import type { Metadata, Viewport } from "next";
import { Archivo, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { PwaProvider } from "@/components/PwaProvider";
import "./globals.css";
// From a server-safe module, not from the "use client" components that own
// these settings — importing them from there turned both scripts into a client
// reference stub that threw, so neither ever ran. See src/lib/boot-scripts.ts.
import { THEME_INIT_SCRIPT, TEXT_INIT_SCRIPT, HAPTIC_SCRIPT } from "@/lib/boot-scripts";

// Display — industrial, engineered. Weights 600-800, tight negative tracking.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

// Body — Jakarta's own typeface, for an Indonesian product. The choice is
// narrative, not only aesthetic. See DECISIONS.md.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Data, labels, credit balances. Numbers and system labels only — not prose.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const SITE_URL = "https://malesan.my.id";
const TITLE = "Malesan — Males mikirnya. Bukan bikinnya.";
const DESCRIPTION =
  "Buat kreator konten Indonesia. Malesan ngilangin momen bengong depan layar kosong — ide, hook, sama naskah siap eksekusi dalam hitungan detik.";

export const metadata: Metadata = {
  // The domain is confirmed and live (malesan.my.id), so relative OG/canonical
  // URLs now resolve against it — without this, a shared link renders no
  // preview card at all.
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Malesan",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
  // The og:image itself comes from the file-convention `opengraph-image.tsx`,
  // which Next injects automatically; this block carries the text and identity.
  openGraph: {
    type: "website",
    siteName: "Malesan",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  /**
   * `viewportFit: "cover"` is what makes `env(safe-area-inset-*)` return real
   * numbers on an iPhone. Without it iOS reports every inset as 0 — and this
   * product pads the bottom tab bar, the admin nav, the undo toast, the install
   * banner and the tutorial sheet with exactly those values. So on any iPhone
   * with a home indicator the tab bar sat underneath it and its bottom row of
   * targets was partly unreachable, while the CSS looked correct in review
   * because it is correct; it was being fed zeroes.
   */
  viewportFit: "cover",
  /**
   * Both themes declared. A single dark value painted the iOS status-bar area
   * and the Android chrome dark while the light theme rendered a near-white
   * page underneath it.
   */
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0a09" },
    { media: "(prefers-color-scheme: light)", color: "#e8e0d8" },
  ],
  /**
   * Not "dark". This tells the browser how to paint form controls, scrollbars
   * and the default caret; pinned to dark, those stayed dark-on-light in the
   * bright theme. The actual per-theme value is set on <html> by the theme
   * script — this is the pair the browser is allowed to choose from.
   */
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${archivo.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
      // The theme script mutates this element before React hydrates, which is
      // the point — without it the dark theme paints for one frame before the
      // light one takes over, and that flash is worse than either theme.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + TEXT_INIT_SCRIPT + HAPTIC_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaProvider />
      </body>
    </html>
  );
}
