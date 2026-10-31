/**
 * Kabinet asosiy sahifalari lug'ati: Umumiy (/kabinet), Bildirishnomalar (+ sozlamalar, push, Telegram kartasi),
 * Saqlanganlar, Obunalar. uz matnlar sahifalardagi asl matn bilan AYNAN bir xil.
 */
import type { Locale, Tr } from "../index";
import { localizePrice, ruPlural } from "./catalog";

/* ------------------------------------------------------------------ */
/* Umumiy yordamchilar                                                 */
/* ------------------------------------------------------------------ */

/** utils.greetingFor() natijasini (o'zbekcha) tilga moslaydi */
const GREETING_RU: Record<string, string> = {
  "Xayrli tun": "Доброй ночи",
  "Xayrli tong": "Доброе утро",
  "Xayrli kun": "Добрый день",
  "Xayrli kech": "Добрый вечер",
};
export function greetingLabel(til: Locale, uzGreeting: string): string {
  return til === "ru" ? (GREETING_RU[uzGreeting] ?? uzGreeting) : uzGreeting;
}

/** Buyurtma holati (ORDER_STATUS_LABEL kalitlari bo'yicha) — constants.ts'ga tegilmaydi */
const ORDER_STATUS_RU: Record<string, string> = {
  new: "Новый",
  accepted: "Принят",
  in_progress: "В работе",
  done: "Выполнен",
  cancelled: "Отменён",
};
export function orderStatusLabel(til: Locale, status: string, uzLabel: string): string {
  return til === "ru" ? (ORDER_STATUS_RU[status] ?? uzLabel) : uzLabel;
}

/** Obuna holati (subscriptionState.status bo'yicha) */
export const OBUNA_HOLATI: Record<string, Tr> = {
  trial: { uz: "Sinov", ru: "Пробный период" },
  active: { uz: "Faol", ru: "Активна" },
  grace: { uz: "Imtiyozli muddat", ru: "Льготный период" },
  expired: { uz: "Faol emas", ru: "Неактивна" },
  off: { uz: "Talab qilinmaydi", ru: "Не требуется" },
  exempt: { uz: "Imtiyozli", ru: "Льготная" },
};

/** Bildirishnoma guruhlari (NOTIFY_GROUP_META server-only — ruscha variantlar shu yerda, uz — serverdan kelgani) */
const NOTIFY_GROUP_RU: Record<string, { label: string; hint: string; short: string }> = {
  orders: { label: "Заказы", hint: "Новый заказ, цена, оплата, сдача, отзыв", short: "Заказы" },
  jobs: { label: "Объявления и вакансии", hint: "Предложения, отклики, сохранённые поиски", short: "Объявления" },
  social: { label: "Социальное", hint: "Подписчики, реакции, комментарии, упоминания, посты каналов, эфиры", short: "Социальное" },
  chat: { label: "Сообщения", hint: "Новые сообщения в чате и чате заказа", short: "Сообщения" },
  system: { label: "Система", hint: "Статус подписки, объявления администрации", short: "Система" },
};
/** Guruh yorlig'i/izohi: uz — serverdagi meta, ru — lug'at (topilmasa uz qoladi) */
export function notifyGroupMeta(til: Locale, key: string, uz: { label: string; hint: string }): { label: string; hint: string } {
  if (til !== "ru") return uz;
  const r = NOTIFY_GROUP_RU[key];
  return r ? { label: r.label, hint: r.hint } : uz;
}
/** Filtr chipi uchun qisqa nom: uz — yorliqning birinchi so'zi (avvalgidek), ru — alohida qisqa nom */
export function notifyGroupShort(til: Locale, key: string, uzLabel: string): string {
  if (til === "ru") return NOTIFY_GROUP_RU[key]?.short ?? uzLabel;
  return uzLabel.split(" ")[0];
}

