/**
 * Bot tili (2026-10-31): Telegram `language_code` ru → ruscha, aks holda o'zbekcha. Holat saqlanmaydi — har update'da
 * `from.language_code` dan olinadi (ro'yxat oqimida sessiya ma'lumotiga yoziladi). Klientga ham xavfsiz (server-only emas).
 */
export type BotLang = "uz" | "ru";
export const botLang = (code?: string | null): BotLang => ((code ?? "").toLowerCase().startsWith("ru") ? "ru" : "uz");
/** Ikki tilli matn: L(lang, uz, ru) */
export const L = (lang: BotLang | undefined, uz: string, ru: string): string => (lang === "ru" ? ru : uz);
