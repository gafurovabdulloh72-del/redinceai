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
export async function startTelegramLogin(): Promise<LoginStart> {
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
  await db.insert(loginRequests).values({ id: uid(), code, secretHash: sha(secret), expiresAt });
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
  | { status: "ok"; userId: string; role: string; name: string; isNew: boolean };

/**
 * Sayt tomoni: cookie'dagi sir bo'yicha holatni o'qiydi. Tasdiqlangan bo'lsa hisobni
 * topadi yoki yaratadi va so'rovni «used» qiladi (CAS — ikki marta ishlatilmaydi).
 */
export async function consumeTelegramLogin(secret: string): Promise<ConsumeResult> {
  if (!secret) return { status: "expired" };
  const row = await db.query.loginRequests.findFirst({ where: eq(loginRequests.secretHash, sha(secret)) });
  if (!row) return { status: "expired" };
  if (row.expiresAt.getTime() < Date.now()) return { status: "expired" };
  if (row.status === "denied") return { status: "denied" };
  if (row.status !== "approved" || !row.telegramChatId) return { status: "pending" };

  // CAS: faqat bitta so'rov «used» qilib oladi
  const claimed = await db
    .update(loginRequests)
    .set({ status: "used" })
    .where(and(eq(loginRequests.id, row.id), eq(loginRequests.status, "approved")))
    .returning({ id: loginRequests.id });
  if (!claimed.length) return { status: "expired" };

  const chatId = row.telegramChatId;
  const existing = await db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, role: true, name: true, isBanned: true } });
  if (existing) {
    if (existing.isBanned) throw new ApiError(403, "Hisob bloklangan");
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, existing.id));
    return { status: "ok", userId: existing.id, role: existing.role, name: existing.name, isNew: false };
  }

  // Yangi hisob: Telegram email bermaydi — vaqtinchalik manzil qo'yamiz (kabinetdan o'zgartiriladi)
  const name = (row.telegramName || row.telegramUsername || "Telegram foydalanuvchisi").slice(0, 80);
  const placeholder = `tg${chatId}@telegram.local`;
  // Avvalroq shu Telegram bilan yaratilgan, keyin uzilgan hisob bo'lsa — qaytadan bog'laymiz
  const old = await db.query.users.findFirst({ where: eq(users.email, placeholder), columns: { id: true, role: true, name: true, isBanned: true } });
  if (old) {
    if (old.isBanned) throw new ApiError(403, "Hisob bloklangan");
    await db.update(users).set({ telegramChatId: chatId, lastLoginAt: new Date() }).where(eq(users.id, old.id));
    return { status: "ok", userId: old.id, role: old.role, name: old.name, isNew: false };
  }
  const id = uid();
  await db.insert(users).values({
    id,
    username: await generateUsername(row.telegramUsername || name),
    name,
    email: placeholder,
    emailVerified: false,
    telegramChatId: chatId,
    role: "client",
    // Parol bilan kirish yo'q — tasodifiy kuchli hash (keyin «parolni tiklash» orqali o'rnatiladi)
    passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
    lastLoginAt: new Date(),
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: new Date(),
  });
  await joinOfficialChannels(id).catch(() => undefined);
  return { status: "ok", userId: id, role: "client", name, isNew: true };
}
