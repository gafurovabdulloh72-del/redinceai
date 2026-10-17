/**
 * Sayt qobig'i lug'ati: navbar, footer, til almashtirgich, bildirishnoma qo'ng'irog'i,
 * 404 va xatolik sahifalari. Har kalit { uz, ru }; parametrli satrlar — funksiya juftligi.
 */

export const SHELL = {
  /** Root layout'dagi "o'tish havolasi" (a11y) */
  skipToContent: { uz: "Asosiy kontentga o'tish", ru: "Перейти к основному содержимому" },

  /** Til almashtirgich: tugma bosilsa qarama-qarshi tilga o'tiladi */
  locale: {
    switchTo: { uz: "Tilni almashtirish — Русский", ru: "Сменить язык — oʻzbekcha" },
  },

  nav: {
    home: { uz: "Bosh sahifa", ru: "Главная" },
    homeShort: { uz: "Asosiy", ru: "Главная" },
    map: { uz: "Xarita", ru: "Карта" },
    lenta: { uz: "Lenta", ru: "Лента" },
    /* "Специалисты" yuqori panelga sig'maydi (logo ikki qatorga tushadi) — ikkala joyda ham ixcham "Профи" */
    specialists: { uz: "Ijodkorlar", ru: "Профи" },
    specialistsShort: { uz: "Ijodkorlar", ru: "Профи" },
    jobs: { uz: "Ishlar", ru: "Заказы" },
    prices: { uz: "Narxlar", ru: "Тарифы" },
    about: { uz: "Haqida", ru: "О нас" },
    groups: { uz: "Jamoalar", ru: "Сообщества" },
    vacancies: { uz: "Vakansiyalar", ru: "Вакансии" },
    cabinet: { uz: "Kabinet", ru: "Кабинет" },
    login: { uz: "Kirish", ru: "Войти" },
    loginShort: { uz: "Kirish", ru: "Вход" },
    start: { uz: "Boshlash", ru: "Начать" },
    mainAria: { uz: "Asosiy navigatsiya", ru: "Основная навигация" },
    mobileAria: { uz: "Mobil navigatsiya", ru: "Мобильная навигация" },
  },

  /** Hisob (avatar) menyusi */
  menu: {
    groups: { uz: "Jamoalarim", ru: "Мои сообщества" },
    vacancies: { uz: "Vakansiyalar", ru: "Вакансии" },
    aria: { uz: (name: string) => `Hisob menyusi: ${name}`, ru: (name: string) => `Меню аккаунта: ${name}` },
    roleAdmin: { uz: "Administrator", ru: "Администратор" },
    roleSpecialist: { uz: "Mutaxassis", ru: "Специалист" },
    roleClient: { uz: "Mijoz", ru: "Клиент" },
    cabinet: { uz: "Kabinet", ru: "Кабинет" },
    myProfile: { uz: "Mening profilim", ru: "Мой профиль" },
    subscription: { uz: "Obuna", ru: "Подписка" },
    notifications: { uz: "Bildirishnomalar", ru: "Уведомления" },
    favorites: { uz: "Sevimlilar", ru: "Избранное" },
    profile: { uz: "Profil", ru: "Профиль" },
    admin: { uz: "Admin panel", ru: "Админ-панель" },
    logout: { uz: "Chiqish", ru: "Выйти" },
  },

  /** Bildirishnoma qo'ng'irog'i (yuqori panel) */
  bell: {
    label: { uz: "Bildirishnomalar", ru: "Уведомления" },
    labelUnread: { uz: (n: number) => `Bildirishnomalar: ${n} ta yangi`, ru: (n: number) => `Уведомления: ${n} новых` },
    newCount: { uz: (n: number) => `${n} yangi`, ru: (n: number) => `${n} новых` },
    newSr: { uz: " (yangi)", ru: " (новое)" },
    loading: { uz: "Yuklanmoqda", ru: "Загрузка" },
    loadFailed: { uz: "Yuklab bo'lmadi", ru: "Не удалось загрузить" },
    retry: { uz: "Qayta urinish", ru: "Повторить" },
    emptyTitle: { uz: "Yangi bildirishnoma yo'q", ru: "Новых уведомлений нет" },
    emptyText: { uz: "Buyurtma va to'lov yangiliklari shu yerda chiqadi.", ru: "Новости о заказах и платежах будут появляться здесь." },
    markAll: { uz: "Hammasini o'qilgan deb belgilash", ru: "Отметить всё прочитанным" },
    all: { uz: "Barchasi", ru: "Все" },
  },

  footer: {
    tagline: {
      uz: "O'zbekistonning ijodiy mutaxassislar xaritasi. Videograf, montajor, dizayner — 14 ta hudud, bitta xarita.",
      ru: "Карта творческих специалистов Узбекистана. Видеографы, монтажёры, дизайнеры — 14 регионов, одна карта.",
    },
    linksAria: { uz: "Footer havolalari", ru: "Ссылки в подвале сайта" },
    map: { uz: "Xarita", ru: "Карта" },
    specialists: { uz: "Mutaxassislar", ru: "Специалисты" },
    orderWizard: { uz: "Buyurtma sehrgari", ru: "Создать заказ" },
    jobs: { uz: "Ishlar", ru: "Заказы" },
    prices: { uz: "Narxlar", ru: "Тарифы" },
    help: { uz: "Yordam", ru: "Помощь" },
    about: { uz: "Biz haqimizda", ru: "О нас" },
    groups: { uz: "Jamoalar", ru: "Сообщества" },
    vacancies: { uz: "Vakansiyalar", ru: "Вакансии" },
    becomeSpecialist: { uz: "Mutaxassis bo'lish", ru: "Стать специалистом" },
    terms: { uz: "Foydalanish shartlari", ru: "Условия использования" },
    privacy: { uz: "Maxfiylik siyosati", ru: "Политика конфиденциальности" },
    socialAria: { uz: "Ijtimoiy tarmoqlar", ru: "Социальные сети" },
    newWindow: { uz: (name: string) => `${name} (yangi oynada)`, ru: (name: string) => `${name} (в новом окне)` },
    rights: { uz: "Barcha huquqlar himoyalangan.", ru: "Все права защищены." },
    owner: { uz: (name: string) => `Loyiha rahbari — ${name}`, ru: (name: string) => `Руководитель проекта — ${name}` },
    mapBorders: { uz: "Xarita chegaralari —", ru: "Границы на карте —" },
  },

  notFound: {
    eyebrow: { uz: "Xato 404", ru: "Ошибка 404" },
    title: { uz: "Sahifa topilmadi", ru: "Страница не найдена" },
    text: {
      uz: "Bu manzil ko'chib ketgan yoki umuman bo'lmagan. Yo'qolib qolmang — ijodkorlar xaritada, bir bosishda.",
      ru: "Этот адрес переехал или никогда не существовал. Не теряйтесь — все специалисты на карте, в один клик.",
    },
    searchLabel: { uz: "Mutaxassis qidirish", ru: "Поиск специалиста" },
    searchPlaceholder: { uz: "Ism yoki ko'nikma…", ru: "Имя или навык…" },
    searchBtn: { uz: "Qidirish", ru: "Найти" },
    homeBtn: { uz: "Bosh sahifaga", ru: "На главную" },
    openMap: { uz: "Xaritani ochish", ru: "Открыть карту" },
    specialistsList: { uz: "Mutaxassislar ro'yxati", ru: "Список специалистов" },
    helpCenter: { uz: "Yordam markazi", ru: "Центр помощи" },
    cabinet: { uz: "Kabinet", ru: "Кабинет" },
  },

  error: {
    eyebrow: { uz: "Xatolik", ru: "Ошибка" },
    titleA: { uz: "Nimadir ", ru: "Что-то пошло " },
    titleAccent: { uz: "xato", ru: "не так" },
    titleB: { uz: " ketdi", ru: "" },
    text: {
      uz: "Sahifani yuklab bo'lmadi. Bu vaqtinchalik bo'lishi mumkin — qayta urinib ko'ring yoki bosh sahifaga qayting.",
      ru: "Не удалось загрузить страницу. Возможно, это временный сбой — попробуйте ещё раз или вернитесь на главную.",
    },
    code: { uz: "Kod", ru: "Код" },
    retry: { uz: "Qayta urinish", ru: "Повторить" },
    homeBtn: { uz: "Bosh sahifaga", ru: "На главную" },
    specialistsList: { uz: "Mutaxassislar ro'yxati", ru: "Список специалистов" },
    interactiveMap: { uz: "Interaktiv xarita", ru: "Интерактивная карта" },
  },
} as const;
