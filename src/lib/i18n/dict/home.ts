/**
 * Bosh sahifa lug'ati: hero, interaktiv xarita bo'limi, yo'nalishlar, ishlar lentasi,
 * tavsiya etilganlar, uch qadam va CTA. Har kalit { uz, ru }; parametrli satrlar — funksiya juftligi.
 */

/** Ruscha ko'plik shakli: 1 специалист / 2 специалиста / 5 специалистов */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const m10 = Math.abs(n) % 10;
  const m100 = Math.abs(n) % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const ruSpecialists = (n: number) => ruPlural(n, "специалист", "специалиста", "специалистов");
const ruRegions = (n: number) => ruPlural(n, "регион", "региона", "регионов");

export const HOME = {
  hero: {
    /* Ru eyebrow qisqa — 390px'da bir qatorga sig'ishi kerak (uppercase + tracking keng) */
    eyebrow: { uz: "O'zbekiston ijodkorlar xaritasi", ru: "Карта специалистов Узбекистана" },
    titleA: { uz: "Ijodkorlarni", ru: "Найдите специалистов" },
    titleAccent: { uz: "xaritada", ru: "на карте" },
    titleB: { uz: " toping", ru: "" },
    lead: {
      uz: "Videograf, montajor, dizayner va boshqa ijodkorlar — hududingizda. Viloyatni bosing, portfolio va narxlarni ko'ring, to'g'ridan-to'g'ri buyurtma bering.",
      ru: "Видеографы, монтажёры, дизайнеры и другие творческие специалисты — в вашем регионе. Выберите область, изучите портфолио и цены и закажите напрямую.",
    },
    openMap: { uz: "Xaritani ochish", ru: "Открыть карту" },
    specialistsList: { uz: "Mutaxassislar ro'yxati", ru: "Список специалистов" },
    statSpecialists: { uz: (_n: number) => "mutaxassis", ru: (n: number) => ruSpecialists(n) },
    statRegions: { uz: (_n: number) => "ta hudud", ru: (n: number) => ruRegions(n) },
    interactiveHint: { uz: "Interaktiv — hududni bosing", ru: "Интерактивно — нажмите на регион" },
    legendLess: { uz: "kam", ru: "мало" },
    legendMore: { uz: "ko'p", ru: "много" },
  },

  mapSection: {
    eyebrow: { uz: "Interaktiv xarita", ru: "Интерактивная карта" },
    titleA: { uz: "Hududni tanlang — ", ru: "Выберите регион — покажем " },
    titleAccent: { uz: "mutaxassislar", ru: "специалистов" },
    titleB: { uz: " chiqadi", ru: "" },
    description: {
      uz: "14 ta hudud. Rang qancha to'q bo'lsa, u yerda shuncha ko'p ijodkor bor. Bosing — yo'nalishlar bo'yicha taqsimot va ro'yxat ochiladi.",
      ru: "14 регионов. Чем насыщеннее цвет, тем больше там специалистов. Нажмите — откроется список и распределение по направлениям.",
    },
  },

  categories: {
    eyebrow: { uz: "Yo'nalishlar", ru: "Направления" },
    title: { uz: "Kim kerak?", ru: "Кто вам нужен?" },
    description: {
      uz: "Har bir yo'nalish bo'yicha mutaxassislar soni jonli hisoblanadi.",
      ru: "Число специалистов по каждому направлению обновляется в реальном времени.",
    },
    all: { uz: "Barchasi", ru: "Все" },
    /** Son (alohida chiziladi)dan keyingi matn: "… mutaxassis · N hudud" */
    countLine: {
      uz: (_n: number, regions: number) => `mutaxassis · ${regions} hudud`,
      ru: (n: number, regions: number) => `${ruSpecialists(n)} · ${regions} ${ruRegions(regions)}`,
    },
    beFirst: { uz: "Birinchi bo'ling →", ru: "Станьте первым →" },
  },

  lenta: {
    eyebrow: { uz: "Ishlar lentasi", ru: "Лента работ" },
    titleA: { uz: "Ishlarni ", ru: "Смотрите работы " },
    titleAccent: { uz: "videoda", ru: "в видео" },
    titleB: { uz: " ko'ring", ru: "" },
    description: {
      uz: "Mutaxassislarning so'nggi video ishlari — kartani bosing va Reels uslubida varaqlang.",
      ru: "Свежие видеоработы специалистов — нажмите на карточку и листайте в формате Reels.",
    },
    all: { uz: "Hammasi", ru: "Все" },
    rowAria: { uz: "Ishlar lentasi — video ishlar", ru: "Лента работ — видео" },
    videoWork: { uz: "video ish", ru: "видеоработа" },
    openLenta: { uz: "lentani ochish", ru: "открыть ленту" },
    priceFrom: { uz: (p: string) => `${p} dan`, ru: (p: string) => `от ${p}` },
    negotiable: { uz: "Narx kelishiladi", ru: "Цена договорная" },
  },

  featured: {
    eyebrow: { uz: "Tavsiya etiladi", ru: "Рекомендуем" },
    ratedA: { uz: "Eng yuqori ", ru: "Специалисты с " },
    ratedAccent: { uz: "reytingli", ru: "высоким" },
    ratedB: { uz: " ijodkorlar", ru: " рейтингом" },
    newA: { uz: "Yangi ", ru: "" },
    newAccent: { uz: "qo'shilgan", ru: "Новые" },
    newB: { uz: " ijodkorlar", ru: " специалисты платформы" },
    ratedDescription: {
      uz: "Tasdiqlangan profil, haqiqiy sharhlar va ochiq narxlar.",
      ru: "Подтверждённые профили, настоящие отзывы и открытые цены.",
    },
    newDescription: {
      uz: "Platformaga endigina qo'shilgan profillar — portfolio va narxlar ochiq, birinchi sharhni siz qoldiring.",
      ru: "Профили, недавно появившиеся на платформе, — портфолио и цены открыты, оставьте первый отзыв.",
    },
    viewAll: { uz: "Hammasini ko'rish", ru: "Смотреть всех" },
  },

  steps: {
    eyebrow: { uz: "Qanday ishlaydi", ru: "Как это работает" },
    title: { uz: "Uch qadam — va mutaxassis topildi", ru: "Три шага — и специалист найден" },
    stepN: { uz: (i: number) => `${i}-qadam`, ru: (i: number) => `Шаг ${i}` },
    s1Title: { uz: "Hududni tanlang", ru: "Выберите регион" },
    s1Text: {
      uz: "Xaritada viloyatni bosing yoki yo'nalish bo'yicha qidiring — yaqin atrofdagi ijodkorlar chiqadi.",
      ru: "Нажмите на область на карте или ищите по направлению — появятся специалисты поблизости.",
    },
    s2Title: { uz: "Portfolioni ko'ring", ru: "Изучите портфолио" },
    s2Text: {
      uz: "Ishlar, narxlar, tajriba va haqiqiy mijozlar sharhlari — hammasi bitta sahifada.",
      ru: "Работы, цены, опыт и настоящие отзывы клиентов — всё на одной странице.",
    },
    s3Title: { uz: "Buyurtma bering", ru: "Сделайте заказ" },
    s3Text: {
      uz: "Loyihani yozing, narxni kelishing va xavfsiz to'lang — pul ishni qabul qilganingizdan keyin o'tkaziladi.",
      ru: "Опишите проект, договоритесь о цене и оплатите безопасно — деньги переводятся после приёмки работы.",
    },
    escrowOn: {
      uz: "To'lov eskrou orqali: pul mutaxassisga ish qabul qilingandan keyingina o'tadi.",
      ru: "Оплата через эскроу: специалист получает деньги только после приёмки работы.",
    },
    escrowOff: {
      uz: "Kelishuv, portfolio va muloqot — bitta ishonchli joyda.",
      ru: "Договорённости, портфолио и общение — в одном надёжном месте.",
    },
  },

  cta: {
    eyebrow: { uz: "Mutaxassislar uchun", ru: "Для специалистов" },
    titleA: { uz: "Siz ijodkormisiz? ", ru: "Вы специалист? Заявите о себе " },
    titleAccent: { uz: "Xaritada", ru: "на карте" },
    titleB: { uz: " paydo bo'ling.", ru: "." },
    subscription: {
      uz: (trialDays: number, price: string) => (trialDays > 0 ? `${trialDays} kun bepul sinab ko'ring, keyin ${price} / oy.` : `Obuna — ${price} / oy.`),
      ru: (trialDays: number, price: string) =>
        trialDays > 0 ? `Попробуйте ${trialDays} ${ruPlural(trialDays, "день", "дня", "дней")} бесплатно, затем ${price} / мес.` : `Подписка — ${price} / мес.`,
    },
    rest: {
      uz: "Portfolio joylang, narxlaringizni belgilang — buyurtmalar to'g'ridan-to'g'ri kabinetingizga keladi.",
      ru: "Разместите портфолио, укажите свои цены — заказы будут приходить прямо в ваш кабинет.",
    },
    pricesLink: { uz: "Narxlar va shartlar", ru: "Тарифы и условия" },
    joinSpecialist: { uz: "Mutaxassis sifatida qo'shilish", ru: "Присоединиться как специалист" },
    startClient: { uz: "Mijoz sifatida boshlash", ru: "Начать как клиент" },
  },

  /** HomeMapSection — bosh sahifadagi interaktiv xarita paneli */
  mapPanel: {
    /** Son (alohida chiziladi)dan keyin: umumiy hisob */
    afterCountAll: { uz: (_n: number) => "ta mutaxassis · 14 hudud", ru: (n: number) => `${ruSpecialists(n)} · 14 регионов` },
    /** Son (alohida chiziladi)dan keyin: tanlangan yo'nalish hisobi (nomi ma'lumotdan keladi) */
    afterCountCat: { uz: (_n: number, cat: string) => `ta ${cat} · 14 hudud`, ru: (_n: number, cat: string) => `${cat} · 14 регионов` },
    clickHint: { uz: "Hududni bosing — ro'yxat o'ngda ochiladi", ru: "Нажмите на регион — список откроется справа" },
    pickCategoryAria: { uz: "Yo'nalish tanlash", ru: "Выбор направления" },
    all: { uz: "Barchasi", ru: "Все" },
    legendLess: { uz: "kam", ru: "мало" },
    legendMore: { uz: "ko'p", ru: "много" },
    legendUnit: { uz: (unit: string) => `— ${unit}lar soni`, ru: (_unit: string) => "— число специалистов" },
    fullMap: { uz: "To'liq xarita rejimi — filtrlar, zoom", ru: "Полная карта — фильтры и масштаб" },
    /** Hudud sarlavhasi ostidagi hisob qatori: son alohida chiziladi, bu — davomi */
    afterHeadCount: {
      uz: (_count: string, gender: "" | "male" | "female", genderLabel: string, unit: string, capital: string) =>
        ` ta ${gender ? `${genderLabel.toLowerCase()} ` : ""}${unit}${gender ? " ko'rsatilgan" : ""} · ${capital}`,
      ru: (count: string, gender: "" | "male" | "female", _genderLabel: string, unit: string, capital: string) => {
        const n = Number(count);
        const u = unit === "mutaxassis" ? (Number.isFinite(n) ? ruSpecialists(n) : "специалистов") : unit;
        const g = gender === "male" ? " · мужчины" : gender === "female" ? " · женщины" : "";
        return ` ${u} · ${capital}${g}`;
      },
    },
    clearSelection: { uz: "Tanlovni bekor qilish", ru: "Сбросить выбор" },
    catAllCountry: { uz: (plural: string) => `${plural} — butun O'zbekiston`, ru: (plural: string) => `${plural} — весь Узбекистан` },
    genderAllCountry: {
      uz: (label: string, _value: "male" | "female") => `${label} mutaxassislar — butun O'zbekiston`,
      ru: (_label: string, value: "male" | "female") => (value === "male" ? "Мужчины-специалисты — весь Узбекистан" : "Женщины-специалисты — весь Узбекистан"),
    },
    pickRegionTitle: { uz: "Hududni tanlang", ru: "Выберите регион" },
    descFiltered: {
      uz: "Xaritada viloyatni bosing — ro'yxat o'sha hudud bo'yicha filtrlanadi.",
      ru: "Нажмите на область на карте — список отфильтруется по этому региону.",
    },
    descDefault: {
      uz: "Xaritadagi istalgan viloyatni bosing — o'sha yerdagi mutaxassislar chiqadi.",
      ru: "Нажмите на любую область карты — покажем специалистов оттуда.",
    },
    gender: { uz: "Jins", ru: "Пол" },
    genderAll: { uz: "Barchasi", ru: "Все" },
    genderMale: { uz: "Erkak", ru: "Мужчины" },
    genderFemale: { uz: "Ayol", ru: "Женщины" },
    loadingAria: { uz: "Yuklanmoqda", ru: "Загрузка" },
    loadFailed: { uz: "Yuklab bo'lmadi", ru: "Не удалось загрузить" },
    retry: { uz: "Qayta urinish", ru: "Повторить" },
    emptyTitle: { uz: "Hali topilmadi", ru: "Пока никого нет" },
    emptyText: {
      uz: (regionShort: string | null, catSelected: boolean, genderLabel: string, unit: string) =>
        `${regionShort ? `${regionShort}da` : catSelected ? "Bu yo'nalishda" : "Bu filtr bo'yicha"} hozircha ${genderLabel}${unit} yo'q.`,
      ru: (regionShort: string | null, _catSelected: boolean, _genderLabel: string, _unit: string) =>
        regionShort ? "В этом регионе пока нет подходящих специалистов." : "По этому запросу пока никого нет.",
    },
    beFirst: { uz: "Birinchi bo'ling →", ru: "Станьте первым →" },
    viewAllCount: { uz: (n: number) => `Barchasini ko'rish (${n})`, ru: (n: number) => `Смотреть всех (${n})` },
    byCategories: { uz: "Yo'nalishlar bo'yicha", ru: "По направлениям" },
    topRegions: { uz: "Eng faol hududlar", ru: "Самые активные регионы" },
    catBarAria: { uz: (plural: string, n: number) => `${plural}: ${n} ta`, ru: (plural: string, n: number) => `${plural}: ${n}` },
  },
} as const;
