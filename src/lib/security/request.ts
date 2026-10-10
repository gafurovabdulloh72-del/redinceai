import "server-only";

/** Mijoz IP manzili: proksi (Railway/Vercel/Nginx) sarlavhalaridan, aks holda "local" */
export function clientIp(req: Request): string {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = h.get("x-real-ip") || h.get("cf-connecting-ip");
  if (real) return real.trim().slice(0, 64);
  return "local";
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
