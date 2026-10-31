import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginRequests, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { isTelegramEnabled } from "@/lib/telegram";
import { generateUsername } from "@/lib/chat/username";
import { hashPassword } from "@/lib/security/password";
import { joinOfficialChannels } from "@/lib/groups/service";
import { TERMS_VERSION } from "@/lib/constants";
import { uid } from "@/lib/utils";

/**
 * «Telegram bilan kirish» — bot orqali, Login Widget'siz (BotFather'da domen sozlash shart emas,
 * CSP'ga tashqi skript qo'shilmaydi).
 *
 * Oqim:
 *  1. Sayt `start()` chaqiradi → 6 xonali kod + `t.me/<bot>?start=l_<kod>` havolasi; brauzerga
 *     `tg_login` cookie'siga SIR yoziladi (so'rovning xeshi bazada).
 *  2. Foydalanuvchi botni ochadi → bot «Kirishni tasdiqlaysizmi?» tugmalarini beradi (`lg:ok|no:<kod>`).
 *  3. Tasdiqlansa `approve()` chat id'ni yozadi; sayt `consume()` bilan natijani oladi va sessiya ochadi.
 *
 * Xavfsizlik: havola/kodning o'zi yetarli emas — natijani faqat SIRni biladigan brauzer oladi;
 * so'rov 5 daqiqa yashaydi va bir marta ishlatiladi.
 */

export const TG_LOGIN_COOKIE = "tg_login";
const TTL_MS = 5 * 60_000;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function isTelegramLoginEnabled(): boolean {
  return isTelegramEnabled() && Boolean(process.env.TELEGRAM_BOT_USERNAME);
}

/** Eskirgan so'rovlarni tozalash (har yangi so'rovda; cron shart emas) */
async function sweep(): Promise<void> {
  await db.delete(loginRequests).where(or(lt(loginRequests.expiresAt, new Date()), eq(loginRequests.status, "used")));
}

export type LoginStart = { code: string; secret: string; link: string; expiresAt: number };

/** Yangi kirish so'rovi: kod, sir (cookie'ga) va bot havolasi */
export async function startTelegramLogin(deviceLabel?: string | null): Promise<LoginStart> {
  if (!isTelegramLoginEnabled()) throw new ApiError(503, "Telegram bilan kirish sozlanmagan");
  await sweep().catch(() => undefined);
  const secret = randomBytes(24).toString("base64url");
  // Kod takrorlanmasin: bir vaqtda faol so'rovlar orasida noyob bo'lsin (10 urinish)
  let code = "";
  for (let i = 0; i < 10; i++) {
    const c = String(randomInt(100_000, 1_000_000));
    const busy = await db.query.loginRequests.findFirst({ where: and(eq(loginRequests.code, c), eq(loginRequests.status, "pending")), columns: { id: true } });
    if (!busy) {
      code = c;
      break;
    }
  }
  if (!code) throw new ApiError(503, "Hozir band — bir necha soniyadan keyin urinib ko'ring");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(loginRequests).values({ id: uid(), code, secretHash: sha(secret), expiresAt, deviceLabel: deviceLabel ? deviceLabel.slice(0, 80) : null });
  const bot = process.env.TELEGRAM_BOT_USERNAME ?? "";
  return { code, secret, link: `https://t.me/${bot.replace(/^@/, "")}?start=l_${code}`, expiresAt: expiresAt.getTime() };
}

