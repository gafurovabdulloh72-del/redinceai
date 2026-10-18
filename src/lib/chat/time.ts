import type { Locale } from "@/lib/i18n";

/**
 * Chat vaqt belgilari — O'zbekiston vaqti (UTC+5, yozgi vaqt yo'q) bo'yicha, uz/ru lokalda.
 * Server va brauzerda bir xil natija (brauzer vaqt zonasiga bog'liq emas).
 */
const TZ_MS = 5 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

const MONTHS: Record<Locale, string[]> = {
  uz: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
};
const T = {
  today: { uz: "Bugun", ru: "Сегодня" },
  yesterday: { uz: "Kecha", ru: "Вчера" },
  now: { uz: "hozirgina", ru: "только что" },
  min: { uz: "daqiqa oldin", ru: "мин. назад" },
  hour: { uz: "soat oldin", ru: "ч. назад" },
  day: { uz: "kun oldin", ru: "дн. назад" },
} as const;

function parts(ms: number) {
  const t = new Date(ms + TZ_MS);
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes() };
}

/** Kun kaliti (YYYY-MM-DD, Toshkent) — kun ajratuvchilari uchun */
export function dayKey(ms: number): string {
  const p = parts(ms);
  return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}`;
}

/** HH:MM (Toshkent) */
export function clock(ms: number): string {
  const p = parts(ms);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

/** "18-oktabr" / "18 октября" (boshqa yil bo'lsa yil ham) */
export function dateLabel(ms: number, locale: Locale, now = Date.now()): string {
  const p = parts(ms);
  const year = p.y !== parts(now).y ? (locale === "ru" ? ` ${p.y}` : `, ${p.y}`) : "";
  return locale === "ru" ? `${p.d} ${MONTHS.ru[p.mo]}${year}` : `${p.d}-${MONTHS.uz[p.mo]}${year}`;
}

/** Kun ajratuvchisi: Bugun / Kecha / sana */
export function dayLabel(ms: number, locale: Locale, now = Date.now()): string {
  const k = dayKey(ms);
  if (k === dayKey(now)) return T.today[locale];
  if (k === dayKey(now - 86_400_000)) return T.yesterday[locale];
  return dateLabel(ms, locale, now);
}

/** Ro'yxatdagi vaqt: bugun — HH:MM, kecha — "Kecha", eski — sana */
export function listStamp(ms: number, locale: Locale, now = Date.now()): string {
  const k = dayKey(ms);
  if (k === dayKey(now)) return clock(ms);
  if (k === dayKey(now - 86_400_000)) return T.yesterday[locale];
  return dateLabel(ms, locale, now);
}

/** To'liq belgi (tooltip): "18-oktabr, 14:32" */
export function fullStamp(ms: number, locale: Locale, now = Date.now()): string {
  return `${dayLabel(ms, locale, now)}, ${clock(ms)}`;
}

/** Nisbiy vaqt uz/ru: hozirgina / 5 daqiqa oldin / 3 soat oldin / 2 kun oldin / sana */
export function relativeTime(ms: number, locale: Locale, now = Date.now()): string {
  const diff = Math.max(0, now - ms);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return T.now[locale];
  if (m < 60) return `${m} ${T.min[locale]}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${T.hour[locale]}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ${T.day[locale]}`;
  return dateLabel(ms, locale, now);
}
