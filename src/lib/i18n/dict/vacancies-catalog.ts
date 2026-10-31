/**
 * Vakansiyalar KATALOGI va DETAL sahifalari lug'ati (uz/ru):
 * /vakansiyalar, /vakansiyalar/kasb/[slug], /vakansiyalar/[id], /vakansiyalar/yangi,
 * VacancyCard, SaveVacancyButton, VacancyAlertButton, ExtendVacancyButton.
 * Umumiy yorliqlar (kasb, format, bandlik, maosh…) — `./vacancies.ts` (`*Tr` funksiyalari).
 */
import type { Locale, Tr } from "../index";
import { ruPlural } from "./catalog";
import type { PayFilter } from "@/lib/vacancies/format";
import { PAY_FILTER } from "@/lib/vacancies/format";

/** `pay` filtri chiplari (PAY_FILTER kalitlari bo'yicha) */
const PAY_FILTER_RU: Record<PayFilter, string> = { set: "С указанной зарплатой", neg: "Договорная" };
export function payFilterTr(til: Locale, k: PayFilter): string {
  return til === "ru" ? PAY_FILTER_RU[k] : PAY_FILTER[k];
}

/** Maosh chipi: "3 mln+" → "3 млн+" */
export function salaryChipTr(til: Locale, label: string): string {
  return til === "ru" ? label.replace(/mln/g, "млн") : label;
}

/** Saralash yorliqlari (VacancyFilter.sort kalitlari) */
export const VAK_SORT: Record<"newest" | "salary_high" | "applications", Tr> = {
  newest: { uz: "Yangi", ru: "Новые" },
  salary_high: { uz: "Maosh", ru: "Зарплата" },
  applications: { uz: "Ko'p ariza", ru: "Больше откликов" },
};