/** Bot tomoni: kod bo'yicha kutilayotgan so'rovni topish */
export async function findLoginRequest(code: string) {
  if (!/^\d{6}$/.test(code)) return null;
  const row = await db.query.loginRequests.findFirst({ where: and(eq(loginRequests.code, code), eq(loginRequests.status, "pending")) });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

/** Bot tomoni: foydalanuvchi tasdiqladi / rad etdi */
export async function decideLoginRequest(code: string, chatId: string, allow: boolean, who: { name?: string; username?: string }): Promise<boolean> {
  const row = await findLoginRequest(code);
  if (!row) return false;
  const r = await db
    .update(loginRequests)
    .set({ status: allow ? "approved" : "denied", telegramChatId: chatId, telegramName: (who.name ?? "").slice(0, 80) || null, telegramUsername: (who.username ?? "").slice(0, 40) || null })
    .where(and(eq(loginRequests.id, row.id), eq(loginRequests.status, "pending")))
    .returning({ id: loginRequests.id });
  return r.length > 0;
}

export type ConsumeResult =
  | { status: "pending" }
  | { status: "denied" }
  | { status: "expired" }
  /** Bot tasdiqladi, lekin sessiya HALI ochilmadi — brauzerda «bu hisob sizmi?» so'raladi */
  | { status: "confirm"; telegram: { name: string; username: string | null } }
  | { status: "ok"; userId: string; role: string; name: string; isNew: boolean };

/**
 * Sayt tomoni: cookie'dagi sir bo'yicha holatni o'qiydi. Tasdiqlangan bo'lsa hisobni
 * topadi yoki yaratadi va so'rovni «used» qiladi (CAS — ikki marta ishlatilmaydi).
 *
 * `confirm: false` (standart) — faqat Telegram hisobining nomini qaytaradi, sessiya OCHILMAYDI
 * (2026-10-25 auditi, 5-band: begona odam qurbonning kodini taxmin qilib o'z chatId'si bilan
 * tasdiqlasa, qurbon o'zi bilmay HUJUMCHI hisobiga kirib qolardi — endi brauzerda nom ko'rsatiladi
 * va foydalanuvchi aniq «Kirish» bosishi kerak). `confirm: true` — sessiya ochiladi.
 */
export async function consumeTelegramLogin(secret: string, opts: { confirm?: boolean } = {}): Promise<ConsumeResult> {
  if (!secret) return { status: "expired" };
  const row = await db.query.loginRequests.findFirst({ where: eq(loginRequests.secretHash, sha(secret)) });
  if (!row) return { status: "expired" };
  if (row.expiresAt.getTime() < Date.now()) return { status: "expired" };
  if (row.status === "denied") return { status: "denied" };
  if (row.status !== "approved" || !row.telegramChatId) return { status: "pending" };
  if (!opts.confirm) return { status: "confirm", telegram: { name: row.telegramName || row.telegramUsername || "Telegram foydalanuvchisi", username: row.telegramUsername } };

  // CAS: faqat bitta so'rov «used» qilib oladi
  const claimed = await db
    .update(loginRequests)
    .set({ status: "used" })
    .where(and(eq(loginRequests.id, row.id), eq(loginRequests.status, "approved")))
    .returning({ id: loginRequests.id });
  if (!claimed.length) return { status: "expired" };

  const r = await findOrCreateTelegramUser(row.telegramChatId, { name: row.telegramName, username: row.telegramUsername });
  return { status: "ok", ...r };
}

export interface TelegramUserResult {
  userId: string;
  role: string;
  name: string;
  isNew: boolean;
}

/**
 * Telegram chatId bo'yicha hisobni topadi yoki yaratadi («Telegram bilan kirish» va Mini App umumiy).
 * Yangi hisob emaili `tg<chatId>@telegram.local` (kabinetdan o'zgartiriladi); shu email bilan avval
 * yaratilib keyin uzilgan hisob bo'lsa — qayta bog'lanadi (dublikat yaratilmaydi). Bloklangan — 403.
 */
export async function findOrCreateTelegramUser(chatId: string, who: { name?: string | null; username?: string | null }): Promise<TelegramUserResult> {
  const found = await findTelegramUser(chatId);
  if (found) return found;
  const name = (who.name || who.username || "Telegram foydalanuvchisi").slice(0, 80);
  return createTelegramAccount(chatId, { name, username: who.username ?? null, role: "client" });
}

/**
 * Chatga ulangan hisobni topadi (YARATMAYDI): avval `telegramChatId`, keyin eski `tg<chatId>@telegram.local`
 * (avval yaratilib, keyin uzilgan) — topilsa qayta bog'laydi. Hisob yo'q — null: bot savol-javob bilan
 * ro'yxatdan o'tkazadi (2026-10-31: Telegram'dan kirganga avtomatik «mijoz» hisobi OCHILMAYDI).
 */
export async function findTelegramUser(chatId: string): Promise<TelegramUserResult | null> {
  const existing = await db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, role: true, name: true, isBanned: true } });
  if (existing) {
    if (existing.isBanned) throw new ApiError(403, "Hisob bloklangan");
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, existing.id));
    return { userId: existing.id, role: existing.role, name: existing.name, isNew: false };
  }
  const old = await db.query.users.findFirst({ where: eq(users.email, placeholderEmail(chatId)), columns: { id: true, role: true, name: true, isBanned: true } });
  if (old) {
    if (old.isBanned) throw new ApiError(403, "Hisob bloklangan");
    await db.update(users).set({ telegramChatId: chatId, lastLoginAt: new Date() }).where(eq(users.id, old.id));
    return { userId: old.id, role: old.role, name: old.name, isNew: false };
  }
  return null;
}

