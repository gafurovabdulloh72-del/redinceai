import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { RATE_LIMITS, rateLimit, tryConsume } from "@/lib/security/rate-limit";
import { L, type BotLang } from "@/lib/telegram-bot/lang";

/**
 * Webhook himoya yordamchilari (2026-11-10): update takrori, chat bo'yicha chegaralar.
 * QOIDA: foydalanuvchiga chiqadigan matnda chegara qiymati, qancha urinish qolgani yoki nima yozib olinishi AYTILMAYDI —
 * faqat «birozdan keyin urinib ko'ring».
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Update birinchi marta kelyaptimi (24 soat ichida). Telegram javobni vaqtida olmasa (sekin handler, platforma vaqt chegarasi)
 * o'sha update'ni QAYTA yuboradi — takrori ikkinchi marta bajarilmasligi kerak (ikki marta post, takroriy javob, takror e'lon).
 * Baza xatosida — true: update yo'qolgandan ko'ra bir marta ortiqcha bajarilgani yaxshi.
 */
export function firstSeenUpdate(updateId: number): Promise<boolean> {
  return firstSeen(`tgUpd:${updateId}`, DAY_MS);
}

/**
 * Kalit oynada BIRINCHI marta ko'rilyaptimi (va band qiladi). `tryConsume`dan farqi: baza xatosida `true` qaytadi —
 * «takror» deb noto'g'ri tashlab yuborgandan ko'ra bir marta ortiqcha bajargan ma'qul (update takrori, albomning birinchi fayli).
 */
export async function firstSeen(key: string, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const resetAt = now + windowMs;
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ key: key.slice(0, 200), count: 1, resetAt })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.resetAt} <= ${now} then 1 else ${rateLimits.count} + 1 end`,
          resetAt: sql`case when ${rateLimits.resetAt} <= ${now} then ${resetAt} else ${rateLimits.resetAt} end`,
        },
      })
      .returning({ count: rateLimits.count });
    return !row || row.count === 1;
  } catch {
    return true;
  }
}

export type BotBucket = "tgBot" | "tgStart" | "tgMsg" | "tgInline" | "tgSupport" | "tgDm";

/**
 * Chat (yoki foydalanuvchi) bo'yicha chegara. `true` — chegaradan o'tildi, davom etmaymiz. Telegram update'i baribir 200 bilan
 * tasdiqlanadi (aks holda Telegram qayta-qayta yuboraveradi). `scope` — bir xil o'lchamdagi ALOHIDA hisoblagich
 * (masalan `tgStart` + "cb": kirish tasdig'i tugmalari `/start l_` urinishlari bilan bitta chelakni bo'lishmasin).
 */
export async function botLimited(id: string, name: BotBucket, scope = ""): Promise<boolean> {
  try {
    await rateLimit(`${name}:${scope ? `${scope}:` : ""}${id}`, RATE_LIMITS[name].limit, RATE_LIMITS[name].windowMs);
    return false;
  } catch (e) {
    // Faqat haqiqiy chegara (429) to'xtatadi; baza xatosi (band, uzilish) — o'tkazamiz: halol foydalanuvchi «juda ko'p so'rov» olmasin
    if (e instanceof ApiError && e.status === 429) return true;
    console.error("[telegram:limit]", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Chegaralangan foydalanuvchiga matn (bir xil, tafsilotsiz) */
export const LIMITED_TEXT = (lang?: BotLang): string => L(lang, "Juda ko'p so'rov. Birozdan keyin qayta urinib ko'ring.", "Слишком много запросов. Попробуйте чуть позже.");

/** Chegara haqidagi ogohlantirishni chatga oynada BIR MARTA yuborish kerakmi (har xabarga javob qaytarib, o'zimiz flood qilmaylik) */
export async function shouldWarnLimited(chatId: string): Promise<boolean> {
  return tryConsume(`tgWarn:${chatId}`, 10 * 60 * 1000);
}
