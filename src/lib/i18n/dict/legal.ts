import type { Tr } from "@/lib/i18n";

/**
 * Huquqiy hujjatlar lug'ati: Ommaviy oferta (/oferta) va Maxfiylik siyosati (/maxfiylik).
 * uz matn — sahifadagi asl matn (o'zgarmaydi), ru — rasmiy yuridik uslubdagi tarjima.
 * Parametrli satrlar `{ uz: (…) => …, ru: (…) => … }` juftligi bilan.
 */

/** LegalDocument qobig'i yorliqlari */
export const LEGAL_SHELL = {
  eyebrow: { uz: "Huquqiy hujjat", ru: "Юридический документ" } satisfies Tr,
  version: { uz: "Versiya", ru: "Версия" } satisfies Tr,
  effective: { uz: "Kuchga kirgan sana:", ru: "Дата вступления в силу:" } satisfies Tr,
  toc: { uz: "Mundarija", ru: "Содержание" } satisfies Tr,
  offerLabel: { uz: "Ommaviy oferta", ru: "Публичная оферта" } satisfies Tr,
  privacyLabel: { uz: "Maxfiylik siyosati", ru: "Политика конфиденциальности" } satisfies Tr,
};

/** "2026-10-13" → uz: "13-oktabr 2026", ru: "13 октября 2026" */
export function legalDate(iso: string, locale: "uz" | "ru"): string {
  const UZ = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return locale === "ru" ? `${d} ${RU[m - 1]} ${y}` : `${d}-${UZ[m - 1]} ${y}`;
}

