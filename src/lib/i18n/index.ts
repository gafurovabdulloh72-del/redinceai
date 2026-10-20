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

/* ------------------------------------------------------------------ */
/* Ko'rinish tili (DISPLAY) — foydalanuvchi tanlaydigan 4 variant.
   DIQQAT: lug'at kalitlari faqat uz/ru (BASE). Ko'rinish tili BASE'ga xaritalaanadi,
   so'ng «uz_cyrl» uchun matn kirillga aylantiriladi (CyrillicLayer, DOM'da) — shuning uchun
   mavjud `tr()`/`[til]()` chaqiruvlari o'zgarmaydi (hammasi BASE uz/ru bilan ishlaydi). */
/* ------------------------------------------------------------------ */
export const DISPLAY_LOCALES = ["uz", "uz_cyrl", "ru", "en"] as const;
export type DisplayLocale = (typeof DISPLAY_LOCALES)[number];
export const DEFAULT_DISPLAY: DisplayLocale = "uz";

/** Ko'rinish tili → lug'at (BASE) tili. uz_cyrl→uz (keyin kirillga aylantiriladi); en→ru (ingliz lug'ati tayyor bo'lgунча). */
export function baseOf(d: DisplayLocale): Locale {
  if (d === "ru") return "ru";
  if (d === "en") return "ru"; // 2-bosqich: ingliz lug'ati + API; hozircha ru'ga tushadi
  return "uz"; // uz, uz_cyrl
}

/** Noma'lum qiymatni xavfsiz ko'rinish tiliga keltiradi */
export function pickDisplayLocale(v: unknown): DisplayLocale {
  return typeof v === "string" && (DISPLAY_LOCALES as readonly string[]).includes(v) ? (v as DisplayLocale) : DEFAULT_DISPLAY;
}

/** Ko'rinish tili yorliqlari (o'z tilida — switcher uchun) */
export const DISPLAY_LABEL: Record<DisplayLocale, string> = {
  uz: "O'zbekcha",
  uz_cyrl: "Ўзбекча",
  ru: "Русский",
  en: "English",
};
export const DISPLAY_SHORT: Record<DisplayLocale, string> = { uz: "UZ", uz_cyrl: "ЎЗ", ru: "RU", en: "EN" };
export const DISPLAY_LANG: Record<DisplayLocale, string> = { uz: "uz-Latn", uz_cyrl: "uz-Cyrl", ru: "ru", en: "en" };
