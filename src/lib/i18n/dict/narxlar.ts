/**
 * Narxlar sahifasi lug'ati (/narxlar): tarif kartalari, rejalar jadvali,
 * eskrou komissiyasi darajalari va FAQ. JSON-LD (SEO) uz matnlardan tuziladi — sahifada.
 */
import type { Tr } from "../index";
import { localizePrice } from "./catalog";

export const NARX = {
  eyebrow: { uz: "Narxlar", ru: "Цены" } satisfies Tr,
  titleStart: { uz: "Oddiy va", ru: "Простые и" } satisfies Tr,
  titleAccent: { uz: "shaffof", ru: "прозрачные" } satisfies Tr,
  titleEnd: { uz: "narxlar", ru: "цены" } satisfies Tr,
  intro: {
    uz: (site: string) => `Mijozlar ${site}'dan bepul foydalanadi. Mutaxassislar oylik obuna to'laydi — profil katalog va xaritada ko'rinadi, buyurtmalar cheklanmaydi.`,
    ru: (site: string) => `Для клиентов ${site} бесплатен. Специалисты оплачивают месячную подписку — профиль виден в каталоге и на карте, заказы не ограничены.`,
  },
  plansAria: { uz: "Tariflar", ru: "Тарифы" } satisfies Tr,

  /* --------- Mijozlar kartasi --------- */
  clients: { uz: "Mijozlar", ru: "Клиенты" } satisfies Tr,
  free: { uz: "Bepul", ru: "Бесплатно" } satisfies Tr,
  freeNote: { uz: "Hech qanday obuna yoki yashirin to'lov yo'q", ru: "Никаких подписок и скрытых платежей" } satisfies Tr,
  clientBullets: {
    uz: [
      "Xarita va katalog orqali mutaxassis qidirish, solishtirish",
      "To'g'ridan-to'g'ri buyurtma berish va chat",
      "E'lon joylash va mutaxassislardan takliflar olish",
      "Eskrou himoyasi — pul ishni qabul qilguningizcha platformada saqlanadi",
      "Nizo bo'lsa — administrator ko'rib chiqadi",
    ],
    ru: [
      "Поиск и сравнение специалистов по карте и каталогу",
      "Прямые заказы и чат",
      "Размещение заказов и предложения от специалистов",
      "Защита эскроу — деньги хранятся на платформе, пока вы не примете работу",
      "В случае спора — рассмотрит администратор",
    ],
  },
  findSpecialist: { uz: "Mutaxassis topish", ru: "Найти специалиста" } satisfies Tr,

  /* --------- Mutaxassislar kartasi --------- */
  specialists: { uz: "Mutaxassislar", ru: "Специалисты" } satisfies Tr,
  trialBadge: { uz: (d: number) => `${d} kun bepul`, ru: (d: number) => `${d} дн. бесплатно` },
  perMonth: { uz: "/ oy", ru: "/ мес" } satisfies Tr,
  trialNote: { uz: (d: number) => `Birinchi ${d} kun bepul — karta talab qilinmaydi`, ru: (d: number) => `Первые ${d} дн. бесплатно — карта не требуется` },
  noTrialNote: { uz: "Uzoq muddatga to'lasangiz — chegirma", ru: "При оплате на длительный срок — скидка" } satisfies Tr,
  specialistBullets: {
    uz: (proposalLimit: number) => [
      "Katalog, xarita, qidiruv va yo'nalish sahifalarida ko'rinish",
      "Cheklanmagan buyurtmalar, aloqa ma'lumotlari mijozlarga ochiq",
      `E'lonlarga taklif yuborish — kuniga ${proposalLimit} tagacha`,
      "Portfolio, xizmat paketlari, sharhlar va qisqa havola",
      "Eskrou to'lovlar va balansdan pul chiqarish",
    ],
    ru: (proposalLimit: number) => [
      "Видимость в каталоге, на карте, в поиске и на страницах направлений",
      "Неограниченные заказы, контакты открыты клиентам",
      `Предложения к заказам — до ${proposalLimit} в день`,
      "Портфолио, пакеты услуг, отзывы и короткая ссылка",
      "Платежи через эскроу и вывод средств с баланса",
    ],
  },
  startAsSpecialist: { uz: "Mutaxassis sifatida boshlash", ru: "Начать как специалист" } satisfies Tr,

  /* --------- Rejalar jadvali --------- */
  plansTitle: { uz: "Uzoqroq muddat — kattaroq chegirma", ru: "Дольше срок — больше скидка" } satisfies Tr,
  plansDesc: {
    uz: "Yangi davr joriy obuna yoki sinov tugagan kundan boshlanadi — qolgan kunlar yo'qolmaydi.",
    ru: "Новый период начинается после окончания текущей подписки или пробного срока — оставшиеся дни не сгорают.",
  } satisfies Tr,
  tableCaption: { uz: "Obuna rejalari va narxlari", ru: "Тарифные планы и цены" } satisfies Tr,
  colDuration: { uz: "Muddat", ru: "Срок" } satisfies Tr,
  colMonthly: { uz: "Oyiga", ru: "В месяц" } satisfies Tr,
  colTotal: { uz: "Jami", ru: "Итого" } satisfies Tr,
  months: { uz: (m: number) => `${m} oy`, ru: (m: number) => `${m} мес.` },
  savings: { uz: (s: string) => `${s} tejash`, ru: (s: string) => `экономия ${localizePrice("ru", s)}` },

  /* --------- Eskrou komissiyasi --------- */
  escrowEyebrow: { uz: "Eskrou", ru: "Эскроу" } satisfies Tr,
  commissionTitle: { uz: "Platforma orqali to'lovlar uchun xizmat haqi", ru: "Сервисный сбор за платежи через платформу" } satisfies Tr,
  commissionDesc: {
    uz: "Mijoz eskrou orqali to'lasa, pul ish qabul qilinguncha platformada turadi. Ish qabul qilingach mutaxassisga o'tadi, xizmat haqi shu summa ichidan ushlanadi — mijoz ustiga to'lamaydi. Platformadan tashqaridagi kelishuvlardan komissiya olinmaydi.",
    ru: "Если клиент платит через эскроу, деньги остаются на платформе до приёмки работы. После приёмки они переходят специалисту, сервисный сбор удерживается из этой суммы — клиент ничего не доплачивает. С договорённостей вне платформы комиссия не берётся.",
  } satisfies Tr,
  tiers: {
    newSpec: {
      name: { uz: "Yangi mutaxassis", ru: "Новый специалист" } satisfies Tr,
      rule: { uz: (n: number) => `Birinchi ${n} ta bajarilgan buyurtmagacha`, ru: (n: number) => `До первых ${n} выполненных заказов` },
    },
    regular: {
      name: { uz: "Oddiy daraja", ru: "Обычный уровень" } satisfies Tr,
      rule: { uz: (n: number) => `${n} va undan ko'p bajarilgan buyurtma`, ru: (n: number) => `${n} и более выполненных заказов` },
    },
    top: {
      name: { uz: "Top mutaxassis", ru: "Топ-специалист" } satisfies Tr,
      rule: { uz: (r: number, n: number) => `Reyting ${r}+ va kamida ${n} ta sharh`, ru: (r: number, n: number) => `Рейтинг ${r}+ и не менее ${n} отзывов` },
    },
  },

  /* --------- FAQ --------- */
  faqEyebrow: { uz: "Savollar", ru: "Вопросы" } satisfies Tr,
  faqTitle: { uz: "Ko'p so'raladigan savollar", ru: "Частые вопросы" } satisfies Tr,
  faq: {
    whySubQ: { uz: "Nega obuna?", ru: "Почему подписка?" } satisfies Tr,
    whySubA: {
      uz: (site: string) =>
        `Mijozlar mutaxassisni ${site}'da topadi, lekin ko'pincha keyin Telegram yoki telefon orqali kelishib, ishni platformadan tashqarida davom ettiradi. Platformadan tashqarida kelishilgan ishlar ham bizning mijozlarimizdan keladi — obuna katalog, xarita, qidiruv va reklama orqali sizga mijoz olib kelish xizmati uchun adolatli to'lov. Komissiya faqat eskrou orqali to'langan buyurtmalardan olinadi.`,
      ru: (site: string) =>
        `Клиенты находят специалиста на ${site}, но часто затем договариваются в Telegram или по телефону и продолжают работу вне платформы. Даже такие заказы приходят от наших клиентов — подписка является честной платой за привлечение клиентов через каталог, карту, поиск и рекламу. Комиссия берётся только с заказов, оплаченных через эскроу.`,
    },
    expireQ: { uz: "Obuna tugasa nima bo'ladi?", ru: "Что будет, когда подписка закончится?" } satisfies Tr,
    expireA: {
      uz: (grace: number) =>
        `${grace > 0 ? `Avval ${grace} kunlik muhlat beriladi — bu vaqtda profil odatdagidek ishlaydi. ` : ""}Keyin profil katalog, xarita, qidiruv va yo'nalish sahifalaridan yashiriladi, aloqa ma'lumotlari yopiladi, yangi buyurtma va takliflar to'xtaydi. Mavjud buyurtmalar va eskroudagi to'lovlar odatdagidek davom etadi. To'lashingiz bilan profil darhol qaytadi.`,
      ru: (grace: number) =>
        `${grace > 0 ? `Сначала даётся льготный период ${grace} дн. — в это время профиль работает как обычно. ` : ""}Затем профиль скрывается из каталога, карты, поиска и страниц направлений, контакты закрываются, новые заказы и предложения останавливаются. Текущие заказы и платежи в эскроу продолжаются как обычно. После оплаты профиль сразу возвращается.`,
    },
    payQ: { uz: "Qanday to'lash mumkin?", ru: "Как можно оплатить?" } satisfies Tr,
    payA: {
      uz: "Payme yoki Click (karta yoki ilova orqali) yoki bank kartasiga o'tkazma — o'tkazmani administrator odatda 1 ish kuni ichida tasdiqlaydi. Avtomatik yechib olish yo'q: har bir davr Kabinet → Obuna bo'limidan alohida to'lanadi. Har bir to'lov uchun elektron chek beriladi.",
      ru: "Payme или Click (картой или через приложение), либо переводом на банковскую карту — перевод администратор обычно подтверждает в течение 1 рабочего дня. Автосписаний нет: каждый период оплачивается отдельно в разделе Кабинет → Подписка. За каждый платёж выдаётся электронный чек.",
    } satisfies Tr,
    refundQ: { uz: "Pulni qaytarish mumkinmi?", ru: "Можно ли вернуть деньги?" } satisfies Tr,
    refundA: {
      uz: "Hali boshlanmagan davr (oldindan to'langan oylar) uchun qo'llab-quvvatlashga yozing — qaytarilgan summaga mos ravishda obuna muddati qisqartiriladi. Boshlangan davr uchun to'lov qaytarilmaydi, platforma aybi bilan xizmat ko'rsatilmagan holatlar bundan mustasno (Ommaviy oferta).",
      ru: "За ещё не начавшийся период (оплаченные вперёд месяцы) напишите в поддержку — срок подписки сократится соразмерно возвращённой сумме. За начавшийся период оплата не возвращается, кроме случаев, когда услуга не оказана по вине платформы (Публичная оферта).",
    } satisfies Tr,
    trialQ: { uz: "Sinov muddati qanday ishlaydi?", ru: "Как работает пробный период?" } satisfies Tr,
    trialA: {
      uz: (trial: number) =>
        trial > 0
          ? `Mutaxassis sifatida ro'yxatdan o'tgan kundan boshlab ${trial} kun barcha imkoniyatlar bepul — karta talab qilinmaydi. Sinov tugashidan 3 va 1 kun oldin eslatma keladi.`
          : "Hozircha sinov muddati yo'q — obuna ro'yxatdan o'tgandan keyin faollashtiriladi.",
      ru: (trial: number) =>
        trial > 0
          ? `Со дня регистрации специалиста все возможности бесплатны в течение ${trial} дн. — карта не требуется. За 3 дня и за 1 день до конца пробного периода придёт напоминание.`
          : "Пробного периода пока нет — подписка активируется после регистрации.",
    },
    clientsPayQ: { uz: "Mijozlar biror narsa to'laydimi?", ru: "Платят ли клиенты что-нибудь?" } satisfies Tr,
    clientsPayA: {
      uz: "Yo'q. Mutaxassis qidirish, buyurtma berish, e'lon joylash va takliflar olish mijozlar uchun bepul. Eskrou orqali to'lasangiz, xizmat haqi kelishilgan narx ichida — siz ustiga hech narsa qo'shib to'lamaysiz.",
      ru: "Нет. Поиск специалистов, заказы, размещение объявлений и получение предложений для клиентов бесплатны. При оплате через эскроу сервисный сбор уже внутри согласованной цены — доплачивать сверху не нужно.",
    } satisfies Tr,
  },
  termsNote: { uz: "Batafsil shartlar —", ru: "Подробные условия —" } satisfies Tr,
  termsLink: { uz: "Ommaviy oferta", ru: "Публичная оферта" } satisfies Tr,

  /* --------- CTA --------- */
  ctaTitle: { uz: "Ijodkormisiz? Mijozlar sizni xaritada qidirmoqda", ru: "Вы творческий специалист? Клиенты ищут вас на карте" } satisfies Tr,
  ctaTrial: { uz: (trial: number, price: string) => `${trial} kun bepul sinab ko'ring — keyin ${price} / oy.`, ru: (trial: number, price: string) => `Попробуйте ${trial} дн. бесплатно — затем ${localizePrice("ru", price)} / мес.` },
  ctaNoTrial: { uz: (price: string) => `${price} / oy.`, ru: (price: string) => `${localizePrice("ru", price)} / мес.` },
} as const;
