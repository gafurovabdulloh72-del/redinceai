import "server-only";
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { MAX_PROPOSAL_DAILY_LIMIT } from "@/lib/constants";

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
  /** Email bo'yicha (IP'dan mustaqil) — umumiy ofis/NAT ortidagi halol foydalanuvchilar qulflanib qolmasin (#51) */
  loginEmail: { limit: 40, windowMs: 15 * MIN },
  register: { limit: 5, windowMs: HOUR },
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
   * Taklif yuborish urinishlari — mutaxassis userId (eng yuqori tarif limiti × 2 / kun). Asl kunlik limit —
   * tarif bo'yicha server hisobi (proposalsSentToday ≤ TIER_LIMITS[tier].proposals); bu faqat xato urinishlar
   * spamini to'xtatadi. DIQQAT: Max tarif (50/kun) uchun bu chegara undan katta bo'lishi SHART.
   */
  proposals: { limit: MAX_PROPOSAL_DAILY_LIMIT * 2, windowMs: DAY },
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
  /** Jamoalar: yaratish (5 / kun), post (30 / soat), izoh (60 / soat), qo'shilish/obuna amallari (120 / soat) — userId */
  groups: { limit: 5, windowMs: DAY },
  /** Vakansiya e'loni va ariza — spamga qarshi */
  vacancies: { limit: 5, windowMs: DAY },
  applications: { limit: 20, windowMs: DAY },
  /** AI vakansiya yordamchisi (Gemini so'rovi pullik bo'lishi mumkin) */
  vacancyAi: { limit: 20, windowMs: DAY },
  /** Mos nomzodga taklif (DM) — spamga qarshi */
  vacancyInvite: { limit: 30, windowMs: DAY },
  posts: { limit: 30, windowMs: HOUR },
  comments: { limit: 60, windowMs: HOUR },
  social: { limit: 120, windowMs: HOUR },
  /** Ovozli xabarlar (alohida kvota — oddiy fayl kvotasini yemasin) va "yozmoqda" signallari — userId */
  voice: { limit: 200, windowMs: DAY },
  typing: { limit: 900, windowMs: HOUR },
  /** Maxfiylik sozlamalari / bloklash amallari — userId */
  blocks: { limit: 60, windowMs: HOUR },
  /** @eslatma avtoto'ldirish (har harfda so'rov, klientda kesh) — userId */
  mention: { limit: 600, windowMs: HOUR },
  /** Post ko'rish hisobi — ko'ruvchi kaliti (user yoki IP xeshi) bo'yicha */
  views: { limit: 1200, windowMs: HOUR },
  /** So'rovnoma ovozi / «qiziq emas» / muallifni yashirish — userId */
  feedActions: { limit: 240, windowMs: HOUR },
  /** Havola kartasi (OG) — server tashqi so'rov qiladi; ko'ruvchi kaliti (user yoki IP) bo'yicha */
  preview: { limit: 120, windowMs: HOUR },
  /** Push sinov xabari (o'ziga) — userId */
  pushTest: { limit: 10, windowMs: HOUR },
  /** «Telegram bilan kirish»: yangi kod so'rash — IP bo'yicha */
  tgLogin: { limit: 10, windowMs: 15 * MIN },
  /** «Telegram bilan kirish»: holatni so'rash (har 2 s) — IP bo'yicha */
  tgLoginPoll: { limit: 400, windowMs: 15 * MIN },
  /** DM: xabarni tahrirlash/o'chirish — userId */
  dmEdit: { limit: 120, windowMs: HOUR },
  /** DM: havola prevyusi (server OG so'rovi, keshlanadi) — userId */
  linkPreview: { limit: 300, windowMs: HOUR },

  /* ---- 2026-10-25 xavfsizlik auditi ---- */
  /** Efirga kirish urinishi (kod terishga qarshi) — userId (3-band) */
  liveGate: { limit: 20, windowMs: 15 * MIN },
  /** LiveKit tokeni — userId; har token LiveKit daqiqasini yoqadi (10-band) */
  liveToken: { limit: 60, windowMs: HOUR },
  /** Efir ichidagi yozuvlar: subtitr, davomat signali, qo'l ko'tarish (7-band) */
  liveWrite: { limit: 600, windowMs: HOUR },
  /** Efir yozuvini yoqish/o'chirish — Egress xarajatiga qarshi (11-band) */
  liveRecord: { limit: 20, windowMs: HOUR },
  /** Promokod tekshiruvi — kod terishga qarshi (4-band) */
  promo: { limit: 30, windowMs: HOUR },
  /** Mentorlik yozuvlari: kurs/dars CRUD, sharh, vazifa — userId */
  mentor: { limit: 240, windowMs: HOUR },
  /** Xarid boshlash (hisob ochish) — saytda ham, botda ham (6-band) */
  purchase: { limit: 30, windowMs: HOUR },
  /** Telegram bot: tugma bosishlari — chatId bo'yicha (6-band) */
  tgBot: { limit: 120, windowMs: HOUR },
  /** Telegram bot: `/start l_<kod>` — kodni terishga qarshi, chatId bo'yicha (5-band) */
  tgStart: { limit: 10, windowMs: HOUR },
  /** Telegram bot: oddiy xabarlar, buyruqlar va fayllar — chatId bo'yicha (har matn qidiruv + javob yuboradi) */
  tgMsg: { limit: 240, windowMs: HOUR },
  /** Telegram bot: inline so'rovlar (`@bot so'z`, har harfda bitta) — foydalanuvchi id bo'yicha; tugmalar chegarasidan ALOHIDA */
  tgInline: { limit: 600, windowMs: HOUR },
  /** Telegram bot: qo'llab-quvvatlashga xabar (fikr) — chatId bo'yicha. (Bot orqali shaxsiy xabar — saytdagi `messages` chelagi bilan umumiy) */
  tgSupport: { limit: 5, windowMs: HOUR },
  /** Mini App kirishi (/api/tg/auth) — kalit: tasdiqlangan Telegram user id (IP emas: mobil NAT ortida minglab odam) */
  tgApp: { limit: 60, windowMs: HOUR },
  /** Qo'ng'iroq tokeni va taklif amallari — userId */
  call: { limit: 120, windowMs: HOUR },
  /** Story yaratish/o'chirish/ko'rish belgisi — userId */
  stories: { limit: 300, windowMs: HOUR },
  /** Til almashtirish — IP bo'yicha (13-band: cookie yozadi, arzon, lekin cheksiz edi) */
  locale: { limit: 120, windowMs: HOUR },
  /** Avtomatik RU tarjima (IP) — har so'rov ≤60 matn; Gemini chaqiruvi qimmat */
  i18nAuto: { limit: 90, windowMs: HOUR },
  /** Post statistikasi — userId (16-band) */
  postStats: { limit: 120, windowMs: HOUR },
  /** Fikr bildirish (/api/fikr) — kirgan: userId, mehmon: IP (qattiqroq) */
  feedback: { limit: 10, windowMs: HOUR },
  feedbackGuest: { limit: 3, windowMs: HOUR },
} as const;
export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * KUNLIK (ishbilarmonlik) limitlari uchun tushunarli nom. Bular spam himoyasi emas, mahsulot qoidasi — shuning uchun xabar
 * «Juda ko'p urinish» emas, limitning o'zini aytadi («Kunlik limit: kuniga 5 ta vakansiya»); aks holda oltinchi vakansiyani
 * joylamoqchi bo'lgan odam «696 daqiqadan keyin urinib ko'ring» degan tushunarsiz xatoni ko'rardi.
 */
