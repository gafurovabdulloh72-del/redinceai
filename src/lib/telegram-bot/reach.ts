import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

/**
 * YETIB BO'LMAYDIGAN CHATLAR (2026-11-10): foydalanuvchi botni bloklagan, Telegram hisobini o'chirgan yoki botni hech qachon
 * ishga tushirmagan (Mini App orqali ro'yxatdan o'tgan) bo'lsa, har yuborish 403 qaytaradi. Bunday chat BELGILANADI —
 * ommaviy yuborishlar (bildirishnoma, e'lon, jamlama) unga qayta-qayta urinmaydi.
 *
 * `users.telegramChatId` O'CHIRILMAYDI: hisob bog'lanishi saqlanadi (Mini App kirishi, botdagi buyruqlar ishlayveradi) —
 * faqat yuborish to'xtaydi. Belgi `rate_limits` jadvalida (kalit `tgDead:<chatId>`, alohida jadval shart emas) 14 kun
 * yashaydi: muddat o'tgach bir marta qayta sinab ko'riladi. Chatdan har qanday xabar kelsa (foydalanuvchi blokni olgan)
 * yoki `my_chat_member` «member» bo'lsa — belgi darhol olinadi.
 */
const TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** «Belgilanmagan» javobi xotirada shuncha turadi (har yuborishda bazaga bormaslik uchun) */
const CLEAN_MEMO_MS = 5 * 60 * 1000;
const key = (chatId: string) => `tgDead:${chatId}`;

/** Jarayon xotirasi: chatId → { dead, until } (dev'da modul qayta yuklanadi — globalThis'da) */
const flag = globalThis as { __redinceTgReach?: Map<string, { dead: boolean; until: number }> };
const memo = (): Map<string, { dead: boolean; until: number }> => (flag.__redinceTgReach ??= new Map());

/** Chat yetib bo'lmaydigan deb belgilanganmi (xotira → baza). Baza xatosida — yo'q (yuborishga urinamiz) */
export async function isUnreachable(chatId: string): Promise<boolean> {
  const now = Date.now();
  const hit = memo().get(chatId);
  if (hit && hit.until > now) return hit.dead;
  try {
    const row = await db.query.rateLimits.findFirst({ where: eq(rateLimits.key, key(chatId)), columns: { resetAt: true } });
    const dead = Boolean(row && row.resetAt > now);
    memo().set(chatId, { dead, until: dead ? row!.resetAt : now + CLEAN_MEMO_MS });
    return dead;
  } catch {
    return false;
  }
}

/** Yuborish 403 / «chat not found» qaytardi yoki `my_chat_member` «kicked» keldi */
export async function markUnreachable(chatId: string, why = ""): Promise<void> {
  const until = Date.now() + TTL_MS;
  memo().set(chatId, { dead: true, until });
  try {
    await db
      .insert(rateLimits)
      .values({ key: key(chatId), count: 1, resetAt: until })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: 1, resetAt: until } });
  } catch (e) {
    console.error("[telegram:reach]", e instanceof Error ? e.message : e);
  }
  if (why) console.warn(`[telegram] chat ${chatId} yetib bo'lmaydigan deb belgilandi: ${why.slice(0, 120)}`);
}

/** Chatdan xabar keldi (yoki bot qayta ishga tushirildi) — belgi olinadi */
export async function markReachable(chatId: string): Promise<void> {
  const hit = memo().get(chatId);
  // Xotirada «toza» deb turgan bo'lsa bazaga bormaymiz (har update'da bitta ortiqcha DELETE bo'lmasin)
  if (hit && !hit.dead && hit.until > Date.now()) return;
  memo().set(chatId, { dead: false, until: Date.now() + CLEAN_MEMO_MS });
  try {
    await db.delete(rateLimits).where(eq(rateLimits.key, key(chatId)));
  } catch {
    /* muhim emas — keyingi update'da qayta uriniladi */
  }
}

/** Hozir belgilangan chatlar soni (admin statistikasi) */
export async function unreachableCount(): Promise<number> {
  try {
    const { and, gt, like, sql } = await import("drizzle-orm");
    const r = await db
      .select({ c: sql<number>`count(*)` })
      .from(rateLimits)
      .where(and(like(rateLimits.key, "tgDead:%"), gt(rateLimits.resetAt, Date.now())));
    return Number(r[0]?.c ?? 0);
  } catch {
    return 0;
  }
}
