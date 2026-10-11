import "server-only";

/**
 * Mijoz IP manzili. Proksi sarlavhalari: cf-connecting-ip (Cloudflare) → x-real-ip (Vercel/Railway/Nginx)
 * → x-forwarded-for'ning ENG O'NGDAGI (proksi o'zi qo'shgan) qiymati. Birinchi qiymat mijoz tomonidan
 * soxtalashtirilishi mumkin, shuning uchun ishlatilmaydi. Hech biri bo'lmasa "local".
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const direct = (h.get("cf-connecting-ip") || h.get("x-real-ip"))?.trim();
  if (direct) return direct.slice(0, 64);
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((p) => p.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last.slice(0, 64);
  }
  return "local";
}

/**
 * Sozlamalardan ma'lum, ishonchli sayt manzili (so'rov sarlavhalariga bog'liq EMAS):
 * NEXT_PUBLIC_SITE_URL → Vercel production domeni → Railway ommaviy domeni. Bo'lmasa null.
 * Emaildagi havolalar (parol tiklash) faqat shu asosda tuziladi — Host/X-Forwarded-Host soxtalashtirilsa ham.
 */
export function trustedSiteOrigin(): string | null {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return null;
}

/** So'rov kelgan tashqi manzil (proksi orqasida ham to'g'ri): https://redince.uz */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

export function userAgent(req: Request): string | null {
  const ua = req.headers.get("user-agent");
  return ua ? ua.slice(0, 200) : null;
}