export const placeholderEmail = (chatId: string) => `tg${chatId}@telegram.local`;

export interface TelegramSignup {
  name: string;
  username?: string | null;
  role: "client" | "specialist";
  phone?: string | null;
  /** Mutaxassis uchun: kasb, tajriba, hudud — profil qatori darhol yaratiladi (narx daraja bo'yicha taklif) */
  specialist?: { category: string; experience: "junior" | "middle" | "senior" | "expert"; regionSlug: string } | null;
}

/**
 * Bot savol-javobidan hisob yaratish (Telegram email bermaydi — `tg<chatId>@telegram.local`, kabinetdan o'zgartiriladi).
 * Idempotent: chat allaqachon ulangan bo'lsa — o'sha hisob qaytadi.
 */
export async function createTelegramAccount(chatId: string, s: TelegramSignup): Promise<TelegramUserResult> {
  const found = await findTelegramUser(chatId);
  if (found) return found;
  const name = s.name.trim().slice(0, 80) || "Telegram foydalanuvchisi";
  const id = uid();
  await db.insert(users).values({
    id,
    username: await generateUsername(s.username || name),
    name,
    email: placeholderEmail(chatId),
    emailVerified: false,
    phone: s.phone || null,
    telegramChatId: chatId,
    role: s.role,
    digestFreq: s.role === "specialist" ? "weekly" : "off",
    // Parol bilan kirish yo'q — tasodifiy kuchli hash (keyin «parolni tiklash» orqali o'rnatiladi)
    passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
    lastLoginAt: new Date(),
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: new Date(),
  });
  if (s.role === "specialist" && s.specialist) {
    const { specialists } = await import("@/lib/db/schema");
    const { CATEGORY_BY_SLUG, REGION_BY_SLUG } = await import("@/lib/constants");
    const { slugify } = await import("@/lib/utils");
    const { suggestPrice } = await import("@/lib/pricing");
    const cat = CATEGORY_BY_SLUG[s.specialist.category];
    const region = REGION_BY_SLUG[s.specialist.regionSlug];
    const spId = uid();
    const base = slugify(name) || "mutaxassis";
    const taken = await db.query.specialists.findFirst({ where: eq(specialists.slug, base), columns: { id: true } });
    const price = suggestPrice({ category: s.specialist.category, experience: s.specialist.experience, regionSlug: s.specialist.regionSlug });
    await db.insert(specialists).values({
      id: spId,
      userId: id,
      slug: taken ? `${base}-${spId.slice(0, 6)}` : base,
      title: cat?.name ?? s.specialist.category,
      category: s.specialist.category,
      experience: s.specialist.experience,
      regionSlug: s.specialist.regionSlug,
      city: region?.capital ?? region?.name ?? "",
      priceFrom: price.from,
    });
    const { notifyAdminsNewSpecialist } = await import("@/lib/telegram-bot/admin");
    await notifyAdminsNewSpecialist(spId).catch(() => undefined);
  }
  await joinOfficialChannels(id).catch(() => undefined);
  return { userId: id, role: s.role, name, isNew: true };
}