/* ------------------------------------------------------------------ */
/* OMMAVIY OFERTA                                                      */
/* ------------------------------------------------------------------ */
export const OFERTA = {
  metaTitle: { uz: "Ommaviy oferta", ru: "Публичная оферта" } satisfies Tr,
  metaDescription: {
    uz: "Kasb Egalari platformasidan foydalanish shartlari: platformaning roli, mutaxassislar obunasi, eskrou to'lovlar va komissiya, qaytarish va nizolar, taqiqlangan harakatlar, javobgarlik.",
    ru: "Условия использования платформы Kasb Egalari: роль платформы, подписка специалистов, эскроу-платежи и комиссия, возвраты и споры, запрещённые действия, ответственность.",
  } satisfies Tr,
  title: { uz: "Ommaviy", ru: "Публичная" } satisfies Tr,
  accent: { uz: "oferta", ru: "оферта" } satisfies Tr,
  intro: {
    uz: (site: string, pro: string, max: string) =>
      `${site}'dan foydalanish shartlari: platforma nima qiladi va nima qilmaydi, mutaxassislar tariflari (Pro ${pro}/oy, Max ${max}/oy), eskrou to'lovlar, komissiya, qaytarish va nizolar tartibi.`,
    ru: (site: string, pro: string, max: string) =>
      `Условия использования ${site}: что платформа делает и чего не делает, тарифы специалистов (Pro ${pro}/мес, Max ${max}/мес), эскроу-платежи, комиссия, порядок возвратов и споров.`,
  },

  /* 01 Umumiy qoidalar */
  umumiyTitle: { uz: "Umumiy qoidalar", ru: "Общие положения" } satisfies Tr,
  umumiyP1: {
    uz: (site: string) =>
      `Ushbu hujjat ${site} platformasi (keyingi o'rinlarda — «Platforma») tomonidan istalgan shaxsga qaratilgan ommaviy oferta hisoblanadi va O'zbekiston Respublikasi Fuqarolik kodeksining ommaviy oferta to'g'risidagi qoidalariga muvofiq tuzilgan.`,
    ru: (site: string) =>
      `Настоящий документ является публичной офертой платформы ${site} (далее — «Платформа»), адресованной любому лицу, и составлен в соответствии с положениями Гражданского кодекса Республики Узбекистан о публичной оферте.`,
  },
  umumiyP2: {
    uz: "Platformada ro'yxatdan o'tish, «Oferta va Maxfiylik siyosatiga roziman» belgisini qo'yish yoki Platforma xizmatlaridan amalda foydalanish ofertaning to'liq va so'zsiz qabul qilinishi (aksept) hisoblanadi. Agar shartlarga rozi bo'lmasangiz, Platformadan foydalanmang.",
    ru: "Регистрация на Платформе, установка отметки «Принимаю Оферту и Политику конфиденциальности» либо фактическое использование услуг Платформы являются полным и безоговорочным принятием (акцептом) оферты. Если вы не согласны с условиями, не используйте Платформу.",
  } satisfies Tr,
  umumiyP3a: {
    uz: "Shaxsga doir ma'lumotlarni qayta ishlash tartibi alohida hujjatda — ",
    ru: "Порядок обработки персональных данных изложен в отдельном документе — ",
  } satisfies Tr,
  umumiyP3link: { uz: "Maxfiylik siyosati", ru: "Политике конфиденциальности" } satisfies Tr,
  umumiyP3b: {
    uz: "da bayon etilgan va ushbu ofertaning ajralmas qismi hisoblanadi.",
    ru: ", которая является неотъемлемой частью настоящей оферты.",
  } satisfies Tr,

  /* 02 Atamalar */
  atamalarTitle: { uz: "Atamalar", ru: "Термины" } satisfies Tr,
  termUser: { uz: "Foydalanuvchi", ru: "Пользователь" } satisfies Tr,
  termUserDesc: { uz: " — Platformada hisob ochgan har qanday jismoniy yoki yuridik shaxs.", ru: " — любое физическое или юридическое лицо, создавшее учётную запись на Платформе." } satisfies Tr,
  termClient: { uz: "Mijoz", ru: "Заказчик" } satisfies Tr,
  termClientDesc: { uz: " — xizmat buyurtma qiluvchi Foydalanuvchi.", ru: " — Пользователь, заказывающий услугу." } satisfies Tr,
  termSpecialist: { uz: "Mutaxassis", ru: "Специалист" } satisfies Tr,
  termSpecialistDesc: {
    uz: " — videograf, montajor, dizayner va boshqa ijodiy xizmatlarni taklif qiluvchi, ommaviy profil ochgan Foydalanuvchi.",
    ru: " — Пользователь с публичным профилем, предлагающий услуги видеографа, монтажёра, дизайнера и иные творческие услуги.",
  } satisfies Tr,
  termOrder: { uz: "Buyurtma", ru: "Заказ" } satisfies Tr,
  termOrderDesc: {
    uz: " — Mijoz va Mutaxassis o'rtasida Platforma orqali rasmiylashtirilgan ish (narx, muddat, natija).",
    ru: " — работа, оформленная между Заказчиком и Специалистом через Платформу (цена, срок, результат).",
  } satisfies Tr,
  termJob: { uz: "E'lon", ru: "Объявление" } satisfies Tr,
  termJobDesc: { uz: " — Mijoz joylagan ish tavsifi; ", ru: " — описание работы, размещённое Заказчиком; " } satisfies Tr,
  termProposal: { uz: "Taklif", ru: "Предложение" } satisfies Tr,
  termProposalDesc: {
    uz: " — Mutaxassisning e'longa yuborgan narx va muddat taklifi.",
    ru: " — предложение Специалиста по цене и сроку, направленное на объявление.",
  } satisfies Tr,
  termEscrow: { uz: "Eskrou", ru: "Эскроу" } satisfies Tr,
  termEscrowDesc: {
    uz: " — Mijoz to'lagan pulni ish qabul qilinguncha Platforma hisobida saqlab turish tartibi.",
    ru: " — порядок удержания оплаченных Заказчиком средств на счёте Платформы до приёмки работы.",
  } satisfies Tr,
  termSubscription: { uz: "Obuna", ru: "Подписка" } satisfies Tr,
  termSubscriptionDesc: {
    uz: " — Mutaxassisning profilini katalogda ko'rsatish va yangi buyurtmalar olish huquqi uchun oylik to'lov.",
    ru: " — ежемесячная плата за право показа профиля Специалиста в каталоге и получения новых заказов.",
  } satisfies Tr,

  /* 03 Platformaning roli */
  roliTitle: { uz: "Platformaning roli", ru: "Роль Платформы" } satisfies Tr,
  roliP1: {
    uz: "Platforma — Mijoz va Mutaxassisni bir-biri bilan tanishtiruvchi axborot vositachisi: katalog, xarita, qidiruv, e'lonlar, buyurtma va xabar almashish vositalari hamda eskrou to'lov imkoniyatini taqdim etadi.",
    ru: "Платформа — информационный посредник, знакомящий Заказчика и Специалиста друг с другом: она предоставляет каталог, карту, поиск, объявления, инструменты оформления заказов и обмена сообщениями, а также возможность эскроу-платежей.",
  } satisfies Tr,
  roliL1: {
    uz: "Platforma Mijoz va Mutaxassis o'rtasidagi kelishuvning tarafi emas va xizmat sifati, muddati yoki natijasini kafolatlamaydi.",
    ru: "Платформа не является стороной соглашения между Заказчиком и Специалистом и не гарантирует качество, срок или результат услуги.",
  } satisfies Tr,
  roliL2: {
    uz: "Mutaxassis profilidagi ma'lumotlar (portfolio, narx, tajriba) uchun profil egasi javob beradi. «Tasdiqlangan» belgisi faqat Platforma tekshiruvidan o'tganini bildiradi.",
    ru: "За сведения в профиле Специалиста (портфолио, цены, опыт) отвечает владелец профиля. Отметка «Подтверждён» означает лишь прохождение проверки Платформы.",
  } satisfies Tr,
  roliL3: {
    uz: "Tomonlar tanishgach Platformadan tashqarida (masalan, Telegram yoki telefon orqali) muloqot qilishlari va kelishishlari mumkin. Bunday kelishuvlar va to'lovlar Platforma eskrou himoyasidan tashqarida bo'ladi.",
    ru: "После знакомства стороны могут общаться и договариваться вне Платформы (например, через Telegram или по телефону). Такие договорённости и платежи находятся вне эскроу-защиты Платформы.",
  } satisfies Tr,

  /* 04 Hisob */
  hisobTitle: { uz: "Ro'yxatdan o'tish va hisob xavfsizligi", ru: "Регистрация и безопасность учётной записи" } satisfies Tr,
  hisobL1: {
    uz: "Platformadan 16 yoshdan oshgan shaxslar foydalanishi mumkin; to'lov va pul chiqarish uchun 18 yosh to'lgan bo'lishi lozim.",
    ru: "Платформой могут пользоваться лица старше 16 лет; для оплаты и вывода средств необходимо достижение 18 лет.",
  } satisfies Tr,
  hisobL2: {
    uz: "Ro'yxatdan o'tishda haqiqiy ism, ishlaydigan email va (ixtiyoriy) telefon raqam kiritiladi. Bir shaxs bitta hisobdan foydalanadi.",
    ru: "При регистрации указываются настоящее имя, действующий email и (по желанию) номер телефона. Одно лицо использует одну учётную запись.",
  } satisfies Tr,
  hisobL3: {
    uz: "Parol va kirish kodlarini sir saqlash Foydalanuvchining zimmasida. Ikki bosqichli himoyani (autentifikator ilovasi) yoqish tavsiya etiladi, administratorlar uchun esa qat'iy talab etiladi.",
    ru: "Сохранение в тайне пароля и кодов входа — обязанность Пользователя. Рекомендуется включить двухфакторную защиту (приложение-аутентификатор); для администраторов она обязательна.",
  } satisfies Tr,
  hisobL4: {
    uz: "Hisobga begona kirish sezilsa, darhol parolni o'zgartirib, «Kabinet → Xavfsizlik» bo'limida boshqa sessiyalarni yoping.",
    ru: "При обнаружении постороннего доступа к учётной записи немедленно смените пароль и завершите остальные сессии в разделе «Кабинет → Безопасность».",
  } satisfies Tr,

  /* 05 Obuna */
  obunaTitle: { uz: "Mutaxassislar uchun obuna", ru: "Подписка для специалистов" } satisfies Tr,
  obunaP1: {
    uz: "Mijoz va Mutaxassis Platformada bir-birini topgach, ko'pincha ishni boshqa kanallarda davom ettiradi. Shu sababli Platformaning asosiy daromadi komissiya emas, balki Mutaxassislarning oylik obunasi hisoblanadi. ",
    ru: "Найдя друг друга на Платформе, Заказчик и Специалист зачастую продолжают работу в других каналах. Поэтому основной доход Платформы — не комиссия, а ежемесячная подписка Специалистов. ",
  } satisfies Tr,
  obunaP1strong: { uz: "Mijozlar uchun Platforma bepul.", ru: "Для Заказчиков Платформа бесплатна." } satisfies Tr,
  tariffs: { uz: "Tariflar: ", ru: "Тарифы: " } satisfies Tr,
  tariffStandard: { uz: "Standart", ru: "Стандарт" } satisfies Tr,
  tariffStandardDesc: { uz: " — bepul (sinov davrida profil ko'rinadi), ", ru: " — бесплатно (в пробный период профиль виден), " } satisfies Tr,
  tariffPro: { uz: (price: string) => ` — oyiga ${price}, `, ru: (price: string) => ` — ${price} в месяц, ` },
  tariffMax: { uz: (price: string) => ` — oyiga ${price}.`, ru: (price: string) => ` — ${price} в месяц.` },
  tariffLimits: {
    uz: " Har tarifning chegaralari (kunlik takliflar, haftalik post/story, portfolio ishlari) va imkoniyatlari ",
    ru: " Ограничения каждого тарифа (предложения в день, посты/сторис в неделю, работы в портфолио) и возможности указаны на странице ",
  } satisfies Tr,
  tariffPricesLink: { uz: "Narxlar", ru: "Цены" } satisfies Tr,
  tariffDiscount: {
    uz: " sahifasida ko'rsatiladi. Pro tarifi uchun uzoq muddatga to'lansa chegirma beriladi (Max'ga ham shu foizlar qo'llanadi): ",
    ru: ". При оплате тарифа Pro на длительный срок предоставляется скидка (те же проценты применяются и к Max): ",
  } satisfies Tr,
  planMonths: { uz: (n: number, price: string) => `${n} oy — ${price}`, ru: (n: number, price: string) => `${n} мес — ${price}` },
  trialBefore: { uz: "Yangi Mutaxassis uchun ro'yxatdan o'tgan kundan boshlab ", ru: "Для нового Специалиста со дня регистрации действует " } satisfies Tr,
  trialStrong: { uz: (days: number) => `${days} kunlik bepul sinov muddati`, ru: (days: number) => `бесплатный пробный период ${days} дней` },
  trialAfter: { uz: " amal qiladi.", ru: "." } satisfies Tr,
  grace: {
    uz: (days: number) =>
      `Obuna (yoki sinov) muddati tugagach ${days > 0 ? `${days} kunlik imtiyozli davr beriladi — bu vaqtda profil odatdagidek ishlaydi.` : "imtiyozli davr berilmaydi."}`,
    ru: (days: number) =>
      `После окончания подписки (или пробного периода) ${days > 0 ? `предоставляется льготный период ${days} дней — в это время профиль работает как обычно.` : "льготный период не предоставляется."}`,
  },
  afterGrace: {
    uz: "Imtiyozli davr ham tugagach, obuna to'lanmaguncha: profil katalog, xarita, qidiruv takliflari va hudud sahifalaridan yashiriladi; to'g'ridan-to'g'ri havola orqali ochilganda kontaktlar ko'rsatilmaydi; yangi buyurtma qabul qilish va e'lonlarga taklif yuborish to'xtatiladi. Boshlangan buyurtmalar va eskroudagi to'lovlar odatdagidek yakunlanadi.",
    ru: "По окончании льготного периода до оплаты подписки: профиль скрывается из каталога, карты, поисковых подсказок и региональных страниц; при открытии по прямой ссылке контакты не показываются; приём новых заказов и отправка предложений на объявления приостанавливаются. Начатые заказы и платежи в эскроу завершаются в обычном порядке.",
  } satisfies Tr,
  payMethods: {
    uz: "To'lov Payme, Click yoki bank o'tkazmasi (administrator tasdiqlaydi) orqali amalga oshiriladi. Avtomatik yechib olish yo'q — har bir davr alohida to'lanadi.",
    ru: "Оплата производится через Payme, Click или банковским переводом (подтверждает администратор). Автоматического списания нет — каждый период оплачивается отдельно.",
  } satisfies Tr,
  renewal: {
    uz: "Yangi to'lov joriy muddat tugagan kundan (yoki muddat o'tib ketgan bo'lsa — to'lov kunidan) boshlab davrni uzaytiradi. Muddat tugashidan 3 kun va 1 kun oldin eslatma yuboriladi.",
    ru: "Новый платёж продлевает период со дня окончания текущего срока (или, если срок уже истёк, — со дня оплаты). За 3 дня и за 1 день до окончания срока направляется напоминание.",
  } satisfies Tr,
  noRefund: {
    uz: "Boshlangan davr uchun to'lov qaytarilmaydi, Platforma aybi bilan xizmat ko'rsatilmagan holatlar bundan mustasno. Narx o'zgarsa, kamida 14 kun oldin e'lon qilinadi va allaqachon to'langan davrga ta'sir qilmaydi.",
    ru: "Оплата за начатый период не возвращается, за исключением случаев неоказания услуги по вине Платформы. Об изменении цены сообщается не менее чем за 14 дней; оно не затрагивает уже оплаченный период.",
  } satisfies Tr,

  /* 06 Eskrou */
  eskrouTitle: { uz: "Eskrou to'lovlar va komissiya", ru: "Эскроу-платежи и комиссия" } satisfies Tr,
  eskrouS1: {
    uz: (min: string) => `Mutaxassis buyurtma narxini belgilaydi (eng kam summa — ${min}), Mijoz uni Payme, Click yoki bank o'tkazmasi orqali to'laydi.`,
    ru: (min: string) => `Специалист устанавливает цену заказа (минимальная сумма — ${min}), Заказчик оплачивает её через Payme, Click или банковским переводом.`,
  },
  eskrouS2: {
    uz: "To'langan pul eskrouda saqlanadi — Mutaxassis ishni bajarayotgan paytda u hech kimga o'tkazilmaydi.",
    ru: "Оплаченные средства хранятся в эскроу — пока Специалист выполняет работу, они никому не перечисляются.",
  } satisfies Tr,
  eskrouS3: {
    uz: "Mutaxassis ishni topshiradi, Mijoz natijani tekshirib «Qabul qilish»ni bosadi va pul Mutaxassis balansiga o'tadi.",
    ru: "Специалист сдаёт работу, Заказчик проверяет результат и нажимает «Принять», после чего средства поступают на баланс Специалиста.",
  } satisfies Tr,
  eskrouS4: {
    uz: (days: number) => `Ish topshirilgandan keyin ${days} kun ichida Mijoz na qabul qilsa, na nizo ochsa — pul avtomatik ravishda Mutaxassisga o'tkaziladi.`,
    ru: (days: number) => `Если в течение ${days} дней после сдачи работы Заказчик не принял её и не открыл спор — средства автоматически перечисляются Специалисту.`,
  },
  commission: {
    uz: (pNew: number, pStd: number, pTop: number, urgent: number) =>
      `Eskrou orqali o'tgan har bir buyurtmadan Platforma komissiyasi Mutaxassisga o'tkaziladigan summadan ushlab qolinadi: yangi Mutaxassislar uchun ${pNew}%, standart darajada ${pStd}%, «Top mutaxassis»lar uchun ${pTop}%. Shoshilinch buyurtma uchun Mijoz ${urgent}% gacha ustama to'lashi mumkin.`,
    ru: (pNew: number, pStd: number, pTop: number, urgent: number) =>
      `С каждого заказа, прошедшего через эскроу, комиссия Платформы удерживается из суммы, перечисляемой Специалисту: для новых Специалистов — ${pNew}%, на стандартном уровне — ${pStd}%, для «Топ-специалистов» — ${pTop}%. За срочный заказ Заказчик может доплатить до ${urgent}%.`,
  },
  payout: {
    uz: (min: string) => `Balansdan pul chiqarish — kamida ${min}; so'rov administrator tomonidan ko'rib chiqiladi. To'lov tizimlari komissiyasi (agar bo'lsa) ularning tariflari bo'yicha.`,
    ru: (min: string) => `Вывод средств с баланса — не менее ${min}; запрос рассматривается администратором. Комиссия платёжных систем (при наличии) — по их тарифам.`,
  },

  /* 07 Qaytarish */
  qaytarishTitle: { uz: "Bekor qilish, qaytarish va nizolar", ru: "Отмена, возврат и споры" } satisfies Tr,
  qaytarishL1: {
    uz: "Ish boshlanishidan oldin buyurtma bekor qilinsa, eskroudagi summa Mijozga to'liq qaytariladi.",
    ru: "При отмене заказа до начала работы сумма в эскроу возвращается Заказчику полностью.",
  } satisfies Tr,
  qaytarishL2: {
    uz: "Ish jarayonida kelishmovchilik chiqsa, istalgan tomon buyurtma sahifasida nizo ochishi mumkin. Nizo davomida pul eskrouda muzlatiladi.",
    ru: "При возникновении разногласий в ходе работы любая сторона может открыть спор на странице заказа. На время спора средства в эскроу замораживаются.",
  } satisfies Tr,
  qaytarishL3: {
    uz: "Administrator buyurtma tarixi, chatdagi yozishmalar va topshirilgan fayllarni ko'rib chiqib qaror qabul qiladi: pulni to'liq Mutaxassisga o'tkazish, to'liq Mijozga qaytarish yoki qisman bo'lish. Shu sababli kelishuvlarni buyurtma chatida yozib qoldirish tavsiya etiladi.",
    ru: "Администратор рассматривает историю заказа, переписку в чате и сданные файлы и принимает решение: перечислить средства Специалисту полностью, вернуть Заказчику полностью или разделить частично. Поэтому рекомендуется фиксировать договорённости в чате заказа.",
  } satisfies Tr,
  qaytarishL4: {
    uz: "Qaytarilgan pul to'lov qilingan usul orqali, to'lov tizimi muddatlarida qaytariladi.",
    ru: "Возврат производится тем же способом, которым была совершена оплата, в сроки платёжной системы.",
  } satisfies Tr,
  qaytarishL5: {
    uz: "Platformadan tashqarida amalga oshirilgan to'lovlar bo'yicha Platforma nizolarni ko'rib chiqmaydi va pulni qaytarmaydi.",
    ru: "По платежам, совершённым вне Платформы, Платформа споры не рассматривает и средства не возвращает.",
  } satisfies Tr,

  /* 08 Taqiqlar */
  taqiqlarTitle: { uz: "Taqiqlangan harakatlar", ru: "Запрещённые действия" } satisfies Tr,
  taqiqL1: {
    uz: "Soxta profil, boshqa shaxs nomidan ish yuritish yoki bloklangandan keyin yangi hisob ochish.",
    ru: "Поддельный профиль, действия от имени другого лица или создание новой учётной записи после блокировки.",
  } satisfies Tr,
  taqiqL2: {
    uz: "Boshqalarning ishini o'z portfoliosi sifatida joylash, mualliflik huquqini buzish.",
    ru: "Размещение чужих работ в качестве собственного портфолио, нарушение авторских прав.",
  } satisfies Tr,
  taqiqL3: {
    uz: "Soxta sharh yozish yoki sharhni pul evaziga o'zgartirishni talab qilish.",
    ru: "Написание поддельных отзывов или требование изменить отзыв за вознаграждение.",
  } satisfies Tr,
  taqiqL4: {
    uz: "Firibgarlik, oldindan pul olib ishni bajarmaslik, boshqa foydalanuvchilarni Platformadagi to'lov o'rniga «xavfsizroq» deb aldash.",
    ru: "Мошенничество, получение предоплаты без выполнения работы, склонение других пользователей к оплате вне Платформы под предлогом «более безопасного» способа.",
  } satisfies Tr,
  taqiqL5: {
    uz: "Haqoratli, kamsituvchi, zo'ravonlikka chaqiruvchi, odobsiz yoki qonunga zid kontent.",
    ru: "Оскорбительный, унижающий, призывающий к насилию, непристойный или противоправный контент.",
  } satisfies Tr,
  taqiqL6: {
    uz: "Spam, ommaviy xabar yuborish, boshqalarning shaxsiy ma'lumotlarini ruxsatsiz yig'ish.",
    ru: "Спам, массовые рассылки, сбор персональных данных других лиц без разрешения.",
  } satisfies Tr,
  taqiqL7: {
    uz: "Platforma xavfsizligini buzishga, limitlarni chetlab o'tishga yoki ma'lumotlarni avtomatik yig'ishga (scraping) urinish.",
    ru: "Попытки нарушить безопасность Платформы, обойти ограничения или автоматически собирать данные (скрейпинг).",
  } satisfies Tr,

  /* 09 Kontent */
  kontentTitle: { uz: "Kontent va intellektual mulk", ru: "Контент и интеллектуальная собственность" } satisfies Tr,
  kontentP1: {
    uz: "Foydalanuvchi joylagan matn, rasm va videolarga bo'lgan huquqlar uning o'zida qoladi. Kontentni joylash orqali Foydalanuvchi Platformaga uni xizmat ko'rsatish maqsadida (profilda ko'rsatish, qidiruv, ijtimoiy tarmoqlardagi ulashish ko'rinishi) bepul, noeksklyuziv tarzda foydalanish huquqini beradi.",
    ru: "Права на размещённые Пользователем тексты, изображения и видео сохраняются за ним. Размещая контент, Пользователь предоставляет Платформе безвозмездное неисключительное право использовать его в целях оказания услуг (показ в профиле, поиск, вид при публикации в социальных сетях).",
  } satisfies Tr,
  kontentP2: {
    uz: "Buyurtma natijasiga bo'lgan huquqlar to'liq to'lov amalga oshgach, agar tomonlar boshqacha kelishmagan bo'lsa, Mijozga o'tadi.",
    ru: "Права на результат заказа переходят к Заказчику после полной оплаты, если стороны не договорились об ином.",
  } satisfies Tr,

  /* 10 Javobgarlik */
  javobgarlikTitle: { uz: "Javobgarlikni cheklash", ru: "Ограничение ответственности" } satisfies Tr,
  javobL1: {
    uz: "Platforma «boricha» (as is) taqdim etiladi; texnik nosozliklar, rejalashtirilgan ishlar va uchinchi tomon xizmatlari (to'lov tizimlari, hosting) uzilishlari bo'lishi mumkin.",
    ru: "Платформа предоставляется «как есть» (as is); возможны технические сбои, плановые работы и перебои в работе сторонних сервисов (платёжные системы, хостинг).",
  } satisfies Tr,
  javobL2: {
    uz: "Platforma Foydalanuvchilar o'rtasidagi bevosita kelishuvlar, Platformadan tashqaridagi to'lovlar va ular natijasida yetgan zarar uchun javob bermaydi.",
    ru: "Платформа не несёт ответственности за прямые договорённости между Пользователями, платежи вне Платформы и причинённый в результате них ущерб.",
  } satisfies Tr,
  javobL3: {
    uz: "Har qanday holatda Platformaning javobgarligi Foydalanuvchi oxirgi 3 oyda Platformaga to'lagan obuna va komissiya summasidan oshmaydi.",
    ru: "В любом случае ответственность Платформы не превышает суммы подписки и комиссий, уплаченных Пользователем Платформе за последние 3 месяца.",
  } satisfies Tr,
  javobL4: {
    uz: "Fors-major holatlarida (tabiiy ofat, davlat organlari qarorlari, keng ko'lamli tarmoq uzilishlari) tomonlar majburiyatlarni bajarmaganlik uchun javobgar emas.",
    ru: "При обстоятельствах непреодолимой силы (стихийные бедствия, решения государственных органов, масштабные сетевые сбои) стороны не несут ответственности за неисполнение обязательств.",
  } satisfies Tr,

  /* 11 Bloklash */
  bloklashTitle: { uz: "Hisobni bloklash va o'chirish", ru: "Блокировка и удаление учётной записи" } satisfies Tr,
  bloklashP1: {
    uz: "Ushbu shartlar buzilganda Platforma ogohlantirishsiz profilni yashirish, hisobni vaqtincha yoki butunlay bloklash huquqiga ega. Qoidabuzarlik tufayli bloklanganda to'langan obunaning qolgan qismi qaytarilmaydi.",
    ru: "При нарушении настоящих условий Платформа вправе без предупреждения скрыть профиль, временно или полностью заблокировать учётную запись. При блокировке за нарушение остаток оплаченной подписки не возвращается.",
  } satisfies Tr,
  bloklashP2: {
    uz: "Foydalanuvchi istalgan vaqtda «Kabinet → Xavfsizlik» bo'limida hisobini o'chirishi mumkin. Eskroudagi to'lovlar yoki kutilayotgan pul chiqarish so'rovi yakunlanmaguncha o'chirish amalga oshmaydi.",
    ru: "Пользователь может в любое время удалить учётную запись в разделе «Кабинет → Безопасность». Удаление невозможно до завершения платежей в эскроу или ожидающего запроса на вывод средств.",
  } satisfies Tr,

  /* 12 O'zgarishlar */
  ozgarishlarTitle: { uz: "Shartlarni o'zgartirish", ru: "Изменение условий" } satisfies Tr,
  ozgarishlarP1: {
    uz: "Platforma ushbu shartlarni o'zgartirishi mumkin. Yangi versiya shu sahifada sana va versiya raqami bilan e'lon qilinadi, Kabinetda esa yangilangan shartlarni qabul qilish taklif etiladi. Yangi versiya kuchga kirgandan keyin Platformadan foydalanishni davom ettirish uni qabul qilish hisoblanadi. Joriy versiya: ",
    ru: "Платформа вправе изменять настоящие условия. Новая версия публикуется на этой странице с указанием даты и номера версии, а в Кабинете предлагается принять обновлённые условия. Продолжение использования Платформы после вступления новой версии в силу считается её принятием. Текущая версия: ",
  } satisfies Tr,

  /* 13 Aloqa */
  aloqaTitle: { uz: "Nizolarni hal qilish va aloqa", ru: "Разрешение споров и контакты" } satisfies Tr,
  aloqaP1: {
    uz: "Ushbu oferta O'zbekiston Respublikasi qonunchiligiga muvofiq tartibga solinadi. Kelishmovchiliklar avvalo muzokaralar yo'li bilan, kelishuvga erishilmasa — qonunchilikda belgilangan tartibda sudda hal qilinadi.",
    ru: "Настоящая оферта регулируется законодательством Республики Узбекистан. Разногласия разрешаются прежде всего путём переговоров, а при недостижении согласия — в суде в порядке, установленном законодательством.",
  } satisfies Tr,
  aloqaP2a: { uz: "Savollar va murojaatlar uchun: Telegram ", ru: "Для вопросов и обращений: Telegram " } satisfies Tr,
  aloqaP2b: {
    uz: ". Hisob va buyurtmalarga oid murojaatlarni Kabinet orqali yuborish tavsiya etiladi.",
    ru: ". Обращения по учётной записи и заказам рекомендуется направлять через Кабинет.",
  } satisfies Tr,
};

