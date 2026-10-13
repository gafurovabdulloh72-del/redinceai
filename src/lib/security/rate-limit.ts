import "server-only";
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { PROPOSAL_DAILY_LIMIT } from "@/lib/constants";

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
 *   profile / privacy — userId (30 / soat) · verifyRequest / verifyConfirm — userId · accountExport / accountDelete — userId
 *   jobs / jobEdit / proposals / proposalAct / messages / subscription — userId (E'lon, Taklif, chat, Obuna to'lovi)
 *   twoFactorSetup — userId · twoFactorVerify — ticket jti + ip (5 / 15 daqiqa) · twoFactorUser — userId (muvaffaqiyatsiz kodlar)
 *   sessions — userId (sessiyani bekor qilish) · terms — userId
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
  favorites: { limit: 120, windowMs: HOUR },
  /** PUT /api/profile va PUT /api/privacy — userId (30 / soat) */
  profile: { limit: 30, windowMs: HOUR },
  privacy: { limit: 30, windowMs: HOUR },
  /** Email tasdiqlash: kod yuborish — userId; kodni tekshirish — userId (6 xonali kodni terib chiqib bo'lmasin) */
  verifyRequest: { limit: 5, windowMs: HOUR },
  verifyConfirm: { limit: 10, windowMs: 15 * MIN },
  /** Hisob: eksport va o'chirish — userId */
  accountExport: { limit: 5, windowMs: HOUR },
  accountDelete: { limit: 5, windowMs: HOUR },
  /** Sharhga javob (F43) va shikoyatlar (F85) — userId */
  reviewReply: { limit: 30, windowMs: HOUR },
  reports: { limit: 10, windowMs: HOUR },
  /** E'lon joylash — userId (10 / kun) */
  jobs: { limit: 10, windowMs: DAY },
  /** E'lonni tahrirlash / yopish / qayta ochish — userId (60 / soat) */
  jobEdit: { limit: 60, windowMs: HOUR },
  /**
   * Taklif yuborish urinishlari — mutaxassis userId (PROPOSAL_DAILY_LIMIT × 3 / kun). Asl kunlik limit —
   * server hisobi (proposalsSentToday ≤ PROPOSAL_DAILY_LIMIT); bu faqat xato urinishlar spamini to'xtatadi.
   */
  proposals: { limit: PROPOSAL_DAILY_LIMIT * 3, windowMs: DAY },
  /** Taklifni saralash / rad etish / qabul qilish / qaytarib olish — userId (120 / soat) */
  proposalAct: { limit: 120, windowMs: HOUR },
  /** Buyurtma chati xabarlari — userId (60 / 10 daqiqa) */
  messages: { limit: 60, windowMs: 10 * MIN },
  /** Obuna to'lovini boshlash — userId (20 / soat) */
  subscription: { limit: 20, windowMs: HOUR },
  /** 2FA: sozlashni boshlash / zaxira kodlarini yangilash — userId */
  twoFactorSetup: { limit: 10, windowMs: HOUR },
  /** 2FA kirish bosqichi: bitta ticket + ip bo'yicha har bir urinish */
  twoFactorVerify: { limit: 5, windowMs: 15 * MIN },
  /** 2FA: foydalanuvchi bo'yicha muvaffaqiyatsiz kodlar (ticket'larni almashtirib terib chiqib bo'lmasin) */
  twoFactorUser: { limit: 10, windowMs: 15 * MIN },
  /** Sessiyani (qurilmani) bekor qilish — userId */
  sessions: { limit: 30, windowMs: HOUR },
  /** Foydalanish shartlarini qabul qilish — userId */
  terms: { limit: 20, windowMs: HOUR },
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

/**
 * Bir martalik "kvota": kalit oynada hali ishlatilmagan bo'lsa true (va band qiladi), aks holda false.
 * Xato tashlamaydi — masalan, chat xabari uchun emailni 30 daqiqada bir martadan ko'p yubormaslik.
 */
export async function tryConsume(key: string, windowMs: number): Promise<boolean> {
  try {
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
      .returning({ count: rateLimits.count });
    return Boolean(row && row.count === 1);
  } catch {
    return false;
  }
}

/** Kalit hozir band (oynasi tugamagan) — tryConsume() bilan ishlatilgan bir martalik belgi uchun, o'zgartirmaydi */
export async function isConsumed(key: string): Promise<boolean> {
  const row = await db.query.rateLimits.findFirst({ where: eq(rateLimits.key, key), columns: { resetAt: true } });
  return Boolean(row && row.resetAt > Date.now());
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
