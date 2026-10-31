/**
 * Rezyumelar (katalog, sahifa, karta) va kabinetdagi vakansiya/ariza/rezyume sahifalari lug'ati.
 * Yorliq funksiyalari (`*Tr`) `dict/vacancies.ts`da — bu yerda faqat sahifa matnlari.
 * Qoida: uz matn sahifadagi asl matn bilan AYNAN bir xil, ru — qisqa va tabiiy.
 */
import type { Locale, Tr } from "../index";
import { ruPlural } from "./catalog";
import { APPLICATION_TABS, type ApplicationTab } from "@/lib/vacancies/format";

/** "12 ta nomzod" / "12 кандидатов" */
export function candidatesCountTr(til: Locale, n: number): string {
  return til === "ru" ? `${n} ${ruPlural(n, ["кандидат", "кандидата", "кандидатов"])}` : `${n} ta nomzod`;
}
/** "7 marta ko'rilgan" / "7 просмотров" */
export function viewsCountTr(til: Locale, n: number): string {
  return til === "ru" ? `${n} ${ruPlural(n, ["просмотр", "просмотра", "просмотров"])}` : `${n} marta ko'rilgan`;
}
/** Arizalarim bo'limlari (APPLICATION_TABS kalitlari bo'yicha) — uz yorliq format.ts'dan */
const APPLICATION_TAB_RU: Record<ApplicationTab, string> = { "": "Все", faol: "Активные", qabul: "Приняты", rad: "Отклонены" };
export function applicationTabLabelTr(til: Locale, key: ApplicationTab): string {
  if (til === "ru") return APPLICATION_TAB_RU[key];
  return APPLICATION_TABS.find((t) => t.key === key)?.label ?? key;
}

/* ------------------------------------------------------------------ */
/* /rezyumelar — katalog                                               */
/* ------------------------------------------------------------------ */
export const REZ_KATALOG = {
  metaTitle: { uz: "Rezyumelar — nomzodlar katalogi", ru: "Резюме — каталог кандидатов" } satisfies Tr,
  mTitle: { uz: "Rezyumelar", ru: "Резюме" } satisfies Tr,
  metaDescription: {
    uz: "Onlayn kasblar bo'yicha nomzodlar: IT, dizayn, video, marketing, kontent, sotuv, moliya, ta'lim. Rezyumeni ko'ring va sayt ichidagi chat orqali yozing.",
    ru: "Кандидаты по онлайн-профессиям: IT, дизайн, видео, маркетинг, контент, продажи, финансы, образование. Смотрите резюме и пишите в чате сайта.",
  } satisfies Tr,
  titleStart: { uz: "Nomzodlar", ru: "Резюме" } satisfies Tr,
  titleAccent: { uz: "rezyumelari", ru: "кандидатов" } satisfies Tr,
  description: {
    uz: "Onlayn kasblar bo'yicha nomzodlar — tajriba, ko'nikma va kutilayotgan maosh bilan. Mos nomzodga chat orqali yozing.",
    ru: "Кандидаты по онлайн-профессиям — с опытом, навыками и ожидаемой зарплатой. Подходящему кандидату напишите в чате.",
  } satisfies Tr,
  updateResume: { uz: "Rezyumemni yangilash", ru: "Обновить резюме" } satisfies Tr,
  createResume: { uz: "Rezyume yaratish", ru: "Создать резюме" } satisfies Tr,
  searchPlaceholder: { uz: "Lavozim, ko'nikma, ism…", ru: "Должность, навык, имя…" } satisfies Tr,
  formatAny: { uz: "Format", ru: "Формат" } satisfies Tr,
  remoteOnly: { uz: "Faqat masofaviy", ru: "Только удалённо" } satisfies Tr,
  professionsAria: { uz: "Kasblar", ru: "Профессии" } satisfies Tr,
  allProfessions: { uz: "Barcha kasblar", ru: "Все профессии" } satisfies Tr,
  emptyFilteredTitle: { uz: "Bunday nomzod topilmadi", ru: "Таких кандидатов не найдено" } satisfies Tr,
  emptyNoneTitle: { uz: "Hali ommaviy rezyumelar yo'q", ru: "Публичных резюме пока нет" } satisfies Tr,
  emptyFilteredDesc: {
    uz: "Filtrlarni kengaytiring yoki vakansiya joylang — nomzodlar o'zlari ariza yuboradi.",
    ru: "Расширьте фильтры или разместите вакансию — кандидаты откликнутся сами.",
  } satisfies Tr,
  emptyNoneDesc: {
    uz: "Birinchi rezyumeni siz qo'ying — ish beruvchilar katalogdan topadi.",
    ru: "Разместите первое резюме — работодатели найдут вас в каталоге.",
  } satisfies Tr,
  allResumes: { uz: "Barcha rezyumelar", ru: "Все резюме" } satisfies Tr,
  byFilter: { uz: " (filtr bo'yicha)", ru: " (по фильтру)" } satisfies Tr,
  /** " · 2/5-sahifa" / " · страница 2/5" */
  pageOf: { uz: (page: number, pages: number) => ` · ${page}/${pages}-sahifa`, ru: (page: number, pages: number) => ` · страница ${page}/${pages}` },
};

