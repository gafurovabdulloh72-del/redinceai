/**
 * Qidiruv lug'ati (batch-800, profile sohasi): /qidiruv (Explore), ⌘K paleti, navbar qidiruv tugmasi va /xarita sarlavhasi.
 * Har kalit { uz, ru } juftligi; parametrli satrlar — funksiya juftligi.
 */
import type { Tr } from "../index";
import { ruPlural } from "./catalog";

/* ------------------------------------------------------------------ */
/* /qidiruv — ommaviy qidiruv zonasi                                   */
/* ------------------------------------------------------------------ */
export const QIDIRUV = {
  eyebrow: { uz: "Qidiruv", ru: "Поиск" } satisfies Tr,
  titleStart: { uz: "Nimani", ru: "Что" } satisfies Tr,
  titleAccent: { uz: "qidiryapsiz?", ru: "ищете?" } satisfies Tr,
  description: { uz: "Ish nomi, post matni yoki ijodkor ismi — barcha ochiq kontent bir joyda.", ru: "Название работы, текст поста или имя автора — весь открытый контент в одном месте." } satisfies Tr,
  placeholder: { uz: "Masalan: to'y montaj, logo animatsiya, Zarina…", ru: "Например: свадебный монтаж, анимация логотипа, Зарина…" } satisfies Tr,
  inputAria: { uz: "Qidiruv so'zi", ru: "Поисковый запрос" } satisfies Tr,
  submit: { uz: "Qidirish", ru: "Найти" } satisfies Tr,
  clear: { uz: "Tozalash", ru: "Очистить" } satisfies Tr,
  typeAria: { uz: "Natija turi", ru: "Тип результата" } satisfies Tr,
  types: {
    all: { uz: "Hammasi", ru: "Всё" },
    video: { uz: "Videolar", ru: "Видео" },
    work: { uz: "Ishlar", ru: "Работы" },
    post: { uz: "Postlar", ru: "Посты" },
    people: { uz: "Ijodkorlar", ru: "Авторы" },
    groups: { uz: "Jamoalar", ru: "Сообщества" },
    vacancies: { uz: "Vakansiyalar", ru: "Вакансии" },
  } as Record<string, Tr>,
  people: { uz: "Ijodkorlar", ru: "Авторы" } satisfies Tr,
  found: { uz: "Topildi", ru: "Найдено" } satisfies Tr,
  fresh: { uz: "Yangi videolar va postlar", ru: "Новые видео и посты" } satisfies Tr,
  kind: { work: { uz: "Ish", ru: "Работа" }, post: { uz: "Post", ru: "Пост" } } as Record<string, Tr>,
  recent: { uz: "So'nggi qidiruvlar", ru: "Недавние запросы" } satisfies Tr,
  recentClear: { uz: "Tozalash", ru: "Очистить" } satisfies Tr,
  recentRemove: { uz: (q: string) => `«${q}» ni tarixdan o'chirish`, ru: (q: string) => `Удалить «${q}» из истории` },
  popular: { uz: "Ommabop", ru: "Популярное" } satisfies Tr,
  emptyTitle: { uz: (q: string) => `«${q}» bo'yicha hech narsa topilmadi`, ru: (q: string) => `По запросу «${q}» ничего не найдено` },
  emptyDesc: { uz: "Boshqa so'z bilan urinib ko'ring: ish turi (montaj, logo), shahar yoki ijodkor ismi.", ru: "Попробуйте другое слово: вид работы (монтаж, логотип), город или имя автора." } satisfies Tr,
  nothingYetTitle: { uz: "Hali ommaviy kontent yo'q", ru: "Открытого контента пока нет" } satisfies Tr,
  nothingYetDesc: { uz: "Ijodkorlar video va postlar joylashi bilan ular shu yerda chiqadi.", ru: "Как только авторы опубликуют видео и посты, они появятся здесь." } satisfies Tr,
  needQueryTitle: { uz: "So'z kiriting", ru: "Введите запрос" } satisfies Tr,
  needQueryDesc: { uz: "Bu turdagi natijalar faqat qidiruv so'zi bo'yicha ko'rsatiladi — ism, kasb yoki ko'nikma yozing.", ru: "Результаты этого типа показываются только по запросу — введите имя, профессию или навык." } satisfies Tr,
  keyHint: { uz: "«/» — qidiruvga o'tish · ↑ ↓ — natijalar bo'ylab", ru: "«/» — к поиску · ↑ ↓ — по результатам" } satisfies Tr,
  resultsAria: { uz: "Qidiruv natijalari", ru: "Результаты поиска" } satisfies Tr,
  countShort: { uz: (n: number) => `${n} ta`, ru: (n: number) => `${n}` },
} as const;

