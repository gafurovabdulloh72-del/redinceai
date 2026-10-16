/**
 * Mutaxassis profili lug'ati (/mutaxassislar/[slug]): bo'lim sarlavhalari, CTA tugmalar,
 * aloqa paneli (lock sabablari), ish vaqti, paketlar, kalkulyator va sharhlar yorliqlari.
 */
import type { Locale, Tr } from "../index";
import type { LockReason } from "@/lib/privacy";
import { ruPlural } from "./catalog";

/* ------------------------------------------------------------------ */
/* Yopiq maydon sabablari (privacy.LOCK_LABEL'ning til-mos varianti)    */
/* ------------------------------------------------------------------ */
export const LOCK_SABAB: Record<LockReason, Tr> = {
  login: { uz: "Faqat ro'yxatdan o'tganlarga ko'rinadi", ru: "Видно только зарегистрированным" },
  order: { uz: "Buyurtma qabul qilingach ko'rinadi", ru: "Откроется после принятия заказа" },
};

/** Tillar (profil "Tillar" chipi, LANGUAGE_LABEL kalitlari bo'yicha) */
export const TIL_NOMI: Record<string, Tr> = {
  uz: { uz: "O'zbek", ru: "Узбекский" },
  ru: { uz: "Rus", ru: "Русский" },
  en: { uz: "Ingliz", ru: "Английский" },
  kaa: { uz: "Qoraqalpoq", ru: "Каракалпакский" },
  tg: { uz: "Tojik", ru: "Таджикский" },
};

/** Hafta kunlari (WEEKDAYS kalitlari bo'yicha) — ish vaqti jadvali uchun */
export const HAFTA_KUNI: Record<string, { full: Tr; short: Tr }> = {
  mon: { full: { uz: "Dushanba", ru: "Понедельник" }, short: { uz: "Du", ru: "Пн" } },
  tue: { full: { uz: "Seshanba", ru: "Вторник" }, short: { uz: "Se", ru: "Вт" } },
  wed: { full: { uz: "Chorshanba", ru: "Среда" }, short: { uz: "Ch", ru: "Ср" } },
  thu: { full: { uz: "Payshanba", ru: "Четверг" }, short: { uz: "Pa", ru: "Чт" } },
  fri: { full: { uz: "Juma", ru: "Пятница" }, short: { uz: "Ju", ru: "Пт" } },
  sat: { full: { uz: "Shanba", ru: "Суббота" }, short: { uz: "Sh", ru: "Сб" } },
  sun: { full: { uz: "Yakshanba", ru: "Воскресенье" }, short: { uz: "Ya", ru: "Вс" } },
};

/** Ruscha "qachon ochiladi" uchun kelishik shakli: "в пятницу", "во вторник" */
export const HAFTA_KUNI_RU_QACHON: Record<string, string> = {
  mon: "в понедельник",
  tue: "во вторник",
  wed: "в среду",
  thu: "в четверг",
  fri: "в пятницу",
  sat: "в субботу",
  sun: "в воскресенье",
};

/** Oxirgi faollik chelagi (utils.ACTIVITY_LABEL'ning til-mos varianti) */
export const FAOLLIK: Record<"today" | "week" | "month", Tr> = {
  today: { uz: "bugun", ru: "сегодня" },
  week: { uz: "shu hafta", ru: "на этой неделе" },
  month: { uz: "shu oy", ru: "в этом месяце" },
};

/** Sharh mezonlari (RATING_CRITERIA kalitlari bo'yicha) */
export const MEZON: Record<string, Tr> = {
  quality: { uz: "Sifat", ru: "Качество" },
  timeliness: { uz: "Muddat", ru: "Сроки" },
  communication: { uz: "Muloqot", ru: "Общение" },
};

/** Paket darajalari (PACKAGE_TIERS kalitlari bo'yicha) */
export const PAKET_DARAJA: Record<string, Tr> = {
  basic: { uz: "Boshlang'ich", ru: "Базовый" },
  standard: { uz: "Standart", ru: "Стандарт" },
  premium: { uz: "Premium", ru: "Премиум" },
};

