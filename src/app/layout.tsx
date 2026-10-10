import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LiquidBackground } from "@/components/layout/LiquidBackground";
import { GlassPointer } from "@/components/layout/GlassPointer";
import { THEME_INIT_SCRIPT } from "@/components/layout/ThemeToggle";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  keywords: ["videograf", "montajor", "dizayner", "O'zbekiston", "Toshkent", "Samarqand", "freelancer", "video montaj"],
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    type: "website",
    locale: "uz_UZ",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef0f7" },
    { media: "(prefers-color-scheme: dark)", color: "#06070c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <LiquidBackground />
        <GlassPointer />
        <Navbar />
        <main className="pt-24 pb-28 sm:pt-28 md:pb-0">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
