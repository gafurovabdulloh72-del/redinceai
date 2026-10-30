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

  /** Umumiy qobiq matnlari: yopish, orqaga, yuqoriga, yuklanmoqda */
  common: {
    close: { uz: "Yopish", ru: "Закрыть" },
    back: { uz: "Orqaga", ru: "Назад" },
    toTop: { uz: "Sahifa boshiga qaytish", ru: "Наверх страницы" },
    loading: { uz: "Yuklanmoqda", ru: "Загрузка" },
    newWindow: { uz: " (yangi oynada)", ru: " (в новом окне)" },
    logoAria: { uz: "Kasb Egalari — bosh sahifa", ru: "Kasb Egalari — главная" },
    shareTelegram: { uz: "Telegram orqali ulashish", ru: "Поделиться в Telegram" },
    confirm: { uz: "Tasdiqlash", ru: "Подтвердить" },
    cancel: { uz: "Bekor qilish", ru: "Отмена" },
    delete: { uz: "O'chirish", ru: "Удалить" },
    areYouSure: { uz: "Ishonchingiz komilmi?", ru: "Вы уверены?" },
  },

  /** Ko'rinish paneli: tema (avto/yorug'/qorong'u), shrift o'lchami, harakat */
  appearance: {
    title: { uz: "Ko'rinish", ru: "Вид" },
    theme: { uz: "Tema", ru: "Тема" },
    themeAuto: { uz: "Avto", ru: "Авто" },
    themeLight: { uz: "Yorug'", ru: "Светлая" },
    themeDark: { uz: "Qorong'u", ru: "Тёмная" },
    themeToggle: { uz: "Tema: avto / yorug' / qorong'u", ru: "Тема: авто / светлая / тёмная" },
    fontSize: { uz: "Shrift", ru: "Шрифт" },
    fontS: { uz: "Kichik", ru: "Мелкий" },
    fontM: { uz: "O'rta", ru: "Средний" },
    fontL: { uz: "Katta", ru: "Крупный" },
    reduceMotion: { uz: "Harakatni kamaytirish", ru: "Меньше анимации" },
    reduceMotionHint: { uz: "Animatsiyalar va o'tishlar o'chadi", ru: "Анимации и переходы отключаются" },
    dataSaver: { uz: "Ma'lumot tejash", ru: "Экономия трафика" },
    dataSaverHint: { uz: "Lentada video o'zi o'ynamaydi, rasm va video oldindan yuklanmaydi, yuklanadigan rasmlar kichikroq", ru: "Видео в ленте не автовоспроизводится, медиа не подгружается заранее, загружаемые фото меньше" },
  },

  /** Tarmoq banneri */
  network: {
    offline: { uz: "Internet yo'q — ba'zi amallar vaqtincha ishlamaydi", ru: "Нет интернета — некоторые действия временно недоступны" },
    online: { uz: "Aloqa tiklandi", ru: "Соединение восстановлено" },
  },

  /** SW yangilanishi */
  update: {
    available: { uz: "Saytning yangi versiyasi tayyor", ru: "Доступна новая версия сайта" },
    reload: { uz: "Yangilash", ru: "Обновить" },
  },

  /** Klaviatura qisqartmalari oynasi */
  shortcuts: {
    title: { uz: "Klaviatura qisqartmalari", ru: "Горячие клавиши" },
    hint: { uz: "Matn maydonidan tashqarida ishlaydi. «g» dan keyin bir soniya ichida ikkinchi tugma bosiladi.", ru: "Работают вне текстовых полей. После «g» вторую клавишу нужно нажать в течение секунды." },
    search: { uz: "Qidiruv", ru: "Поиск" },
    create: { uz: "Yaratish menyusi", ru: "Меню создания" },
    help: { uz: "Shu oyna", ru: "Это окно" },
    goHome: { uz: "Bosh sahifa", ru: "Главная" },
    goSearch: { uz: "Qidiruv sahifasi", ru: "Страница поиска" },
    goLenta: { uz: "Lenta", ru: "Лента" },
    goGroups: { uz: "Jamoalar", ru: "Сообщества" },
    goMap: { uz: "Xarita", ru: "Карта" },
    goMessages: { uz: "Xabarlar", ru: "Сообщения" },
    goNotifications: { uz: "Bildirishnomalar", ru: "Уведомления" },
    goCabinet: { uz: "Kabinet", ru: "Кабинет" },
    escape: { uz: "Yopish / bekor qilish", ru: "Закрыть / отменить" },
    sectionGo: { uz: "O'tish", ru: "Переход" },
    sectionActions: { uz: "Amallar", ru: "Действия" },
  },

  nav: {
    home: { uz: "Asosiy", ru: "Главная" },
    homeShort: { uz: "Asosiy", ru: "Главная" },
    map: { uz: "Xarita", ru: "Карта" },
    lenta: { uz: "Reels", ru: "Reels" },
    top: { uz: "TOP reyting", ru: "ТОП рейтинг" },
    /* "Специалисты" yuqori panelga sig'maydi (logo ikki qatorga tushadi) — ikkala joyda ham ixcham "Профи" */
    specialists: { uz: "Mutaxassislar", ru: "Профи" },
    specialistsShort: { uz: "Mutaxassislar", ru: "Профи" },
    jobs: { uz: "Ishlar", ru: "Заказы" },
    prices: { uz: "Narxlar", ru: "Тарифы" },
    about: { uz: "Haqida", ru: "О нас" },
    groups: { uz: "Hamjamiyat", ru: "Сообщества" },
    vacancies: { uz: "Vakansiyalar", ru: "Вакансии" },
    mentorship: { uz: "Mentorlik", ru: "Менторство" },
    cabinet: { uz: "Kabinet", ru: "Кабинет" },
    login: { uz: "Kirish", ru: "Войти" },
    loginShort: { uz: "Kirish", ru: "Вход" },
    start: { uz: "Boshlash", ru: "Начать" },
    search: { uz: "Qidiruv", ru: "Поиск" },
    messages: { uz: "Xabarlar", ru: "Сообщения" },
    create: { uz: "Yaratish", ru: "Создать" },
    more: { uz: "Yana", ru: "Ещё" },
    profile: { uz: "Profil", ru: "Профиль" },
    mainAria: { uz: "Asosiy navigatsiya", ru: "Основная навигация" },
    mobileAria: { uz: "Mobil navigatsiya", ru: "Мобильная навигация" },
  },

  /** "Yaratish" menyusi (yon panel va mobil tab-bar) */
  create: {
    post: { uz: "Post joylash", ru: "Опубликовать пост" },
    postHint: { uz: "Matn, rasm yoki video — profil lentangizga", ru: "Текст, фото или видео — в ленту профиля" },
    postNeedsProfile: { uz: "Avval ijodkor profilini yarating", ru: "Сначала создайте профиль автора" },
    group: { uz: "Guruh yoki kanal ochish", ru: "Создать сообщество или канал" },
    groupHint: { uz: "Hamjamiyat, muhokama, efirlar", ru: "Сообщество, обсуждения, эфиры" },
    vacancy: { uz: "Vakansiya joylash", ru: "Разместить вакансию" },
    vacancyHint: { uz: "Bepul, 2 daqiqa", ru: "Бесплатно, 2 минуты" },
    job: { uz: "E'lon berish", ru: "Разместить заказ" },
    jobHint: { uz: "Loyiha uchun ijodkor topish", ru: "Найти исполнителя для проекта" },
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
    saved: { uz: "Saqlanganlar", ru: "Сохранённое" },
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
      uz: "Ijodkorlar va onlayn kasblar platformasi: katalog va xarita, xavfsiz buyurtma, jamoalar va kanallar, vakansiyalar — 14 ta hudud, bitta tizim.",
      ru: "Платформа творческих и онлайн-профессий: каталог и карта, безопасный заказ, сообщества и каналы, вакансии — 14 регионов, одна система.",
    },
    linksAria: { uz: "Footer havolalari", ru: "Ссылки в подвале сайта" },
    map: { uz: "Xarita", ru: "Карта" },
    specialists: { uz: "Mutaxassislar", ru: "Специалисты" },
    orderWizard: { uz: "Buyurtma sehrgari", ru: "Создать заказ" },
    jobs: { uz: "Ishlar", ru: "Заказы" },
    prices: { uz: "Narxlar", ru: "Тарифы" },
    help: { uz: "Yordam", ru: "Помощь" },
    about: { uz: "Biz haqimizda", ru: "О нас" },
    groups: { uz: "Hamjamiyat", ru: "Сообщества" },
    vacancies: { uz: "Vakansiyalar", ru: "Вакансии" },
    search: { uz: "Qidiruv", ru: "Поиск" },
    becomeSpecialist: { uz: "Mutaxassis bo'lish", ru: "Стать специалистом" },
    terms: { uz: "Foydalanish shartlari", ru: "Условия использования" },
    privacy: { uz: "Maxfiylik siyosati", ru: "Политика конфиденциальности" },
    socialAria: { uz: "Ijtimoiy tarmoqlar", ru: "Социальные сети" },
    byCraft: { uz: "Yo'nalish bo'yicha", ru: "По направлению" },
    byCity: { uz: "Shahar bo'yicha", ru: "По городу" },
    craftsAria: { uz: "Yo'nalish sahifalari", ru: "Страницы направлений" },
    inRegion: { uz: (craft: string, region: string) => `${region}da ${craft}`, ru: (craft: string, region: string) => `${craft} — ${region}` },
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