export const VAK_KATALOG = {
  /* --------- Metadata --------- */
  metaTitle: { uz: "Vakansiyalar — onlayn ish o'rinlari", ru: "Вакансии — онлайн-работа" } satisfies Tr,
  mTitle: { uz: "Vakansiyalar", ru: "Вакансии" } satisfies Tr,
  metaDescription: {
    uz: "Masofaviy va ofis vakansiyalari: IT, dizayn, video, marketing, kontent, sotuv, moliya, ta'lim. Joylash ham, ariza berish ham bepul.",
    ru: "Удалённые и офисные вакансии: IT, дизайн, видео, маркетинг, контент, продажи, финансы, образование. Размещение и отклик бесплатны.",
  } satisfies Tr,

  /* --------- Sarlavha --------- */
  eyebrow: { uz: (n: number) => `${n} ta ochiq vakansiya · bepul`, ru: (n: number) => `${n} ${ruPlural(n, ["открытая вакансия", "открытые вакансии", "открытых вакансий"])} · бесплатно` },
  titleStart: { uz: "Onlayn", ru: "Онлайн" } satisfies Tr,
  titleAccent: { uz: "vakansiyalar", ru: "вакансии" } satisfies Tr,
  description: {
    uz: "Masofaviy va ofis ish o'rinlari — IT, dizayn, video, marketing, kontent va boshqa onlayn kasblar. Rezyume bilan bir bosishda ariza yuboring.",
    ru: "Удалённая и офисная работа — IT, дизайн, видео, маркетинг, контент и другие онлайн-профессии. Откликайтесь в один клик с резюме.",
  } satisfies Tr,
  postVacancy: { uz: "Vakansiya joylash", ru: "Разместить вакансию" } satisfies Tr,
  rssTitle: { uz: "Yangi vakansiyalar RSS lentasi", ru: "RSS-лента новых вакансий" } satisfies Tr,
  resumes: { uz: "Rezyumelar", ru: "Резюме" } satisfies Tr,

  /* --------- Qidiruv formasi --------- */
  searchPlaceholder: { uz: "Lavozim, kompaniya, ko'nikma…", ru: "Должность, компания, навык…" } satisfies Tr,
  searchAria: { uz: "Qidirish", ru: "Поиск" } satisfies Tr,
  formatAria: { uz: "Ish formati", ru: "Формат работы" } satisfies Tr,
  anyFormat: { uz: "Har qanday format", ru: "Любой формат" } satisfies Tr,
  searchBtn: { uz: "Qidirish", ru: "Найти" } satisfies Tr,
  moreFilters: { uz: "Qo'shimcha filtrlar", ru: "Дополнительные фильтры" } satisfies Tr,
  employmentAria: { uz: "Bandlik", ru: "Занятость" } satisfies Tr,
  anyEmployment: { uz: "Har qanday bandlik", ru: "Любая занятость" } satisfies Tr,
  experienceAria: { uz: "Tajriba", ru: "Опыт" } satisfies Tr,
  anyExperience: { uz: "Har qanday tajriba", ru: "Любой опыт" } satisfies Tr,
  regionAria: { uz: "Hudud", ru: "Регион" } satisfies Tr,
  wholeUz: { uz: "Butun O'zbekiston", ru: "Весь Узбекистан" } satisfies Tr,
  remoteOnly: { uz: "Faqat masofaviy", ru: "Только удалённо" } satisfies Tr,

  /* --------- Chiplar --------- */
  professionsAria: { uz: "Kasblar", ru: "Профессии" } satisfies Tr,
  allProfessions: { uz: "Barcha kasblar", ru: "Все профессии" } satisfies Tr,
  quickFiltersAria: { uz: "Tez filtrlar", ru: "Быстрые фильтры" } satisfies Tr,
  remote: { uz: "Masofaviy", ru: "Удалённо" } satisfies Tr,
  fresh: { uz: "Yangi (48 soat)", ru: "Новые (48 часов)" } satisfies Tr,

  /* --------- Natijalar --------- */
  emptyFilteredTitle: { uz: "Bunday vakansiya topilmadi", ru: "Таких вакансий не найдено" } satisfies Tr,
  emptyNoneTitle: { uz: "Hali vakansiyalar yo'q", ru: "Вакансий пока нет" } satisfies Tr,
  emptyFilteredDesc: {
    uz: "Filtrlarni kengaytiring yoki qidiruvni saqlang — mos vakansiya chiqsa xabar beramiz.",
    ru: "Расширьте фильтры или сохраните поиск — сообщим, когда появится подходящая вакансия.",
  } satisfies Tr,
  emptyNoneDesc: {
    uz: "Birinchi vakansiyani siz joylang — bepul, 30 kun ro'yxatda turadi.",
    ru: "Разместите первую вакансию — бесплатно, 30 дней в списке.",
  } satisfies Tr,
  allVacancies: { uz: "Barcha vakansiyalar", ru: "Все вакансии" } satisfies Tr,
  /** "24 ta vakansiya (filtr bo'yicha) · 2/5-sahifa" */
  resultCount: { uz: (n: number) => `${n} ta vakansiya`, ru: (n: number) => `${n} ${ruPlural(n, ["вакансия", "вакансии", "вакансий"])}` },
  byFilter: { uz: " (filtr bo'yicha)", ru: " (по фильтру)" } satisfies Tr,
  pageOf: { uz: (p: number, pages: number) => ` · ${p}/${pages}-sahifa`, ru: (p: number, pages: number) => ` · страница ${p}/${pages}` },
  sortLabel: { uz: "Saralash:", ru: "Сортировка:" } satisfies Tr,

  /* --------- CTA bloklari --------- */
  seekerTitle: { uz: "Ish qidiryapsizmi?", ru: "Ищете работу?" } satisfies Tr,
  seekerDesc: {
    uz: "Rezyume to'ldiring — har vakansiyaga bir bosishda ariza yuborasiz. Kontaktingiz ochiq ko'rsatilmaydi.",
    ru: "Заполните резюме — откликайтесь на любую вакансию в один клик. Ваши контакты не показываются открыто.",
  } satisfies Tr,
  createResume: { uz: "Rezyume yaratish", ru: "Создать резюме" } satisfies Tr,
  employerTitle: { uz: "Xodim kerakmi?", ru: "Нужен сотрудник?" } satisfies Tr,
  employerDesc: {
    uz: "Vakansiyani 2 daqiqada joylang — bepul. Arizalar rezyume va kontakt bilan kabinetingizga keladi.",
    ru: "Разместите вакансию за 2 минуты — бесплатно. Отклики с резюме и контактами придут в ваш кабинет.",
  } satisfies Tr,

  /* --------- Saqlangan qidiruv nomi --------- */
  alertAll: { uz: "Barcha vakansiyalar", ru: "Все вакансии" } satisfies Tr,
};

