import "server-only";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function hostOf(value: string | null): string | null {
  if (!value || value === "null") return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/** So'rov o'z hosti (proksi orqasida x-forwarded-host) */
export function requestHost(req: Request): string {
  const fwd = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = fwd || req.headers.get("host");
  if (host) return host.toLowerCase();
  try {
    return new URL(req.url).host.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * CSRF himoyasi (SameSite=Lax cookie'ga qo'shimcha): o'zgartiruvchi so'rovlar faqat
 * o'z saytimizdan kelishi kerak.
 *  - Sec-Fetch-Site: cross-site → rad
 *  - Origin (yo'q bo'lsa Referer) hosti so'rov hostiga teng bo'lishi shart
 * Xato bo'lsa sabab matni, aks holda null. curl testlari "Origin: http://localhost:3000" yuborishi kerak.
 */
export function checkSameOrigin(req: Request): string | null {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return null;

  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site") return "So'rov boshqa saytdan yuborilgan";

  const origin = req.headers.get("origin");
  const source = origin ?? req.headers.get("referer");
  const sourceHost = hostOf(source);
  if (!sourceHost) return "So'rov manbasi (Origin) ko'rsatilmagan";

  const host = requestHost(req);
  if (!host || sourceHost !== host) return "So'rov manbasi saytga mos kelmaydi";
  return null;
}
