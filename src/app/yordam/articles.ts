/**
 * Yordam markazi maqolalari (F73) — statik kontent (server va klientda bir xil; Intl ishlatilmaydi).
 * Raqamlar constants.ts'dagi standart qiymatlardan olinadi; admin sozlamani o'zgartirsa, aniq qiymat
 * Narxlar sahifasida va kabinetda ko'rinadi — maqolalarda "standart" deb ataladi.
 */
import { JOB_TTL_DAYS, PLATFORM_DEFAULTS, PROPOSAL_DAILY_LIMIT, SUBSCRIPTION_PLANS, TOP_RATED_RULE } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";

/** payments/service.ts AUTO_RELEASE_DAYS bilan bir xil (u server moduli — bu yerga import qilinmaydi) */
const AUTO_RELEASE_DAYS_DEFAULT = 7;

export type HelpCategoryKey = "mijozlar" | "mutaxassislar" | "hamjamiyat" | "vakansiyalar" | "xavfsizlik";

export interface HelpCategory {
  key: HelpCategoryKey;
  title: string;
  description: string;
}

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "note"; text: string; tone?: "info" | "warning" };

export interface HelpArticle {
  slug: string;
  category: HelpCategoryKey;
  title: string;
  summary: string;
  /** Qidiruv uchun qo'shimcha so'zlar (sinonimlar, ruscha/inglizcha atamalar) */
  keywords: string[];
  body: HelpBlock[];
  related: string[];
  cta?: { href: string; label: string };
  /** YYYY-MM-DD */
  updated: string;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { key: "mijozlar", title: "Mijozlar uchun", description: "Buyurtma berish, eskrou orqali xavfsiz to'lov, nizo va pulni qaytarish." },
  { key: "mutaxassislar", title: "Mutaxassislar uchun", description: "Profil, oylik obuna va sinov muddati, komissiya, pul chiqarish, takliflar." },
  { key: "hamjamiyat", title: "Jamoalar va kanallar", description: "Guruhlar, kanallar, rasmiy kanal, lenta va chat, jonli efirlar." },
  { key: "vakansiyalar", title: "Vakansiyalar", description: "Ish joylash, rezyume, ariza va holatlar — to'lovsiz." },
  { key: "xavfsizlik", title: "Xavfsizlik", description: "Ikki bosqichli himoya va firibgarlardan saqlanish." },
];

const som = (n: number) => `${formatNumber(n)} so'm`;
const price = PLATFORM_DEFAULTS.subscriptionPrice;
const planPrice = (months: number, pct: number) => Math.round((price * months * (100 - pct)) / 100 / 1000) * 1000;
const plans = SUBSCRIPTION_PLANS.map((p) => `${p.months} oy — ${som(planPrice(p.months, p.discountPct))}${p.discountPct ? ` (−${p.discountPct}%)` : ""}`);
const UPDATED = "2026-10-13";

