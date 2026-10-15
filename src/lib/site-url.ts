/**
 * Kanonik sayt manzili — build/render vaqtida bir marta hisoblanadi.
 * Ustuvorlik: NEXT_PUBLIC_SITE_URL → SITE_URL → Vercel domeni (VERCEL_URL) → lokal dev.
 * metadataBase, sitemap, robots va OG rasmlari shu qiymatdan tuziladi — productionda
 * sozlanmasa hamma joyda http://localhost:3000 chiqib qoladi (docs/DEPLOY.md).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")) || "http://localhost:3000";
