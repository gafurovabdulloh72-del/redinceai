/**
 * Vakansiyalar — lug'atlar va sof yordamchilar (server va klientda bir xil; server importlari YO'Q).
 * Kasblar ro'yxati barcha onlayn ishlaydigan kasblarni qamraydi — ijodkorlar faqat bir qismi.
 */
import { REGION_BY_SLUG } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";

export const PROFESSIONS = [
  { slug: "dasturlash", name: "Dasturlash / IT", short: "IT" },
  { slug: "dizayn", name: "Dizayn (grafik, UI/UX)", short: "Dizayn" },
  { slug: "video", name: "Video, montaj, animatsiya", short: "Video" },
  { slug: "marketing", name: "Marketing / SMM / reklama", short: "Marketing" },
  { slug: "kontent", name: "Kontent, kopirayting, tarjima", short: "Kontent" },
  { slug: "sotuv", name: "Sotuv va mijozlar bilan ishlash", short: "Sotuv" },
  { slug: "moliya", name: "Buxgalteriya / moliya", short: "Moliya" },
  { slug: "talim", name: "Ta'lim / repetitorlik", short: "Ta'lim" },
  { slug: "boshqaruv", name: "Boshqaruv, loyiha, assistent", short: "Boshqaruv" },
  { slug: "data", name: "Ma'lumotlar, analitika, AI", short: "Data / AI" },
  { slug: "boshqa", name: "Boshqa onlayn kasblar", short: "Boshqa" },
] as const;
export type ProfessionSlug = (typeof PROFESSIONS)[number]["slug"];
export const PROFESSION_SLUGS = PROFESSIONS.map((p) => p.slug) as [ProfessionSlug, ...ProfessionSlug[]];
export const PROFESSION_BY_SLUG: Record<string, (typeof PROFESSIONS)[number]> = Object.fromEntries(PROFESSIONS.map((p) => [p.slug, p]));

export const WORK_FORMAT = { remote: "Masofaviy", hybrid: "Gibrid", office: "Ofis" } as const;
export type WorkFormat = keyof typeof WORK_FORMAT;
export const RESUME_FORMAT = { any: "Istalgan format", ...WORK_FORMAT } as const;
export const EMPLOYMENT = { full: "To'liq stavka", part: "Yarim stavka", project: "Loyihaviy / freelance", internship: "Amaliyot" } as const;
export type Employment = keyof typeof EMPLOYMENT;
export const EXPERIENCE = { none: "Tajriba shart emas", junior: "1 yilgacha", middle: "1–3 yil", senior: "3+ yil" } as const;
export type Experience = keyof typeof EXPERIENCE;
export const RESUME_EXPERIENCE = { none: "Tajribasiz / boshlovchi", junior: "1 yilgacha", middle: "1–3 yil", senior: "3+ yil" } as const;
export const APPLICATION_STATUS = { new: "Yangi", viewed: "Ko'rildi", shortlisted: "Tanlovda", rejected: "Rad etildi", hired: "Ishga olindi" } as const;
export type ApplicationStatus = keyof typeof APPLICATION_STATUS;
export const APPLICATION_TONE: Record<ApplicationStatus, "neutral" | "info" | "accent" | "danger" | "success"> = { new: "neutral", viewed: "info", shortlisted: "accent", rejected: "danger", hired: "success" };

export const VACANCY_TTL_DAYS = 30;
export const VACANCY_TITLE_MIN = 5;
export const VACANCY_TITLE_MAX = 120;
export const VACANCY_DESC_MIN = 30;
export const VACANCY_DESC_MAX = 6000;
export const VACANCY_REQ_MAX = 3000;
export const VACANCY_SKILLS_MAX = 12;
export const RESUME_SUMMARY_MAX = 3000;
export const RESUME_SKILLS_MAX = 20;
export const RESUME_LINKS_MAX = 6;
export const COVER_LETTER_MAX = 2000;
export const COVER_LETTER_MIN = 30;
export const REMOTE_REGION = "remote";

/** "3–5 mln so'm" (birlik bir xil bo'lsa bir marta) / "500 ming – 1,5 mln so'm" / "5 mln so'mdan" / "Kelishiladi" */
export function salaryLabel(min: number | null | undefined, max: number | null | undefined): string {
  if (min && max) {
    const a = formatPrice(min, { compact: true });
    const b = formatPrice(max, { compact: true });
    const unit = (s: string) => s.replace(/^[\d,]+\s*/, "");
    // "3 mln so'm – 5 mln so'm" → "3–5 mln so'm"
    if (unit(a) === unit(b)) return `${a.replace(/\s.*$/, "")}–${b}`;
    return `${a.replace(/\s*so'm$/, "")} – ${b}`;
  }
  if (min) return `${formatPrice(min, { compact: true })}dan`;
  if (max) return `${formatPrice(max, { compact: true })}gacha`;
  return "Kelishiladi";
}

/** Maosh tez filtrlari (so'm/oy, `min` parametri) */
export const SALARY_CHIPS = [
  { min: 3_000_000, label: "3 mln+" },
  { min: 5_000_000, label: "5 mln+" },
  { min: 10_000_000, label: "10 mln+" },
] as const;

/** `pay` filtri: faqat maosh ko'rsatilganlar / faqat «Kelishiladi» */
export const PAY_FILTER = { set: "Maosh ko'rsatilgan", neg: "Kelishiladi" } as const;
export type PayFilter = keyof typeof PAY_FILTER;

/** Muddat tugashiga qolgan kunlar: 0 → "Bugun tugaydi", aks holda "N kun qoldi" */
export function daysLeftLabel(days: number): string {
  return days <= 0 ? "Bugun tugaydi" : `${days} kun qoldi`;
}

/** Ariza shuncha kundan beri javobsiz bo'lsa ishora chiqadi */
export const SLA_WAIT_DAYS = 3;

/** "N kundan beri javobsiz" — faqat yangi/ko'rilgan arizalar uchun, SLA_WAIT_DAYS dan oshsa; aks holda null */
export function slaHint(status: ApplicationStatus, createdAt: number, now = Date.now()): string | null {
  if (status !== "new" && status !== "viewed") return null;
  const days = Math.floor((now - createdAt) / 86_400_000);
  return days >= SLA_WAIT_DAYS ? `${days} kundan beri javobsiz` : null;
}

/** Arizalarim bo'limlari */
export const APPLICATION_TABS = [
  { key: "", label: "Barchasi" },
  { key: "faol", label: "Faol" },
  { key: "qabul", label: "Qabul" },
  { key: "rad", label: "Rad etilgan" },
] as const;
export type ApplicationTab = (typeof APPLICATION_TABS)[number]["key"];
export function applicationTabOf(status: ApplicationStatus): Exclude<ApplicationTab, ""> {
  return status === "hired" ? "qabul" : status === "rejected" ? "rad" : "faol";
}

export function vacancyRegionLabel(slug: string | null | undefined, full = false): string {
  if (!slug) return "Istalgan hudud";
  const r = REGION_BY_SLUG[slug];
  return r ? (full ? r.name : r.short) : slug;
}

export function professionLabel(slug: string, short = false): string {
  const p = PROFESSION_BY_SLUG[slug];
  return p ? (short ? p.short : p.name) : slug;
}