/** Kasb bo'yicha sahifa (/vakansiyalar/kasb/[slug]) */
export const VAK_KASB = {
  notFoundTitle: { uz: "Kasb topilmadi", ru: "Профессия не найдена" } satisfies Tr,
  /** "<Kasb> — vakansiyalar" */
  metaTitle: { uz: (name: string) => `${name} — vakansiyalar`, ru: (name: string) => `${name} — вакансии` },
  metaDescription: {
    uz: (name: string) => `${name} bo'yicha ochiq vakansiyalar: masofaviy va ofis ish o'rinlari, maosh va talablar bilan. Ariza berish bepul.`,
    ru: (name: string) => `Открытые вакансии: ${name} — удалённая и офисная работа с зарплатой и требованиями. Отклик бесплатный.`,
  },
  eyebrow: { uz: (n: number) => `${n} ta ochiq vakansiya`, ru: (n: number) => `${n} ${ruPlural(n, ["открытая вакансия", "открытые вакансии", "открытых вакансий"])}` },
  titleAccent: { uz: "vakansiyalari", ru: "— вакансии" } satisfies Tr,
  description: {
    uz: (name: string) => `${name} bo'yicha masofaviy va ofis ish o'rinlari — maosh va talablar bilan. Ariza berish bepul.`,
    ru: (name: string) => `${name}: удалённая и офисная работа — с зарплатой и требованиями. Отклик бесплатный.`,
  },
  rssTitle: { uz: (name: string) => `${name} vakansiyalari RSS lentasi`, ru: (name: string) => `RSS-лента вакансий: ${name}` },
  emptyTitle: { uz: (short: string) => `${short} bo'yicha ochiq vakansiya yo'q`, ru: (short: string) => `Открытых вакансий по направлению «${short}» нет` },
  emptyDesc: {
    uz: "Qidiruvni saqlang — mos vakansiya chiqsa xabar beramiz, yoki boshqa kasbni tanlang.",
    ru: "Сохраните поиск — сообщим, когда появится подходящая вакансия, или выберите другую профессию.",
  } satisfies Tr,
};

/** Vakansiya sahifasi (/vakansiyalar/[id]) */
export const VAK_DETAL = {
  breadcrumbAria: { uz: "Yo'l", ru: "Навигация" } satisfies Tr,
  vacancies: { uz: "Vakansiyalar", ru: "Вакансии" } satisfies Tr,
  closedFilled: { uz: "Bu vakansiya yopilgan — o'rin to'ldirilgan.", ru: "Вакансия закрыта — место занято." } satisfies Tr,
  closedExpired: { uz: "Bu vakansiyaning muddati o'tgan.", ru: "Срок этой вакансии истёк." } satisfies Tr,
  /** "Shunga o'xshash ochiq vakansiyalarni <ko'ring>." */
  seeSimilarPre: { uz: "Shunga o'xshash ochiq vakansiyalarni ", ru: "Похожие открытые вакансии можно " } satisfies Tr,
  seeSimilarLink: { uz: "ko'ring", ru: "посмотреть" } satisfies Tr,
  emailVerified: { uz: "Email tasdiqlangan", ru: "Email подтверждён" } satisfies Tr,
  perMonthLong: { uz: "so'm / oy", ru: "сум / месяц" } satisfies Tr,
  tasksTitle: { uz: "Vazifalar va shartlar", ru: "Обязанности и условия" } satisfies Tr,
  requirementsTitle: { uz: "Talablar", ru: "Требования" } satisfies Tr,
  skillsTitle: { uz: "Ko'nikmalar", ru: "Навыки" } satisfies Tr,
  yourVacancy: { uz: "Bu sizning vakansiyangiz", ru: "Это ваша вакансия" } satisfies Tr,
  /** Egasi statistikasi: "3 ta ariza · 120 ta ko'rish · 5 ta tashqi o'tish" */
  ownerApplications: { uz: (n: number) => `${n} ta ariza`, ru: (n: number) => `${n} ${ruPlural(n, ["отклик", "отклика", "откликов"])}` },
  ownerViews: { uz: (n: number) => `${n} ta ko'rish`, ru: (n: number) => `${n} ${ruPlural(n, ["просмотр", "просмотра", "просмотров"])}` },
  ownerClicks: { uz: (n: number) => `${n} ta tashqi o'tish`, ru: (n: number) => `${n} ${ruPlural(n, ["внешний переход", "внешних перехода", "внешних переходов"])}` },
  candidates: { uz: "Nomzodlar", ru: "Кандидаты" } satisfies Tr,
  edit: { uz: "Tahrirlash", ru: "Редактировать" } satisfies Tr,
  applications: { uz: "Arizalar", ru: "Отклики" } satisfies Tr,
  posted: { uz: "Joylangan", ru: "Опубликована" } satisfies Tr,
  deadline: { uz: "Muddati", ru: "Срок" } satisfies Tr,
  prepayNote: {
    uz: "Oldindan to'lov yoki hujjat so'ralsa — @montajor_man ga yozing. Vakansiyalar uchun to'lov olinmaydi.",
    ru: "Если просят предоплату или документы — напишите @montajor_man. Вакансии размещаются бесплатно.",
  } satisfies Tr,
  similar: { uz: "Shunga o'xshash vakansiyalar", ru: "Похожие вакансии" } satisfies Tr,
  /** "<Kompaniya> — boshqa vakansiyalari" */
  otherFromEmployer: { uz: "— boshqa vakansiyalari", ru: "— другие вакансии" } satisfies Tr,
  apply: { uz: "Ariza yuborish", ru: "Откликнуться" } satisfies Tr,
};

