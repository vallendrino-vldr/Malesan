import type { Metadata, Viewport } from "next";
import { Archivo, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { PwaProvider } from "@/components/PwaProvider";
import "./globals.css";
// From a server-safe module, not from the "use client" components that own
// these settings — importing them from there turned both scripts into a client
// reference stub that threw, so neither ever ran. See src/lib/boot-scripts.ts.
import { THEME_INIT_SCRIPT, TEXT_INIT_SCRIPT, HAPTIC_SCRIPT, SECURITY_SHIELD_SCRIPT } from "@/lib/boot-scripts";

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

// Vercel serves www as the canonical origin; the apex permanently redirects
// there. Keep metadata/share URLs on the final origin instead of adding a hop.
const SITE_URL = "https://www.malesan.my.id";
const TITLE = "Malesan — AI Creative Companion";
const DESCRIPTION =
  "Bikin konten tanpa ribet. Ide, script, dan workflow kreator dalam satu AI companion.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Malesan",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: "Malesan",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    locale: "id_ID",
    images: [
      {
        url: "/branding/logo-social.png",
        width: 1200,
        height: 630,
        alt: "Malesan — AI Creative Companion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/branding/logo-social.png"],
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
   * Permanent dark theme declared for mobile chrome and status bar.
   */
  themeColor: [{ color: "#080808" }],
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`dark ${archivo.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://hjdctzrvnhvarxoxixrn.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://hjdctzrvnhvarxoxixrn.supabase.co" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + TEXT_INIT_SCRIPT + HAPTIC_SCRIPT + SECURITY_SHIELD_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaProvider />
      </body>
    </html>
  );
}
