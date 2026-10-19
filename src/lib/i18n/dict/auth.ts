/**
 * Auth lug'ati: kirish/ro'yxatdan o'tish formasi, 2FA bosqichi, parol tiklash,
 * parol maydoni/kuch ko'rsatkichi va auth layout'dagi brend paneli.
 * Server (API) xato xabarlari o'zbekcha qoladi — bu yerda faqat klient UI matnlari.
 */

export const AUTH = {
  /* ---------- Brend paneli (auth/layout.tsx) ---------- */
  panel: {
    eyebrow: { uz: "Ijodkorlar va onlayn kasblar platformasi", ru: "Платформа творческих и онлайн-профессий" },
    titleA: { uz: "Ish, buyurtma va hamjamiyat — ", ru: "Работа, заказы и сообщество — " },
    titleAccent: { uz: "bir joyda", ru: "в одном месте" },
    lead: {
      uz: "Videograf, dizayner, dasturchi, marketolog — buyurtma oling yoki bering, vakansiya toping, kanallar va jamoalarda muloqot qiling. Bepul.",
      ru: "Видеограф, дизайнер, разработчик, маркетолог — получайте или размещайте заказы, находите вакансии, общайтесь в каналах и сообществах. Бесплатно.",
    },
    b1Title: { uz: "Xaritadan toping", ru: "Ищите на карте" },
    b1Text: {
      uz: (regions: number) => `${regions} ta hudud — viloyatni bosing, ijodkorlar chiqadi.`,
      ru: (regions: number) => `${regions} регионов — нажмите на область, появятся специалисты.`,
    },
    b2Title: { uz: "Tasdiqlangan profillar", ru: "Подтверждённые профили" },
    b2Text: {
      uz: "Portfolio, narxlar va haqiqiy mijozlar sharhlari ochiq.",
      ru: "Портфолио, цены и настоящие отзывы клиентов — открыто.",
    },
    b3Title: { uz: "Vakansiyalar va jamoalar", ru: "Вакансии и сообщества" },
    b3Text: {
      uz: "Ish o'rinlari, rezyumelar, kanallar, jonli efirlar — to'lovsiz.",
      ru: "Вакансии, резюме, каналы, прямые эфиры — бесплатно.",
    },
    statSpecialists: { uz: "mutaxassis", ru: "специалистов" },
    statRegions: { uz: "hudud", ru: "регионов" },
    statCategories: { uz: "yo'nalish", ru: "направлений" },
    freeSignup: { uz: "Ro'yxatdan o'tish bepul", ru: "Регистрация бесплатна" },
    sectionAria: { uz: "Autentifikatsiya", ru: "Аутентификация" },
  },

  /* ---------- AuthForm: sarlavhalar ---------- */
  form: {
    eyebrowRegister: { uz: "Yangi hisob", ru: "Новый аккаунт" },
    eyebrowLogin: { uz: "Kirish", ru: "Вход" },
    titleRegisterA: { uz: "Hisob ", ru: "Создайте " },
    titleRegisterAccent: { uz: "yarating", ru: "аккаунт" },
    titleLoginA: { uz: "Xush ", ru: "С " },
    titleLoginAccent: { uz: "kelibsiz", ru: "возвращением" },
    leadRegister: {
      uz: "Bir daqiqa — va siz Kasb Egalari platformasidasiz. Profilni keyin xohlagan payt to'ldirasiz.",
      ru: "Одна минута — и вы на платформе Kasb Egalari. Профиль можно заполнить позже в любой момент.",
    },
    leadLogin: {
      uz: "Hisobingizga kiring — kabinet va buyurtmalaringiz sizni kutmoqda.",
      ru: "Войдите в аккаунт — кабинет и ваши заказы уже ждут.",
    },
  },

  /* ---------- Kontekstli xabar (nega kirish so'ralmoqda) ---------- */
  context: {
    verbRegister: { uz: "avval hisob oching", ru: "сначала создайте аккаунт" },
    verbLogin: { uz: "avval kiring", ru: "сначала войдите" },
    expiredTitle: { uz: "Sessiya muddati tugagan", ru: "Сессия истекла" },
    expiredText: {
      uz: "Xavfsizlik uchun qayta kirishingiz kerak. Kirgach, oldingi sahifaga qaytasiz.",
      ru: "В целях безопасности нужно войти заново. После входа вы вернётесь на прежнюю страницу.",
    },
    reviewTitle: { uz: (verb: string) => `Sharh qoldirish uchun ${verb}`, ru: (verb: string) => `Чтобы оставить отзыв, ${verb}` },
    reviewText: {
      uz: "Sharhlar faqat ro'yxatdan o'tgan foydalanuvchilar nomidan yoziladi.",
      ru: "Отзывы публикуются только от имени зарегистрированных пользователей.",
    },
    orderTitle: { uz: (verb: string) => `Buyurtma berish uchun ${verb}`, ru: (verb: string) => `Чтобы оформить заказ, ${verb}` },
    orderText: {
      uz: "Kirganingizdan so'ng buyurtma sahifasiga qaytasiz — yozganlaringiz saqlanadi.",
      ru: "После входа вы вернётесь на страницу заказа — всё написанное сохранится.",
    },
    specialistTitle: { uz: (verb: string) => `Sharh yozish yoki buyurtma berish uchun ${verb}`, ru: (verb: string) => `Чтобы написать отзыв или сделать заказ, ${verb}` },
    specialistText: { uz: "Kirganingizdan so'ng mutaxassis sahifasiga qaytasiz.", ru: "После входа вы вернётесь на страницу специалиста." },
    adminTitle: { uz: "Admin panel uchun kiring", ru: "Войдите в админ-панель" },
    adminText: { uz: "Faqat administrator hisobi bilan ochiladi.", ru: "Доступно только аккаунту администратора." },
    cabinetTitle: { uz: (verb: string) => `Kabinetga o'tish uchun ${verb}`, ru: (verb: string) => `Чтобы открыть кабинет, ${verb}` },
    cabinetText: { uz: "Buyurtmalar, profil va sozlamalar kabinetda.", ru: "Заказы, профиль и настройки — в кабинете." },
  },

  /* ---------- Rol tanlash ---------- */
  role: {
    legend: { uz: "Kim sifatida qo'shilasiz?", ru: "Кем вы присоединяетесь?" },
    /* Maqsad tanlovi (mutaxassis/mijoz o'rniga): to'rtta yo'l — rolga xaritalanadi, keyin o'zgartirish mumkin */
    intentLegend: { uz: "Nima qilmoqchisiz?", ru: "Что вы хотите делать?" },
    intentAria: { uz: "Maqsad", ru: "Цель" },
    serviceTitle: { uz: "Xizmat ko'rsataman", ru: "Оказываю услуги" },
    serviceSub: { uz: "Videograf, dizayner, montajchi… buyurtma olaman", ru: "Видеограф, дизайнер, монтажёр… получаю заказы" },
    orderTitle: { uz: "Buyurtma beraman", ru: "Заказываю" },
    orderSub: { uz: "Ijodkor topib loyihamni topshiraman", ru: "Нахожу специалиста и поручаю проект" },
    jobTitle: { uz: "Ish qidiryapman", ru: "Ищу работу" },
    jobSub: { uz: "Vakansiyalarga ariza, rezyume", ru: "Отклики на вакансии, резюме" },
    hireTitle: { uz: "Xodim qidiryapman", ru: "Ищу сотрудника" },
    hireSub: { uz: "Vakansiya joylayman — bepul", ru: "Размещаю вакансию — бесплатно" },
    hintJob: {
      uz: "Ro'yxatdan so'ng 2 daqiqalik rezyume to'ldirasiz — keyin har vakansiyaga bir bosishda ariza yuborasiz.",
      ru: "После регистрации заполните резюме за 2 минуты — затем откликайтесь на вакансии в один клик.",
    },
    hintHire: {
      uz: "Ro'yxatdan so'ng vakansiya joylaysiz — arizalar rezyume va kontakt bilan kabinetingizga keladi.",
      ru: "После регистрации разместите вакансию — отклики с резюме и контактами придут в кабинет.",
    },
    later: { uz: "Keyin kabinetda o'zgartira olasiz. Jamoalar, kanallar va chat — hammaga ochiq.", ru: "Позже можно изменить в кабинете. Сообщества, каналы и чат открыты всем." },
    aria: { uz: "Rol", ru: "Роль" },
    clientTitle: { uz: "Mijozman", ru: "Я клиент" },
    clientSubtitle: { uz: "Mutaxassis qidiryapman", ru: "Ищу специалиста" },
    specialistTitle: { uz: "Mutaxassisman", ru: "Я специалист" },
    specialistSubtitle: { uz: "Buyurtma olmoqchiman", ru: "Хочу получать заказы" },
    hintSpecialist: {
      uz: "Ro'yxatdan so'ng yo'nalish, hudud va narxlaringizni kiritasiz — profil xaritada ko'rinadi.",
      ru: "После регистрации укажите направление, регион и цены — профиль появится на карте.",
    },
    hintClient: {
      uz: "Mutaxassislarni xaritadan toping, portfoliosini ko'ring va buyurtma bering.",
      ru: "Находите специалистов на карте, смотрите портфолио и заказывайте.",
    },
  },

  /* ---------- Maydonlar ---------- */
  fields: {
    name: { uz: "Ism va familiya", ru: "Имя и фамилия" },
    namePlaceholder: { uz: "Masalan: Aziz Karimov", ru: "Например: Азиз Каримов" },
    email: { uz: "Email", ru: "Email" },
    emailPlaceholder: { uz: "siz@misol.uz", ru: "vy@primer.uz" },
    password: { uz: "Parol", ru: "Пароль" },
    passwordPlaceholderNew: { uz: "Kamida 8 ta belgi, harf va raqam", ru: "Минимум 8 символов, буквы и цифры" },
    passwordPlaceholderCurrent: { uz: "Parolingiz", ru: "Ваш пароль" },
    forgotPassword: { uz: "Parolni unutdingizmi?", ru: "Забыли пароль?" },
    phone: { uz: "Telefon", ru: "Телефон" },
    optional: { uz: "(ixtiyoriy)", ru: "(необязательно)" },
    gender: { uz: "Jins", ru: "Пол" },
    genderNone: { uz: "Aytmayman", ru: "Не скажу" },
    genderMale: { uz: "Erkak", ru: "Мужской" },
    genderFemale: { uz: "Ayol", ru: "Женский" },
    genderHint: { uz: "Ko'rinishini keyin maxfiylikdan boshqarasiz.", ru: "Видимость можно настроить позже в разделе приватности." },
    termsI: { uz: "Men", ru: "Я принимаю" },
    termsOffer: { uz: "Oferta", ru: "Оферту" },
    termsAnd: { uz: "va", ru: "и" },
    termsPrivacy: { uz: "Maxfiylik siyosatiga", ru: "Политику конфиденциальности" },
    termsAgree: { uz: "roziman", ru: "" },
    remember: { uz: "Meni eslab qolish", ru: "Запомнить меня" },
    rememberDays: { uz: "· 30 kun", ru: "· 30 дней" },
  },

  /* ---------- Klient tomondagi tekshiruv xatolari ---------- */
  errors: {
    nameShort: { uz: "Ism kamida 2 ta belgi", ru: "Имя — минимум 2 символа" },
    emailInvalid: { uz: "Email noto'g'ri", ru: "Некорректный email" },
    passwordShort: { uz: "Parol kamida 8 ta belgi", ru: "Пароль — минимум 8 символов" },
    passwordWeak: { uz: "Parolda harf ham, raqam ham bo'lsin", ru: "В пароле должны быть и буквы, и цифры" },
    passwordRequired: { uz: "Parolni kiriting", ru: "Введите пароль" },
    phoneInvalid: {
      uz: "Telefon raqami noto'g'ri (masalan: +998 90 123 45 67)",
      ru: "Неверный номер телефона (например: +998 90 123 45 67)",
    },
    termsRequired: {
      uz: "Davom etish uchun oferta va maxfiylik siyosatiga rozilik bering",
      ru: "Чтобы продолжить, примите оферту и политику конфиденциальности",
    },
    tooMany: { uz: "Juda ko'p urinish", ru: "Слишком много попыток" },
    tooManyRetry: {
      uz: (min: number) => `Juda ko'p urinish. ${min} daqiqadan keyin qayta urinib ko'ring.`,
      ru: (min: number) => `Слишком много попыток. Повторите через ${min} мин.`,
    },
    server: { uz: "Serverda kutilmagan xatolik", ru: "Непредвиденная ошибка сервера" },
    network: {
      uz: "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.",
      ru: "Ошибка сети. Проверьте интернет и попробуйте снова.",
    },
  },

  /* ---------- Yuborish tugmalari va pastki havolalar ---------- */
  google: {
    button: { uz: "Google bilan davom etish", ru: "Продолжить с Google" },
    divider: { uz: "yoki", ru: "или" },
    off: { uz: "Google orqali kirish hozircha mavjud emas — email va parol bilan davom eting.", ru: "Вход через Google пока недоступен — используйте email и пароль." },
    cancel: { uz: "Google kirishi bekor qilindi.", ru: "Вход через Google отменён." },
    error: { uz: "Google orqali kirishda xatolik. Qayta urinib ko'ring yoki email bilan kiring.", ru: "Ошибка входа через Google. Попробуйте снова или войдите по email." },
    unverified: { uz: "Google emailingiz tasdiqlanmagan. Boshqa usulda kiring.", ru: "Ваш email в Google не подтверждён. Войдите другим способом." },
  },
  submit: {
    registering: { uz: "Hisob yaratilmoqda…", ru: "Создаём аккаунт…" },
    loggingIn: { uz: "Kirilmoqda…", ru: "Выполняем вход…" },
    register: { uz: "Ro'yxatdan o'tish", ru: "Зарегистрироваться" },
    login: { uz: "Kirish", ru: "Войти" },
    subscriptionNote: {
      uz: (trialDays: number, price: string) =>
        `Mutaxassislar uchun ${trialDays > 0 ? `dastlabki ${trialDays} kun bepul, keyin ` : ""}obuna — oyiga ${price}. Mijozlar uchun platforma bepul.`,
      ru: (trialDays: number, price: string) =>
        `Для специалистов ${trialDays > 0 ? `первые ${trialDays} дн. бесплатно, затем ` : ""}подписка — ${price} в месяц. Для клиентов платформа бесплатна.`,
    },
    haveAccount: { uz: "Hisobingiz bormi? ", ru: "Уже есть аккаунт? " },
    noAccount: { uz: "Hisob yo'qmi? ", ru: "Нет аккаунта? " },
    toLogin: { uz: "Kirish", ru: "Войти" },
    toRegister: { uz: "Ro'yxatdan o'tish", ru: "Зарегистрироваться" },
  },

  /* ---------- 2FA bosqichi ---------- */
  twoFactor: {
    eyebrow: { uz: "Ikki bosqichli himoya", ru: "Двухфакторная защита" },
    titleA: { uz: "Kodni ", ru: "Введите " },
    titleAccent: { uz: "kiriting", ru: "код" },
    leadRecovery: {
      uz: "Telefoningiz yonida bo'lmasa, 2FA yoqilganda saqlab olgan zaxira kodlaringizdan birini kiriting. Har bir kod bir marta ishlaydi.",
      ru: "Если телефона нет под рукой, введите один из резервных кодов, сохранённых при включении 2FA. Каждый код работает один раз.",
    },
    leadOtp: {
      uz: "Autentifikator ilovasini (Google Authenticator, Microsoft Authenticator, 1Password…) oching va Kasb Egalari uchun ko'rsatilgan 6 xonali kodni kiriting.",
      ru: "Откройте приложение-аутентификатор (Google Authenticator, Microsoft Authenticator, 1Password…) и введите 6-значный код для Kasb Egalari.",
    },
    recoveryLabel: { uz: "Zaxira kodi", ru: "Резервный код" },
    otpLabel: { uz: "Ilovadagi kod", ru: "Код из приложения" },
    otpHint: {
      uz: "Kod har 30 soniyada yangilanadi. 6 raqam terilishi bilan tekshiriladi.",
      ru: "Код обновляется каждые 30 секунд и проверяется сразу после ввода 6 цифр.",
    },
    errRecovery: { uz: "Zaxira kodini to'liq kiriting (masalan: abcd-efgh)", ru: "Введите резервный код полностью (например: abcd-efgh)" },
    errOtp: { uz: "6 xonali kodni kiriting", ru: "Введите 6-значный код" },
    expired: { uz: "Kirish muddati tugadi. Qaytadan kiring", ru: "Время входа истекло. Войдите заново" },
    checking: { uz: "Tekshirilmoqda…", ru: "Проверяем…" },
    confirm: { uz: "Tasdiqlash va kirish", ru: "Подтвердить и войти" },
    useOtp: { uz: "Ilova kodi bilan kirish", ru: "Войти по коду из приложения" },
    useRecovery: { uz: "Tiklash kodi bilan kirish", ru: "Войти по резервному коду" },
    otherAccount: { uz: "Boshqa hisob bilan kirish", ru: "Войти в другой аккаунт" },
  },

  /* ---------- Demo hisoblar (faqat dev) ---------- */
  demo: {
    tryIt: { uz: "Sinab ko'rmoqchimisiz?", ru: "Хотите попробовать?" },
    loginDemo: { uz: "Demo hisob bilan kiring", ru: "Войдите с демо-аккаунтом" },
    title: { uz: "Demo hisoblar", ru: "Демо-аккаунты" },
    subtitle: { uz: "Bu demo loyiha — bir bosishda to'ldiring", ru: "Это демо-проект — заполните в один клик" },
    specialist: { uz: "Mutaxassis", ru: "Специалист" },
    specialistHint: { uz: "Profil, portfolio, buyurtmalar", ru: "Профиль, портфолио, заказы" },
    client: { uz: "Mijoz", ru: "Клиент" },
    clientHint: { uz: "Qidiruv va buyurtma berish", ru: "Поиск и оформление заказа" },
    admin: { uz: "Admin", ru: "Админ" },
    adminHint: { uz: "Boshqaruv paneli", ru: "Панель управления" },
    ready: { uz: "Tayyor", ru: "Готово" },
    fill: { uz: "To'ldirish", ru: "Заполнить" },
  },

  /* ---------- Parol maydoni + kuch ko'rsatkichi ---------- */
  password: {
    hide: { uz: "Parolni yashirish", ru: "Скрыть пароль" },
    show: { uz: "Parolni ko'rsatish", ru: "Показать пароль" },
    capsLock: { uz: "Caps Lock yoqilgan", ru: "Включён Caps Lock" },
    strengthAria: { uz: "Parol kuchi", ru: "Надёжность пароля" },
    strengthAriaWith: { uz: (label: string) => `Parol kuchi: ${label}`, ru: (label: string) => `Надёжность пароля: ${label}` },
    labelTooShort: { uz: "Juda qisqa", ru: "Слишком короткий" },
    labelWeak: { uz: "Zaif", ru: "Слабый" },
    labelMedium: { uz: "O'rtacha", ru: "Средний" },
    labelGood: { uz: "Yaxshi", ru: "Хороший" },
    labelStrong: { uz: "Kuchli", ru: "Надёжный" },
    hintEmpty: { uz: "Kamida 8 ta belgi, harf va raqam", ru: "Минимум 8 символов, буквы и цифры" },
    hintMoreChars: { uz: (n: number) => `Yana ${n} ta belgi kerak`, ru: (n: number) => `Нужно ещё ${n} симв.` },
    hintAddDigit: { uz: "Kamida bitta raqam qo'shing", ru: "Добавьте хотя бы одну цифру" },
    hintAddLetter: { uz: "Kamida bitta harf qo'shing", ru: "Добавьте хотя бы одну букву" },
    hintMedium: { uz: "Uzunroq qiling yoki katta harf / belgi qo'shing", ru: "Сделайте длиннее или добавьте заглавные буквы / символы" },
    hintGood: { uz: "Yaxshi parol — 12+ belgi va belgilar bilan yanada kuchli", ru: "Хороший пароль — с 12+ символами и спецсимволами будет ещё надёжнее" },
    hintStrong: { uz: "Zo'r! Bu parolni boshqa saytlarda ishlatmang", ru: "Отлично! Не используйте этот пароль на других сайтах" },
  },

  /* ---------- Parolni tiklash: so'rov ---------- */
  reset: {
    eyebrow: { uz: "Parolni tiklash", ru: "Восстановление пароля" },
    titleA: { uz: "Parolni ", ru: "Забыли " },
    titleAccent: { uz: "unutdingizmi?", ru: "пароль?" },
    lead: {
      uz: "Hisobingiz emailini kiriting — yangi parol o'rnatish havolasini yuboramiz.",
      ru: "Введите email вашего аккаунта — мы отправим ссылку для установки нового пароля.",
    },
    sending: { uz: "Yuborilmoqda…", ru: "Отправляем…" },
    sendLink: { uz: "Havola yuborish", ru: "Отправить ссылку" },
    remembered: { uz: "Esladingizmi?", ru: "Вспомнили пароль?" },
    login: { uz: "Kirish", ru: "Войти" },
    doneTitle: { uz: "Xatni tekshiring", ru: "Проверьте почту" },
    doneTextA: { uz: "Agar ", ru: "Если " },
    doneTextB: {
      uz: " bizda ro'yxatdan o'tgan bo'lsa, unga parolni tiklash havolasi yuborildi. Havola 1 soat amal qiladi.",
      ru: " зарегистрирован у нас, на него отправлена ссылка для восстановления пароля. Ссылка действует 1 час.",
    },
    doneHint: {
      uz: "Xat kelmadimi? «Spam» papkasini tekshiring yoki bir necha daqiqadan so'ng qayta so'rang.",
      ru: "Письмо не пришло? Проверьте папку «Спам» или запросите снова через несколько минут.",
    },
    otherEmail: { uz: "Boshqa email kiritish", ru: "Ввести другой email" },
    toLoginPage: { uz: "Kirish sahifasiga", ru: "На страницу входа" },
    tooManyRequests: { uz: "Juda ko'p so'rov", ru: "Слишком много запросов" },
    tooManyRequestsRetry: {
      uz: (min: number) => `Juda ko'p so'rov. ${min} daqiqadan keyin qayta urinib ko'ring.`,
      ru: (min: number) => `Слишком много запросов. Повторите через ${min} мин.`,
    },
  },

  /* ---------- Parolni tiklash: yangi parol ---------- */
  resetConfirm: {
    linkExpiredTitle: { uz: "Havola eskirgan", ru: "Ссылка устарела" },
    linkExpiredText: {
      uz: "Bu havola muddati tugagan yoki allaqachon ishlatilgan. Yangi havola so'rang — u 1 soat amal qiladi.",
      ru: "Срок действия ссылки истёк, или она уже использована. Запросите новую — она действует 1 час.",
    },
    requestNew: { uz: "Yangi havola so'rash", ru: "Запросить новую ссылку" },
    titleA: { uz: "Yangi ", ru: "Новый " },
    titleAccent: { uz: "parol", ru: "пароль" },
    lead: {
      uz: "Kamida 8 ta belgi — harf va raqam bilan. Saqlangach, barcha eski sessiyalar yopiladi.",
      ru: "Минимум 8 символов — с буквами и цифрами. После сохранения все старые сессии будут завершены.",
    },
    newPassword: { uz: "Yangi parol", ru: "Новый пароль" },
    repeatPassword: { uz: "Parolni takrorlang", ru: "Повторите пароль" },
    repeatPlaceholder: { uz: "Yana bir marta", ru: "Ещё раз" },
    mismatch: { uz: "Parollar mos kelmadi", ru: "Пароли не совпадают" },
    saving: { uz: "Saqlanmoqda…", ru: "Сохраняем…" },
    save: { uz: "Parolni saqlash", ru: "Сохранить пароль" },
    doneTitle: { uz: "Parol yangilandi", ru: "Пароль обновлён" },
    doneNeedsLogin: {
      uz: "Barcha sessiyalar yakunlandi. Endi yangi parol va autentifikator kodi bilan kiring — kirish sahifasiga o'tmoqdamiz…",
      ru: "Все сессии завершены. Войдите с новым паролем и кодом аутентификатора — переходим на страницу входа…",
    },
    doneAuto: {
      uz: "Boshqa qurilmalardagi sessiyalar yakunlandi. Kabinetga o'tmoqdamiz…",
      ru: "Сессии на других устройствах завершены. Переходим в кабинет…",
    },
  },
} as const;