/** Yangi vakansiya sahifasi (/vakansiyalar/yangi) */
export const VAK_YANGI = {
  metaTitle: { uz: "Vakansiya joylash", ru: "Разместить вакансию" } satisfies Tr,
  breadcrumbAria: { uz: "Yo'l", ru: "Навигация" } satisfies Tr,
  vacancies: { uz: "Vakansiyalar", ru: "Вакансии" } satisfies Tr,
  newVacancy: { uz: "Yangi vakansiya", ru: "Новая вакансия" } satisfies Tr,
  eyebrowCopy: { uz: "Nusxa · maydonlar to'ldirilgan", ru: "Копия · поля заполнены" } satisfies Tr,
  eyebrowFree: { uz: "Bepul · 30 kun ro'yxatda", ru: "Бесплатно · 30 дней в списке" } satisfies Tr,
  titleStart: { uz: "Vakansiya", ru: "Разместить" } satisfies Tr,
  titleAccent: { uz: "joylash", ru: "вакансию" } satisfies Tr,
  description: {
    uz: "Lavozim, format, maosh va talablarni yozing. Arizalar rezyume va kontakt bilan kabinetingizga keladi.",
    ru: "Укажите должность, формат, зарплату и требования. Отклики с резюме и контактами придут в ваш кабинет.",
  } satisfies Tr,
};

/** Vakansiya kartasi */
export const VAK_KARTA = {
  isNew: { uz: "Yangi", ru: "Новая" } satisfies Tr,
  emailVerified: { uz: "Email tasdiqlangan", ru: "Email подтверждён" } satisfies Tr,
  perMonth: { uz: "/ oy", ru: "/ мес." } satisfies Tr,
};

/** Saqlash tugmasi */
export const VAK_SAQLASH = {
  savedToast: { uz: "Saqlandi — Kabinet → Arizalarim", ru: "Сохранено — Кабинет → Мои отклики" } satisfies Tr,
  removedToast: { uz: "Saqlanganlardan olindi", ru: "Удалено из сохранённых" } satisfies Tr,
  failed: { uz: "Bo'lmadi", ru: "Не получилось" } satisfies Tr,
  ariaRemove: { uz: "Saqlanganlardan olish", ru: "Убрать из сохранённых" } satisfies Tr,
  ariaSave: { uz: "Vakansiyani saqlash", ru: "Сохранить вакансию" } satisfies Tr,
  saved: { uz: "Saqlangan", ru: "Сохранено" } satisfies Tr,
  save: { uz: "Saqlash", ru: "Сохранить" } satisfies Tr,
};

/** «Xabardor qil» tugmasi (saqlangan qidiruv) */
export const VAK_XABAR = {
  notify: { uz: "Xabardor qil", ru: "Уведомлять" } satisfies Tr,
  savedStatus: { uz: "Saqlandi — yangi mos vakansiya chiqsa xabar beramiz", ru: "Сохранено — сообщим о новых подходящих вакансиях" } satisfies Tr,
  networkError: { uz: "Tarmoq xatosi. Qayta urinib ko'ring.", ru: "Ошибка сети. Попробуйте ещё раз." } satisfies Tr,
  formAria: { uz: "Qidiruvni saqlash", ru: "Сохранить поиск" } satisfies Tr,
  nameLabel: { uz: "Qidiruv nomi", ru: "Название поиска" } satisfies Tr,
  namePlaceholder: { uz: "Masalan: Masofaviy dizayn", ru: "Например: Удалённый дизайн" } satisfies Tr,
  save: { uz: "Saqlash", ru: "Сохранить" } satisfies Tr,
  close: { uz: "Yopish", ru: "Закрыть" } satisfies Tr,
};

/** Uzaytirish / qayta ochish tugmasi */
export const VAK_UZAYTIRISH = {
  failed: { uz: "Bajarilmadi", ru: "Не выполнено" } satisfies Tr,
  extendedToast: { uz: (d: number) => `Vakansiya yana ${d} kun ro'yxatda`, ru: (d: number) => `Вакансия продлена ещё на ${d} ${ruPlural(d, ["день", "дня", "дней"])}` },
  reopen: { uz: "Qayta ochish", ru: "Открыть снова" } satisfies Tr,
  plusDays: { uz: (d: number) => `+${d} kun`, ru: (d: number) => `+${d} ${ruPlural(d, ["день", "дня", "дней"])}` },
};
