import "server-only";
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";

export { clientIp } from "./request";

export const RATE_LIMIT_MESSAGE = "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * Tayyor limitlar. Kalit: `${nom}:${id}` (id — ip yoki userId).
 *   login      — ip+email bo'yicha muvaffaqiyatsiz urinishlar
 *   loginIp    — ip bo'yicha muvaffaqiyatsiz urinishlar
 *   loginEmail — email bo'yicha (IP'dan mustaqil — proksi sarlavhasini almashtirib chetlab o'tib bo'lmaydi)
 *   register   — ip
 *   reset      — ip (parol tiklash so'rovi)
 *   password   — userId (parolni o'zgartirish)
 *   orders     — userId · reviews — userId · upload — userId (kunlik) · portfolio — userId (kunlik) · checkout — userId
 */
export const RATE_LIMITS = {
  login: { limit: 5, windowMs: 15 * MIN },
  loginIp: { limit: 20, windowMs: 15 * MIN },
  loginEmail: { limit: 20, windowMs: 15 * MIN },
  register: { limit: 3, windowMs: HOUR },
  reset: { limit: 3, windowMs: HOUR },
  resetConfirm: { limit: 10, windowMs: HOUR },
  password: { limit: 5, windowMs: 15 * MIN },
  orders: { limit: 10, windowMs: HOUR },
  reviews: { limit: 5, windowMs: HOUR },
  upload: { limit: 30, windowMs: DAY },
  portfolio: { limit: 60, windowMs: DAY },
  checkout: { limit: 10, windowMs: HOUR },
} as const;
export type RateLimitName = keyof typeof RATE_LIMITS;

function tooMany(resetAt: number): ApiError {
  const retry = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return new ApiError(429, RATE_LIMIT_MESSAGE, undefined, { "Retry-After": String(retry) });
}

/** Vaqti o'tgan yozuvlarni vaqti-vaqti bilan tozalash (har ~50 chaqiriqda bir) */
async function sweep() {
  if (Math.random() > 0.02) return;
  try {
    await db.delete(rateLimits).where(lt(rateLimits.resetAt, Date.now()));
  } catch {
    /* tozalash muhim emas */
  }
}

/**
 * Qat'iy oyna (fixed window) hisoblagichi — atomar UPSERT (serverless/ko'p nusxa uchun bazada).
 * Limitdan oshsa ApiError(429) + Retry-After tashlaydi.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const now = Date.now();
  const resetAt = now + windowMs;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} <= ${now} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} <= ${now} then ${resetAt} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });
  void sweep();
  if (row && row.count > limit) throw tooMany(row.resetAt);
}

/** Tayyor limit bo'yicha: `enforceLimit("orders", session.sub)` */
export function enforceLimit(name: RateLimitName, id: string) {
  const { limit, windowMs } = RATE_LIMITS[name];
  return rateLimit(`${name}:${id}`, limit, windowMs);
}

/** Hisoblagichni oshirmasdan tekshirish (login: urinishdan OLDIN) */
export async function assertUnderLimit(key: string, limit: number): Promise<void> {
  const row = await db.query.rateLimits.findFirst({ where: eq(rateLimits.key, key) });
  if (row && row.resetAt > Date.now() && row.count >= limit) throw tooMany(row.resetAt);
}

/** Muvaffaqiyatli kirishdan so'ng hisoblagichni nolga tushirish */
export async function clearLimit(key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}
