import "server-only";
import { requestOrigin, trustedSiteOrigin } from "./request";

/** Jarayon bo'yicha bir marta (dev'da modul qayta yuklanadi — globalThis'da) */
const flag = globalThis as { __redinceSiteUrlWarned?: boolean };
function errorOnce() {
  if (flag.__redinceSiteUrlWarned) return;
  flag.__redinceSiteUrlWarned = true;
  console.error("[site] SITE_URL / NEXT_PUBLIC_SITE_URL o'rnatilmagan — productionda sayt manzili sarlavhadan olinmaydi (email havolalari yuborilmaydi)");
}

export interface SiteUrlOptions {
  /**
   * Productionda sozlama bo'lmasa Host sarlavhasiga yo'l qo'yish (to'lov qaytish URL'lari kabi kam xavfli joylar).
   * Standart: false — emaildagi havolalar (parol tiklash, tasdiqlash) productionda faqat sozlamadan tuziladi,
   * aks holda null (reset-link poisoning'dan himoya).
   */
  allowHostInProduction?: boolean;
}

/**
 * Kanonik sayt manzili (oxirida "/" yo'q): SITE_URL → NEXT_PUBLIC_SITE_URL → Vercel production domeni
 * → Railway domeni → so'rovning Host sarlavhasi (X-Forwarded-Host faqat TRUST_PROXY_HOST=1 / ma'lum platforma —
 * request.ts trustProxy()). Productionda sozlama bo'lmasa bir marta console.error yoziladi.
 */
export function siteUrl(req?: Request | null, opts: SiteUrlOptions = {}): string | null {
  const configured = trustedSiteOrigin();
  if (configured) return configured;
  const prod = process.env.NODE_ENV === "production";
  if (prod) errorOnce();
  if (!req || (prod && !opts.allowHostInProduction)) return null;
  return requestOrigin(req);
}