export const HELP_ARTICLES: HelpArticle[] = [
  /* ------------------------------ Mijozlar ------------------------------ */
  {
    slug: "qanday-buyurtma-berish",
    category: "mijozlar",
    title: "Qanday buyurtma berish",
    summary: "Mutaxassisni xarita yoki ro'yxatdan toping, loyihani yozing va narxni kelishing — 5 daqiqalik ish.",
    keywords: ["buyurtma", "zakaz", "order", "mutaxassis topish", "videograf", "montajor", "narx"],
    body: [
      { type: "p", text: "Kasb Egalari platformasida buyurtma ikki yo'l bilan beriladi: mutaxassisni o'zingiz tanlaysiz yoki e'lon joylab, takliflarni kutasiz." },
      { type: "h", text: "Mutaxassisni tanlab buyurtma berish" },
      {
        type: "steps",
        items: [
          "Xaritada viloyatni bosing yoki «Mutaxassislar» ro'yxatida yo'nalish, narx, ish turi bo'yicha filtrlang.",
          "Profilda portfolio, sharhlar, paketlar va ish vaqtini ko'ring. Band sanalar kalendarda belgilangan.",
          "«Buyurtma berish» tugmasini bosing: loyiha nomi, tavsif, muddat va taxminiy byudjetni yozing. Brief yoki referens fayllarni biriktirishingiz mumkin.",
          "Mutaxassis buyurtmani qabul qiladi va aniq narxni belgilaydi. Narx sizga mos kelmasa — qarshi taklif yuboring.",
          "Narx kelishilgach, eskrou orqali to'laysiz — ish boshlanadi. Buyurtma chatida fayl va izohlar almashasiz.",
        ],
      },
      { type: "h", text: "E'lon joylab takliflar olish" },
      { type: "p", text: `«Ishlar» bo'limida «E'lon joylash» orqali loyihangizni yozing. Mutaxassislar narx va muddat bilan taklif yuboradi; siz eng mosini tanlaysiz va u avtomatik buyurtmaga aylanadi. E'lon ${JOB_TTL_DAYS} kun faol turadi.` },
      { type: "note", text: "Mijozlar uchun platforma bepul: ro'yxatdan o'tish, qidiruv, e'lon joylash va buyurtma berish uchun to'lov olinmaydi." },
    ],
    related: ["eskrou-qanday-ishlaydi", "nizo-ochish", "firibgarlikdan-saqlanish"],
    cta: { href: "/mutaxassislar", label: "Mutaxassis topish" },
    updated: UPDATED,
  },
  {
    slug: "eskrou-qanday-ishlaydi",
    category: "mijozlar",
    title: "Eskrou (xavfsiz to'lov) qanday ishlaydi",
    summary: "Pul ish qabul qilinguncha platformada turadi va faqat siz tasdiqlaganingizdan keyin mutaxassisga o'tadi.",
    keywords: ["eskrou", "escrow", "to'lov", "payme", "click", "xavfsiz to'lov", "oplata", "kafolat"],
    body: [
      { type: "p", text: "Eskrou — mijoz va mutaxassis o'rtasidagi kafolatlangan to'lov. Siz to'lagan pul darhol mutaxassisga emas, platformadagi maxsus hisobga tushadi." },
      {
        type: "steps",
        items: [
          "Mutaxassis narxni belgilaydi, siz uni qabul qilasiz.",
          "Payme, Click yoki karta/bank o'tkazmasi orqali to'laysiz. O'tkazmani admin tekshirib tasdiqlaydi.",
          "Pul eskrouda turadi — mutaxassis to'lov tasdiqlanganini ko'radi va ishni boshlaydi.",
          "Ish topshirilgach, uni tekshirib «Ishni qabul qilish» tugmasini bosasiz — pul mutaxassisga o'tadi.",
        ],
      },
      { type: "note", text: `Ish topshirilganidan keyin ${AUTO_RELEASE_DAYS_DEFAULT} kun ichida javob bermasangiz, to'lov avtomatik mutaxassisga o'tkaziladi. Ish sifatiga e'tirozingiz bo'lsa — shu muddat ichida nizo oching.`, tone: "warning" },
      { type: "h", text: "Chek va hisob-faktura" },
      { type: "p", text: "Har bir to'lov uchun chek «Kabinet → To'lovlar» bo'limida turadi; uni chop etish yoki PDF sifatida saqlash mumkin." },
    ],
    related: ["nizo-ochish", "pulni-qaytarish", "qanday-buyurtma-berish"],
    updated: UPDATED,
  },
  {
    slug: "nizo-ochish",
    category: "mijozlar",
    title: "Nizo: kelishmovchilik bo'lsa nima qilish kerak",
    summary: "Ish kelishilganidek bajarilmagan bo'lsa, eskroudagi buyurtma bo'yicha nizo oching — admin ikkala tomonni eshitib qaror qiladi.",
    keywords: ["nizo", "spor", "dispute", "shikoyat", "arbitraj", "kelishmovchilik"],
    body: [
      { type: "p", text: "Avval mutaxassis bilan buyurtma chatida gaplashing: ko'p masalalar tuzatish (revision) bilan hal bo'ladi. Kelisha olmasangiz, nizo oching." },
      {
        type: "steps",
        items: [
          "Kabinetda buyurtmani oching va «Nizo ochish» tugmasini bosing.",
          "Sababni aniq yozing: nima kelishilgan edi, nima bajarilmadi. Dalillar (fayllar, chat) buyurtma tarixida saqlanadi.",
          "Pul eskrouda muzlatiladi — avtomatik o'tkazish to'xtaydi.",
          "Admin ikkala tomonning dalillarini ko'rib chiqadi va qaror qiladi: pul mutaxassisga o'tadi yoki sizga qaytariladi.",
        ],
      },
      { type: "note", text: "Nizoni mutaxassis ham ochishi mumkin (masalan, mijoz javob bermasa). Qaror haqida ikkala tomonga bildirishnoma keladi." },
    ],
    related: ["pulni-qaytarish", "eskrou-qanday-ishlaydi"],
    updated: UPDATED,
  },
  {
    slug: "pulni-qaytarish",
    category: "mijozlar",
    title: "Pulni qaytarish (refund)",
    summary: "Buyurtma bekor qilinsa yoki nizo sizning foydangizga hal bo'lsa, eskroudagi pul to'liq qaytariladi.",
    keywords: ["qaytarish", "refund", "vozvrat", "bekor qilish", "otmena", "pul qaytdi"],
    body: [
      { type: "p", text: "Eskrou tufayli pul mutaxassisga faqat siz ishni qabul qilganingizdan keyin o'tadi. Shuning uchun qaytarish oddiy:" },
      {
        type: "list",
        items: [
          "Ish boshlanmasdan buyurtma bekor qilinsa — admin to'lovni qaytaradi.",
          "Nizo sizning foydangizga hal bo'lsa — pul to'liq qaytariladi.",
          "Pul to'lov qilingan usulga (Payme/Click karta yoki o'tkazma rekvizitiga) qaytariladi; bank muddati 1–5 ish kuni.",
        ],
      },
      { type: "note", text: "Ish qabul qilingan (yoki avtomatik o'tkazilgan) to'lov qaytarilmaydi — shuning uchun ishni tekshirmasdan «qabul qilish»ni bosmang.", tone: "warning" },
    ],
    related: ["nizo-ochish", "eskrou-qanday-ishlaydi"],
    updated: UPDATED,
  },

  /* ---------------------------- Mutaxassislar ---------------------------- */
  {
    slug: "profilni-toldirish",
    category: "mutaxassislar",
    title: "Profilni to'ldirish",
    summary: "To'liq profil ko'proq buyurtma oladi: sarlavha, bio, narx, portfolio, ish vaqti va paketlar.",
    keywords: ["profil", "portfolio", "anketa", "bio", "paket", "narx", "tasdiqlash", "verified"],
    body: [
      { type: "p", text: "Mijozlar sizni xarita, ro'yxat va qidiruv orqali topadi. Kabinetdagi «Profil to'liqligi» halqasi nimalar qolganini ko'rsatadi." },
      {
        type: "list",
        items: [
          "Aniq sarlavha: masalan, «To'y videografi · Sony FX3».",
          "Kamida 80 belgili bio: tajriba, uslub, qaysi loyihalarni olasiz.",
          "Narx, paketlar (Boshlang'ich / Standart / Premium) va ish turlari (to'y, reklama, korporativ…).",
          "Portfolioda kamida 3 ta eng yaxshi ish; oldin/keyin juftliklari va teglar qidiruvga yordam beradi.",
          "Ish vaqti va band sanalar — mijoz bo'sh kuningizni ko'radi.",
          "Maxfiylik: telefon va ijtimoiy tarmoqlarni kim ko'rishini o'zingiz tanlaysiz.",
        ],
      },
      { type: "note", text: "Admin profilingizni tekshirib «Tasdiqlangan» belgisini beradi — bu mijoz ishonchini oshiradi." },
    ],
    related: ["obuna-va-sinov-muddati", "komissiya-darajalari", "takliflar-limiti"],
    cta: { href: "/kabinet/profil", label: "Profilni tahrirlash" },
    updated: UPDATED,
  },
  {
    slug: "obuna-va-sinov-muddati",
    category: "mutaxassislar",
    title: `Obuna: ${som(price)}/oy va bepul sinov muddati`,
    summary: `Mutaxassislar oylik obuna to'laydi — standart narx ${som(price)}/oy. Yangi profil ${PLATFORM_DEFAULTS.subscriptionTrialDays} kun bepul.`,
    keywords: ["obuna", "podpiska", "subscription", "oylik to'lov", "tarif", "sinov", "trial", "50 000", "narxlar"],
    body: [
      {
        type: "p",
        text: "Kasb Egalari mijoz va mutaxassisni bir-biriga topib beradi. Ko'p hamkorliklar keyin Telegram yoki telefon orqali davom etadi, shuning uchun platforma faqat komissiyaga tayanmaydi: mutaxassislar oylik obuna to'laydi, mijozlar esa bepul foydalanadi.",
      },
      { type: "h", text: "Qancha turadi" },
      { type: "list", items: plans },
      {
        type: "p",
        text: `Ro'yxatdan o'tgan kundan boshlab ${PLATFORM_DEFAULTS.subscriptionTrialDays} kun — bepul sinov. Muddat tugagach yana ${PLATFORM_DEFAULTS.subscriptionGraceDays} kun imtiyozli davr bor: profil ko'rinib turadi, buyurtma olasiz, faqat to'lash eslatiladi.`,
      },
      { type: "h", text: "Obuna faol bo'lmasa nima bo'ladi" },
      {
        type: "list",
        items: [
          "Profil katalog, xarita, qidiruv va yo'nalish sahifalaridan yashiriladi.",
          "To'g'ridan-to'g'ri havola ochiladi, lekin kontaktlar yopiq va «Buyurtma berish» o'rniga «Mutaxassis obunasi faol emas» yoziladi.",
          "Yangi buyurtma va e'lonlarga taklif qabul qilinmaydi.",
          "Mavjud buyurtmalar va eskroudagi to'lovlar odatdagidek davom etadi.",
        ],
      },
      { type: "h", text: "Qanday to'lanadi" },
      {
        type: "p",
        text: "«Kabinet → Obuna» bo'limida rejani tanlang va Payme, Click yoki karta o'tkazmasi orqali to'lang (o'tkazmani admin tasdiqlaydi). Muddat qolgan kunlaringiz ustiga qo'shiladi — oldindan to'lasangiz hech narsa yo'qolmaydi. Tugashidan 3 kun va 1 kun oldin bildirishnoma keladi.",
      },
      { type: "note", text: "Obuna komissiyani almashtirmaydi: platforma orqali eskrou bilan to'langan buyurtmalardan daraja bo'yicha komissiya alohida ushlanadi." },
    ],
    related: ["komissiya-darajalari", "pul-chiqarish", "profilni-toldirish"],
    cta: { href: "/kabinet/obuna", label: "Obunani boshqarish" },
    updated: UPDATED,
  },
  {
    slug: "komissiya-darajalari",
    category: "mutaxassislar",
    title: "Komissiya darajalari",
    summary: `Eskrou orqali to'langan buyurtmadan platforma ${PLATFORM_DEFAULTS.commissionPctTop}–${PLATFORM_DEFAULTS.commissionPctNew}% komissiya oladi — darajangiz qancha yuqori bo'lsa, shuncha kam.`,
    keywords: ["komissiya", "foiz", "commission", "daraja", "top mutaxassis", "top rated"],
    body: [
      { type: "p", text: "Komissiya faqat platforma orqali (eskrou bilan) to'langan buyurtmalardan olinadi. Foiz narx belgilangan paytdagi darajangiz bo'yicha buyurtmaga muhrlanadi." },
      {
        type: "list",
        items: [
          `Yangi mutaxassis (3 tadan kam bajarilgan buyurtma) — ${PLATFORM_DEFAULTS.commissionPctNew}%.`,
          `Oddiy daraja — ${PLATFORM_DEFAULTS.commissionPct}%.`,
          `Top mutaxassis (reyting ≥ ${TOP_RATED_RULE.minRating} va kamida ${TOP_RATED_RULE.minReviews} ta sharh) — ${PLATFORM_DEFAULTS.commissionPctTop}%.`,
        ],
      },
      { type: "p", text: `Masalan, 1 000 000 so'mlik buyurtmadan oddiy darajada ${som(1_000_000 - (1_000_000 * PLATFORM_DEFAULTS.commissionPct) / 100)} sizga tushadi. Narx qo'yishda «Siz olasiz» ko'rsatkichi aniq summani ko'rsatadi.` },
      { type: "note", text: "Shoshilinch buyurtma ustamasi ham sizga tegishli; komissiya umumiy summaga qo'llanadi. Foizlar admin tomonidan o'zgartirilishi mumkin — joriy qiymatlar Narxlar sahifasida." },
    ],
    related: ["pul-chiqarish", "obuna-va-sinov-muddati"],
    updated: UPDATED,
  },
  {
    slug: "pul-chiqarish",
    category: "mutaxassislar",
    title: "Pul chiqarish (payout)",
    summary: `Mijoz ishni qabul qilgach, pul balansingizga tushadi. Kamida ${som(PLATFORM_DEFAULTS.minPayout)} bo'lsa, kartaga chiqarish so'rovini yuboring.`,
    keywords: ["pul chiqarish", "payout", "vyvod", "karta", "balans", "to'lov olish"],
    body: [
      {
        type: "steps",
        items: [
          "«Kabinet → To'lovlar» bo'limida «Pul chiqarish» tugmasini bosing.",
          `Summani kiriting (kamida ${som(PLATFORM_DEFAULTS.minPayout)}, yakunlangan balansdan oshmasin) va karta yoki bank rekvizitini tanlang.`,
          "Admin rekvizitni tekshirib tasdiqlaydi, o'tkazma qilingach holat «To'langan» bo'ladi.",
        ],
      },
      { type: "note", text: "Rekvizitlar shifrlangan holda saqlanadi va faqat admin ko'radi. Rad etilsa, sabab so'rov yonida ko'rinadi." },
      { type: "p", text: "Oylik daromad, komissiya, payoutlar va obuna to'lovlari jamlangan hisobotni «Kabinet → Hisobot» bo'limidan chop etishingiz mumkin." },
    ],
    related: ["komissiya-darajalari", "eskrou-qanday-ishlaydi"],
    cta: { href: "/kabinet/tolovlar", label: "To'lovlarga o'tish" },
    updated: UPDATED,
  },
  {
    slug: "takliflar-limiti",
    category: "mutaxassislar",
    title: "Takliflar va kunlik limit",
    summary: `Mijozlar e'lonlariga kuniga ${PROPOSAL_DAILY_LIMIT} tagacha taklif yuborish mumkin — sifatli, aniq takliflar ko'proq qabul qilinadi.`,
    keywords: ["taklif", "proposal", "otklik", "e'lon", "ishlar", "limit"],
    body: [
      { type: "p", text: `«Ishlar» bo'limida mijozlar e'lonlari turadi. Har bir e'longa bitta taklif yuborasiz: xat, narx va muddat. Kuniga ko'pi bilan ${PROPOSAL_DAILY_LIMIT} ta taklif (Toshkent vaqti bo'yicha yarim tunda yangilanadi); qaytarib olingan takliflar ham hisobga kiradi.` },
      {
        type: "list",
        items: [
          "Xatda mijozning vazifasiga javob bering, umumiy shablon yozmang.",
          "O'xshash ishlaringizga portfolio havolasini qo'shing.",
          "Narx va muddatni real belgilang — tanlangan taklif shu shartlar bilan buyurtmaga aylanadi.",
        ],
      },
      { type: "note", text: "Taklif yuborish uchun obuna yoki sinov muddati faol bo'lishi kerak.", tone: "warning" },
    ],
    related: ["profilni-toldirish", "obuna-va-sinov-muddati"],
    cta: { href: "/ishlar", label: "E'lonlarni ko'rish" },
    updated: UPDATED,
  },

  /* ------------------------------ Xavfsizlik ------------------------------ */
  {
    slug: "ikki-bosqichli-himoya",
    category: "xavfsizlik",
    title: "Ikki bosqichli himoya (2FA)",
    summary: "Parol o'g'irlansa ham hisobingizga kirib bo'lmaydi: kirishda autentifikator ilovasidagi 6 xonali kod so'raladi.",
    keywords: ["2fa", "ikki bosqichli", "totp", "google authenticator", "himoya", "parol", "zaxira kod"],
    body: [
      {
        type: "steps",
        items: [
          "«Kabinet → Xavfsizlik» bo'limida «Ikki bosqichli himoya»ni yoqing.",
          "Google Authenticator, Microsoft Authenticator yoki boshqa TOTP ilovasi bilan QR-kodni skanerlang.",
          "Ilovadagi 6 xonali kodni kiritib tasdiqlang.",
          "Zaxira kodlarni xavfsiz joyga saqlang — telefon yo'qolsa, ular bilan kirasiz (har biri bir marta).",
        ],
      },
      { type: "note", text: "Xavfsizlik bo'limida faol qurilmalar ro'yxati ham bor: notanish qurilmani bir bosishda chiqarib yuboring yoki parolni almashtiring." },
    ],
    related: ["firibgarlikdan-saqlanish"],
    cta: { href: "/kabinet/xavfsizlik", label: "Xavfsizlik sozlamalari" },
    updated: UPDATED,
  },
  {
    slug: "firibgarlikdan-saqlanish",
    category: "xavfsizlik",
    title: "Firibgarlikdan saqlanish",
    summary: "Oldindan to'lovni platformadan tashqarida so'rashsa yoki kod so'rashsa — bu firibgarlik belgisi.",
    keywords: ["firibgarlik", "moshennik", "scam", "aldash", "xavfsizlik", "shikoyat", "spam"],
    body: [
      { type: "h", text: "Shubhali belgilar" },
      {
        type: "list",
        items: [
          "Eskrousiz, to'g'ridan-to'g'ri kartaga oldindan to'liq to'lov so'rash.",
          "SMS kod, parol yoki 2FA kodini so'rash — Kasb Egalari xodimlari hech qachon bularni so'ramaydi.",
          "Platformaga o'xshash, lekin boshqa domendagi to'lov havolasi.",
          "Juda arzon narx, portfoliosi boshqalardan ko'chirilgan yoki sharhlarsiz yangi profil.",
        ],
      },
      { type: "h", text: "O'zingizni qanday himoya qilasiz" },
      {
        type: "list",
        items: [
          "To'lovni faqat buyurtma ichidagi eskrou orqali qiling — shunda nizo va qaytarish huquqi saqlanadi.",
          "Kelishuvlarni buyurtma chatida yozing: nizo bo'lsa, bu asosiy dalil.",
          "Shubhali profil yoki sharhni «Shikoyat qilish» tugmasi bilan yuboring — admin tekshiradi.",
          "Ikki bosqichli himoyani yoqing.",
        ],
      },
      { type: "note", text: "Platformadan tashqarida qilingan to'lovlar uchun Kasb Egalari kafolat bera olmaydi.", tone: "warning" },
    ],
    related: ["eskrou-qanday-ishlaydi", "ikki-bosqichli-himoya", "nizo-ochish"],
    updated: UPDATED,
  },

  /* ------------------------------ Jamoalar va kanallar ------------------------------ */
  {
    slug: "jamoalar-va-kanallar",
    category: "hamjamiyat",
    title: "Jamoalar va kanallar qanday ishlaydi",
    summary: "Guruh — hamma yozadi, kanal — faqat egasi. Rasmiy kanalga hamma avtomatik a'zo. Qo'shilish, rollar va qoidalar.",
    keywords: ["jamoa", "guruh", "kanal", "hamjamiyat", "community", "группа", "канал", "lenta", "chat", "rasmiy kanal"],
    body: [
      { type: "p", text: "«Jamoalar» bo'limi — ijodkorlar va onlayn kasb egalari uchun ijtimoiy tarmoq qismi. Ikki tur bor: guruh va kanal." },
      {
        type: "list",
        items: [
          "Guruh — har bir a'zo post yozadi, like va izoh qoldiradi, guruh chatida suhbatlashadi. Ochiq guruhga bir bosishda qo'shilasiz; yopiq guruhga so'rov yuborasiz — egasi tasdiqlaydi.",
          "Kanal — faqat egasi va adminlar post yozadi; a'zolar o'qiydi, yoqtiradi, izoh qoldiradi va «Muhokama» chatida gaplashadi. E'lonlar, yangiliklar va efirlar uchun.",
          "Rasmiy kanal — platformaning o'z kanali: har bir ro'yxatdan o'tgan foydalanuvchi avtomatik a'zo bo'ladi, u ro'yxat tepasida qadalgan turadi va undan chiqib bo'lmaydi. Yangiliklar va jonli efir e'lonlari shu yerda.",
        ],
      },
      { type: "h", text: "Rollar" },
      {
        type: "list",
        items: [
          "Egasi — jamoani ochgan odam: sozlaydi, adminlar tayinlaydi, o'chira oladi.",
          "Admin — so'rovlarni tasdiqlaydi, postlarni o'chiradi, a'zolarni chiqaradi. Platforma admini har bir jamoaga avtomatik qo'shiladi — shikoyatlar uchun.",
          "A'zo — guruhda yozadi, kanalda o'qiydi va izoh qoldiradi.",
        ],
      },
      { type: "h", text: "O'z jamoangizni ochish" },
      { type: "steps", items: ["Jamoalar → «Guruh yoki kanal ochish»", "Turi (guruh/kanal), nom, tavsif, yo'nalish va hudud, muqova (3:1)", "Yopiq rejim kerak bo'lsa — yoqing", "Birinchi postni yozing va havolani ulashing"] },
      { type: "note", text: "Qoidalar: hurmat, spam va takroriy reklama yo'q, mijoz kontaktlari tarqatilmaydi. Buzilsa post o'chiriladi, takrorlansa a'zolikdan chiqariladi.", tone: "info" },
    ],
    related: ["jonli-efirlar", "firibgarlikdan-saqlanish"],
    cta: { href: "/jamoalar", label: "Jamoalarga o'tish" },
    updated: "2026-10-17",
  },
  {
    slug: "jonli-efirlar",
    category: "hamjamiyat",
    title: "Jonli efirlar va yig'ilishlar",
    summary: "Efir e'loni kanalda chiqadi, a'zolarga bildirishnoma boradi; vaqti kelganda havola orqali qo'shilasiz.",
    keywords: ["efir", "jonli", "live", "stream", "yig'ilish", "meeting", "эфир", "трансляция", "zoom", "meet"],
    body: [
      { type: "p", text: "Kanal yoki guruh egasi efir/yig'ilish e'lon qilganda, barcha a'zolarga «Jonli efir» bildirishnomasi (saytda va Telegram botda) boradi. Efir kartasida vaqt, qolgan muddat va havola ko'rinadi." },
      { type: "steps", items: ["Jamoa sahifasida «Yaqin efirlar» kartasini oching", "Vaqti kelganda «Qo'shilish» tugmasini bosing — havola (Google Meet, Zoom, YouTube yoki Telegram) ochiladi", "Savollarni post ostidagi izohlarda qoldiring — efirda javob beriladi"] },
      { type: "h", text: "O'zingiz efir e'lon qilish (egasi/admin)" },
      { type: "list", items: ["Lenta kompozitorida «Efir / yig'ilish» tugmasi → vaqt va https havola", "Havolani keyinroq izohda ham berishingiz mumkin", "Efir tugagach post «o'tkazildi» holatiga o'tadi; yozuv havolasini qo'shib qo'ying"] },
      { type: "note", text: "Rasmiy kanalda haftasiga 2–4 marta efir bo'ladi: portfolio tahlili, savol-javob, soha yangiliklari. Telegram botni ulasangiz eslatma telefoningizga keladi.", tone: "info" },
    ],
    related: ["jamoalar-va-kanallar"],
    cta: { href: "/jamoalar", label: "Rasmiy kanal" },
    updated: "2026-10-17",
  },
  /* ------------------------------ Vakansiyalar ------------------------------ */
  {
    slug: "vakansiya-joylash",
    category: "vakansiyalar",
    title: "Vakansiya joylash va nomzodlarni boshqarish",
    summary: "2 daqiqada bepul joylang; arizalar rezyume, xat va kontakt bilan kabinetga keladi; holatlarni bir bosishda boshqaring.",
    keywords: ["vakansiya", "ish beruvchi", "xodim", "вакансия", "работодатель", "hiring", "nomzod", "ariza"],
    body: [
      { type: "p", text: "Vakansiyalar bo'limi barcha onlayn kasblar uchun: IT, dizayn, video, marketing, kontent, sotuv, moliya, ta'lim, boshqaruv, data/AI. Joylash ham, ariza berish ham to'lovsiz." },
      { type: "steps", items: ["Vakansiyalar → «Vakansiya joylash»", "Lavozim, kompaniya, kasb, format (masofaviy/gibrid/ofis), bandlik, tajriba, maosh, tavsif va talablar", "Joylangach 30 kun ro'yxatda turadi — kabinetda bir bosishda uzaytiriladi yoki yopiladi"] },
      { type: "h", text: "Arizalar" },
      { type: "list", items: ["Har yangi ariza — bildirishnoma (sayt + Telegram) va Kabinet → «Vakansiyalarim»", "Nomzodning rezyumesi, xati, email va telefoni ko'rinadi (u ariza yuborib rozilik bergan)", "Holatlar: ko'rildi (avtomatik) → tanlovda / ishga olindi / rad etildi — nomzodga xabar boradi", "Sayt chati orqali ham yozish mumkin"] },
      { type: "note", text: "Nomzoddan oldindan to'lov, hujjat nusxasi yoki karta ma'lumotini so'rash taqiqlanadi — bunday e'lonlar olib tashlanadi, hisob bloklanadi.", tone: "warning" },
    ],
    related: ["rezyume-va-ariza", "firibgarlikdan-saqlanish"],
    cta: { href: "/vakansiyalar/yangi", label: "Vakansiya joylash" },
    updated: "2026-10-17",
  },
  {
    slug: "rezyume-va-ariza",
    category: "vakansiyalar",
    title: "Rezyume va ariza yuborish",
    summary: "Bitta rezyume — har vakansiyaga bir bosishda ariza. Kontaktingiz faqat siz ariza yuborgan ish beruvchiga ochiladi.",
    keywords: ["rezyume", "resume", "cv", "ariza", "отклик", "резюме", "ish qidirish", "работа"],
    body: [
      { type: "steps", items: ["Kabinet → «Rezyumem»: lavozim, kasb, tajriba, ko'nikmalar, kutilayotgan maosh, havolalar (portfolio, GitHub, Behance)", "«Katalogda ko'rinsin» yoqilsa — ish beruvchilar /rezyumelar bo'limida topadi va chat orqali yozadi", "Vakansiya sahifasida «Ariza yuborish» — rezyume avtomatik biriktiriladi, xat ixtiyoriy (rezyume bo'lmasa — kamida 30 belgili xat)"] },
      { type: "h", text: "Holatlar va maxfiylik" },
      { type: "list", items: ["Yangi → ko'rildi → tanlovda / ishga olindi / rad etildi — har o'zgarish bildirishnoma bilan keladi (Kabinet → «Arizalarim»)", "«Yangi» holatida arizani qaytarib olish mumkin", "Ommaviy rezyumeda email va telefon ko'rsatilmaydi; ular faqat siz ariza yuborgan vakansiya egasiga ochiladi", "Bitta vakansiyaga bir marta ariza beriladi"] },
      { type: "note", text: "Ish beruvchi sizdan pul, karta ma'lumoti yoki pasport nusxasini so'rasa — «Shikoyat» qiling va @kasb_egalari ga yozing.", tone: "warning" },
    ],
    related: ["vakansiya-joylash", "jamoalar-va-kanallar"],
    cta: { href: "/kabinet/rezyume", label: "Rezyume yaratish" },
    updated: "2026-10-17",
  },
];

export const HELP_BY_SLUG: Record<string, HelpArticle> = Object.fromEntries(HELP_ARTICLES.map((a) => [a.slug, a]));

/** Qidiruv indeksi uchun maqolaning butun matni */
export function articleText(a: HelpArticle): string {
  const parts: string[] = [a.title, a.summary, ...a.keywords];
  for (const b of a.body) {
    if (b.type === "list" || b.type === "steps") parts.push(...b.items);
    else parts.push(b.text);
  }
  return parts.join(" ");
}
