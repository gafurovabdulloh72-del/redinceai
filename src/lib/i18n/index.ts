/**
 * i18n yadrosi (klient uchun ham xavfsiz — "server-only" EMAS).
 * Til cookie orqali tanlanadi (URL prefiksi yo'q): standart "uz", qo'shimcha "ru".
 * Lug'atlar bo'lim-bo'lim fayllarda yoziladi: har kalit { uz, ru } juftligi,
 * parametrli satrlar uchun { uz: (n)=>..., ru: (n)=>... } funksiya juftligi ham mumkin.
 */
export const LOCALES = ["uz", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";
/** Cookie nomi — /api/til marshruti o'rnatadi */
export const LOCALE_COOKIE = "til";

/** Noma'lum qiymatni xavfsiz tilga keltiradi */
export function pickLocale(v: unknown): Locale {
  return v === "ru" ? "ru" : DEFAULT_LOCALE;
}

/** Bitta tarjima juftligi */
export interface Tr {
  uz: string;
  ru: string;
}

/** tr(locale, { uz: "Salom", ru: "Привет" }) */
export function tr(locale: Locale, e: Tr): string {
  return e[locale];
}

/** HTML lang atributi uchun */
export const LOCALE_LANG: Record<Locale, string> = { uz: "uz", ru: "ru" };

/** Til almashtirgich yorliqlari */
export const LOCALE_LABEL: Record<Locale, string> = { uz: "O'zbekcha", ru: "Русский" };
export const LOCALE_SHORT: Record<Locale, string> = { uz: "UZ", ru: "RU" };