/* ------------------------------------------------------------------ */
/* /rezyumelar/[id] — rezyume sahifasi                                  */
/* ------------------------------------------------------------------ */
export const REZ_SAHIFA = {
  breadcrumbAria: { uz: "Yo'l", ru: "Навигация" } satisfies Tr,
  privateOwner: { uz: "Bu rezyume katalogda ko'rinmaydi — faqat siz ko'ryapsiz.", ru: "Это резюме не показывается в каталоге — его видите только вы." } satisfies Tr,
  privateViewer: {
    uz: "Yopiq rezyume — nomzod sizning vakansiyangizga ariza yuborgani uchun ko'rinadi.",
    ru: "Закрытое резюме — вы видите его, потому что кандидат откликнулся на вашу вакансию.",
  } satisfies Tr,
  emailVerified: { uz: "Email tasdiqlangan", ru: "Email подтверждён" } satisfies Tr,
  perMonth: { uz: "so'm / oy", ru: "в месяц" } satisfies Tr,
  about: { uz: "Men haqimda", ru: "О себе" } satisfies Tr,
  links: { uz: "Havolalar", ru: "Ссылки" } satisfies Tr,
  yourResume: { uz: "Bu sizning rezyumeingiz", ru: "Это ваше резюме" } satisfies Tr,
  contactTitle: { uz: "Nomzod bilan bog'lanish", ru: "Связаться с кандидатом" } satisfies Tr,
  contactHint: { uz: "Kontakt ochiq ko'rsatilmaydi — chat orqali yozing.", ru: "Контакты не показываются — напишите в чате." } satisfies Tr,
  writeInChat: { uz: "Chatda yozish", ru: "Написать в чате" } satisfies Tr,
  specialistProfile: { uz: "Mutaxassis profili", ru: "Профиль специалиста" } satisfies Tr,
  updated: { uz: "Yangilangan", ru: "Обновлено" } satisfies Tr,
  similarAria: { uz: "O'xshash rezyumelar", ru: "Похожие резюме" } satisfies Tr,
  similarTitle: { uz: "Shu kasbdagi boshqa nomzodlar", ru: "Другие кандидаты этой профессии" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* /kabinet/vakansiyalar — ish beruvchi kabineti                        */
/* ------------------------------------------------------------------ */
export const KAB_VAK = {
  kabinet: { uz: "Kabinet", ru: "Кабинет" } satisfies Tr,
  titleStart: { uz: "Mening", ru: "Мои" } satisfies Tr,
  titleAccent: { uz: "vakansiyalarim", ru: "вакансии" } satisfies Tr,
  /** "3 ta ochiq vakansiya · 2 ta yangi ariza." */
  summary: {
    uz: (live: number, fresh: number) => `${live} ta ochiq vakansiya${fresh > 0 ? ` · ${fresh} ta yangi ariza` : ""}.`,
    ru: (live: number, fresh: number) => `${live} ${ruPlural(live, ["открытая вакансия", "открытые вакансии", "открытых вакансий"])}${fresh > 0 ? ` · ${fresh} ${ruPlural(fresh, ["новый отклик", "новых отклика", "новых откликов"])}` : ""}.`,
  },
  intro: {
    uz: "Vakansiya joylang — arizalar rezyume va kontakt bilan shu yerga keladi. Bepul.",
    ru: "Разместите вакансию — отклики с резюме и контактами придут сюда. Бесплатно.",
  } satisfies Tr,
  newVacancy: { uz: "Yangi vakansiya", ru: "Новая вакансия" } satisfies Tr,
  emptyTitle: { uz: "Hali vakansiya joylamagansiz", ru: "Вы ещё не размещали вакансий" } satisfies Tr,
  emptyDesc: {
    uz: "2 daqiqada joylang: lavozim, format, maosh, talablar. 30 kun ro'yxatda turadi.",
    ru: "Разместите за 2 минуты: должность, формат, зарплата, требования. 30 дней в списке.",
  } satisfies Tr,
  postVacancy: { uz: "Vakansiya joylash", ru: "Разместить вакансию" } satisfies Tr,
  stateClosed: { uz: "Yopilgan", ru: "Закрыта" } satisfies Tr,
  stateExpired: { uz: "Muddati o'tgan", ru: "Срок истёк" } satisfies Tr,
  stateOpen: { uz: "Ochiq", ru: "Открыта" } satisfies Tr,
  /** "5 ta ariza" / "5 откликов" (0 bo'lsa ham raqam bilan) */
  applications: { uz: (n: number) => `${n} ta ariza`, ru: (n: number) => `${n} ${ruPlural(n, ["отклик", "отклика", "откликов"])}` },
  /** "2 yangi" chip */
  fresh: { uz: (n: number) => `${n} yangi`, ru: (n: number) => `${n} ${ruPlural(n, ["новый", "новых", "новых"])}` },
  views: { uz: (n: number) => `${n} ta ko'rish`, ru: (n: number) => `${n} ${ruPlural(n, ["просмотр", "просмотра", "просмотров"])}` },
  copy: { uz: "Nusxa", ru: "Копия" } satisfies Tr,
  copyTitle: { uz: "Shu vakansiya asosida yangisini joylash", ru: "Разместить новую на основе этой вакансии" } satisfies Tr,
  candidates: { uz: "Nomzodlar", ru: "Кандидаты" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* /kabinet/arizalarim — nomzod kabineti                                */
/* ------------------------------------------------------------------ */
export const KAB_ARIZA = {
  titleStart: { uz: "Mening", ru: "Мои" } satisfies Tr,
  titleAccent: { uz: "arizalarim", ru: "отклики" } satisfies Tr,
  summary: {
    uz: (active: number) => `${active} ta faol ariza. Ish beruvchi javobi shu yerda va bildirishnomada ko'rinadi.`,
    ru: (active: number) => `${active} ${ruPlural(active, ["активный отклик", "активных отклика", "активных откликов"])}. Ответ работодателя появится здесь и в уведомлениях.`,
  },
  intro: { uz: "Vakansiyalarga yuborgan arizalaringiz va holatlari shu yerda.", ru: "Здесь ваши отклики на вакансии и их статусы." } satisfies Tr,
  createResume: { uz: "Rezyume yaratish", ru: "Создать резюме" } satisfies Tr,
  emptyTitle: { uz: "Hali ariza yubormagansiz", ru: "Вы ещё не откликались" } satisfies Tr,
  emptyWithResume: {
    uz: "Vakansiyalarni ko'ring — rezyumeingiz bilan bir bosishda ariza yuborasiz.",
    ru: "Посмотрите вакансии — с резюме откликнуться можно в один клик.",
  } satisfies Tr,
  emptyNoResume: {
    uz: "Avval rezyume to'ldiring (2 daqiqa) — keyin har vakansiyaga bir bosishda ariza yuborasiz.",
    ru: "Сначала заполните резюме (2 минуты) — потом откликайтесь на любую вакансию в один клик.",
  } satisfies Tr,
  goToVacancies: { uz: "Vakansiyalarga o'tish", ru: "Перейти к вакансиям" } satisfies Tr,
  tabsAria: { uz: "Arizalar holati", ru: "Статус откликов" } satisfies Tr,
  emptyTabTitle: { uz: "Bu bo'limda ariza yo'q", ru: "В этом разделе откликов нет" } satisfies Tr,
  emptyTabDesc: { uz: "Boshqa bo'limni tanlang.", ru: "Выберите другой раздел." } satisfies Tr,
  vacancyClosed: { uz: "· vakansiya yopilgan", ru: "· вакансия закрыта" } satisfies Tr,
  /** "· ko'rildi 2 soat oldin" — vaqt alohida qo'shiladi */
  viewedAt: { uz: "· ko'rildi", ru: "· просмотрен" } satisfies Tr,
  privateEmployer: { uz: "Shaxsiy ish beruvchi", ru: "Частный работодатель" } satisfies Tr,
  suggestedTitle: { uz: "Sizga mos yangi vakansiyalar", ru: "Новые вакансии для вас" } satisfies Tr,
  savedTitle: { uz: "Saqlangan vakansiyalar", ru: "Сохранённые вакансии" } satisfies Tr,
  closed: { uz: "Yopilgan", ru: "Закрыта" } satisfies Tr,
  expired: { uz: "Muddati o'tgan", ru: "Срок истёк" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* /kabinet/rezyume — rezyume tahriri                                   */
/* ------------------------------------------------------------------ */
export const KAB_REZ = {
  titleStart: { uz: "Mening", ru: "Моё" } satisfies Tr,
  titleAccent: { uz: "rezyumem", ru: "резюме" } satisfies Tr,
  /** Ommaviy: "Katalogda ko'rinadi va arizalaringizga biriktiriladi · 7 marta ko'rilgan." */
  publicSummary: {
    uz: (views: number) => `Katalogda ko'rinadi va arizalaringizga biriktiriladi · ${viewsCountTr("uz", views)}.`,
    ru: (views: number) => `Видно в каталоге и прикрепляется к откликам · ${viewsCountTr("ru", views)}.`,
  },
  privateSummary: { uz: "Faqat arizalaringizga biriktiriladi (katalogda ko'rinmaydi).", ru: "Прикрепляется только к откликам (в каталоге не показывается)." } satisfies Tr,
  intro: {
    uz: "Bir marta to'ldiring — har vakansiyaga bir bosishda ariza yuborasiz, ish beruvchilar sizni katalogdan topadi.",
    ru: "Заполните один раз — откликайтесь на любую вакансию в один клик, а работодатели найдут вас в каталоге.",
  } satisfies Tr,
  preview: { uz: "Qanday ko'rinadi", ru: "Как выглядит" } satisfies Tr,
};
