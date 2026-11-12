/** Mentorlik — klient va server uchun umumiy konstantalar va sof formatlar (DB'siz) */

export const MENTOR_CATEGORIES = [
  { key: "montaj", label: "Videomontaj" },
  { key: "videografiya", label: "Videografiya" },
  { key: "dizayn", label: "Grafik dizayn" },
  { key: "motion", label: "Motion / animatsiya" },
  { key: "foto", label: "Fotografiya" },
  { key: "smm", label: "SMM / marketing" },
  { key: "boshqa", label: "Boshqa" },
] as const;

export type MentorCategory = (typeof MENTOR_CATEGORIES)[number]["key"];

export const COURSE_LEVELS = [
  { key: "boshlangich", label: "Boshlang'ich" },
  { key: "orta", label: "O'rta" },
  { key: "pro", label: "Professional" },
] as const;

export type CourseLevel = (typeof COURSE_LEVELS)[number]["key"];

export const categoryLabel = (key: string): string => MENTOR_CATEGORIES.find((c) => c.key === key)?.label ?? "Boshqa";
export const levelLabel = (key: string): string => COURSE_LEVELS.find((l) => l.key === key)?.label ?? key;

/** Narx so'mda: 0 → "Bepul", aks holda "250 000 so'm" */
export function formatSom(price: number): string {
  if (!price) return "Bepul";
  return `${price.toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
}

/** Daqiqa → "1 soat 20 daq" / "45 daq" */
export function formatDuration(min: number): string {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} soat ${m} daq`;
  if (h) return `${h} soat`;
  return `${m} daq`;
}

/** Mentorlik limitlari (klientga xavfsiz) */
export const MENTOR_LIMITS = {
  headlineMax: 90,
  roleMax: 40,
  highlightsMax: 4,
  highlightTitleMax: 40,
  highlightTextMax: 300,
  bioMax: 1200,
  expertiseMax: 6,
  courseTitleMax: 100,
  courseSummaryMax: 600,
  outcomesMax: 10,
  requirementsMax: 8,
  outcomeMax: 140,
  audienceMax: 300,
  lessonTitleMax: 120,
  lessonBodyMax: 8000,
  reviewMax: 800,
  maxLessonsPerCourse: 60,
  priceMax: 50_000_000,
} as const;

/** Pul qoidalari (klientga xavfsiz): platforma komissiyasi, daromadni ushlab turish va yechish chegarasi */
export const MENTOR_FEE_PCT = 15;
export const EARNING_HOLD_DAYS = 7;
export const MIN_PAYOUT = 100_000;
export const SLOT_HOLD_MS = 20 * 60_000;
export const SUB_DAYS = 30;

export type PurchaseType = "course" | "ticket" | "sub" | "consult" | "review";
export const PURCHASE_LABEL: Record<PurchaseType, string> = { course: "Kurs", ticket: "Efir chiptasi", sub: "Oylik obuna", consult: "Konsultatsiya", review: "Ish sharhi" };

/**
 * «Ishimni baholang» chegaralari (klientga xavfsiz). Narx konsultatsiya bilan bir xil uslubda: 0 (bepul) yoki
 * 5 000 – 5 000 000 so'm; javob muddati 1–14 kun.
 */
export const WORK_REVIEW = {
  priceMin: 5_000,
  priceMax: 5_000_000,
  daysMin: 1,
  daysMax: 14,
  aboutMax: 400,
  noteMax: 1500,
  responseMin: 20,
  responseMax: 5000,
  /** Bitta talabada bir vaqtda to'lanmagan so'rovlar chegarasi */
  openMax: 5,
} as const;
export type WorkReviewStatus = "pending_payment" | "waiting" | "done" | "refunded" | "cancelled";

/** Kurs tili yorlig'i (courses.language) */
export const COURSE_LANGUAGES = [
  { key: "uz", label: "O'zbek" },
  { key: "ru", label: "Rus" },
  { key: "en", label: "Ingliz" },
] as const;
export function languageLabel(key: string): string {
  return COURSE_LANGUAGES.find((l) => l.key === key)?.label ?? key;
}

/**
 * Mentorlik imkoniyatlari (2026-11-12 soddalashtirish): boshlang'ich bosqichda faqat «kurs + 1:1» savdosi ko'rinadi —
 * ustoz nimadan boshlashni bilmay qolmasin. Quyidagilar O'CHIRILMAGAN (server, jadval, API ishlayveradi), faqat UI'da
 * yashirin; qaytarish — qiymatni `true` qilish. Mavjud oylik obunachilarning «… gacha obuna» belgisi baribir ko'rinadi.
 */
export const MENTOR_FEATURES = {
  /** Ustozga oylik obuna (sahifadagi «Obuna bo'lish» tugmasi, narx sozlamasi, «faqat obunachilarga» postlar) */
  monthlySub: false,
  /** Promokodlar (ustoz kabinetida yaratish, xarid oynasida kiritish) */
  promo: false,
  /** Tavsiya qilish (do'st chegirmasi kartasi, tavsiya foizi sozlamasi) */
  referral: false,
  /** Ustoz sahifasidagi yutuq belgilari */
  badges: false,
} as const;