/* ------------------------------------------------------------------ */
/* MAXFIYLIK SIYOSATI                                                  */
/* ------------------------------------------------------------------ */
export const MAXFIYLIK = {
  metaTitle: { uz: "Maxfiylik siyosati", ru: "Политика конфиденциальности" } satisfies Tr,
  metaDescription: {
    uz: "Kasb Egalari qanday shaxsiy ma'lumotlarni yig'adi, kim ko'radi (har bir maydon bo'yicha ko'rinish), qancha saqlaydi va ma'lumotlarni qanday yuklab olish yoki o'chirish mumkin.",
    ru: "Какие персональные данные собирает Kasb Egalari, кто их видит (видимость по каждому полю), сколько они хранятся и как данные можно скачать или удалить.",
  } satisfies Tr,
  title: { uz: "Maxfiylik", ru: "Политика" } satisfies Tr,
  accent: { uz: "siyosati", ru: "конфиденциальности" } satisfies Tr,
  intro: {
    uz: "Qanday ma'lumotlar yig'iladi, kim nimani ko'radi, qancha saqlanadi va ularni qanday yuklab olish yoki o'chirish mumkin — qisqa va aniq.",
    ru: "Какие данные собираются, кто что видит, сколько они хранятся и как их скачать или удалить — коротко и ясно.",
  } satisfies Tr,

  /* 01 */
  umumiyTitle: { uz: "Umumiy qoidalar", ru: "Общие положения" } satisfies Tr,
  umumiyP1a: {
    uz: (site: string) =>
      `Ushbu siyosat ${site} platformasi foydalanuvchilarining shaxsga doir ma'lumotlari qanday yig'ilishi, ishlatilishi, saqlanishi va himoya qilinishini tushuntiradi. Siyosat O'zbekiston Respublikasining «Shaxsga doir ma'lumotlar to'g'risida»gi Qonuni talablariga muvofiq tuzilgan va `,
    ru: (site: string) =>
      `Настоящая политика разъясняет, как собираются, используются, хранятся и защищаются персональные данные пользователей платформы ${site}. Политика составлена в соответствии с требованиями Закона Республики Узбекистан «О персональных данных» и является неотъемлемой частью `,
  },
  umumiyP1link: { uz: "Ommaviy oferta", ru: "Публичной оферты" } satisfies Tr,
  umumiyP1b: { uz: "ning ajralmas qismi hisoblanadi.", ru: "." } satisfies Tr,
  umumiyP2: {
    uz: "Biz faqat xizmat ko'rsatish uchun zarur ma'lumotlarni yig'amiz va ularni hech qachon sotmaymiz.",
    ru: "Мы собираем только данные, необходимые для оказания услуг, и никогда их не продаём.",
  } satisfies Tr,

  /* 02 */
  malumotlarTitle: { uz: "Qanday ma'lumotlar yig'iladi", ru: "Какие данные собираются" } satisfies Tr,
  dAccount: { uz: "Hisob:", ru: "Учётная запись:" } satisfies Tr,
  dAccountDesc: {
    uz: " ism, email, parol (faqat bcrypt hash ko'rinishida), ixtiyoriy telefon raqam, jins va avatar.",
    ru: " имя, email, пароль (только в виде bcrypt-хеша), необязательные номер телефона, пол и аватар.",
  } satisfies Tr,
  dProfile: { uz: "Mutaxassis profili:", ru: "Профиль специалиста:" } satisfies Tr,
  dProfileDesc: {
    uz: " yo'nalish, hudud va shahar, bio, ko'nikmalar, uskunalar, narxlar va paketlar, portfolio, sertifikatlar, ish vaqti, ijtimoiy tarmoq havolalari.",
    ru: " направление, регион и город, биография, навыки, оборудование, цены и пакеты, портфолио, сертификаты, рабочее время, ссылки на социальные сети.",
  } satisfies Tr,
  dActivity: { uz: "Faoliyat:", ru: "Активность:" } satisfies Tr,
  dActivityDesc: {
    uz: " buyurtmalar, e'lonlar va takliflar, buyurtma chatidagi xabarlar va fayllar, sharhlar, sevimlilar, saqlangan qidiruvlar, bildirishnomalar.",
    ru: " заказы, объявления и предложения, сообщения и файлы в чате заказа, отзывы, избранное, сохранённые поиски, уведомления.",
  } satisfies Tr,
  dPayments: { uz: "To'lovlar:", ru: "Платежи:" } satisfies Tr,
  dPaymentsDesc: {
    uz: " summa, holat, to'lov tizimidagi tranzaksiya raqami. Karta raqami va CVV Platformaga kelmaydi — ularni Payme yoki Click o'zi qayta ishlaydi. Pul chiqarish rekvizitlari shifrlangan (AES-256-GCM) holda saqlanadi, ro'yxatlarda faqat maskalangan ko'rinishi chiqadi.",
    ru: " сумма, статус, номер транзакции в платёжной системе. Номер карты и CVV на Платформу не поступают — их обрабатывают Payme или Click. Реквизиты для вывода средств хранятся в зашифрованном виде (AES-256-GCM), в списках отображается только маскированный вариант.",
  } satisfies Tr,
  dTech: { uz: "Texnik ma'lumotlar:", ru: "Технические данные:" } satisfies Tr,
  dTechDesc: {
    uz: " IP manzil (suiiste'mollarga qarshi limitlar va xavfsizlik jurnali uchun), brauzer va qurilma turi. Faol sessiyalar ro'yxatida IP manzil ochiq saqlanmaydi — faqat uning sha256 hashi.",
    ru: " IP-адрес (для ограничений против злоупотреблений и журнала безопасности), тип браузера и устройства. В списке активных сессий IP-адрес в открытом виде не хранится — только его sha256-хеш.",
  } satisfies Tr,

  /* 03 */
  cookieTitle: { uz: "Cookie va brauzer xotirasi", ru: "Cookie и память браузера" } satisfies Tr,
  cookieL1: {
    uz: " — kirish holatini saqlovchi himoyalangan (HttpOnly) cookie. «Meni eslab qolish» bilan 30 kun, aks holda brauzer yopilguncha amal qiladi.",
    ru: " — защищённый (HttpOnly) cookie, хранящий состояние входа. С опцией «Запомнить меня» действует 30 дней, иначе — до закрытия браузера.",
  } satisfies Tr,
  cookieL2: {
    uz: "Tanlangan tema (yorug'/qorong'i) brauzeringizning lokal xotirasida saqlanadi.",
    ru: "Выбранная тема (светлая/тёмная) сохраняется в локальной памяти вашего браузера.",
  } satisfies Tr,
  cookieL3: {
    uz: "Reklama va kuzatuv (tracking) cookie'lari hamda uchinchi tomon reklama tarmoqlari ishlatilmaydi.",
    ru: "Рекламные и отслеживающие (tracking) cookie, а также сторонние рекламные сети не используются.",
  } satisfies Tr,

  /* 04 */
  maqsadlarTitle: { uz: "Ma'lumotlardan foydalanish maqsadlari", ru: "Цели использования данных" } satisfies Tr,
  maqsadL1: {
    uz: "Hisob yaratish, kirish va hisobni himoya qilish (jumladan, ikki bosqichli himoya va qurilmalar ro'yxati).",
    ru: "Создание учётной записи, вход и защита учётной записи (включая двухфакторную защиту и список устройств).",
  } satisfies Tr,
  maqsadL2: {
    uz: "Mutaxassislarni katalog, xarita va qidiruvda ko'rsatish, buyurtma va to'lovlarni amalga oshirish.",
    ru: "Показ специалистов в каталоге, на карте и в поиске, оформление заказов и платежей.",
  } satisfies Tr,
  maqsadL3: {
    uz: "Muhim hodisalar haqida bildirishnoma va email yuborish (buyurtma, to'lov, xabar, obuna muddati).",
    ru: "Отправка уведомлений и email о важных событиях (заказ, платёж, сообщение, срок подписки).",
  } satisfies Tr,
  maqsadL4: {
    uz: "Firibgarlik, spam va suiiste'mollarning oldini olish, nizolarni ko'rib chiqish.",
    ru: "Предотвращение мошенничества, спама и злоупотреблений, рассмотрение споров.",
  } satisfies Tr,
  maqsadL5: { uz: "Qonunchilik talablarini bajarish.", ru: "Выполнение требований законодательства." } satisfies Tr,

  /* 05 */
  korinishTitle: { uz: "Kim nimani ko'radi", ru: "Кто что видит" } satisfies Tr,
  korinishP1a: {
    uz: "Mutaxassis har bir kontakt maydonining kimga ko'rinishini o'zi tanlaydi («Kabinet → Profil → Maxfiylik»). Darajalar: ",
    ru: "Специалист сам выбирает, кому виден каждый контактный пункт («Кабинет → Профиль → Конфиденциальность»). Уровни: ",
  } satisfies Tr,
  korinishP1b: {
    uz: ". Administratorlar nizo va shikoyatlarni ko'rib chiqish uchun barcha maydonlarni ko'ra oladi.",
    ru: ". Администраторы могут видеть все поля для рассмотрения споров и жалоб.",
  } satisfies Tr,
  tableCaption: { uz: "Maydonlarning standart ko'rinishi", ru: "Видимость полей по умолчанию" } satisfies Tr,
  thField: { uz: "Maydon", ru: "Поле" } satisfies Tr,
  thDefault: { uz: "Standart ko'rinish", ru: "Видимость по умолчанию" } satisfies Tr,
  korinishP2: {
    uz: "Ism, yo'nalish, hudud, portfolio, narxlar va sharhlar ommaviy profilning bir qismi. Mutaxassis obunasi faol bo'lmasa, profil katalogdan yashiriladi va kontaktlar ko'rsatilmaydi. Mijozning ism va kontaktlari faqat u buyurtma bergan Mutaxassisga ko'rinadi.",
    ru: "Имя, направление, регион, портфолио, цены и отзывы являются частью публичного профиля. Если подписка Специалиста неактивна, профиль скрывается из каталога и контакты не показываются. Имя и контакты Заказчика видны только Специалисту, которому он сделал заказ.",
  } satisfies Tr,

  /* 06 */
  uchinchiTitle: { uz: "Uchinchi shaxslarga berish", ru: "Передача третьим лицам" } satisfies Tr,
  uchinchiP1: {
    uz: "Ma'lumotlar faqat xizmat ko'rsatish uchun zarur hajmda quyidagilarga uzatiladi:",
    ru: "Данные передаются только в объёме, необходимом для оказания услуг, следующим получателям:",
  } satisfies Tr,
  uchinchiL1: { uz: "to'lov tizimlari (Payme, Click) — to'lov summasi va buyurtma raqami;", ru: "платёжные системы (Payme, Click) — сумма платежа и номер заказа;" } satisfies Tr,
  uchinchiL2: { uz: "email yuborish xizmati — email manzil va xat matni;", ru: "сервис отправки email — адрес email и текст письма;" } satisfies Tr,
  uchinchiL3: { uz: "hosting va ma'lumotlar bazasi provayderlari — xizmat ishlashi uchun;", ru: "провайдеры хостинга и базы данных — для работы сервиса;" } satisfies Tr,
  uchinchiL4: {
    uz: "vakolatli davlat organlari — faqat qonunda belgilangan asos va tartibda.",
    ru: "уполномоченные государственные органы — только на основаниях и в порядке, установленных законом.",
  } satisfies Tr,
  uchinchiP2: { uz: "Ma'lumotlar reklama maqsadida sotilmaydi va uzatilmaydi.", ru: "Данные не продаются и не передаются в рекламных целях." } satisfies Tr,

  /* 07 */
  saqlashTitle: { uz: "Saqlash muddatlari", ru: "Сроки хранения" } satisfies Tr,
  saqlashL1: { uz: "Hisob va profil ma'lumotlari — hisob o'chirilguncha.", ru: "Данные учётной записи и профиля — до удаления учётной записи." } satisfies Tr,
  saqlashL2: {
    uz: "Buyurtma va to'lov tarixi — hisob o'chirilgandan keyin ham anonim ko'rinishda (ism va kontaktlarsiz) buxgalteriya va nizolar uchun saqlanadi.",
    ru: "История заказов и платежей — сохраняется и после удаления учётной записи в анонимном виде (без имени и контактов) для бухгалтерии и споров.",
  } satisfies Tr,
  saqlashL3: { uz: "Xavfsizlik jurnali (kirishlar, muhim amallar) — 180 kun.", ru: "Журнал безопасности (входы, важные действия) — 180 дней." } satisfies Tr,
  saqlashL4: { uz: "Sessiyalar — muddati tugagach yoki yopilgach ko'pi bilan 30 kun.", ru: "Сессии — не более 30 дней после истечения срока или завершения." } satisfies Tr,
  saqlashL5: {
    uz: "Email tasdiqlash kodlari — 15 daqiqa, parol tiklash havolalari — 1 soat (bir martalik).",
    ru: "Коды подтверждения email — 15 минут, ссылки для восстановления пароля — 1 час (одноразовые).",
  } satisfies Tr,
  saqlashL6: { uz: "Limit hisoblagichlari — tegishli vaqt oynasi tugaguncha.", ru: "Счётчики ограничений — до окончания соответствующего временного окна." } satisfies Tr,

  /* 08 */
  xavfsizlikTitle: { uz: "Ma'lumotlar xavfsizligi", ru: "Безопасность данных" } satisfies Tr,
  xavfL1: {
    uz: "Parollar bcrypt bilan hashlanadi; ikki bosqichli himoya siri va pul chiqarish rekvizitlari AES-256-GCM bilan shifrlanadi; zaxira kodlari faqat hash ko'rinishida saqlanadi.",
    ru: "Пароли хешируются bcrypt; секрет двухфакторной защиты и реквизиты для вывода средств шифруются AES-256-GCM; резервные коды хранятся только в виде хеша.",
  } satisfies Tr,
  xavfL2: {
    uz: "Barcha ulanishlar HTTPS orqali; sessiya cookie'si JavaScript'dan yashirin (HttpOnly) va saytlararo so'rovlardan himoyalangan.",
    ru: "Все соединения — по HTTPS; cookie сессии скрыт от JavaScript (HttpOnly) и защищён от межсайтовых запросов.",
  } satisfies Tr,
  xavfL3: {
    uz: "Kirish urinishlari va boshqa sezgir amallar soni cheklangan; muhim amallar xavfsizlik jurnaliga yoziladi.",
    ru: "Количество попыток входа и других чувствительных действий ограничено; важные действия записываются в журнал безопасности.",
  } satisfies Tr,
  xavfL4: {
    uz: "Har bir qurilma sessiyasini «Kabinet → Xavfsizlik» bo'limida ko'rish va alohida yopish mumkin.",
    ru: "Сессию каждого устройства можно посмотреть и завершить отдельно в разделе «Кабинет → Безопасность».",
  } satisfies Tr,

  /* 09 */
  huquqlarTitle: { uz: "Sizning huquqlaringiz", ru: "Ваши права" } satisfies Tr,
  rView: { uz: "Ko'rish va eksport:", ru: "Просмотр и экспорт:" } satisfies Tr,
  rViewDesc: {
    uz: " «Kabinet → Xavfsizlik → Ma'lumotlarimni yuklab olish» — barcha ma'lumotlaringiz bitta JSON faylda.",
    ru: " «Кабинет → Безопасность → Скачать мои данные» — все ваши данные в одном JSON-файле.",
  } satisfies Tr,
  rFix: { uz: "Tuzatish:", ru: "Исправление:" } satisfies Tr,
  rFixDesc: {
    uz: " ism, kontaktlar va profilni «Kabinet → Profil»da istalgan payt o'zgartirasiz.",
    ru: " имя, контакты и профиль можно изменить в любое время в «Кабинет → Профиль».",
  } satisfies Tr,
  rVisibility: { uz: "Ko'rinishni boshqarish:", ru: "Управление видимостью:" } satisfies Tr,
  rVisibilityDesc: { uz: " har bir kontakt maydoni uchun daraja tanlanadi.", ru: " для каждого контактного поля выбирается уровень." } satisfies Tr,
  rEmail: { uz: "Email bildirishnomalardan voz kechish:", ru: "Отказ от email-уведомлений:" } satisfies Tr,
  rEmailDesc: {
    uz: " «Kabinet → Profil → Email bildirishnomalar» tugmasi. Xavfsizlikka oid xatlar (parol tiklash, tasdiqlash kodi) baribir yuboriladi.",
    ru: " кнопка «Кабинет → Профиль → Email-уведомления». Письма, связанные с безопасностью (восстановление пароля, код подтверждения), отправляются в любом случае.",
  } satisfies Tr,
  rDelete: { uz: "O'chirish:", ru: "Удаление:" } satisfies Tr,
  rDeleteDesc: {
    uz: " «Kabinet → Xavfsizlik → Akkauntni o'chirish» — ism, email, telefon, profil va portfolio o'chiriladi, buyurtma tarixi anonimlashtiriladi.",
    ru: " «Кабинет → Безопасность → Удалить аккаунт» — имя, email, телефон, профиль и портфолио удаляются, история заказов анонимизируется.",
  } satisfies Tr,

  /* 10 */
  bolalarTitle: { uz: "Voyaga yetmaganlar", ru: "Несовершеннолетние" } satisfies Tr,
  bolalarP1: {
    uz: "Platforma 16 yoshga to'lmagan shaxslarga mo'ljallanmagan. Bunday foydalanuvchi ma'lumotlari aniqlansa, hisob o'chiriladi.",
    ru: "Платформа не предназначена для лиц младше 16 лет. При обнаружении данных такого пользователя учётная запись удаляется.",
  } satisfies Tr,

  /* 11 */
  ozgarishlarTitle: { uz: "Siyosatni o'zgartirish", ru: "Изменение политики" } satisfies Tr,
  ozgarishlarP1: {
    uz: "Siyosat yangilansa, shu sahifada yangi versiya va sana e'lon qilinadi, Kabinetda esa yangilangan hujjatni qabul qilish taklif etiladi. Joriy versiya: ",
    ru: "При обновлении политики на этой странице публикуются новая версия и дата, а в Кабинете предлагается принять обновлённый документ. Текущая версия: ",
  } satisfies Tr,

  /* 12 */
  aloqaTitle: { uz: "Aloqa", ru: "Контакты" } satisfies Tr,
  aloqaP1a: {
    uz: "Shaxsiy ma'lumotlarga oid savol va so'rovlar uchun: Telegram ",
    ru: "По вопросам и запросам, связанным с персональными данными: Telegram ",
  } satisfies Tr,
  aloqaP1b: { uz: ". So'rovlarga 30 kun ichida javob beramiz.", ru: ". На запросы отвечаем в течение 30 дней." } satisfies Tr,
};