const LIMIT_LABELS: Partial<Record<string, (n: number) => string>> = {
  vacancies: (n) => `kuniga ${n} ta vakansiya`,
  applications: (n) => `kuniga ${n} ta ariza`,
  jobs: (n) => `kuniga ${n} ta e'lon`,
  vacancyAi: (n) => `kuniga ${n} ta AI loyiha`,
  vacancyInvite: (n) => `kuniga ${n} ta taklif`,
};

function tooMany(resetAt: number, label?: string): ApiError {
  const retry = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  // Kamchilik #96: foydalanuvchi qancha kutishini xabarning o'zida ko'rsin (UI alohida taymer chizmasa ham)
  const human = retry >= 5400 ? `${Math.ceil(retry / 3600)} soatdan` : retry >= 120 ? `${Math.ceil(retry / 60)} daqiqadan` : `${retry} soniyadan`;
  const text = label ? `Kunlik limit tugadi: ${label}. ${human} keyin yana urinib ko'ring` : `Juda ko'p urinish. ${human} keyin qayta urinib ko'ring`;
  return new ApiError(429, text, undefined, { "Retry-After": String(retry) });
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
export async function rateLimit(key: string, limit: number, windowMs: number, label?: string): Promise<void> {
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
  if (row && row.count > limit) throw tooMany(row.resetAt, label);
}

/** Tayyor limit bo'yicha: `enforceLimit("orders", session.sub)` */
export function enforceLimit(name: RateLimitName, id: string) {
  const { limit, windowMs } = RATE_LIMITS[name];
  return rateLimit(`${name}:${id}`, limit, windowMs, LIMIT_LABELS[name]?.(limit));
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
