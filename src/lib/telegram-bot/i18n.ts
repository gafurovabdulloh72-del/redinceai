import "server-only";
import { ApiError } from "@/lib/api";
import { L, type BotLang } from "@/lib/telegram-bot/lang";

/**
 * Sayt servislaridan keladigan O'ZBEKCHA xato/holat matnini (`ApiError.message` — «Kurs topilmadi», «Promokod yaroqsiz»…)
 * rus tilidagi bot foydalanuvchisiga o'girish: bildirishnomalar bilan bir xil yo'l (`localizeNotification`: lug'at
 * `ru-dict.json` → baza keshi → AI; topilmasa asl matn qoladi). uz — o'zgarishsiz qaytadi.
 * Yangi servis xatosi botda ko'rinadigan bo'lsa — `ru-dict.json`ga ham yozing (AI'ga bog'liq bo'lmasin).
 */
export async function trServer(lang: BotLang | undefined, text: string): Promise<string> {
  if (lang !== "ru" || !text) return text;
  try {
    const { localizeNotification } = await import("@/lib/notifications");
    return (await localizeNotification(text, null)).title;
  } catch {
    return text;
  }
}

/**
 * Xatoni foydalanuvchiga ko'rsatiladigan matnga aylantirish: `ApiError` — o'z matni (tilga o'girib), boshqasi — umumiy zaxira.
 * Chegara xatosi (429) — bir xil umumiy matn: qancha kutish yoki chegara qiymati aytilmaydi.
 */
export async function errorText(e: unknown, lang: BotLang | undefined, fallbackUz: string, fallbackRu: string): Promise<string> {
  if (e instanceof ApiError && e.status === 429) return L(lang, "Juda ko'p so'rov. Birozdan keyin qayta urinib ko'ring.", "Слишком много запросов. Попробуйте чуть позже.");
  return e instanceof ApiError ? trServer(lang, e.message) : L(lang, fallbackUz, fallbackRu);
}