/** Portfolio galereyasi (lightbox) */
export const GALEREYA = {
  emptyTitle: { uz: "Portfolio hali bo'sh", ru: "Портфолио пока пустое" } satisfies Tr,
  emptyDesc: { uz: "Mutaxassis ishlarini tez orada joylaydi.", ru: "Специалист скоро добавит свои работы." } satisfies Tr,
  tagsAria: { uz: "Teglar bo'yicha filtr", ru: "Фильтр по тегам" } satisfies Tr,
  all: { uz: "Barchasi", ru: "Все" } satisfies Tr,
  beforeAfter: { uz: "Oldin / keyin", ru: "До / после" } satisfies Tr,
  opensNewWindow: { uz: (t: string) => `${t} — yangi oynada ochiladi`, ru: (t: string) => `${t} — откроется в новом окне` },
  zoom: { uz: (t: string) => `${t} — kattalashtirish`, ru: (t: string) => `${t} — увеличить` },
  openOnYoutube: { uz: "YouTube'da ochish", ru: "Открыть на YouTube" } satisfies Tr,
  openOnVimeo: { uz: "Vimeo'da ochish", ru: "Открыть на Vimeo" } satisfies Tr,
  openSource: { uz: "Manbada ochish", ru: "Открыть источник" } satisfies Tr,
  close: { uz: "Yopish (Esc)", ru: "Закрыть (Esc)" } satisfies Tr,
  prev: { uz: "Oldingi", ru: "Назад" } satisfies Tr,
  next: { uz: "Keyingi", ru: "Вперёд" } satisfies Tr,
  openVideoNew: { uz: "Videoni yangi oynada ochish", ru: "Открыть видео в новом окне" } satisfies Tr,
  before: { uz: "Oldin", ru: "До" } satisfies Tr,
  after: { uz: "Keyin", ru: "После" } satisfies Tr,
  compareAria: { uz: "Oldin va keyin rasmlarini solishtirish", ru: "Сравнение фото до и после" } satisfies Tr,
  compareValue: { uz: (a: number, b: number) => `Oldin ${a}%, keyin ${b}%`, ru: (a: number, b: number) => `До ${a}%, после ${b}%` },
  imageFailed: { uz: "Rasm yuklanmadi", ru: "Не удалось загрузить фото" } satisfies Tr,
} as const;

/** "Shikoyat qilish" (F85) formasi */
export const SHIKOYAT = {
  aboutProfile: { uz: "Profil haqida shikoyat", ru: "Пожаловаться на профиль" } satisfies Tr,
  aboutReview: { uz: "Sharh haqida shikoyat", ru: "Пожаловаться на отзыв" } satisfies Tr,
  sent: { uz: "Shikoyatingiz yuborildi — admin ko'rib chiqadi", ru: "Жалоба отправлена — администратор рассмотрит её" } satisfies Tr,
  loginFirst: { uz: " — avval tizimga kiring", ru: " — сначала войдите" } satisfies Tr,
  button: { uz: "Shikoyat qilish", ru: "Пожаловаться" } satisfies Tr,
  pickReason: { uz: "Sababni tanlang", ru: "Выберите причину" } satisfies Tr,
  reason: { uz: "Sabab", ru: "Причина" } satisfies Tr,
  choose: { uz: "Tanlang…", ru: "Выберите…" } satisfies Tr,
  comment: { uz: "Izoh", ru: "Комментарий" } satisfies Tr,
  optional: { uz: "(ixtiyoriy)", ru: "(необязательно)" } satisfies Tr,
  placeholder: { uz: "Nima bo'ldi? Qisqacha yozing", ru: "Что случилось? Опишите коротко" } satisfies Tr,
  cancel: { uz: "Bekor qilish", ru: "Отмена" } satisfies Tr,
  send: { uz: "Yuborish", ru: "Отправить" } satisfies Tr,
  networkError: { uz: "Tarmoq xatosi. Qayta urinib ko'ring.", ru: "Ошибка сети. Попробуйте ещё раз." } satisfies Tr,
} as const;

