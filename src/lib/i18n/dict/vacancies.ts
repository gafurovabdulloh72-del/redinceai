/**
 * Vakansiyalar va rezyumelar lug'ati (ruscha): `lib/vacancies/format.ts` yorliqlarining tilga mos varianti.
 * Qoida: uz matn format.ts'dan OLINADI (bitta manba), ru — shu yerda. Yangi yorliq qo'shsangiz ikkalasiga ham.
 */
import type { Locale, Tr } from "../index";
import { ruPlural } from "./catalog";
import { APPLICATION_STATUS, EMPLOYMENT, EXPERIENCE, PROFESSION_BY_SLUG, RESUME_EXPERIENCE, RESUME_FORMAT, WORK_FORMAT, daysLeftLabel, professionLabel, salaryLabel, vacancyRegionLabel, type ApplicationStatus, type Employment, type Experience, type WorkFormat } from "@/lib/vacancies/format";
import { REGION_BY_SLUG } from "@/lib/constants";

const PROFESSION_RU: Record<string, { name: string; short: string }> = {
  dasturlash: { name: "Программирование / IT", short: "IT" },
  dizayn: { name: "Дизайн (графика, UI/UX)", short: "Дизайн" },
  video: { name: "Видео, монтаж, анимация", short: "Видео" },
  marketing: { name: "Маркетинг / SMM / реклама", short: "Маркетинг" },
  kontent: { name: "Контент, копирайтинг, перевод", short: "Контент" },
  sotuv: { name: "Продажи и работа с клиентами", short: "Продажи" },
  moliya: { name: "Бухгалтерия / финансы", short: "Финансы" },
  talim: { name: "Образование / репетиторство", short: "Образование" },
  boshqaruv: { name: "Управление, проекты, ассистент", short: "Управление" },
  data: { name: "Данные, аналитика, AI", short: "Data / AI" },
  boshqa: { name: "Другие онлайн-профессии", short: "Другое" },
};
export function professionLabelTr(til: Locale, slug: string, short = false): string {
  if (til !== "ru") return professionLabel(slug, short);
  const p = PROFESSION_RU[slug];
  return p ? (short ? p.short : p.name) : (PROFESSION_BY_SLUG[slug]?.name ?? slug);
}

const WORK_FORMAT_RU: Record<WorkFormat, string> = { remote: "Удалённо", hybrid: "Гибрид", office: "Офис" };
export function workFormatTr(til: Locale, f: WorkFormat): string {
  return til === "ru" ? WORK_FORMAT_RU[f] : WORK_FORMAT[f];
}
export function resumeFormatTr(til: Locale, f: keyof typeof RESUME_FORMAT): string {
  if (til !== "ru") return RESUME_FORMAT[f];
  return f === "any" ? "Любой формат" : WORK_FORMAT_RU[f];
}
const EMPLOYMENT_RU: Record<Employment, string> = { full: "Полная занятость", part: "Частичная занятость", project: "Проектная / фриланс", internship: "Стажировка" };
export function employmentTr(til: Locale, e: Employment): string {
  return til === "ru" ? EMPLOYMENT_RU[e] : EMPLOYMENT[e];
}
const EXPERIENCE_RU: Record<Experience, string> = { none: "Опыт не требуется", junior: "До 1 года", middle: "1–3 года", senior: "3+ года" };
export function experienceTr(til: Locale, e: Experience): string {
  return til === "ru" ? EXPERIENCE_RU[e] : EXPERIENCE[e];
}
const RESUME_EXPERIENCE_RU: Record<Experience, string> = { none: "Без опыта / начинающий", junior: "До 1 года", middle: "1–3 года", senior: "3+ года" };
export function resumeExperienceTr(til: Locale, e: Experience): string {
  return til === "ru" ? RESUME_EXPERIENCE_RU[e] : RESUME_EXPERIENCE[e];
}
const APPLICATION_STATUS_RU: Record<ApplicationStatus, string> = { new: "Новый", viewed: "Просмотрен", shortlisted: "В шорт-листе", rejected: "Отклонён", hired: "Принят" };
export function applicationStatusTr(til: Locale, s: ApplicationStatus): string {
  return til === "ru" ? APPLICATION_STATUS_RU[s] : APPLICATION_STATUS[s];
}