/* ------------------------------------------------------------------ */
/* /kabinet — Umumiy                                                   */
/* ------------------------------------------------------------------ */
export const UMUMIY = {
  hello: { uz: "Salom,", ru: "Привет," } satisfies Tr,
  profileAria: { uz: (pct: number) => `Profil ${pct}% to'ldirilgan`, ru: (pct: number) => `Профиль заполнен на ${pct}%` },

  /* «Bugun» */
  today: { uz: "Bugun", ru: "Сегодня" } satisfies Tr,
  todayEmpty: { uz: "Hammasi tinch — yangi buyurtma, muddat yoki xabar yo'q.", ru: "Всё спокойно — новых заказов, сроков или сообщений нет." } satisfies Tr,
  newOrder: { uz: "Yangi buyurtma", ru: "Новый заказ" } satisfies Tr,
  overdue: { uz: "muddati o'tgan", ru: "просрочен" } satisfies Tr,
  dueToday: { uz: "bugun", ru: "сегодня" } satisfies Tr,
  live: { uz: (group: string) => `Efir · ${group}`, ru: (group: string) => `Эфир · ${group}` },
  newApplication: { uz: "Vakansiyaga yangi ariza", ru: "Новый отклик на вакансию" } satisfies Tr,
  newProposal: { uz: "E'lonlaringizga yangi taklif", ru: "Новое предложение по вашим объявлениям" } satisfies Tr,
  unreadDm: { uz: "O'qilmagan xabar", ru: "Непрочитанное сообщение" } satisfies Tr,
  unreadNotif: { uz: "O'qilmagan bildirishnoma", ru: "Непрочитанное уведомление" } satisfies Tr,
  contactBuyers: { uz: "Kontaktingizni olganlar", ru: "Купили ваш контакт" } satisfies Tr,
  contactsUnlocked: { uz: "Ochilgan kontaktlar", ru: "Открытые контакты" } satisfies Tr,

  /* Profil yaratish */
  createTitle: { uz: "Mutaxassis profilingizni yarating", ru: "Создайте профиль специалиста" } satisfies Tr,
  createText: { uz: "Yo'nalish, hudud, narx va ko'nikmalar — profil xaritada paydo bo'ladi.", ru: "Направление, регион, цена и навыки — профиль появится на карте." } satisfies Tr,
  createBtn: { uz: "Profilni yaratish", ru: "Создать профиль" } satisfies Tr,

  /* Plitkalar */
  views: { uz: "Profil ko'rishlar", ru: "Просмотры профиля" } satisfies Tr,
  notYet: { uz: "Hali yo'q", ru: "Пока нет" } satisfies Tr,
  rating: { uz: "Reyting", ru: "Рейтинг" } satisfies Tr,
  ratingReviews: { uz: (n: number) => `Reyting · ${n} ta sharh`, ru: (n: number) => `Рейтинг · ${n} ${ruPlural(n, ["отзыв", "отзыва", "отзывов"])}` },
  followers: { uz: "Obunachilar", ru: "Подписчики" } satisfies Tr,
  inProgressDone: { uz: (done: number) => `Jarayonda · ${done} bajarilgan`, ru: (done: number) => `В работе · ${done} выполнено` },
  sentOrders: { uz: "Yuborilgan buyurtmalar", ru: "Отправленные заказы" } satisfies Tr,
  inProgress: { uz: "Jarayonda", ru: "В работе" } satisfies Tr,
  done: { uz: "Bajarilgan", ru: "Выполнено" } satisfies Tr,
  partners: { uz: "Ishlagan mutaxassislar", ru: "Специалисты, с которыми работали" } satisfies Tr,

  /* Profil to'liqligi ro'yxati */
  ck: {
    title: { uz: "Haqiqiy sarlavha", ru: "Настоящий заголовок" } satisfies Tr,
    titleHint: { uz: "Masalan: To'y videografi · Sony FX3", ru: "Например: Свадебный видеограф · Sony FX3" } satisfies Tr,
    bio: { uz: "O'zingiz haqingizda (bio)", ru: "О себе (био)" } satisfies Tr,
    bioHint: { uz: "Kamida 80 ta belgi", ru: "Минимум 80 символов" } satisfies Tr,
    price: { uz: "Narx belgilangan", ru: "Цена указана" } satisfies Tr,
    skills: { uz: "Kamida 3 ta ko'nikma", ru: "Минимум 3 навыка" } satisfies Tr,
    photo: { uz: "Muqova yoki avatar rasmi", ru: "Обложка или аватар" } satisfies Tr,
    portfolio: { uz: "Portfolioda kamida 3 ta ish", ru: "Минимум 3 работы в портфолио" } satisfies Tr,
    portfolioHint: { uz: (n: number) => `Hozir: ${n} ta`, ru: (n: number) => `Сейчас: ${n}` },
    schedule: { uz: "Ish vaqti kiritilgan", ru: "Указан график работы" } satisfies Tr,
    contact: { uz: "Aloqa: Telegram yoki Instagram", ru: "Контакт: Telegram или Instagram" } satisfies Tr,
  },
  fillProfile: { uz: "Profilni to'ldiring", ru: "Заполните профиль" } satisfies Tr,
  almostThere: { uz: "Yana ozgina qoldi", ru: "Осталось совсем немного" } satisfies Tr,
  progress: {
    uz: (done: number, total: number, verified: boolean) => `${done}/${total} bajarildi · ${verified ? "tasdiqlangan" : "tasdiq kutilmoqda"}`,
    ru: (done: number, total: number, verified: boolean) => `${done}/${total} выполнено · ${verified ? "подтверждён" : "ожидает подтверждения"}`,
  },

  /* So'nggi buyurtmalar */
  recent: { uz: "So'nggi buyurtmalar", ru: "Последние заказы" } satisfies Tr,
  recentSub: { uz: (active: number, done: number) => `${active} ta jarayonda · ${done} ta bajarilgan`, ru: (active: number, done: number) => `${active} в работе · ${done} выполнено` },
  recentEmptySub: { uz: "Hozircha bo'sh", ru: "Пока пусто" } satisfies Tr,
  all: { uz: "Barchasi", ru: "Все" } satisfies Tr,
  noIncoming: { uz: "Hali buyurtmalar kelmagan", ru: "Заказов пока не было" } satisfies Tr,
  noOutgoing: { uz: "Hali buyurtma bermagansiz", ru: "Вы ещё не делали заказов" } satisfies Tr,
  noIncomingText: { uz: "Profil va portfolioni to'ldiring — mijozlar sizni tezroq topadi.", ru: "Заполните профиль и портфолио — клиенты найдут вас быстрее." } satisfies Tr,
  noOutgoingText: { uz: "Xaritadan mutaxassis tanlang va loyihangizni yuboring.", ru: "Выберите специалиста на карте и отправьте свой проект." } satisfies Tr,
  openMap: { uz: "Xaritani ochish", ru: "Открыть карту" } satisfies Tr,
  clientPrefix: { uz: "Mijoz: ", ru: "Клиент: " } satisfies Tr,
  specialistPrefix: { uz: "Mutaxassis: ", ru: "Специалист: " } satisfies Tr,
  /** " · byudjet 1,5 mln so'm" — narx tayyor formatlangan holda keladi */
  budget: { uz: (price: string) => ` · byudjet ${price}`, ru: (price: string) => ` · бюджет ${localizePrice("ru", price)}` },
  /** " · 1,5 mln so'm" — summa */
  amount: { uz: (price: string) => ` · ${price}`, ru: (price: string) => ` · ${localizePrice("ru", price)}` },

  /* Profil kartasi */
  profile: { uz: "Profil", ru: "Профиль" } satisfies Tr,
  paused: { uz: "Pauzada", ru: "На паузе" } satisfies Tr,
  vacation: { uz: "Ta'tilda", ru: "В отпуске" } satisfies Tr,
  available: { uz: "Bo'sh", ru: "Свободен" } satisfies Tr,
  busy: { uz: "Band", ru: "Занят" } satisfies Tr,

  /* Bo'limlar ro'yxati */
  subscription: { uz: "Obuna", ru: "Подписка" } satisfies Tr,
  subDays: { uz: (label: string, days: number) => `${label} · ${days} kun`, ru: (label: string, days: number) => `${label} · ${days} ${ruPlural(days, ["день", "дня", "дней"])}` },
  proposals: { uz: "Takliflar", ru: "Предложения" } satisfies Tr,
  proposalsValue: {
    uz: (today: number, limit: number, pending: number) => `${today}/${limit} bugun · ${pending} kutilmoqda`,
    ru: (today: number, limit: number, pending: number) => `${today}/${limit} сегодня · ${pending} в ожидании`,
  },
  myJobs: { uz: "E'lonlarim", ru: "Мои объявления" } satisfies Tr,
  openJobs: { uz: (n: number) => `${n} ochiq`, ru: (n: number) => `${n} ${ruPlural(n, ["открытое", "открытых", "открытых"])}` },
  favorites: { uz: "Sevimlilar", ru: "Избранное" } satisfies Tr,
  pickSpecialist: { uz: "Mutaxassis tanlang", ru: "Выберите специалиста" } satisfies Tr,
  myPosts: { uz: "Postlarim", ru: "Мои посты" } satisfies Tr,
  savedPosts: { uz: "Saqlangan postlar", ru: "Сохранённые посты" } satisfies Tr,

  /* Mijoz uchun maslahat */
  creatorQ: { uz: "Siz ijodkormisiz?", ru: "Вы творческий специалист?" } satisfies Tr,
  creatorText: { uz: "Portfolio joylang, narx belgilang — buyurtmalar kabinetingizga keladi.", ru: "Разместите портфолио, укажите цену — заказы будут приходить в ваш кабинет." } satisfies Tr,
  becomeSpecialist: { uz: "Mutaxassis bo'lish", ru: "Стать специалистом" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* /kabinet/bildirishnomalar                                           */
/* ------------------------------------------------------------------ */
export const BILDIRISHNOMA = {
  cabinet: { uz: "Kabinet", ru: "Кабинет" } satisfies Tr,
  title: { uz: "Bildirishnomalar", ru: "Уведомления" } satisfies Tr,
  description: { uz: "Buyurtma, xabar, obuna va hisob yangiliklari bir joyda.", ru: "Заказы, сообщения, подписки и новости аккаунта в одном месте." } satisfies Tr,
  all: { uz: "Hammasi", ru: "Все" } satisfies Tr,
  unread: { uz: "O'qilmagan", ru: "Непрочитанные" } satisfies Tr,
  filterAria: { uz: "Saralash", ru: "Фильтр" } satisfies Tr,
  emptyUnread: { uz: "O'qilmagan bildirishnoma yo'q", ru: "Непрочитанных уведомлений нет" } satisfies Tr,
  emptyGroup: { uz: (label: string) => `«${label}» bo'yicha bildirishnoma yo'q`, ru: (label: string) => `Нет уведомлений в разделе «${label}»` },
  emptyAll: { uz: "Hali bildirishnoma yo'q", ru: "Уведомлений пока нет" } satisfies Tr,
  emptyUnreadText: { uz: "Hammasi ko'rib chiqilgan.", ru: "Всё просмотрено." } satisfies Tr,
  emptyAllText: { uz: "Yangi hodisalar shu yerda jamlanadi.", ru: "Новые события будут собираться здесь." } satisfies Tr,
  showAll: { uz: "Barchasini ko'rish", ru: "Показать все" } satisfies Tr,

  /* NotificationPrefs */
  prefs: {
    digestOff: { uz: "O'chiq", ru: "Выкл." } satisfies Tr,
    digestDaily: { uz: "Kunlik", ru: "Ежедневно" } satisfies Tr,
    digestWeekly: { uz: "Haftalik", ru: "Еженедельно" } satisfies Tr,
    notSaved: { uz: "Saqlanmadi", ru: "Не сохранилось" } satisfies Tr,
    settings: { uz: "Sozlamalar", ru: "Настройки" } satisfies Tr,
    allOn: { uz: "Hamma guruh yoqilgan", ru: "Все группы включены" } satisfies Tr,
    offCount: { uz: (n: number) => `${n} ta guruh o'chirilgan`, ru: (n: number) => `${n} ${ruPlural(n, ["группа отключена", "группы отключены", "групп отключено"])}` },
    emailOn: { uz: "email yoqilgan", ru: "email включён" } satisfies Tr,
    emailOff: { uz: "email o'chiq", ru: "email выключен" } satisfies Tr,
    digestDailySummary: { uz: "kunlik jamlama", ru: "ежедневная сводка" } satisfies Tr,
    digestWeeklySummary: { uz: "haftalik jamlama", ru: "еженедельная сводка" } satisfies Tr,
    email: { uz: "Email orqali ham", ru: "Также по email" } satisfies Tr,
    emailHint: {
      uz: "Muhim hodisalar (buyurtma, to'lov, taklif, xabar) emailga ham keladi. Xavfsizlik xatlari doim yuboriladi.",
      ru: "Важные события (заказ, оплата, предложение, сообщение) приходят и на email. Письма о безопасности отправляются всегда.",
    } satisfies Tr,
    digest: { uz: "Jamlama xabarnoma", ru: "Сводка уведомлений" } satisfies Tr,
    digestHint: {
      uz: "Obunachilar, reaksiya, izoh, ko'rish va o'qilmagan xabarlar — bitta qisqa xabarda (Telegram, email va saytda). Yangilik bo'lmasa yuborilmaydi.",
      ru: "Подписчики, реакции, комментарии, просмотры и непрочитанные сообщения — одним коротким сообщением (Telegram, email и на сайте). Если новостей нет, сводка не отправляется.",
    } satisfies Tr,
    footer: {
      uz: "Hisob xavfsizligi, nizo va pul qaytarish xabarlari sozlamadan qat'i nazar keladi.",
      ru: "Сообщения о безопасности аккаунта, спорах и возвратах приходят независимо от настроек.",
    } satisfies Tr,
  },

  /* PushPanel */
  push: {
    blocked: { uz: "Brauzer bildirishnomani bloklagan — sayt sozlamalaridan ruxsat bering", ru: "Браузер заблокировал уведомления — разрешите их в настройках сайта" } satisfies Tr,
    denied: { uz: "Ruxsat berilmadi", ru: "Разрешение не получено" } satisfies Tr,
    notSaved: { uz: "Saqlanmadi", ru: "Не сохранилось" } satisfies Tr,
    enabled: { uz: "Bildirishnomalar yoqildi", ru: "Уведомления включены" } satisfies Tr,
    enableFailed: { uz: "Yoqilmadi", ru: "Не удалось включить" } satisfies Tr,
    disabled: { uz: "Bu qurilmada o'chirildi", ru: "Отключено на этом устройстве" } satisfies Tr,
    disableFailed: { uz: "O'chirilmadi", ru: "Не удалось отключить" } satisfies Tr,
    sendFailed: { uz: "Yuborilmadi", ru: "Не отправлено" } satisfies Tr,
    sentTo: { uz: (n: number) => `${n} qurilmaga yuborildi`, ru: (n: number) => `Отправлено на ${n} ${ruPlural(n, ["устройство", "устройства", "устройств"])}` },
    noDevices: { uz: "Faol qurilma topilmadi", ru: "Активных устройств не найдено" } satisfies Tr,
    title: { uz: "Brauzer bildirishnomalari", ru: "Браузерные уведомления" } satisfies Tr,
    description: { uz: "Sayt yopiq bo'lsa ham xabar, buyurtma va efir haqida darhol xabar beradi.", ru: "Сообщает о сообщениях, заказах и эфирах, даже когда сайт закрыт." } satisfies Tr,
    devices: { uz: (n: number) => `${n} qurilma`, ru: (n: number) => `${n} ${ruPlural(n, ["устройство", "устройства", "устройств"])}` },
    unsupported: {
      uz: "Bu brauzer push bildirishnomani qo'llab-quvvatlamaydi. iPhone'da saytni «Asosiy ekranga qo'shish» orqali ilova sifatida o'rnatsangiz ishlaydi.",
      ru: "Этот браузер не поддерживает push-уведомления. На iPhone добавьте сайт на главный экран как приложение — тогда они заработают.",
    } satisfies Tr,
    disableHere: { uz: "Bu qurilmada o'chirish", ru: "Отключить на этом устройстве" } satisfies Tr,
    enableHere: { uz: "Shu qurilmada yoqish", ru: "Включить на этом устройстве" } satisfies Tr,
    test: { uz: "Sinov xabari", ru: "Тестовое сообщение" } satisfies Tr,
  },

  /* TelegramCard */
  tg: {
    linked: { uz: "Telegram ulandi", ru: "Telegram подключён" } satisfies Tr,
    networkRetry: { uz: "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.", ru: "Ошибка сети. Проверьте интернет и попробуйте снова." } satisfies Tr,
    notYet: { uz: "Hali ulanmagan — botda «Start» tugmasini bosing", ru: "Ещё не подключено — нажмите «Start» в боте" } satisfies Tr,
    checkFailed: { uz: "Tekshirib bo'lmadi", ru: "Не удалось проверить" } satisfies Tr,
    unlinked: { uz: "Telegram uzildi", ru: "Telegram отключён" } satisfies Tr,
    testSent: { uz: "Sinov xabari yuborildi — Telegramni tekshiring", ru: "Тестовое сообщение отправлено — проверьте Telegram" } satisfies Tr,
    networkShort: { uz: "Tarmoq xatosi. Qayta urinib ko'ring.", ru: "Ошибка сети. Попробуйте снова." } satisfies Tr,
    aria: { uz: "Telegram bildirishnomalari", ru: "Уведомления Telegram" } satisfies Tr,
    badge: { uz: "Ulangan", ru: "Подключён" } satisfies Tr,
    linkedText: { uz: "Buyurtma, to'lov, takliflar va xabarlar botga ham keladi. Uzish — tugma yoki botda /stop.", ru: "Заказы, оплата, предложения и сообщения приходят и в бот. Отключить — кнопкой или командой /stop в боте." } satisfies Tr,
    unlinkedText: { uz: "Hisobni botga ulang — muhim xabarlar Telegramga darhol keladi.", ru: "Подключите аккаунт к боту — важные сообщения сразу придут в Telegram." } satisfies Tr,
    featOrders: { uz: "📦 buyurtmani botda qabul qilish", ru: "📦 приём заказа в боте" } satisfies Tr,
    featApp: { uz: "📱 Telegram ichidagi ilova", ru: "📱 приложение внутри Telegram" } satisfies Tr,
    featSearch: { uz: "🔎 ijodkor qidiruvi", ru: "🔎 поиск специалистов" } satisfies Tr,
    featSettings: { uz: "🔔 /sozlamalar", ru: "🔔 /sozlamalar" } satisfies Tr,
    featPost: { uz: "📸 rasm/video yuborib post joylash", ru: "📸 пост из фото/видео прямо в боте" } satisfies Tr,
    featContacts: { uz: "🔓 /kontaktlarim — ochilgan kontaktlar", ru: "🔓 /kontaktlarim — открытые контакты" } satisfies Tr,
    featInline: { uz: "@bot so'z — istalgan chatda ijodkor kartasi", ru: "@bot слово — карточка специалиста в любом чате" } satisfies Tr,
    test: { uz: "Sinov xabari", ru: "Тестовое сообщение" } satisfies Tr,
    openBot: { uz: "Botni ochish", ru: "Открыть бота" } satisfies Tr,
    unlink: { uz: "Uzish", ru: "Отключить" } satisfies Tr,
    connect: { uz: "Telegramga ulash", ru: "Подключить Telegram" } satisfies Tr,
    check: { uz: "Tekshirish", ru: "Проверить" } satisfies Tr,
    waiting: {
      uz: "Botda «Start» bosilishini kutyapmiz — ulangach bu karta o'zi yangilanadi. Havola 15 daqiqa amal qiladi.",
      ru: "Ждём нажатия «Start» в боте — после подключения карточка обновится сама. Ссылка действует 15 минут.",
    } satisfies Tr,
  },
};

/* ------------------------------------------------------------------ */
/* /kabinet/saqlanganlar                                               */
/* ------------------------------------------------------------------ */
export const SAQLANGANLAR = {
  cabinet: { uz: "Kabinet", ru: "Кабинет" } satisfies Tr,
  titleStart: { uz: "Saqlangan", ru: "Сохранённые" } satisfies Tr,
  titleAccent: { uz: "postlar", ru: "посты" } satisfies Tr,
  description: { uz: "Lentada belgilab qo'ygan postlaringiz — faqat sizga ko'rinadi.", ru: "Посты, которые вы отметили в ленте, — видны только вам." } satisfies Tr,
  navAria: { uz: "Saqlanganlar turi", ru: "Тип сохранённого" } satisfies Tr,
  posts: { uz: "Postlar", ru: "Посты" } satisfies Tr,
  courses: { uz: "Kurslar", ru: "Курсы" } satisfies Tr,
  noCourses: { uz: "Hali saqlangan kurs yo'q", ru: "Сохранённых курсов пока нет" } satisfies Tr,
  noCoursesText: { uz: "Kurs sahifasidagi belgi tugmasini bosing — keyinroq shu yerdan topasiz.", ru: "Нажмите кнопку закладки на странице курса — потом найдёте его здесь." } satisfies Tr,
  noPosts: { uz: "Hali saqlangan post yo'q — lentada postning belgi tugmasini bosing", ru: "Сохранённых постов пока нет — нажмите кнопку закладки у поста в ленте" } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* /kabinet/obunalar                                                   */
/* ------------------------------------------------------------------ */
export const OBUNALAR = {
  cabinet: { uz: "Kabinet", ru: "Кабинет" } satisfies Tr,
  titleStart: { uz: "Obunachilar va", ru: "Подписчики и" } satisfies Tr,
  titleAccent: { uz: "obunalar", ru: "подписки" } satisfies Tr,
  description: {
    uz: (followers: number, following: number) => `${followers} ta obunachi · ${following} ta obuna. Obuna bo'lganlaringiz postlari bosh sahifadagi «Obunalarim»da.`,
    ru: (followers: number, following: number) =>
      `${followers} ${ruPlural(followers, ["подписчик", "подписчика", "подписчиков"])} · ${following} ${ruPlural(following, ["подписка", "подписки", "подписок"])}. Посты тех, на кого вы подписаны, — на главной во вкладке «Подписки».`,
  },
};