export const PROFIL = {
  /* --------- Preview (egasi) --------- */
  previewTitle: { uz: "Ko'rish rejimi — profilingiz boshqalarga shunday ko'rinadi", ru: "Режим просмотра — так ваш профиль видят другие" } satisfies Tr,
  previewModes: {
    guest: { label: { uz: "Mehmon", ru: "Гость" }, hint: { uz: "Tizimga kirmagan tashrifchi", ru: "Посетитель без входа в систему" } },
    client: { label: { uz: "Ro'yxatdan o'tgan", ru: "Зарегистрированный" }, hint: { uz: "Kirgan, lekin buyurtmasi yo'q", ru: "Вошёл, но без заказа" } },
    order: { label: { uz: "Buyurtmachi", ru: "Заказчик" }, hint: { uz: "Buyurtmasi qabul qilingan mijoz", ru: "Клиент с принятым заказом" } },
  } as Record<string, { label: Tr; hint: Tr }>,
  lockedFields: { uz: (n: number) => ` · ${n} ta maydon yopiq`, ru: (n: number) => ` · Скрытых полей: ${n}` },
  allFieldsOpen: { uz: " · hamma maydon ochiq", ru: " · все поля открыты" } satisfies Tr,
  viewerTypeAria: { uz: "Ko'ruvchi turi", ru: "Тип зрителя" } satisfies Tr,
  exitPreview: { uz: "Chiqish", ru: "Выйти" } satisfies Tr,

  /* --------- Obuna bannerlari (egasi) --------- */
  subExpiredTitle: { uz: "Obunangiz tugagan — profilingiz katalogda ko'rinmaydi", ru: "Подписка истекла — ваш профиль не виден в каталоге" } satisfies Tr,
  subGraceTitle: { uz: (days: number) => `Obuna muddati tugadi — ${days} kun ichida to'lang`, ru: (days: number) => `Срок подписки истёк — оплатите в течение ${days} дн.` },
  subExpiredDesc: {
    uz: "Mijozlar sizni ro'yxat va xaritada topa olmaydi, aloqa ma'lumotlaringiz yopiq va yangi buyurtma qabul qilinmaydi. Mavjud buyurtmalar davom etadi.",
    ru: "Клиенты не найдут вас в списке и на карте, контакты скрыты, новые заказы не принимаются. Текущие заказы продолжаются.",
  } satisfies Tr,
  subGraceDesc: {
    uz: "Imtiyozli kunlar tugagach profilingiz katalogdan yashiriladi va yangi buyurtmalar to'xtaydi.",
    ru: "После льготного периода профиль будет скрыт из каталога, а новые заказы остановятся.",
  } satisfies Tr,
  renewSub: { uz: "Obunani yangilash", ru: "Продлить подписку" } satisfies Tr,

  /* --------- Breadcrumb / hero --------- */
  breadcrumbAria: { uz: "Yo'l", ru: "Навигация" } satisfies Tr,
  specialists: { uz: "Mutaxassislar", ru: "Специалисты" } satisfies Tr,
  verifiedPerson: { uz: "Shaxsi tasdiqlangan", ru: "Личность подтверждена" } satisfies Tr,
  topSpecialist: { uz: "Top mutaxassis", ru: "Топ-специалист" } satisfies Tr,
  featured: { uz: "Tavsiya etiladi", ru: "Рекомендуем" } satisfies Tr,
  inactive: { uz: "Faol emas", ru: "Неактивен" } satisfies Tr,
  onVacation: { uz: "Ta'tilda", ru: "В отпуске" } satisfies Tr,
  available: { uz: "Bo'sh", ru: "Свободен" } satisfies Tr,
  busy: { uz: "Band", ru: "Занят" } satisfies Tr,
  approxCity: { uz: "taxminan", ru: "примерно" } satisfies Tr,
  approxCityHint: { uz: "Aniq shahar yashirin — hudud markazi ko'rsatilgan", ru: "Точный город скрыт — показан центр региона" } satisfies Tr,
  noReviewsYet: { uz: "Hali sharh yo'q", ru: "Отзывов пока нет" } satisfies Tr,
  guestEye: { uz: "Mehmon ko'zi bilan", ru: "Глазами гостя" } satisfies Tr,
  trustAria: { uz: "Ishonch ko'rsatkichlari", ru: "Показатели доверия" } satisfies Tr,
  views: { uz: (v: string) => `${v} ko'rish`, ru: (v: string) => `${v} просмотров` },
  memberSince: { uz: (d: string) => `${d} dan beri`, ru: (d: string) => `На платформе с ${d}` },
  completedOrders: { uz: (n: number) => `${n} ta bajarilgan buyurtma`, ru: (n: number) => `${n} ${ruPlural(n, ["выполненный заказ", "выполненных заказа", "выполненных заказов"])}` },
  completedOrdersHint: { uz: "Platforma orqali bajarilgan buyurtmalar", ru: "Заказы, выполненные через платформу" } satisfies Tr,
  repeatClients: { uz: (n: number) => `${n} ta doimiy mijoz`, ru: (n: number) => `${n} ${ruPlural(n, ["постоянный клиент", "постоянных клиента", "постоянных клиентов"])}` },
  repeatClientsHint: { uz: "Kamida 2 marta buyurtma bergan mijozlar", ru: "Клиенты, заказавшие не менее 2 раз" } satisfies Tr,
  responseHint: { uz: "Buyurtma kelganidan birinchi javobgacha o'rtacha vaqt", ru: "Среднее время от заказа до первого ответа" } satisfies Tr,
  lastActivity: { uz: (b: string) => `Oxirgi faollik: ${b}`, ru: (b: string) => `Был в сети: ${b}` },

  /* --------- Obuna faol emas (tashrifchilar) --------- */
  inactiveTitle: { uz: "Mutaxassis obunasi faol emas — hozircha buyurtma qabul qilmaydi", ru: "Подписка специалиста неактивна — заказы пока не принимаются" } satisfies Tr,
  inactiveDesc: {
    uz: "Profil ma'lumot uchun ochiq. Aloqa ma'lumotlari va buyurtma berish mutaxassis obunasini qayta faollashtirgach ochiladi.",
    ru: "Профиль открыт для ознакомления. Контакты и оформление заказа станут доступны после возобновления подписки.",
  } satisfies Tr,
  similarBtn: { uz: "O'xshash mutaxassislar", ru: "Похожие специалисты" } satisfies Tr,

  /* --------- Haqida --------- */
  aboutEyebrow: { uz: "Haqida", ru: "О специалисте" } satisfies Tr,
  aboutTitle: { uz: (name: string) => `${name} haqida`, ru: (name: string) => `О специалисте ${name}` },
  noBio: { uz: "Mutaxassis hali o'zi haqida ma'lumot yozmagan.", ru: "Специалист ещё не рассказал о себе." } satisfies Tr,
  workTypes: { uz: "Ish turlari", ru: "Типы работ" } satisfies Tr,
  workTypeHint: { uz: (label: string) => `${label} bo'yicha mutaxassislar`, ru: (label: string) => `Специалисты по направлению «${label}»` },
  skills: { uz: "Ko'nikmalar", ru: "Навыки" } satisfies Tr,
  skillHint: { uz: (s: string) => `"${s}" ko'nikmasi bor mutaxassislar`, ru: (s: string) => `Специалисты с навыком «${s}»` },
  equipment: { uz: "Jihozlar", ru: "Оборудование" } satisfies Tr,
  equipmentHint: { uz: (s: string) => `"${s}" jihozi bor mutaxassislar`, ru: (s: string) => `Специалисты с оборудованием «${s}»` },

  /* --------- Paketlar --------- */
  packagesEyebrow: { uz: "Xizmat paketlari", ru: "Пакеты услуг" } satisfies Tr,
  packagesTitleStart: { uz: "Tayyor", ru: "Готовые" } satisfies Tr,
  packagesTitleAccent: { uz: "paketlar", ru: "пакеты" } satisfies Tr,
  packagesOwnerNote: { uz: "Mijozlar shu yerdan paketni tanlaydi", ru: "Здесь клиенты выбирают пакет" } satisfies Tr,
  packagesInactiveNote: { uz: "Hozircha buyurtma qabul qilinmaydi", ru: "Заказы пока не принимаются" } satisfies Tr,
  tierAria: { uz: "Paket darajasi", ru: "Уровень пакета" } satisfies Tr,
  packageAria: { uz: (tier: string) => `${tier} paket`, ru: (tier: string) => `Пакет «${tier}»` },
  sum: { uz: "so'm", ru: "сум" } satisfies Tr,
  inDays: { uz: (d: number) => `${d} kunda`, ru: (d: number) => `за ${d} ${ruPlural(d, ["день", "дня", "дней"])}` },
  revisions: { uz: (n: number) => `${n} marta tuzatish`, ru: (n: number) => `${n} ${ruPlural(n, ["правка", "правки", "правок"])}` },
  noRevisions: { uz: "Tuzatishsiz", ru: "Без правок" } satisfies Tr,
  choose: { uz: "Tanlash", ru: "Выбрать" } satisfies Tr,
  choosePackageAria: { uz: (tier: string, price: string) => `${tier} paketni tanlash — ${price}`, ru: (tier: string, price: string) => `Выбрать пакет «${tier}» — ${price}` },

  /* --------- Aloqa paneli --------- */
  contact: { uz: "Aloqa", ru: "Контакты" } satisfies Tr,
  contactLockedCount: { uz: (n: number) => `${n} ta yopiq`, ru: (n: number) => `скрыто: ${n}` },
  phone: { uz: "Telefon", ru: "Телефон" } satisfies Tr,
  website: { uz: "Veb-sayt", ru: "Веб-сайт" } satisfies Tr,
  login: { uz: "Kirish", ru: "Войти" } satisfies Tr,
  orderShort: { uz: "Buyurtma", ru: "Заказ" } satisfies Tr,
  newWindow: { uz: " (yangi oynada)", ru: " (в новом окне)" } satisfies Tr,
  contactsClosedTitle: { uz: "Aloqa ma'lumotlari yopiq", ru: "Контакты скрыты" } satisfies Tr,
  contactsClosedDesc: {
    uz: "Mutaxassis obunasi faol emas — telefon va ijtimoiy tarmoqlar obuna yangilangach ko'rinadi.",
    ru: "Подписка специалиста неактивна — телефон и соцсети появятся после продления подписки.",
  } satisfies Tr,

  /* --------- Qisqa havola --------- */
  shortLink: { uz: "Qisqa havola", ru: "Короткая ссылка" } satisfies Tr,
  copy: { uz: "Nusxalash", ru: "Скопировать" } satisfies Tr,
  copied: { uz: "Nusxalandi", ru: "Скопировано" } satisfies Tr,
  copyShort: { uz: "Qisqa havolani nusxalash", ru: "Скопировать короткую ссылку" } satisfies Tr,
  copiedShort: { uz: "Qisqa havola nusxalandi", ru: "Короткая ссылка скопирована" } satisfies Tr,
  vcard: { uz: "Vizitkani yuklab olish (vCard)", ru: "Скачать визитку (vCard)" } satisfies Tr,
  vcardHint: { uz: "Kontaktni telefoningizga saqlang (vCard)", ru: "Сохраните контакт в телефон (vCard)" } satisfies Tr,

  /* --------- Ulashish --------- */
  share: { uz: "Ulashish", ru: "Поделиться" } satisfies Tr,
  linkCopied: { uz: "Havola nusxalandi", ru: "Ссылка скопирована" } satisfies Tr,

  /* --------- Ish vaqti --------- */
  scheduleEyebrow: { uz: "Ish vaqti", ru: "График работы" } satisfies Tr,
  scheduleTitleStart: { uz: "Qachon", ru: "Когда можно" } satisfies Tr,
  scheduleTitleAccent: { uz: "bog'lanish", ru: "связаться" } satisfies Tr,
  scheduleTitleEnd: { uz: "mumkin", ru: "" } satisfies Tr,
  openNowUntil: { uz: (t: string) => `Hozir ochiq · ${t} gacha`, ru: (t: string) => `Сейчас открыто · до ${t}` },
  closedOpens: { uz: (when: string, t: string) => `Yopiq · ${when} ${t} da ochiladi`, ru: (when: string, t: string) => `Закрыто · откроется ${when} в ${t}` },
  closed: { uz: "Yopiq", ru: "Закрыто" } satisfies Tr,
  noSchedule: { uz: "Ish vaqti ko'rsatilmagan", ru: "График работы не указан" } satisfies Tr,
  today: { uz: "bugun", ru: "сегодня" } satisfies Tr,
  tomorrow: { uz: "ertaga", ru: "завтра" } satisfies Tr,
  vacationUntil: { uz: (d: string) => `Ta'tilda — ${d} gacha`, ru: (d: string) => `В отпуске — до ${d}` },
  vacationDesc: {
    uz: "Shu sanagacha yangi buyurtmalar qabul qilinmasligi mumkin. Buyurtma yuborsangiz, navbatga qo'yiladi.",
    ru: "До этой даты новые заказы могут не приниматься. Отправленный заказ встанет в очередь.",
  } satisfies Tr,
  weeklyAria: { uz: "Haftalik jadval", ru: "Недельный график" } satisfies Tr,
  dayOff: { uz: "dam", ru: "вых." } satisfies Tr,
  dayAriaToday: { uz: " (bugun)", ru: " (сегодня)" } satisfies Tr,
  tashkentTime: { uz: "Toshkent vaqti (UTC+5)", ru: "Ташкентское время (UTC+5)" } satisfies Tr,
  todayIs: { uz: (d: string) => `Bugun — ${d}`, ru: (d: string) => `Сегодня — ${d}` },
  blockedDays: { uz: "Band kunlar", ru: "Занятые дни" } satisfies Tr,
  blockedAria: { uz: "Mutaxassis band bo'lgan kunlar", ru: "Дни, когда специалист занят" } satisfies Tr,
  moreDays: { uz: (n: number) => `+${n} kun`, ru: (n: number) => `+${n} ${ruPlural(n, ["день", "дня", "дней"])}` },
  blockedNote: { uz: "Bu kunlarga buyurtma qabul qilinmasligi mumkin — boshqa sanani tanlang.", ru: "На эти дни заказ может не приниматься — выберите другую дату." } satisfies Tr,

  /* --------- Sertifikatlar --------- */
  certsEyebrow: { uz: "Ishonch", ru: "Доверие" } satisfies Tr,
  certsTitleStart: { uz: "Sertifikatlar va", ru: "Сертификаты и" } satisfies Tr,
  certsTitleAccent: { uz: "litsenziyalar", ru: "лицензии" } satisfies Tr,
  viewDoc: { uz: "Hujjatni ko'rish", ru: "Посмотреть документ" } satisfies Tr,

  /* --------- Portfolio --------- */
  portfolioEyebrow: { uz: "Portfolio", ru: "Портфолио" } satisfies Tr,
  /** "12 ta <accent>ish</accent>" / "12 <accent>работ</accent>" */
  portfolioTitle: {
    uz: (n: number) => ({ pre: `${n} ta `, accent: "ish" }),
    ru: (n: number) => ({ pre: `${n} `, accent: ruPlural(n, ["работа", "работы", "работ"]) }),
  },
  portfolioEmpty: { uz: "Ishlar", ru: "Работы" } satisfies Tr,
  clickToZoom: { uz: "Bosib kattalashtiring", ru: "Нажмите, чтобы увеличить" } satisfies Tr,

  /* --------- Sharhlar --------- */
  reviewsEyebrow: { uz: "Sharhlar", ru: "Отзывы" } satisfies Tr,
  /** "12 ta <accent>haqiqiy</accent> fikr" / "12 <accent>настоящих</accent> отзывов" */
  reviewsTitle: {
    uz: (n: number) => ({ pre: `${n} ta `, accent: "haqiqiy", end: " fikr" }),
    ru: (n: number) => ({ pre: `${n} `, accent: ruPlural(n, ["настоящий", "настоящих", "настоящих"]), end: ` ${ruPlural(n, ["отзыв", "отзыва", "отзывов"])}` }),
  },
  reviewsEmptyTitleStart: { uz: "Mijozlar", ru: "Мнения" } satisfies Tr,
  reviewsEmptyTitleAccent: { uz: "fikri", ru: "клиентов" } satisfies Tr,
  reviewsOf5: { uz: (n: number) => `${n} ta sharh · 5 dan`, ru: (n: number) => `${n} ${ruPlural(n, ["отзыв", "отзыва", "отзывов"])} · из 5` },
  distributionAria: { uz: "Baholar taqsimoti", ru: "Распределение оценок" } satisfies Tr,
  starsRowAria: { uz: (n: number, v: number, pct: number) => `${n} yulduz: ${v} ta (${pct}%)`, ru: (n: number, v: number, pct: number) => `${n} звёзд: ${v} (${pct}%)` },
  recommendPct: { uz: "mijozlar tavsiya qiladi", ru: "клиентов рекомендуют" } satisfies Tr,
  criteriaAria: { uz: "Mezonlar bo'yicha o'rtacha baho", ru: "Средняя оценка по критериям" } satisfies Tr,
  noReviewsTitle: { uz: "Hali sharhlar yo'q", ru: "Отзывов пока нет" } satisfies Tr,
  noReviewsDesc: {
    uz: "Birinchi bo'lib fikr bildiring — bu boshqa mijozlarga to'g'ri tanlov qilishga yordam beradi.",
    ru: "Оставьте отзыв первым — это поможет другим клиентам сделать правильный выбор.",
  } satisfies Tr,
  you: { uz: "Siz", ru: "Вы" } satisfies Tr,
  orderVerified: { uz: "Buyurtma tasdiqlangan", ru: "Заказ подтверждён" } satisfies Tr,
  orderVerifiedHint: { uz: "Muallifning shu mutaxassis bilan qabul qilingan buyurtmasi bor", ru: "У автора есть принятый заказ у этого специалиста" } satisfies Tr,
  recommends: { uz: "Tavsiya qiladi", ru: "Рекомендует" } satisfies Tr,
  replyOf: { uz: (name: string) => `${name} javobi`, ru: (name: string) => `Ответ: ${name}` },
  specialistReply: { uz: "Mutaxassis javobi", ru: "Ответ специалиста" } satisfies Tr,
  reviewImageAlt: { uz: (name: string, k: number) => `${name} sharhidagi rasm ${k}`, ru: (name: string, k: number) => `Фото ${k} из отзыва ${name}` },

  /* --------- Sharh formasi --------- */
  rf: {
    gateOrderTitle: { uz: "Sharh faqat ishi yakunlangan mijozlar uchun", ru: "Отзыв — только для клиентов с завершённой работой" } satisfies Tr,
    gateOrderDesc: {
      uz: "Shu mutaxassisga buyurtma bering — ish yakunlangach fikringizni yozishingiz mumkin. Shunday qilib har bir sharh haqiqiy bo'ladi.",
      ru: "Закажите у этого специалиста — после завершения работы сможете оставить отзыв. Так каждый отзыв остаётся настоящим.",
    } satisfies Tr,
    orderCta: { uz: "Buyurtma berish", ru: "Заказать" } satisfies Tr,
    gateLoginTitle: { uz: "Sharh qoldirmoqchimisiz?", ru: "Хотите оставить отзыв?" } satisfies Tr,
    gateLoginDesc: { uz: "Fikringizni yozish uchun avval tizimga kiring. Bir daqiqa vaqt oladi.", ru: "Чтобы написать отзыв, сначала войдите. Это займёт минуту." } satisfies Tr,
    login: { uz: "Kirish", ru: "Войти" } satisfies Tr,
    doneDeleted: { uz: "Sharhingiz o'chirildi", ru: "Ваш отзыв удалён" } satisfies Tr,
    doneUpdated: { uz: "Sharhingiz yangilandi", ru: "Ваш отзыв обновлён" } satisfies Tr,
    doneCreated: { uz: "Rahmat! Sharhingiz saqlandi", ru: "Спасибо! Отзыв сохранён" } satisfies Tr,
    doneDeletedDesc: { uz: "Xohlasangiz keyinroq yangi sharh qoldirishingiz mumkin.", ru: "При желании вы сможете оставить новый отзыв позже." } satisfies Tr,
    doneDesc: { uz: "Fikringiz boshqa mijozlarga to'g'ri tanlov qilishga yordam beradi.", ru: "Ваш отзыв поможет другим клиентам сделать правильный выбор." } satisfies Tr,
    edit: { uz: "Tahrirlash", ru: "Редактировать" } satisfies Tr,
    titleEdit: { uz: "Sharhingizni yangilang", ru: "Обновите свой отзыв" } satisfies Tr,
    titleNew: { uz: "Sharh qoldiring", ru: "Оставьте отзыв" } satisfies Tr,
    subEdit: { uz: "Avval qoldirgan bahoyingizni o'zgartirishingiz mumkin.", ru: "Можно изменить оценку, оставленную ранее." } satisfies Tr,
    subNew: { uz: "Hamkorlik qanday o'tdi? Qisqa va aniq yozing.", ru: "Как прошло сотрудничество? Напишите коротко и по делу." } satisfies Tr,
    rating: { uz: "Baho", ru: "Оценка" } satisfies Tr,
    ratingAria: { uz: "Baho (1 dan 5 gacha)", ru: "Оценка (от 1 до 5)" } satisfies Tr,
    pickStar: { uz: "Yulduzni tanlang", ru: "Выберите звезду" } satisfies Tr,
    pickRatingError: { uz: "Bahoni tanlang (1–5 yulduz)", ru: "Выберите оценку (1–5 звёзд)" } satisfies Tr,
    autoRatingNote: { uz: "Mezonlar o'rtachasi bo'yicha — xohlasangiz o'zingiz o'zgartiring.", ru: "По среднему критериев — при желании измените сами." } satisfies Tr,
    criteriaTitle: { uz: "Mezonlar bo'yicha (ixtiyoriy)", ru: "По критериям (необязательно)" } satisfies Tr,
    starAria: { uz: (n: number, name: string) => `${n} yulduz — ${name}`, ru: (n: number, name: string) => `${n} ${ruPlural(n, ["звезда", "звезды", "звёзд"])} — ${name}` },
    ratingNames: {
      uz: { 1: "Yomon", 2: "Qoniqarsiz", 3: "O'rtacha", 4: "Yaxshi", 5: "A'lo" },
      ru: { 1: "Плохо", 2: "Неудовлетворительно", 3: "Средне", 4: "Хорошо", 5: "Отлично" },
    } as Record<Locale, Record<number, string>>,
    textLabel: { uz: "Sharh matni", ru: "Текст отзыва" } satisfies Tr,
    textPlaceholder: {
      uz: "Masalan: Muddatida topshirdi, muloqot oson va aniq bo'ldi…",
      ru: "Например: сдал в срок, общение было простым и чётким…",
    } satisfies Tr,
    minChars: { uz: "Kamida 10 ta belgi", ru: "Не менее 10 символов" } satisfies Tr,
    mediaLabel: { uz: "Natija rasmlari", ru: "Фото результата" } satisfies Tr,
    mediaOptional: { uz: (max: number) => `(ixtiyoriy, ${max} tagacha)`, ru: (max: number) => `(необязательно, до ${max})` },
    mediaRemove: { uz: "Rasmni olib tashlash", ru: "Убрать фото" } satisfies Tr,
    mediaAdd: { uz: "Qo'shish", ru: "Добавить" } satisfies Tr,
    mediaAddAria: { uz: "Rasm qo'shish", ru: "Добавить фото" } satisfies Tr,
    uploadError: { uz: "Rasmni yuklab bo'lmadi", ru: "Не удалось загрузить фото" } satisfies Tr,
    recommendLabel: { uz: "Boshqalarga tavsiya qilaman", ru: "Рекомендую другим" } satisfies Tr,
    networkError: { uz: "Tarmoq xatosi. Qayta urinib ko'ring.", ru: "Ошибка сети. Попробуйте ещё раз." } satisfies Tr,
    confirmDeleteAria: { uz: "O'chirishni tasdiqlash", ru: "Подтверждение удаления" } satisfies Tr,
    confirmDeleteQ: { uz: "Sharh o'chirilsinmi?", ru: "Удалить отзыв?" } satisfies Tr,
    yesDelete: { uz: "Ha, o'chirish", ru: "Да, удалить" } satisfies Tr,
    no: { uz: "Yo'q", ru: "Нет" } satisfies Tr,
    delete: { uz: "O'chirish", ru: "Удалить" } satisfies Tr,
    update: { uz: "Yangilash", ru: "Обновить" } satisfies Tr,
    submit: { uz: "Sharhni yuborish", ru: "Отправить отзыв" } satisfies Tr,
  },

  /* --------- Kalkulyator --------- */
  calc: {
    title: { uz: "Narx kalkulyatori", ru: "Калькулятор цены" } satisfies Tr,
    unitAria: { uz: "Hisob birligi", ru: "Единица расчёта" } satisfies Tr,
    units: {
      hourly: { label: { uz: "Soatbay", ru: "Почасово" }, noun: { uz: "soat", ru: "час" } },
      daily: { label: { uz: "Kunbay", ru: "Подённо" }, noun: { uz: "kun", ru: "день" } },
      unit: { label: { uz: "Donabay", ru: "Поштучно" }, noun: { uz: "dona", ru: "шт." } },
      project: { label: { uz: "Loyihabay", ru: "За проект" }, noun: { uz: "loyiha", ru: "проект" } },
    } as Record<string, { label: Tr; noun: Tr }>,
    projectNote: {
      uz: (price: string) => `Loyiha uchun boshlang'ich narx — ${price}. Aniq summa ish hajmiga qarab kelishiladi.`,
      ru: (price: string) => `Стартовая цена проекта — ${price}. Точная сумма согласуется по объёму работы.`,
    },
    howMany: { uz: (noun: string) => `Necha ${noun}?`, ru: (noun: string) => `Сколько (${noun})?` },
    decrease: { uz: "Kamaytirish", ru: "Уменьшить" } satisfies Tr,
    increase: { uz: "Ko'paytirish", ru: "Увеличить" } satisfies Tr,
    urgent: { uz: (pct: number) => `Shoshilinch (+${pct}%)`, ru: (pct: number) => `Срочно (+${pct}%)` },
    estimate: { uz: "Taxminiy narx", ru: "Примерная цена" } satisfies Tr,
    fromSuffix: { uz: " dan", ru: " от" } satisfies Tr,
    projectUnit: { uz: "Loyihabay", ru: "За проект" } satisfies Tr,
    disclaimer: {
      uz: "Bu taxminiy hisob. Yakuniy narx loyiha hajmiga qarab mutaxassis bilan kelishiladi va buyurtmada belgilanadi.",
      ru: "Это примерный расчёт. Итоговая цена согласуется со специалистом по объёму проекта и фиксируется в заказе.",
    } satisfies Tr,
  },

  /* --------- Narx kartasi / CTA --------- */
  priceEyebrow: { uz: "Narx", ru: "Цена" } satisfies Tr,
  usdApprox: { uz: " · taxminan", ru: " · примерно" } satisfies Tr,
  usdFrom: { uz: " dan", ru: " от" } satisfies Tr,
  priceNegotiable: { uz: "Narx loyihaga qarab belgilanadi.", ru: "Цена определяется по проекту." } satisfies Tr,
  priceFinalNote: { uz: "Yakuniy narx loyiha hajmiga qarab kelishiladi.", ru: "Итоговая цена согласуется по объёму проекта." } satisfies Tr,
  order: { uz: "Buyurtma berish", ru: "Заказать" } satisfies Tr,
  orderMobile: { uz: "Buyurtma", ru: "Заказать" } satisfies Tr,
  write: { uz: "Yozish", ru: "Написать" } satisfies Tr,
  editProfile: { uz: "Profilni tahrirlash", ru: "Редактировать профиль" } satisfies Tr,
  editShort: { uz: "Tahrirlash", ru: "Редактировать" } satisfies Tr,
  notAccepting: { uz: "Buyurtma qabul qilmaydi", ru: "Не принимает заказы" } satisfies Tr,
  notAcceptingShort: { uz: "Qabul qilmaydi", ru: "Не принимает" } satisfies Tr,
  subInactiveNote: { uz: "Mutaxassis obunasi faol emas.", ru: "Подписка специалиста неактивна." } satisfies Tr,
  vacationNote: {
    uz: (d: string) => `${d}gacha ta'tilda — buyurtmangizni qaytgach ko'rib chiqadi.`,
    ru: (d: string) => `В отпуске до ${d} — рассмотрит ваш заказ после возвращения.`,
  },
  vacationNoteNoDate: { uz: "Hozir ta'tilda — buyurtmangizni qaytgach ko'rib chiqadi.", ru: "Сейчас в отпуске — рассмотрит ваш заказ после возвращения." } satisfies Tr,
  busyNote: { uz: "Hozir band — buyurtmangizni bo'shagach ko'rib chiqadi.", ru: "Сейчас занят — рассмотрит ваш заказ, когда освободится." } satisfies Tr,
  statRating: { uz: "Reyting", ru: "Рейтинг" } satisfies Tr,
  statNew: { uz: "Yangi", ru: "Новый" } satisfies Tr,
  statReviews: { uz: "Sharh", ru: "Отзывы" } satisfies Tr,
  statWorks: { uz: "Ish", ru: "Работы" } satisfies Tr,
  statOrders: { uz: "Buyurtma", ru: "Заказы" } satisfies Tr,

  /* --------- Maxfiylik kartasi (egasi) --------- */
  privacy: { uz: "Maxfiylik", ru: "Приватность" } satisfies Tr,
  hiddenFields: { uz: (n: number) => `${n} ta maydon mehmonlardan yashirin.`, ru: (n: number) => `Полей, скрытых от гостей: ${n}.` },
  allOpen: { uz: "Hamma maydon hammaga ochiq.", ru: "Все поля открыты всем." } satisfies Tr,
  checkAs: { uz: "Boshqalar ko'zi bilan tekshiring:", ru: "Проверьте глазами других:" } satisfies Tr,
  configure: { uz: "Sozlash", ru: "Настроить" } satisfies Tr,

  /* --------- O'xshashlar --------- */
  similarEyebrow: { uz: "Yana ko'ring", ru: "Смотрите также" } satisfies Tr,
  similarTitleStart: { uz: "O'xshash", ru: "Похожие" } satisfies Tr,
  similarTitleAccent: { uz: "mutaxassislar", ru: "специалисты" } satisfies Tr,
  similarDesc: { uz: (cat: string, region: string) => `${cat} va ${region} bo'yicha yaqin profillar.`, ru: (cat: string, region: string) => `Близкие профили: ${cat}, ${region}.` },
  similarDescCatFallback: { uz: "Mutaxassislar", ru: "специалисты" } satisfies Tr,
  similarDescRegionFallback: { uz: "shu hudud", ru: "этот регион" } satisfies Tr,
  seeAll: { uz: "Barchasi", ru: "Все" } satisfies Tr,
  ratingAria: { uz: (r: string) => `Reyting ${r}`, ru: (r: string) => `Рейтинг ${r}` },
  notRatedAria: { uz: "Hali baholanmagan", ru: "Пока без оценок" } satisfies Tr,
  notRatedShort: { uz: "Hali yo'q", ru: "Пока нет" } satisfies Tr,
} as const;
