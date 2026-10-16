/**
 * Katalog lug'ati (/mutaxassislar): ro'yxat sahifasi, filtrlar, faol filtr chiplari,
 * sahifalash, mutaxassis kartasi/qatori, taqqoslash va saqlangan qidiruv tugmalari.
 * Umumiy narx/vaqt yordamchilari ham shu yerda — profile/jobs/lenta lug'atlari import qiladi.
 */
import type { Locale, Tr } from "../index";
import { formatPrice } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Umumiy yordamchilar                                                 */
/* ------------------------------------------------------------------ */

/** Ruscha ko'plik: ruPlural(5, ["минута","минуты","минут"]) → "минут" */
export function ruPlural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

/** formatPrice natijasidagi birliklarni ruschaga o'giradi: "1,5 mln so'm" → "1,5 млн сум" */
export function localizePrice(til: Locale, s: string): string {
  if (til !== "ru") return s;
  return s.replace(/mln so'm/g, "млн сум").replace(/ming so'm/g, "тыс. сум").replace(/so'm/g, "сум");
}

/** "X dan" / "от X" (X — tayyor formatlangan narx) */
export function priceFromLabel(til: Locale, formatted: string): string {
  return til === "ru" ? `от ${localizePrice(til, formatted)}` : `${formatted} dan`;
}

/** "X gacha" / "до X" */
export function priceToLabel(til: Locale, formatted: string): string {
  return til === "ru" ? `до ${localizePrice(til, formatted)}` : `${formatted} gacha`;
}

/** formatPriceRange'ning til-moslashgan varianti: "Kelishiladi" / "от …" / "до …" / "A – B" */
export function priceRangeLabel(til: Locale, from: number, to?: number | null): string {
  if (!from && !to) return til === "ru" ? "Договорная" : "Kelishiladi";
  if (!from && to) return priceToLabel(til, formatPrice(to, { compact: true }));
  if (to && to > from) {
    const a = formatPrice(from, { compact: true });
    const b = formatPrice(to, { compact: true });
    return til === "ru" ? `${localizePrice(til, a)} – ${localizePrice(til, b)}` : `${a} – ${b}`;
  }
  return priceFromLabel(til, formatPrice(from, { compact: true }));
}

/** utils.timeAgo'ning til-moslashgan varianti (hydration uchun suppressHydrationWarning kerakligicha qoladi) */
export function timeAgoLabel(til: Locale, date: Date | number | string): string {
  const ms = typeof date === "object" ? date.getTime() : new Date(date).getTime();
  const diff = Math.max(0, Date.now() - ms);
  const m = Math.floor(diff / 60_000);
  const ru = til === "ru";
  if (m < 1) return ru ? "только что" : "hozirgina";
  if (m < 60) return ru ? `${m} ${ruPlural(m, ["минуту", "минуты", "минут"])} назад` : `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return ru ? `${h} ${ruPlural(h, ["час", "часа", "часов"])} назад` : `${h} soat oldin`;
  const days = Math.floor(h / 24);
  if (days < 30) return ru ? `${days} ${ruPlural(days, ["день", "дня", "дней"])} назад` : `${days} kun oldin`;
  const months = Math.floor(days / 30);
  if (months < 12) return ru ? `${months} ${ruPlural(months, ["месяц", "месяца", "месяцев"])} назад` : `${months} oy oldin`;
  const years = Math.floor(months / 12);
  return ru ? `${years} ${ruPlural(years, ["год", "года", "лет"])} назад` : `${years} yil oldin`;
}

/* ------------------------------------------------------------------ */
/* Constants kalitlari bo'yicha ruscha nomlar (constants.ts'ga tegilmaydi) */
/* ------------------------------------------------------------------ */

/** Ish turi (WORK_TYPES sluglari bo'yicha) — ruscha nomi; topilmasa uz label qoladi */
const WORK_TYPE_RU: Record<string, string> = {
  toy: "Свадьба",
  reklama: "Реклама",
  korporativ: "Корпоратив",
  "kontent-smm": "Контент / SMM",
  "musiqiy-klip": "Музыкальный клип",
  hujjatli: "Документальный фильм",
  talim: "Образование",
  "kochmas-mulk": "Недвижимость",
  mahsulot: "Товар / e-commerce",
  tadbir: "Мероприятие",
};
export function workTypeLabel(til: Locale, slug: string, uzLabel: string): string {
  return til === "ru" ? (WORK_TYPE_RU[slug] ?? uzLabel) : uzLabel;
}

/** Tajriba darajasi: nom + yillar (EXPERIENCE_LEVELS value'lari bo'yicha) */
const EXPERIENCE_RU: Record<string, { name: string; years: string }> = {
  junior: { name: "Начинающий", years: "до 1 года" },
  middle: { name: "Средний", years: "1–3 года" },
  senior: { name: "Опытный", years: "3–6 лет" },
  expert: { name: "Эксперт", years: "6+ лет" },
};
export function experienceParts(til: Locale, value: string, uzLabel: string): { name: string; years: string } {
  const [name, years = ""] = uzLabel.replace(")", "").split(" (");
  if (til === "ru" && EXPERIENCE_RU[value]) return EXPERIENCE_RU[value];
  return { name, years };
}
export function experienceLabel(til: Locale, value: string, uzLabel: string): string {
  if (til !== "ru") return uzLabel;
  const e = EXPERIENCE_RU[value];
  return e ? `${e.name} (${e.years})` : uzLabel;
}

/** Jins — filtr kontekstida (ro'yxat) */
const GENDER_FILTER_RU: Record<string, string> = { male: "Мужчины", female: "Женщины" };
export function genderFilterLabel(til: Locale, value: string, uzLabel: string): string {
  return til === "ru" ? (GENDER_FILTER_RU[value] ?? uzLabel) : uzLabel;
}
/** Jins — shaxs haqida (profil chipi) */
const GENDER_PERSON_RU: Record<string, string> = { male: "Мужчина", female: "Женщина" };
export function genderPersonLabel(til: Locale, value: string, uzLabel: string): string {
  return til === "ru" ? (GENDER_PERSON_RU[value] ?? uzLabel) : uzLabel;
}

/* ------------------------------------------------------------------ */
/* Ro'yxat sahifasi                                                    */
/* ------------------------------------------------------------------ */
export const KATALOG = {
  eyebrow: { uz: (n: number) => `O'zbekiston bo'ylab · ${n} ta hudud`, ru: (n: number) => `По всему Узбекистану · ${n} регионов` },
  titleStart: { uz: "Mutaxassislar", ru: "Каталог" } satisfies Tr,
  titleAccent: { uz: "ro'yxati", ru: "специалистов" } satisfies Tr,
  description: {
    uz: "Videograf, montajor, dizayner va boshqa ijodkorlar — hudud, narx, tajriba va jins bo'yicha filtrlang, o'zingizga mosini toping.",
    ru: "Видеографы, монтажёры, дизайнеры и другие специалисты — фильтруйте по региону, цене, опыту и полу и найдите подходящего.",
  } satisfies Tr,
  wizard: { uz: "Buyurtma sehrgari", ru: "Мастер заказа" } satisfies Tr,
  /** "58 ta mutaxassis" — raqam alohida span'da, bu faqat davomi */
  resultSuffix: {
    uz: (_n: number) => " ta mutaxassis",
    ru: (n: number) => ` ${ruPlural(n, ["специалист", "специалиста", "специалистов"])}`,
  },
  sortPhrase: {
    rating: { uz: "reyting bo'yicha", ru: "по рейтингу" },
    popular: { uz: "mashhurlik bo'yicha", ru: "по популярности" },
    newest: { uz: "eng yangilari birinchi", ru: "сначала новые" },
    price_asc: { uz: "narx: arzondan", ru: "цена: по возрастанию" },
    price_desc: { uz: "narx: qimmatdan", ru: "цена: по убыванию" },
  } as Record<string, Tr>,
  emptyFilteredTitle: { uz: "Hech narsa topilmadi", ru: "Ничего не найдено" } satisfies Tr,
  emptyFilteredDesc: {
    uz: "Bu shartlarga mos mutaxassis yo'q. Filtrlarni yumshating yoki boshqa hududni tanlab ko'ring.",
    ru: "По этим условиям специалистов нет. Смягчите фильтры или выберите другой регион.",
  } satisfies Tr,
  clearFilters: { uz: "Filtrlarni tozalash", ru: "Сбросить фильтры" } satisfies Tr,
  findViaWizard: { uz: "Sehrgar orqali topish", ru: "Подобрать через мастер" } satisfies Tr,
  postJobCta: { uz: "E'lon joylang — mutaxassislar o'zi taklif yuboradi", ru: "Разместите заказ — специалисты сами пришлют предложения" } satisfies Tr,
  emptyNoneTitle: { uz: "Hali mutaxassislar yo'q", ru: "Специалистов пока нет" } satisfies Tr,
  emptyNoneDesc: { uz: "Birinchi bo'lib profil oching — mijozlar sizni shu yerda topsin.", ru: "Создайте профиль первым — клиенты найдут вас именно здесь." } satisfies Tr,
  joinAsSpecialist: { uz: "Mutaxassis sifatida qo'shilish", ru: "Присоединиться как специалист" } satisfies Tr,
} as const;

/* ------------------------------------------------------------------ */
/* Filtrlar                                                            */
/* ------------------------------------------------------------------ */
export const FILTR = {
  title: { uz: "Filtrlar", ru: "Фильтры" } satisfies Tr,
  clear: { uz: "Tozalash", ru: "Сбросить" } satisfies Tr,
  updating: { uz: "Natijalar yangilanmoqda…", ru: "Обновляем результаты…" } satisfies Tr,
  activeCountAria: { uz: (n: number) => `${n} ta faol filtr`, ru: (n: number) => `Активных фильтров: ${n}` },
  search: { uz: "Qidiruv", ru: "Поиск" } satisfies Tr,
  searchPlaceholder: { uz: "Ism, ko'nikma yoki shahar…", ru: "Имя, навык или город…" } satisfies Tr,
  searchClear: { uz: "Qidiruvni tozalash", ru: "Очистить поиск" } satisfies Tr,
  suggestionsAria: { uz: "Qidiruv takliflari", ru: "Подсказки поиска" } satisfies Tr,
  category: { uz: "Yo'nalish", ru: "Направление" } satisfies Tr,
  all: { uz: "Barchasi", ru: "Все" } satisfies Tr,
  region: { uz: "Hudud", ru: "Регион" } satisfies Tr,
  allRegions: { uz: "Barcha hududlar", ru: "Все регионы" } satisfies Tr,
  workType: { uz: "Ish turi", ru: "Тип работы" } satisfies Tr,
  price: { uz: "Narx", ru: "Цена" } satisfies Tr,
  range: { uz: "Oraliq", ru: "Диапазон" } satisfies Tr,
  unlimited: { uz: "Cheklanmagan", ru: "Без ограничений" } satisfies Tr,
  priceRangeAria: { uz: "Narx oralig'i", ru: "Диапазон цены" } satisfies Tr,
  minPriceAria: { uz: "Minimal narx", ru: "Минимальная цена" } satisfies Tr,
  maxPriceAria: { uz: "Maksimal narx", ru: "Максимальная цена" } satisfies Tr,
  pricePresets: {
    uz: ["1 mln gacha", "1–3 mln", "3–7 mln", "7 mln+"],
    ru: ["до 1 млн", "1–3 млн", "3–7 млн", "7 млн+"],
  } as Record<Locale, string[]>,
  experience: { uz: "Tajriba", ru: "Опыт" } satisfies Tr,
  gender: { uz: "Jins", ru: "Пол" } satisfies Tr,
  other: { uz: "Boshqa", ru: "Прочее" } satisfies Tr,
  verifiedTitle: { uz: "Faqat tasdiqlanganlar", ru: "Только проверенные" } satisfies Tr,
  verifiedDesc: { uz: "Tekshiruvdan o'tgan profillar", ru: "Профили, прошедшие проверку" } satisfies Tr,
  verifiedAria: { uz: "Faqat tasdiqlangan mutaxassislar", ru: "Только проверенные специалисты" } satisfies Tr,
  verifiedShort: { uz: "Tasdiqlangan", ru: "Проверенные" } satisfies Tr,
  availableTitle: { uz: "Faqat hozir bo'shlar", ru: "Только свободные сейчас" } satisfies Tr,
  availableDesc: { uz: "Band va ta'tildagilar chiqmaydi", ru: "Без занятых и находящихся в отпуске" } satisfies Tr,
  availableAria: { uz: "Faqat hozir buyurtma qabul qiladiganlar", ru: "Только принимающие заказы сейчас" } satisfies Tr,
  availableShort: { uz: "Hozir bo'sh", ru: "Сейчас свободен" } satisfies Tr,
  openNowTitle: { uz: "Hozir ochiq", ru: "Сейчас открыто" } satisfies Tr,
  openNowDesc: { uz: "Ish vaqti bo'yicha hozir ishlayotganlar", ru: "Кто сейчас работает по графику" } satisfies Tr,
  openNowAria: { uz: "Faqat hozir ish vaqtida bo'lganlar", ru: "Только те, у кого сейчас рабочее время" } satisfies Tr,
  sortAria: { uz: "Saralash", ru: "Сортировка" } satisfies Tr,
  sortOptions: {
    rating: { uz: "Reyting bo'yicha", ru: "По рейтингу" },
    popular: { uz: "Mashhurlik bo'yicha", ru: "По популярности" },
    newest: { uz: "Eng yangilari", ru: "Сначала новые" },
    price_asc: { uz: "Narx: arzondan", ru: "Цена: по возрастанию" },
    price_desc: { uz: "Narx: qimmatdan", ru: "Цена: по убыванию" },
  } as Record<string, Tr>,
  viewAria: { uz: "Ko'rinish", ru: "Вид" } satisfies Tr,
  viewGrid: { uz: "To'r", ru: "Сетка" } satisfies Tr,
  viewList: { uz: "Ro'yxat", ru: "Список" } satisfies Tr,
  close: { uz: "Yopish", ru: "Закрыть" } satisfies Tr,
  showResults: { uz: (n: number) => `${n} ta natijani ko'rish`, ru: (n: number) => `Показать ${n} ${ruPlural(n, ["результат", "результата", "результатов"])}` },
} as const;

/* ------------------------------------------------------------------ */
/* Faol filtr chiplari                                                 */
/* ------------------------------------------------------------------ */
export const FAOL_FILTR = {
  listAria: { uz: "Faol filtrlar", ru: "Активные фильтры" } satisfies Tr,
  remove: { uz: (label: string) => `${label} filtrini olib tashlash`, ru: (label: string) => `Убрать фильтр «${label}»` },
  clearAll: { uz: "Hammasini tozalash", ru: "Сбросить все" } satisfies Tr,
  skillPrefix: { uz: "Ko'nikma: ", ru: "Навык: " } satisfies Tr,
  equipmentPrefix: { uz: "Jihoz: ", ru: "Оборудование: " } satisfies Tr,
} as const;

/* ------------------------------------------------------------------ */
/* Sahifalash                                                          */
/* ------------------------------------------------------------------ */
export const SAHIFALASH = {
  navAria: { uz: "Sahifalar", ru: "Страницы" } satisfies Tr,
  prev: { uz: "Oldingi sahifa", ru: "Предыдущая страница" } satisfies Tr,
  next: { uz: "Keyingi sahifa", ru: "Следующая страница" } satisfies Tr,
  pageN: { uz: (n: number) => `${n}-sahifa`, ru: (n: number) => `Страница ${n}` },
  ofPages: { uz: (p: number, pages: number) => `${p} / ${pages} sahifa`, ru: (p: number, pages: number) => `Страница ${p} из ${pages}` },
} as const;

/* ------------------------------------------------------------------ */
/* Mutaxassis kartasi / qatori                                         */
/* ------------------------------------------------------------------ */
export const KARTA = {
  new: { uz: "Yangi", ru: "Новый" } satisfies Tr,
  busy: { uz: "Band", ru: "Занят" } satisfies Tr,
  top: { uz: "Top", ru: "Топ" } satisfies Tr,
  topHint: {
    uz: (rating: number, reviews: number) => `Top mutaxassis: reyting ${rating}+ va kamida ${reviews} ta sharh`,
    ru: (rating: number, reviews: number) => `Топ-специалист: рейтинг ${rating}+ и не менее ${reviews} отзывов`,
  },
} as const;

/* ------------------------------------------------------------------ */
/* Taqqoslash (F54)                                                    */
/* ------------------------------------------------------------------ */
export const TAQQOS = {
  add: { uz: "Taqqoslashga qo'shish", ru: "Добавить к сравнению" } satisfies Tr,
  remove: { uz: "Taqqoslashdan olib tashlash", ru: "Убрать из сравнения" } satisfies Tr,
  inCompare: { uz: "Taqqoslashda", ru: "В сравнении" } satisfies Tr,
  compare: { uz: "Taqqoslash", ru: "Сравнить" } satisfies Tr,
  compareCount: { uz: (n: number) => `Taqqoslash (${n})`, ru: (n: number) => `Сравнить (${n})` },
  trayAria: { uz: "Taqqoslash ro'yxati", ru: "Список сравнения" } satisfies Tr,
  clearAria: { uz: "Taqqoslash ro'yxatini tozalash", ru: "Очистить список сравнения" } satisfies Tr,
  clearTitle: { uz: "Tozalash", ru: "Очистить" } satisfies Tr,
  pickMore: { uz: (n: number) => `Yana ${n} tagacha tanlang`, ru: (n: number) => `Можно выбрать ещё ${n}` },
  maxNotice: {
    uz: (max: number) => `Ko'pi bilan ${max} ta mutaxassisni taqqoslash mumkin`,
    ru: (max: number) => `Сравнивать можно не более ${max} специалистов`,
  },
} as const;

/* ------------------------------------------------------------------ */
/* Ko'nikma chiplari (kartada)                                         */
/* ------------------------------------------------------------------ */
export const KONIKMA_CHIP = {
  withSkill: { uz: (s: string) => `"${s}" ko'nikmasi bor mutaxassislar`, ru: (s: string) => `Специалисты с навыком «${s}»` },
  collapse: { uz: "Kamroq", ru: "Свернуть" } satisfies Tr,
  collapseAria: { uz: "Ko'nikmalarni yig'ish", ru: "Свернуть навыки" } satisfies Tr,
  showMore: { uz: (n: number) => `Yana ${n} ta ko'nikmani ko'rsatish`, ru: (n: number) => `Показать ещё ${n} ${ruPlural(n, ["навык", "навыка", "навыков"])}` },
} as const;

/* ------------------------------------------------------------------ */
/* Sevimlilar                                                          */
/* ------------------------------------------------------------------ */
export const SEVIMLI = {
  add: { uz: "Sevimlilarga qo'shish", ru: "Добавить в избранное" } satisfies Tr,
  remove: { uz: "Sevimlilardan olib tashlash", ru: "Убрать из избранного" } satisfies Tr,
} as const;

/* ------------------------------------------------------------------ */
/* Qidiruvni saqlash (F53)                                             */
/* ------------------------------------------------------------------ */
export const QIDIRUV_SAQLASH = {
  button: { uz: "Qidiruvni saqlash", ru: "Сохранить поиск" } satisfies Tr,
  loginTitle: { uz: "Saqlash uchun tizimga kiring", ru: "Войдите, чтобы сохранить" } satisfies Tr,
  saved: { uz: "Saqlandi", ru: "Сохранено" } satisfies Tr,
  savedSearches: { uz: "Saqlangan qidiruvlar", ru: "Сохранённые поиски" } satisfies Tr,
  formAria: { uz: "Qidiruvni saqlash", ru: "Сохранить поиск" } satisfies Tr,
  nameLabel: { uz: "Qidiruv nomi", ru: "Название поиска" } satisfies Tr,
  namePlaceholder: { uz: "Masalan: Samarqand to'y videograflari", ru: "Например: свадебные видеографы Самарканда" } satisfies Tr,
  notify: { uz: "Yangi mos mutaxassislar haqida xabar berish", ru: "Сообщать о новых подходящих специалистах" } satisfies Tr,
  networkError: { uz: "Tarmoq xatosi. Qayta urinib ko'ring.", ru: "Ошибка сети. Попробуйте ещё раз." } satisfies Tr,
  save: { uz: "Saqlash", ru: "Сохранить" } satisfies Tr,
  close: { uz: "Yopish", ru: "Закрыть" } satisfies Tr,
} as const;
