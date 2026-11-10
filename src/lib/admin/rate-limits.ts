import "server-only";
import { and, desc, eq, gt, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits, users } from "@/lib/db/schema";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { escapeLike } from "@/lib/utils";

/**
 * TEZLIK CHEKLOVLARI KO'RUVCHISI (2026-11-10) — «men kira olmayapman / yoza olmayapman» degan haqiqiy foydalanuvchini
 * tezda ochish uchun: `rate_limits` jadvalidagi faol hisoblagichlar, kimga tegishli, oynasi qachon tugaydi; bittasini
 * tozalash.
 *
 * MUHIM — jadval faqat limitlar emas. Unda BELGILAR ham yotadi va ularni tozalash XAVFLI:
 *   revoked:<sub>:<iat>  — chiqib ketgan sessiya (o'chirilsa eski cookie yana ishlaydi);
 *   totpUsed:… / ticketUsed:… — ishlatilgan 2FA kodi/chiptasi (o'chirilsa kodni qayta ishlatish mumkin);
 *   mailMsg:… / tgMsg:… / subRemind:… / adminDaily:… — «bir marta yuborildi» belgilari (o'chirilsa xabar takror ketadi).
 * Shuning uchun OQ RO'YXAT: faqat ma'lum limit oilalari ko'rsatiladi va tozalanadi (`RATE_LIMITS` nomlari + pastdagi
 * qo'shimchalar). Noma'lum prefiksli kalit — ko'rinmaydi, tozalab ham bo'lmaydi. Yangi `rateLimit("nom:…")` qo'shsangiz
 * va u admin ko'rishi kerak bo'lsa — EXTRA_LIMITS'ga yozing.
 */
