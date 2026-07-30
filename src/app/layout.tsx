import type { Metadata, Viewport } from "next";
import { Archivo, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { PwaProvider } from "@/components/PwaProvider";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/components/ThemeToggle";
import { TEXT_INIT_SCRIPT } from "@/components/TextScale";

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

export const metadata: Metadata = {
  title: "Malesan — Males mikirnya. Bukan bikinnya.",
  description:
    "Buat kreator konten Indonesia. Malesan ngilangin momen bengong depan layar kosong — ide, hook, sama naskah siap eksekusi dalam hitungan detik.",
  applicationName: "Malesan",
  // No metadataBase / canonical URL yet: the domain is unconfirmed.
  // Confirm the domain is verified before adding one.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0a09",
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
      className={`${archivo.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
      // The theme script mutates this element before React hydrates, which is
      // the point — without it the dark theme paints for one frame before the
      // light one takes over, and that flash is worse than either theme.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + TEXT_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaProvider />
      </body>
    </html>
  );
}