/** Maosh yorlig'i: uz — salaryLabel; ru — birliklar va «dan/gacha» moslanadi */
export function salaryLabelTr(til: Locale, min: number | null | undefined, max: number | null | undefined): string {
  const uz = salaryLabel(min, max);
  if (til !== "ru") return uz;
  if (uz === "Kelishiladi") return "Договорная";
  let s = uz;
  if (s.endsWith("dan")) s = `от ${s.slice(0, -3)}`;
  else if (s.endsWith("gacha")) s = `до ${s.slice(0, -5)}`;
  return s.replace(/mln so'm/g, "млн сум").replace(/ming so'm/g, "тыс. сум").replace(/so'm/g, "сум").replace(/(\d)\s*mln\b/g, "$1 млн").replace(/(\d)\s*ming\b/g, "$1 тыс.");
}
export function daysLeftTr(til: Locale, days: number): string {
  if (til !== "ru") return daysLeftLabel(days);
  return days <= 0 ? "Истекает сегодня" : `${ruPlural(days, ["Остался", "Осталось", "Осталось"])} ${days} ${ruPlural(days, ["день", "дня", "дней"])}`;
}
export function vacancyRegionTr(til: Locale, slug: string | null | undefined, full = false): string {
  if (til !== "ru") return vacancyRegionLabel(slug, full);
  if (!slug) return "Любой регион";
  const r = REGION_BY_SLUG[slug];
  return r ? (full ? r.name : r.short) : slug;
}
export function applicationsCountTr(til: Locale, n: number): string {
  if (til !== "ru") return n > 0 ? `${n} ta ariza` : "Hali ariza yo'q";
  return n > 0 ? `${n} ${ruPlural(n, ["отклик", "отклика", "откликов"])}` : "Пока нет откликов";
}
export function slaHintTr(til: Locale, days: number): string {
  return til === "ru" ? `Без ответа ${days} ${ruPlural(days, ["день", "дня", "дней"])}` : `${days} kundan beri javobsiz`;
}

/** Umumiy satrlar (bo'limlar o'z lug'atlarini `VAK_*` nomi bilan shu faylga qo'shadi) */
export const VAK = {
  vacancies: { uz: "Vakansiyalar", ru: "Вакансии" } satisfies Tr,
  resumes: { uz: "Rezyumelar", ru: "Резюме" } satisfies Tr,
  all: { uz: "Barchasi", ru: "Все" } satisfies Tr,
  apply: { uz: "Ariza yuborish", ru: "Откликнуться" } satisfies Tr,
  applied: { uz: "Ariza yuborilgan", ru: "Отклик отправлен" } satisfies Tr,
  save: { uz: "Saqlash", ru: "Сохранить" } satisfies Tr,
  saved: { uz: "Saqlangan", ru: "Сохранено" } satisfies Tr,
  share: { uz: "Ulashish", ru: "Поделиться" } satisfies Tr,
  company: { uz: "Kompaniya", ru: "Компания" } satisfies Tr,
  salary: { uz: "Maosh", ru: "Зарплата" } satisfies Tr,
  format: { uz: "Ish formati", ru: "Формат работы" } satisfies Tr,
  employment: { uz: "Bandlik", ru: "Занятость" } satisfies Tr,
  experience: { uz: "Tajriba", ru: "Опыт" } satisfies Tr,
  region: { uz: "Hudud", ru: "Регион" } satisfies Tr,
  skills: { uz: "Ko'nikmalar", ru: "Навыки" } satisfies Tr,
  description: { uz: "Tavsif", ru: "Описание" } satisfies Tr,
  requirements: { uz: "Talablar", ru: "Требования" } satisfies Tr,
  posted: { uz: "Joylandi", ru: "Опубликовано" } satisfies Tr,
  expires: { uz: "Muddat", ru: "Срок" } satisfies Tr,
  closed: { uz: "Yopilgan", ru: "Закрыта" } satisfies Tr,
  open: { uz: "Ochiq", ru: "Открыта" } satisfies Tr,
  edit: { uz: "Tahrirlash", ru: "Редактировать" } satisfies Tr,
  delete: { uz: "O'chirish", ru: "Удалить" } satisfies Tr,
  cancel: { uz: "Bekor qilish", ru: "Отмена" } satisfies Tr,
  back: { uz: "Orqaga", ru: "Назад" } satisfies Tr,
  search: { uz: "Qidirish", ru: "Поиск" } satisfies Tr,
  filters: { uz: "Filtrlar", ru: "Фильтры" } satisfies Tr,
  clear: { uz: "Tozalash", ru: "Сбросить" } satisfies Tr,
  nothing: { uz: "Hech narsa topilmadi", ru: "Ничего не найдено" } satisfies Tr,
  loginToApply: { uz: "Ariza yuborish uchun tizimga kiring", ru: "Войдите, чтобы откликнуться" } satisfies Tr,
  similar: { uz: "O'xshash vakansiyalar", ru: "Похожие вакансии" } satisfies Tr,
  fromEmployer: { uz: "Shu ish beruvchining boshqa vakansiyalari", ru: "Другие вакансии работодателя" } satisfies Tr,
  negotiable: { uz: "Kelishiladi", ru: "Договорная" } satisfies Tr,
  remote: { uz: "Masofaviy", ru: "Удалённо" } satisfies Tr,
  anyRegion: { uz: "Istalgan hudud", ru: "Любой регион" } satisfies Tr,
  perMonth: { uz: "oyiga", ru: "в месяц" } satisfies Tr,
};