interface LimitDef {
  limit: number;
  windowMs: number;
  label: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

/** `RATE_LIMITS`da bo'lmagan, kodda to'g'ridan-to'g'ri `rateLimit("nom:…")` bilan ishlatiladigan limitlar */
const EXTRA_LIMITS: Record<string, LimitDef> = {
  "api:u": { limit: 300, windowMs: HOUR, label: "Umumiy amallar (hisob)" },
  "api:ip": { limit: 2000, windowMs: HOUR, label: "Umumiy amallar (mehmon IP)" },
  resetEmail: { limit: 3, windowMs: HOUR, label: "Parol tiklash (email bo'yicha)" },
  adminSubscription: { limit: 120, windowMs: HOUR, label: "Admin: obuna amallari" },
  dispute: { limit: 5, windowMs: HOUR, label: "Nizo ochish" },
  usernameCheck: { limit: 120, windowMs: HOUR, label: "Taxallus tekshiruvi" },
  tgTest: { limit: 5, windowMs: HOUR, label: "Telegram sinov xabari" },
  portfolioEdit: { limit: 120, windowMs: HOUR, label: "Portfolio tahriri" },
  vacancyAlerts: { limit: 30, windowMs: HOUR, label: "Vakansiya ogohlantirishlari" },
  savedSearches: { limit: 30, windowMs: HOUR, label: "Saqlangan qidiruvlar" },
  savedSearchCheck: { limit: 60, windowMs: HOUR, label: "Saqlangan qidiruvni tekshirish" },
  subscriptionInvoice: { limit: 30, windowMs: HOUR, label: "Obuna hisobi amallari" },
  payout: { limit: 5, windowMs: HOUR, label: "Pul yechish so'rovi" },
};

/**
 * Limitlarning o'zbekcha nomi (admin ro'yxati uchun). `Partial` — ATAYLAB: `RATE_LIMITS`ga yangi nom qo'shilganda bu fayl
 * build'ni sindirmasin; nomi yozilmagan limit kod nomi bilan ko'rinadi (yangi limit qo'shsangiz shu yerga ham yozing).
 */
const LABELS: Partial<Record<keyof typeof RATE_LIMITS, string>> = {
  login: "Kirish urinishlari (IP + email)",
  loginIp: "Kirish urinishlari (IP)",
  loginEmail: "Kirish urinishlari (email)",
  register: "Ro'yxatdan o'tish",
  reset: "Parol tiklash so'rovi",
  resetConfirm: "Parol tiklashni tasdiqlash",
  password: "Parolni o'zgartirish",
  twoFactorVerify: "2FA kodi (chipta bo'yicha)",
  twoFactorUser: "2FA kodi (foydalanuvchi bo'yicha)",
  twoFactorSetup: "2FA sozlash",
  verifyRequest: "Email tasdiqlash kodi so'rash",
  verifyConfirm: "Email kodini tekshirish",
  sessions: "Sessiyani yopish",
  terms: "Shartlarni qabul qilish",
  accountExport: "Ma'lumot eksporti",
  accountDelete: "Hisobni o'chirish",
  tgLogin: "Telegram bilan kirish",
  tgLoginPoll: "Telegram kirish holati",
  tgBot: "Telegram bot tugmalari",
  tgStart: "Telegram bot /start",
  tgApp: "Telegram Mini App kirishi",
  locale: "Til almashtirish",
  i18nAuto: "Avtomatik tarjima",
  orders: "Buyurtma berish",
  messages: "Buyurtma chati xabarlari",
  reviews: "Sharh yozish",
  reviewReply: "Sharhga javob",
  reports: "Shikoyat yuborish",
  favorites: "Sevimlilar",
  profile: "Profilni saqlash",
  privacy: "Maxfiylik sozlamalari",
  blocks: "Bloklash amallari",
  portfolio: "Portfolio (kunlik)",
  upload: "Fayl yuklash (kunlik)",
  voice: "Ovozli xabar (kunlik)",
  typing: "«Yozmoqda» signali",
  posts: "Post joylash",
  comments: "Izoh yozish",
  social: "Ijtimoiy amallar (obuna, reaksiya)",
  mention: "@eslatma qidiruvi",
  views: "Ko'rishlar hisobi",
  feedActions: "Lenta amallari",
  preview: "Havola kartasi",
  linkPreview: "Chat havola kartasi",
  dmEdit: "Xabarni tahrirlash/o'chirish",
  postStats: "Post statistikasi",
  stories: "Story amallari",
  groups: "Jamoa yaratish (kunlik)",
  jobs: "E'lon joylash (kunlik)",
  jobEdit: "E'lonni tahrirlash",
  proposals: "Taklif yuborish (kunlik)",
  proposalAct: "Taklif bo'yicha amallar",
  vacancies: "Vakansiya e'loni (kunlik)",
  applications: "Vakansiyaga ariza (kunlik)",
  vacancyAi: "AI vakansiya yordamchisi (kunlik)",
  vacancyInvite: "Nomzodga taklif (kunlik)",
  checkout: "To'lovni boshlash",
  subscription: "Obuna to'lovi",
  purchase: "Xarid boshlash",
  promo: "Promokod tekshiruvi",
  mentor: "Mentorlik yozuvlari",
  liveGate: "Efirga kirish kodi",
  liveToken: "Efir tokeni",
  liveWrite: "Efir ichidagi yozuvlar",
  liveRecord: "Efir yozuvini boshqarish",
  call: "Qo'ng'iroq",
  pushTest: "Push sinov xabari",
  feedback: "Fikr bildirish",
  feedbackGuest: "Fikr bildirish (mehmon)",
  clientError: "Brauzer xato hisobotlari (IP)",
  adminCron: "Admin: cron'ni qo'lda ishga tushirish",
  adminReset: "Admin: parol tiklash havolasi",
};

function defFor(name: string): LimitDef | null {
  const extra = EXTRA_LIMITS[name];
  if (extra) return extra;
  const base = (RATE_LIMITS as Record<string, { limit: number; windowMs: number } | undefined>)[name];
  return base ? { limit: base.limit, windowMs: base.windowMs, label: (LABELS as Record<string, string | undefined>)[name] ?? name } : null;
}

/** Kalit → limit oilasi va identifikator. `api:u:<id>` / `api:ip:<ip>` — ikki bo'lakli prefiks */
export function parseLimitKey(key: string): { name: string; id: string } | null {
  const m = /^(api:(?:u|ip)):(.+)$/s.exec(key);
  if (m) return { name: m[1], id: m[2] };
  const i = key.indexOf(":");
  if (i <= 0) return null;
  return { name: key.slice(0, i), id: key.slice(i + 1) };
}

/** Kalit ma'lum LIMIT oilasigami (belgi emas) — faqat shundaylar ko'rsatiladi va tozalanadi */
export function knownLimit(key: string): (LimitDef & { name: string; id: string }) | null {
  const p = parseLimitKey(key);
  if (!p) return null;
  const def = defFor(p.name);
  return def ? { ...def, ...p } : null;
}

/** SQL: faqat ma'lum limit oilalari (prefiks bo'yicha) */
function knownFamiliesCondition(): SQL {
  const names = [...new Set([...Object.keys(RATE_LIMITS), ...Object.keys(EXTRA_LIMITS)])];
  // `key LIKE 'nom:%'` — nomlar kod konstantalari (foydalanuvchi kiritmaydi), baribir escape qilinadi
  const conds = names.map((n) => sql`${rateLimits.key} like ${`${escapeLike(n)}:%`} escape '\\'`);
  return or(...conds) as SQL;
}

export interface RateLimitView {
  key: string;
  /** Limit oilasi (kod nomi) va o'zbekcha nomi */
  name: string;
  label: string;
  /** Kalitning identifikator qismi (IP, email, chat id…) — foydalanuvchi topilsa `user` to'ladi */
  id: string;
  user: { id: string; name: string; email: string } | null;
  count: number;
  limit: number;
  /** Limitga yetgan: keyingi so'rov 429 oladi */
  limited: boolean;
  resetAt: number;
}

const UUID_IN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|seed-[A-Za-z0-9-]{4,40}/gi;

export async function listRateLimits(opts: { q?: string; onlyLimited?: boolean; limit?: number } = {}): Promise<{ items: RateLimitView[]; total: number; limitedTotal: number }> {
  const now = Date.now();
  const max = Math.min(200, Math.max(1, opts.limit ?? 100));
  const conds: SQL[] = [gt(rateLimits.resetAt, now), knownFamiliesCondition()];

  const q = opts.q?.trim().slice(0, 80);
  if (q && q.length >= 2) {
    const term = `%${escapeLike(q.toLowerCase())}%`;
    // Kalit ichida (IP, email, id) yoki foydalanuvchi ismi/emaili bo'yicha → uning id'si kalitda
    const matched = await db
      .select({ id: users.id })
      .from(users)
      .where(or(sql`lower(${users.name}) like ${term} escape '\\'`, sql`lower(${users.email}) like ${term} escape '\\'`, sql`lower(coalesce(${users.username}, '')) like ${term} escape '\\'`))
      .limit(20);
    const byKey = sql`lower(${rateLimits.key}) like ${term} escape '\\'`;
    const byUser = matched.map((u) => sql`${rateLimits.key} like ${`%${escapeLike(u.id)}%`} escape '\\'`);
    conds.push(or(byKey, ...byUser) as SQL);
  }

  // Limitga yetganlarni SQL'da ajratib bo'lmaydi (limit qiymati kodda) — keng oynani olib, xotirada saralaymiz
  const rows = await db.select().from(rateLimits).where(and(...conds)).orderBy(desc(rateLimits.count)).limit(1500);
  const all: RateLimitView[] = [];
  for (const r of rows) {
    const k = knownLimit(r.key);
    if (k) all.push({ key: r.key, name: k.name, label: k.label, id: k.id, user: null, count: r.count, limit: k.limit, limited: r.count >= k.limit, resetAt: r.resetAt });
  }
  const limitedTotal = all.filter((x) => x.limited).length;
  const filtered = opts.onlyLimited ? all.filter((x) => x.limited) : all;
  // Tartib: cheklanganlar birinchi, keyin limitga yaqinligi bo'yicha
  filtered.sort((a, b) => Number(b.limited) - Number(a.limited) || b.count / b.limit - a.count / a.limit || a.resetAt - b.resetAt);
  const items = filtered.slice(0, max);

  // Kalitdagi foydalanuvchi id'lari → ism/email (bitta so'rov)
  const ids = [...new Set(items.flatMap((x) => x.id.match(UUID_IN) ?? []))];
  if (ids.length) {
    const found = await db.query.users.findMany({ where: inArray(users.id, ids.slice(0, 300)), columns: { id: true, name: true, email: true } });
    const map = new Map(found.map((u) => [u.id, u]));
    for (const it of items) {
      const hit = (it.id.match(UUID_IN) ?? []).map((i) => map.get(i)).find(Boolean);
      if (hit) it.user = { id: hit.id, name: hit.name, email: hit.email };
    }
  }
  return { items, total: all.length, limitedTotal };
}

/**
 * Bitta limit kalitini tozalash. Faqat ma'lum limit oilasidagi kalit (belgilar — `revoked:`, `totpUsed:` va h.k. — rad etiladi).
 * Natija: "cleared" | "not_found" | "forbidden".
 */
export async function clearRateLimit(key: string): Promise<"cleared" | "not_found" | "forbidden"> {
  if (!knownLimit(key)) return "forbidden";
  const res = await db.delete(rateLimits).where(eq(rateLimits.key, key));
  return res.rowsAffected > 0 ? "cleared" : "not_found";
}