/** Ko'rinish darajalari (constants.ts VISIBILITY_LEVELS) — ruscha yorliq va tavsif */
export const VISIBILITY_LEVEL_TR: Record<string, { label: Tr; description: Tr }> = {
  public: { label: { uz: "Hammaga", ru: "Всем" }, description: { uz: "Saytga kirgan har kim ko'radi", ru: "Видит любой посетитель сайта" } },
  clients: { label: { uz: "Faqat ro'yxatdan o'tganlarga", ru: "Только зарегистрированным" }, description: { uz: "Tizimga kirgan foydalanuvchilar ko'radi", ru: "Видят вошедшие в систему пользователи" } },
  orders: { label: { uz: "Faqat buyurtmachilarga", ru: "Только заказчикам" }, description: { uz: "Buyurtmasi qabul qilingan mijozlar ko'radi", ru: "Видят заказчики с принятым заказом" } },
  hidden: { label: { uz: "Yashirin", ru: "Скрыто" }, description: { uz: "Hech kimga ko'rinmaydi", ru: "Не видно никому" } },
};

/** Ko'rinish maydonlari (constants.ts VISIBILITY_FIELDS) — ruscha yorliq */
export const VISIBILITY_FIELD_TR: Record<string, Tr> = {
  phone: { uz: "Telefon raqam", ru: "Номер телефона" },
  telegram: { uz: "Telegram", ru: "Telegram" },
  instagram: { uz: "Instagram", ru: "Instagram" },
  youtube: { uz: "YouTube", ru: "YouTube" },
  website: { uz: "Veb-sayt", ru: "Веб-сайт" },
  email: { uz: "Email", ru: "Email" },
  schedule: { uz: "Ish vaqti", ru: "Рабочее время" },
  gender: { uz: "Jins", ru: "Пол" },
  city: { uz: "Shahar", ru: "Город" },
};
