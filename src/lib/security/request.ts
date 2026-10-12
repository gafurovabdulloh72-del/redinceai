import "server-only";
import { createHash } from "node:crypto";

/** Oxirgi (eng o'ngdagi) nechta x-forwarded-for qiymati ishonchli proksi tomonidan qo'shilgan (standart: 1) */
function trustedProxyHops(): number {
  const n = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : 1;
}

/**
 * Mijoz IP manzili (rate limit va audit uchun). Ustuvorlik:
 *   cf-connecting-ip (Cloudflare) → x-vercel-forwarded-for (Vercel) → x-real-ip (Nginx/Railway)
 *   → x-forwarded-for'ning o'ngdan TRUSTED_PROXY_HOPS-chi qiymati (proksi o'zi qo'shgan; standart — eng o'ngdagi).
 * Birinchi (chapdagi) qiymat mijoz tomonidan soxtalashtirilishi mumkin, shuning uchun hech qachon ishlatilmaydi.
 * Sarlavha umuman bo'lmasa (lokal dev, to'g'ridan-to'g'ri ulanish) hamma bitta "local" bucket'ga tushmasin —
 * user-agent hash'idan "unknown-…" kaliti beriladi.
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const direct = (h.get("cf-connecting-ip") || h.get("x-vercel-forwarded-for") || h.get("x-real-ip"))?.split(",")[0]?.trim();
  if (direct) return direct.slice(0, 64);
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((p) => p.trim()).filter(Boolean);
    const pick = hops[Math.max(0, hops.length - trustedProxyHops())];
    if (pick) return pick.slice(0, 64);
  }
  const ua = h.get("user-agent") ?? "";
  return `unknown-${createHash("sha256").update(ua).digest("hex").slice(0, 16)}`;
}

/**
 * Sozlamalardan ma'lum, ishonchli sayt manzili (so'rov sarlavhalariga bog'liq EMAS):
 * SITE_URL → NEXT_PUBLIC_SITE_URL → Vercel production domeni → Railway ommaviy domeni. Bo'lmasa null.
 * Emaildagi havolalar (parol tiklash) faqat shu asosda tuziladi — Host/X-Forwarded-Host soxtalashtirilsa ham.
 */
export function trustedSiteOrigin(): string | null {
  const env = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL)?.trim();
  if (env) return env.replace(/\/+$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return null;
}

/**
 * X-Forwarded-Host / X-Forwarded-Proto sarlavhalariga ishonish mumkinmi. Bu sarlavhalarni har qanday mijoz
 * o'zi yuborishi mumkin, shuning uchun faqat ularni qayta yozadigan ishonchli proksi orqasida hisobga olinadi:
 * TRUST_PROXY_HOST=1 (yoki TRUST_PROXY=1 / true / yes) aniq yoqilganda, yoki ma'lum platforma (Vercel / Railway)
 * muhitida (ular sarlavhani o'zi qayta yozadi). Aks holda (lokal dev, to'g'ridan-to'g'ri ulanish) faqat Host ishlatiladi.
 */
export function trustProxy(): boolean {
  const flag = (process.env.TRUST_PROXY_HOST || process.env.TRUST_PROXY)?.trim().toLowerCase();
  if (flag) return flag === "1" || flag === "true" || flag === "yes";
  return Boolean(process.env.VERCEL || process.env.RAILWAY_PUBLIC_DOMAIN);
}

/** Ishonchli proksi orqasida x-forwarded-host (birinchi qiymat), aks holda null */
export function forwardedHost(headers: Headers): string | null {
  if (!trustProxy()) return null;
  return headers.get("x-forwarded-host")?.split(",")[0]?.trim() || null;
}

/** Ishonchli proksi orqasida x-forwarded-proto (birinchi qiymat), aks holda null */
export function forwardedProto(headers: Headers): string | null {
  if (!trustProxy()) return null;
  return headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || null;
}

/**
 * So'rov kelgan tashqi manzil (ishonchli proksi orqasida ham to'g'ri): https://redince.uz
 * Faqat Host sarlavhasi (X-Forwarded-Host — trustProxy() bo'lsagina). Emaildagi havolalar uchun
 * buni EMAS, security/site.ts siteUrl() ni ishlating.
 * Eslatma: Next req.url protokolini x-forwarded-proto'dan oladi, shuning uchun localhost/127.* uchun http qat'iy.
 */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = forwardedHost(req.headers) || req.headers.get("host") || url.host;
  const proto = forwardedProto(req.headers) || (/^(localhost|127\.)/i.test(host) ? "http" : url.protocol.replace(":", ""));
  return `${proto}://${host}`;
}

export function userAgent(req: Request): string | null {
  const ua = req.headers.get("user-agent");
  return ua ? ua.slice(0, 200) : null;
}
