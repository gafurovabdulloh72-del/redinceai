import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { NavigationProgress } from "@/components/motion/NavigationProgress";
import { CommandPalette } from "@/components/search/CommandPalette";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FooterGate } from "@/components/layout/FooterGate";
import { Backdrop } from "@/components/layout/Backdrop";
import { BackToTop } from "@/components/layout/BackToTop";
import { NetworkBanner } from "@/components/layout/NetworkBanner";
import { Shortcuts } from "@/components/layout/Shortcuts";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";
import { AppearanceSync } from "@/components/layout/Appearance";
import { THEME_INIT_SCRIPT, ThemeToggle } from "@/components/layout/ThemeToggle";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { CallCenter } from "@/components/call/CallCenter";
import { getCurrentUser } from "@/lib/auth";
import { getDisplayLocale, getLocale } from "@/lib/i18n/server";
import { DISPLAY_LANG, tr } from "@/lib/i18n";
import { DisplayLocaleProvider } from "@/components/i18n/DisplayLocale";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { SHELL } from "@/lib/i18n/dict/shell";
import { SITE } from "@/lib/constants";
import { SITE_URL } from "@/lib/site-url";

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
  metadataBase: new URL(SITE_URL),
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
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  /*
   * Qidiruv tizimlariga egalikni tasdiqlash (Google Search Console / Yandex Webmaster).
   * Domen DNS'iga kira olmaganda (masalan *.vercel.app) yagona qulay usul — meta teg.
   * Env'siz hech narsa chizilmaydi: `GOOGLE_SITE_VERIFICATION` / `YANDEX_VERIFICATION`.
   */
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.YANDEX_VERIFICATION ? { yandex: process.env.YANDEX_VERIFICATION } : {}),
  },
  // RSS lentalar — brauzer va lenta o'quvchilar (Feedly, Telegram RSS bot) avtomatik topadi
  alternates: {
    types: {
      "application/rss+xml": [
        { url: "/vakansiyalar/feed.xml", title: "Kasb Egalari — vakansiyalar" },
        { url: "/mentorlik/feed.xml", title: "Kasb Egalari — mentorlik kurslari" },
      ],
    },
  },
};

/** Organization + WebSite (SearchAction) strukturaviy ma'lumoti — qidiruv tizimlari uchun ("<" ekranlanadi) */
const ORG_JSONLD = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/qidiruv?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
]).replace(/</g, "\\u003c");

/** Brauzer manzil paneli rangi — globals.css --bg bilan bir xil (yorug' #fafaf8, qorong'u #0c0c0d); qo'lda tanlangan rejimda AppearanceSync yangilaydi */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce asosidagi CSP (src/middleware.ts): tema skripti faqat shu so'rovning nonce'i bilan ishlaydi
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // Til — "til" cookie'sidan (standart: uz). Almashtirish /api/til orqali, sahifa router.refresh() bilan yangilanadi.
  const display = await getDisplayLocale();
  const locale = await getLocale();
  const currentUser = await getCurrentUser();
  return (
    <html lang={DISPLAY_LANG[display]} data-display={display} suppressHydrationWarning className={`${unbounded.variable} ${manrope.variable} ${instrument.variable}`}>
      <head>
        {/* suppressHydrationWarning: brauzer ishlatilgan nonce atributini yashiradi ("" qaytaradi) — React bilan solishtirilmasin */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {/* O'tish havolasi (a11y): klaviatura foydalanuvchisi navbarni chetlab asosiy kontentga o'tadi (main tabIndex=-1 — Safari/Firefox'da ham fokus o'tadi) */}
        <a
          href="#asosiy"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[170] focus:inline-flex focus:h-11 focus:items-center focus:rounded-full focus:bg-ink focus:px-5 focus:text-[14px] focus:font-semibold focus:text-ink-fg focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
        >
          {tr(locale, SHELL.skipToContent)}
        </a>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ORG_JSONLD }} />
        <LocaleProvider locale={locale}>
         <DisplayLocaleProvider value={display}>
          {/* Doimiy til + yorug'lik (tema) boshqaruvi — o'ng tepada bitta kapsulada (desktop; telefonda Profil → Menyu) */}
          <div className="shell-capsule fixed right-4 top-3 z-[115] hidden items-center gap-0.5 md:flex print:hidden">
            <LocaleSwitch className="[&>button]:!border-transparent [&>button]:!bg-transparent [&>button]:!shadow-none" />
            <ThemeToggle />
          </div>
          <ToastProvider>
            <ConfirmProvider>
              <Backdrop />
              <Navbar />
              {/* Ijtimoiy qobiq: md+ da chap yon panel (76px, xl: 244px) — kontent o'ngga suriladi; telefonda yuqori panel + pastki tab-bar.
                  ≥1920px: kontent 1600px bilan cheklanadi va markazda turadi */}
              <div className="app-shell md:pl-[72px] xl:pl-[232px]">
                <main id="asosiy" tabIndex={-1} className="pt-[calc(3.5rem+env(safe-area-inset-top)+0.75rem)] pb-[calc(3.75rem+env(safe-area-inset-bottom)+1rem)] outline-none md:pb-12 md:pt-8 min-[1920px]:mx-auto min-[1920px]:max-w-[100rem]">
                  {children}
                </main>
                <FooterGate guest={!currentUser}>
                  <Footer />
                </FooterGate>
              </div>
              <BackToTop />
              {/* Harakat/qobiq qatlami: progress chizig'i, ⌘K paleti, qisqartmalar, tarmoq banneri, tema sinxroni, SW — server DOM'iga tegmaydi */}
              <Suspense fallback={null}>
                <NavigationProgress />
              </Suspense>
              <CommandPalette />
              <Shortcuts />
              <NetworkBanner />
              <AppearanceSync />
              <ServiceWorkerRegister />
              {/* Global qo'ng'iroq markazi (Telegram uslubi): kiruvchi/chiquvchi ekran + jiringlash — faqat kirgan foydalanuvchiga */}
              <CallCenter enabled={!!currentUser} />
            </ConfirmProvider>
          </ToastProvider>
         </DisplayLocaleProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
