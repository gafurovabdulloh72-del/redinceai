"use client";

import { useEffect, useState } from "react";
import "./globals.css";
import { reportClientError } from "@/components/system/report-error";
import { LOCALE_COOKIE, tr, type Locale } from "@/lib/i18n";
import { GLOBAL_ERROR } from "@/lib/i18n/dict/system";

/**
 * Ildiz layout ham ishlamay qolgan holat uchun. Tokenlar globals.css'dan,
 * shriftlar bu yerda bo'lmasligi mumkin — tizim shriftlari ishlatiladi.
 * Rejim: localStorage'dagi tanlov (yoki tizim). Inline <script> emas — productiondagi nonce CSP uni bloklaydi
 * (client komponentda headers() yo'q); bundle ichidagi effekt CSP'dan o'tadi.
 * 2026-11-10: matn ikki tilda (uz/ru) va xato admin «Xatolar» jurnaliga yuboriladi. Layout yo'q — LocaleProvider ham yo'q,
 * shuning uchun til effektda aniqlanadi (`til` cookie'si, bo'lmasa brauzer tili); birinchi chizilish — o'zbekcha
 * (server chizgan HTML bilan bir xil, gidratsiya xatosi yo'q).
 */
function applyTheme() {
  try {
    const saved = localStorage.getItem("redince-theme");
    document.documentElement.dataset.theme = saved === "dark" || saved === "light" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    document.documentElement.dataset.theme = "light";
  }
}

/** Ko'rinish tili (uz | uz_cyrl | ru | en) → lug'at tili: ru/en → ru, qolgani uz; cookie bo'lmasa — brauzer tili */
function detectLocale(): Locale {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`));
    const v = m ? decodeURIComponent(m[1]) : "";
    if (v) return v === "ru" || v === "en" ? "ru" : "uz";
    return /^ru\b/i.test(navigator.language ?? "") ? "ru" : "uz";
  } catch {
    return "uz";
  }
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [til, setTil] = useState<Locale>("uz");
  useEffect(() => {
    applyTheme();
    setTil(detectLocale());
  }, []);
  useEffect(() => {
    // Server xatosi (digest bor) serverda yozilgan — brauzerdan faqat klient xatolari yuboriladi
    reportClientError(error, { type: "global", digest: error.digest });
  }, [error]);

  return (
    <html lang={til} suppressHydrationWarning>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        <main className="container-x flex min-h-dvh items-center justify-center py-16">
          <div className="card-outline w-full max-w-xl !rounded-card-lg px-6 py-14 text-center sm:px-12">
            <span className="eyebrow">{tr(til, GLOBAL_ERROR.eyebrow)}</span>
            <h1 className="display-xl mt-5 text-[32px] sm:text-[40px]">{tr(til, GLOBAL_ERROR.title)}</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-fg-2">{tr(til, GLOBAL_ERROR.text)}</p>
            {error.digest && (
              <p className="mt-2 text-[12px] text-fg-3">
                {tr(til, GLOBAL_ERROR.code)}: {error.digest}
              </p>
            )}
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={reset} className="btn-accent inline-flex h-12 items-center justify-center rounded-full px-7 text-[15px] font-semibold">
                {tr(til, GLOBAL_ERROR.retry)}
              </button>
              <a href="/" className="inline-flex h-12 items-center justify-center rounded-full border border-line-2 px-7 text-[15px] font-semibold text-fg transition hover:border-fg">
                {tr(til, GLOBAL_ERROR.home)}
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
