/**
 * Bot tili (2026-10-31): Telegram `language_code` ru → ruscha, aks holda o'zbekcha. Holat saqlanmaydi — har update'da
 * `from.language_code` dan olinadi (ro'yxat oqimida sessiya ma'lumotiga yoziladi). Klientga ham xavfsiz (server-only emas).
 */
export type BotLang = "uz" | "ru";
export const botLang = (code?: string | null): BotLang => ((code ?? "").toLowerCase().startsWith("ru") ? "ru" : "uz");
/** Ikki tilli matn: L(lang, uz, ru) */
export const L = (lang: BotLang | undefined, uz: string, ru: string): string => (lang === "ru" ? ru : uz);

/**
 * Son + ot. O'zbekchada ot o'zgarmaydi («3 post»), ruschada son bilan moslashadi (1 пост · 2 поста · 5 постов · 11 постов).
 * `ru` — [1, 2–4, 5+] shakllari. Foydalanuvchiga ko'rinadigan sanoqlar shu orqali yoziladi («1 постов» chiqmasin).
 */
export function plural(lang: BotLang | undefined, n: number, uz: string, ru: readonly [one: string, few: string, many: string]): string {
  if (lang !== "ru") return `${n} ${uz}`;
  const a = Math.abs(Math.trunc(n)) % 100;
  const b = a % 10;
  const form = a > 10 && a < 20 ? ru[2] : b === 1 ? ru[0] : b >= 2 && b <= 4 ? ru[1] : ru[2];
  return `${n} ${form}`;
}
