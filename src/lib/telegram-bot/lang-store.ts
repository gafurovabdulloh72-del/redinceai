import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits, users } from "@/lib/db/schema";
import { botLang, type BotLang } from "@/lib/telegram-bot/lang";

/**
 * BOT TILI (2026-11-10). Ustuvorlik:
 *  1) hisob tili — `users.lang` (`/til` buyrug'i yoki saytdagi til almashtirgich; bildirishnomalar ham shu tilda);
 *  2) hisobsiz chatning tanlovi — `/til` bosilgan, lekin hali ro'yxatdan o'tmagan (`rate_limits` kaliti `tgLang:<chat>`,
 *     alohida jadval shart emas; hisob ochilganda/ulanganda `users.lang`ga ko'chadi);
 *  3) Telegram ilovasi tili (`language_code`: ru → ruscha, aks holda o'zbekcha).
 */
const TTL_MS = 365 * 24 * 60 * 60 * 1000;
const key = (chatId: string) => `tgLang:${chatId}`;
const CODE: Record<BotLang, number> = { uz: 1, ru: 2 };

/** Hisobsiz chat tanlagan til (bo'lmasa null). Baza xatosida null — Telegram tiliga qaytadi */
export async function guestLang(chatId: string): Promise<BotLang | null> {
  try {
    const row = await db.query.rateLimits.findFirst({ where: eq(rateLimits.key, key(chatId)), columns: { count: true, resetAt: true } });
    if (!row || row.resetAt <= Date.now()) return null;
    return row.count === CODE.ru ? "ru" : row.count === CODE.uz ? "uz" : null;
  } catch {
    return null;
  }
}

async function setGuestLang(chatId: string, lang: BotLang): Promise<void> {
  const resetAt = Date.now() + TTL_MS;
  await db
    .insert(rateLimits)
    .values({ key: key(chatId), count: CODE[lang], resetAt })
    .onConflictDoUpdate({ target: rateLimits.key, set: { count: CODE[lang], resetAt } });
}

/** Chat tilini aniqlash: hisob tili → hisobsiz chat tanlovi → Telegram tili */
export async function resolveLang(chatId: string, account: { lang?: string | null } | null | undefined, telegramCode?: string | null): Promise<BotLang> {
  if (account) return account.lang === "ru" || account.lang === "uz" ? account.lang : botLang(telegramCode);
  return (await guestLang(chatId)) ?? botLang(telegramCode);
}

/** Tilni saqlash: ulangan hisobda — `users.lang` (sayt va bildirishnomalar ham shu tilga o'tadi), aks holda chat tanlovi */
export async function saveLang(chatId: string, account: { id: string } | null | undefined, lang: BotLang): Promise<void> {
  if (account) await db.update(users).set({ lang }).where(eq(users.id, account.id));
  else await setGuestLang(chatId, lang);
}

/**
 * Hisob chatga endigina ulandi: chat avval til tanlagan bo'lsa va hisobda til belgilanmagan bo'lsa — tanlov hisobga ko'chadi
 * (hisobning o'z tili bo'lsa u ustun). Chat tanlovi tozalanadi.
 */
export async function adoptGuestLang(chatId: string, userId: string): Promise<void> {
  try {
    const picked = await guestLang(chatId);
    if (!picked) return;
    await db.update(users).set({ lang: picked }).where(and(eq(users.id, userId), isNull(users.lang)));
    await db.delete(rateLimits).where(eq(rateLimits.key, key(chatId)));
  } catch {
    /* til muhim emas — ulanish buzilmasin */
  }
}