/* ------------------------------------------------------------------ */
/* ⌘K paleti va navbar tugmasi                                          */
/* ------------------------------------------------------------------ */
export const PALET = {
  aria: { uz: "Qidiruv", ru: "Поиск" } satisfies Tr,
  buttonAria: { uz: "Qidiruv (⌘K)", ru: "Поиск (⌘K)" } satisfies Tr,
  buttonTitle: { uz: "Qidiruv — ⌘K / Ctrl+K", ru: "Поиск — ⌘K / Ctrl+K" } satisfies Tr,
  placeholder: { uz: "Ijodkor, vakansiya, jamoa, sahifa…", ru: "Автор, вакансия, сообщество, страница…" } satisfies Tr,
  loading: { uz: "Yuklanmoqda", ru: "Загрузка" } satisfies Tr,
  close: { uz: "Yopish", ru: "Закрыть" } satisfies Tr,
  recent: { uz: "So'nggi qidiruvlar", ru: "Недавние запросы" } satisfies Tr,
  quick: { uz: "Tez o'tish", ru: "Быстрый переход" } satisfies Tr,
  notFound: { uz: "Hech narsa topilmadi", ru: "Ничего не найдено" } satisfies Tr,
  notFoundDesc: { uz: "Boshqa so'z bilan urinib ko'ring yoki Enter — to'liq qidiruv", ru: "Попробуйте другое слово или Enter — полный поиск" } satisfies Tr,
  fullSearch: { uz: (q: string) => `«${q}» — to'liq qidiruv`, ru: (q: string) => `«${q}» — полный поиск` },
  hintNav: { uz: "yurish", ru: "навигация" } satisfies Tr,
  hintOpen: { uz: "ochish", ru: "открыть" } satisfies Tr,
  hintClose: { uz: "yopish", ru: "закрыть" } satisfies Tr,
  sections: {
    pages: { uz: "Sahifalar", ru: "Страницы" },
    specialists: { uz: "Ijodkorlar", ru: "Авторы" },
    vacancies: { uz: "Vakansiyalar", ru: "Вакансии" },
    groups: { uz: "Jamoalar", ru: "Сообщества" },
    jobs: { uz: "Ishlar", ru: "Заказы" },
    help: { uz: "Yordam", ru: "Помощь" },
  } as Record<string, Tr>,
  quickItems: [
    { href: "/mutaxassislar", title: { uz: "Ijodkorlar katalogi", ru: "Каталог авторов" }, sub: { uz: "Portfolio, narx, sharh", ru: "Портфолио, цены, отзывы" } },
    { href: "/jamoalar", title: { uz: "Jamoalar va kanallar", ru: "Сообщества и каналы" }, sub: { uz: "Rasmiy kanal, efirlar", ru: "Официальный канал, эфиры" } },
    { href: "/vakansiyalar", title: { uz: "Vakansiyalar", ru: "Вакансии" }, sub: { uz: "Onlayn ish o'rinlari", ru: "Онлайн-вакансии" } },
    { href: "/vakansiyalar/yangi", title: { uz: "Vakansiya joylash", ru: "Разместить вакансию" }, sub: { uz: "Bepul", ru: "Бесплатно" } },
    { href: "/kabinet", title: { uz: "Kabinet", ru: "Кабинет" }, sub: { uz: "Buyurtmalar va chat", ru: "Заказы и чат" } },
  ] as ReadonlyArray<{ href: string; title: Tr; sub: Tr }>,
  /** Takliflar (SearchBox) tur hint'lari — server hint'i o'rniga tilga mos */
  suggestHint: {
    category: { uz: "Yo'nalish", ru: "Направление" },
    region: { uz: "Hudud", ru: "Регион" },
    skill: { uz: "Ko'nikma", ru: "Навык" },
    city: { uz: "Shahar", ru: "Город" },
  } as Record<string, Tr>,
} as const;

/* ------------------------------------------------------------------ */
/* /xarita sarlavhasi                                                   */
/* ------------------------------------------------------------------ */
export const XARITA = {
  eyebrow: { uz: (regions: number, total: number) => `${regions} hudud · ${total} ijodkor`, ru: (regions: number, total: number) => `${regions} ${ruPlural(regions, ["регион", "региона", "регионов"])} · ${total} ${ruPlural(total, ["автор", "автора", "авторов"])}` },
  titleStart: { uz: "Hududni tanlang —", ru: "Выберите регион —" } satisfies Tr,
  titleAccent: { uz: "ijodkorlar", ru: "авторы" } satisfies Tr,
  titleEnd: { uz: "chiqadi", ru: "рядом" } satisfies Tr,
  description: { uz: "Viloyatni bosing — shu yerdagi ijodkorlar va statistika ochiladi.", ru: "Нажмите на область — откроются авторы и статистика региона." } satisfies Tr,
  shareRegion: { uz: "Hududni ulashish", ru: "Поделиться регионом" } satisfies Tr,
  shareCopied: { uz: "Havola nusxalandi", ru: "Ссылка скопирована" } satisfies Tr,
  topSkills: { uz: "Ko'p uchraydigan ko'nikmalar", ru: "Частые навыки" } satisfies Tr,
} as const;
