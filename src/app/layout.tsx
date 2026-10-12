import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Backdrop } from "@/components/layout/Backdrop";
import { BackToTop } from "@/components/layout/BackToTop";
import { THEME_INIT_SCRIPT } from "@/components/layout/ThemeToggle";
import { SITE } from "@/lib/constants";

const unbounded = localFont({
  src: "../fonts/Unbounded.woff2",
  variable: "--font-unbounded",
  weight: "200 900",
  display: "swap",
});
const manrope = localFont({
  src: "../fonts/Manrope.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});
const instrument = localFont({
  src: [
    { path: "../fonts/InstrumentSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
});

const TITLE = `${SITE.name} — ${SITE.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: TITLE,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ["videograf", "montajor", "dizayner", "O'zbekiston", "Toshkent", "Samarqand", "freelancer", "video montaj"],
  openGraph: {
    title: TITLE,
    description: SITE.description,
    type: "website",
    locale: "uz_UZ",
    siteName: SITE.name,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE.description,
    images: ["/opengraph-image"],
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce asosidagi CSP (src/middleware.ts): tema skripti faqat shu so'rovning nonce'i bilan ishlaydi
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="uz" suppressHydrationWarning className={`${unbounded.variable} ${manrope.variable} ${instrument.variable}`}>
      <head>
        {/* suppressHydrationWarning: brauzer ishlatilgan nonce atributini yashiradi ("" qaytaradi) — React bilan solishtirilmasin */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <Backdrop />
        <Navbar />
        <main className="pt-24 pb-28 sm:pt-28 md:pb-0">{children}</main>
        <Footer />
        <BackToTop />
      </body>
    </html>
  );
}
