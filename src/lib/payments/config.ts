import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "@/lib/constants";

/** Doimiy vaqtli taqqoslash (imzo/kalit) — timing hujumlariga qarshi */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * To'lov provayderlari sozlamalari (env). Faqat sozlangan provayderlar UI'da chiqadi.
 *  PAYME_MERCHANT_ID, PAYME_KEY, PAYME_TEST_KEY, PAYME_TEST=1 (test kassasi)
 *  CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_MERCHANT_USER_ID, CLICK_SECRET_KEY
 *  PLATFORM_CARD ("8600 **** **** 1234"), PLATFORM_CARD_NAME ("Redince MChJ") — qo'lda o'tkazma
 */
export interface PaymentsEnv {
  payme: { merchantId: string; key: string; test: boolean; checkoutUrl: string };
  click: { serviceId: string; merchantId: string; merchantUserId: string; secret: string };
  manual: { card: string; name: string };
}

export function paymentsEnv(): PaymentsEnv {
  const test = process.env.PAYME_TEST === "1";
  const paymeKey = (test ? process.env.PAYME_TEST_KEY : process.env.PAYME_KEY) || process.env.PAYME_KEY || "";
  return {
    payme: {
      merchantId: process.env.PAYME_MERCHANT_ID?.trim() || "",
      key: paymeKey.trim(),
      test,
      checkoutUrl: test ? "https://checkout.test.paycom.uz/" : "https://checkout.paycom.uz/",
    },
    click: {
      serviceId: process.env.CLICK_SERVICE_ID?.trim() || "",
      merchantId: process.env.CLICK_MERCHANT_ID?.trim() || "",
      merchantUserId: process.env.CLICK_MERCHANT_USER_ID?.trim() || "",
      secret: process.env.CLICK_SECRET_KEY?.trim() || "",
    },
    manual: {
      card: process.env.PLATFORM_CARD?.trim() || "",
      name: process.env.PLATFORM_CARD_NAME?.trim() || "Redince",
    },
  };
}

export function isProviderConfigured(provider: PaymentProvider, env = paymentsEnv()): boolean {
  switch (provider) {
    case "payme":
      return Boolean(env.payme.merchantId);
    case "click":
      return Boolean(env.click.serviceId && env.click.merchantId);
    case "manual":
      return Boolean(env.manual.card);
  }
}

/** UI'da ko'rsatiladigan provayderlar (tartib: Payme, Click, O'tkazma) */
export function availableProviders(): PaymentProvider[] {
  const env = paymentsEnv();
  return (["payme", "click", "manual"] as const).filter((p) => isProviderConfigured(p, env));
}

/**
 * Sayt manzili: NEXT_PUBLIC_SITE_URL, aks holda so'rov sarlavhalaridan (proksi orqasida ham to'g'ri).
 * Qaytish (return) URL'lari shu asosda tuziladi.
 */
export function siteOrigin(headers?: Headers | null, fallbackUrl?: string): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  // Vercel production: barqaror domen (sarlavhalarga bog'liq emas)
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (headers) {
    const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host");
    if (host) return `${proto || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")}://${host}`;
  }
  if (fallbackUrl) {
    try {
      return new URL(fallbackUrl).origin;
    } catch {
      /* noop */
    }
  }
  return "http://localhost:3000";
}
