/**
 * Loyihaning asosiy lug'atlari: hududlar va mutaxassislik kategoriyalari.
 * Bu yerdagi slug'lar bazada saqlanadi — o'zgartirishda ehtiyot bo'ling.
 */

export interface Region {
  slug: string;
  name: string;
  short: string;
  capital: string;
  /** Hudud ichidagi yirik shaharlar (profilda "shahar" tanlovi uchun) */
  cities: string[];
}

export const REGIONS: Region[] = [
  { slug: "toshkent-shahri", name: "Toshkent shahri", short: "Toshkent sh.", capital: "Toshkent", cities: ["Toshkent"] },
  { slug: "toshkent-viloyati", name: "Toshkent viloyati", short: "Toshkent vil.", capital: "Nurafshon", cities: ["Nurafshon", "Chirchiq", "Angren", "Olmaliq", "Bekobod", "Yangiyo'l", "Parkent"] },
  { slug: "andijon", name: "Andijon viloyati", short: "Andijon", capital: "Andijon", cities: ["Andijon", "Asaka", "Xonobod", "Shahrixon", "Qo'rg'ontepa"] },
  { slug: "fargona", name: "Farg'ona viloyati", short: "Farg'ona", capital: "Farg'ona", cities: ["Farg'ona", "Qo'qon", "Marg'ilon", "Quvasoy", "Rishton"] },
  { slug: "namangan", name: "Namangan viloyati", short: "Namangan", capital: "Namangan", cities: ["Namangan", "Chust", "Pop", "Kosonsoy", "Uchqo'rg'on"] },
  { slug: "samarqand", name: "Samarqand viloyati", short: "Samarqand", capital: "Samarqand", cities: ["Samarqand", "Kattaqo'rg'on", "Urgut", "Ishtixon", "Jomboy"] },
  { slug: "buxoro", name: "Buxoro viloyati", short: "Buxoro", capital: "Buxoro", cities: ["Buxoro", "Kogon", "G'ijduvon", "Vobkent", "Romitan"] },
  { slug: "navoiy", name: "Navoiy viloyati", short: "Navoiy", capital: "Navoiy", cities: ["Navoiy", "Zarafshon", "Uchquduq", "Nurota", "Karmana"] },
  { slug: "qashqadaryo", name: "Qashqadaryo viloyati", short: "Qashqadaryo", capital: "Qarshi", cities: ["Qarshi", "Shahrisabz", "Kitob", "G'uzor", "Koson"] },
  { slug: "surxondaryo", name: "Surxondaryo viloyati", short: "Surxondaryo", capital: "Termiz", cities: ["Termiz", "Denov", "Sho'rchi", "Boysun", "Jarqo'rg'on"] },
  { slug: "jizzax", name: "Jizzax viloyati", short: "Jizzax", capital: "Jizzax", cities: ["Jizzax", "G'allaorol", "Zomin", "Paxtakor", "Do'stlik"] },
  { slug: "sirdaryo", name: "Sirdaryo viloyati", short: "Sirdaryo", capital: "Guliston", cities: ["Guliston", "Yangiyer", "Shirin", "Sirdaryo", "Boyovut"] },
  { slug: "xorazm", name: "Xorazm viloyati", short: "Xorazm", capital: "Urganch", cities: ["Urganch", "Xiva", "Xonqa", "Shovot", "Pitnak"] },
  { slug: "qoraqalpogiston", name: "Qoraqalpog'iston Respublikasi", short: "Qoraqalpog'iston", capital: "Nukus", cities: ["Nukus", "Xo'jayli", "Beruniy", "To'rtko'l", "Taxiatosh", "Mo'ynoq"] },
];

export const REGION_BY_SLUG: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.slug, r]));

export { CATEGORIES, CATEGORY_BY_SLUG, CATEGORY_GROUPS, CATEGORY_GROUP_BY_SLUG, CATEGORIES_BY_GROUP, topCategories } from "./categories";
export type { Category, CategoryGroupSlug, CategoryIconName } from "./categories";

export const ORDER_STATUSES = ["new", "accepted", "in_progress", "done", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Yangi",
  accepted: "Qabul qilindi",
  in_progress: "Jarayonda",
  done: "Bajarildi",
  cancelled: "Bekor qilindi",
};

export const EXPERIENCE_LEVELS = [
  { value: "junior", label: "Boshlang'ich (1 yilgacha)" },
  { value: "middle", label: "O'rta (1–3 yil)" },
  { value: "senior", label: "Tajribali (3–6 yil)" },
  { value: "expert", label: "Ekspert (6+ yil)" },
] as const;

/** "Top mutaxassis" nishoni qoidasi (recalcRating hisoblaydi; seed bilan bir xil) */
export const TOP_RATED_RULE = { minRating: 4.8, minReviews: 3 } as const;

/** Shikoyat sabablari (POST /api/reports) */
export const REPORT_REASONS = [
  { value: "spam", label: "Spam yoki reklama" },
  { value: "fake", label: "Soxta profil yoki sharh" },
  { value: "offensive", label: "Haqoratli yoki nomaqbul kontent" },
  { value: "fraud", label: "Firibgarlik / to'lov bilan bog'liq" },
  { value: "other", label: "Boshqa" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

/**
 * Ijodkor sahifasida buyurtma/yollash bloklari: narx kartasi, paketlar, kalkulyator, ish jadvali, aloqa paneli,
 * «Buyurtma berish» CTA, taqqoslash, pastki yopishqoq panel, bajarilgan buyurtma statistikasi, vCard.
 * false — profil Instagram ko'rinishida (bio, lenta: postlar/videolar/ishlar, sharhlar, yozish/obuna/ulashish).
 * Buyurtma tizimi o'zi o'chmaydi: katalog kartalari va /buyurtma/<id> ishlayveradi. Qaytarish — true.
 */
export const PROFILE_HIRING = false;

/**
 * Ijodkor sahifasidan BOSHQA mutaxassislarga olib boruvchi bloklar: «O'xshash mutaxassislar», «Yaqinda ko'rilganlar»,
 * katalogga yo'l ko'rsatuvchi breadcrumb va yo'nalish havolasi. false — ijodkor mijoziga o'z portfoliosini ulashganda
 * tashrif buyuruvchi boshqa ijodkorga o'tib ketmaydi. Qaytarish — true.
 */
export const PROFILE_CROSS_LINKS = false;

export const SITE = {
  name: "Kasb Egalari",
  /** Loyiha rahbari (footer'da ko'rinadi) */
  owner: "Abdulloh G'afurov",
  /** Ijtimoiy tarmoqlar (footer). YouTube hozircha yo'q — kanal ochilganda qo'shiladi */
  telegram: "https://t.me/kasb_egalari",
  instagram: "https://instagram.com/kasb.egalari",
  /** To'g'ridan-to'g'ri aloqa (Yordam sahifasi) — rasmiy kanal, shaxsiy akkaunt emas */
  supportTelegram: "https://t.me/kasb_egalari",
  supportPhone: "+998 94 143 44 99",
  tagline: "Ijodkorlar va onlayn kasblar platformasi",
  description:
    "Kasb Egalari — O'zbekiston ijodkorlari va barcha onlayn kasb egalari uchun platforma: videograf, dizayner, montajchi va boshqa mutaxassislar katalogi, xavfsiz buyurtma, jamoalar va kanallar, jonli efirlar, to'lovsiz vakansiyalar va rezyumelar.",
};


/* ------------------------------------------------------------------ */
/* Maxfiylik, ish vaqti, jins                                          */
/* ------------------------------------------------------------------ */
export const VISIBILITY_LEVELS = [
  { value: "public", label: "Hammaga", description: "Saytga kirgan har kim ko'radi" },
  { value: "clients", label: "Faqat ro'yxatdan o'tganlarga", description: "Tizimga kirgan foydalanuvchilar ko'radi" },
  { value: "orders", label: "Faqat buyurtmachilarga", description: "Buyurtmasi qabul qilingan mijozlar ko'radi" },
  { value: "hidden", label: "Yashirin", description: "Hech kimga ko'rinmaydi" },
] as const;
export type VisibilityLevelValue = (typeof VISIBILITY_LEVELS)[number]["value"];

// Aloqa maydonlari (phone/telegram/instagram/email) — platforma qoidasi: faqat buyurtma
// qabul qilingach ochiladi (privacy.ts dagi FORCED_ORDER_FIELDS clamp'i bilan bir xil qoida)
export const VISIBILITY_FIELDS = [
  { key: "phone", label: "Telefon raqam", default: "orders" },
  { key: "telegram", label: "Telegram", default: "orders" },
  { key: "instagram", label: "Instagram", default: "orders" },
  { key: "youtube", label: "YouTube", default: "public" },
  { key: "website", label: "Veb-sayt", default: "public" },
  { key: "email", label: "Email", default: "hidden" },
  { key: "schedule", label: "Ish vaqti", default: "public" },
  { key: "gender", label: "Jins", default: "public" },
  { key: "city", label: "Shahar", default: "public" },
] as const;
export type VisibilityFieldKey = (typeof VISIBILITY_FIELDS)[number]["key"];

export const DEFAULT_VISIBILITY: Record<VisibilityFieldKey, VisibilityLevelValue> = Object.fromEntries(
  VISIBILITY_FIELDS.map((f) => [f.key, f.default]),
) as Record<VisibilityFieldKey, VisibilityLevelValue>;

export const WEEKDAYS = [
  { key: "mon", label: "Dushanba", short: "Du" },
  { key: "tue", label: "Seshanba", short: "Se" },
  { key: "wed", label: "Chorshanba", short: "Ch" },
  { key: "thu", label: "Payshanba", short: "Pa" },
  { key: "fri", label: "Juma", short: "Ju" },
  { key: "sat", label: "Shanba", short: "Sh" },
  { key: "sun", label: "Yakshanba", short: "Ya" },
] as const;
export type WeekdayKey = (typeof WEEKDAYS)[number]["key"];

export const GENDERS = [
  { value: "male", label: "Erkak" },
  { value: "female", label: "Ayol" },
] as const;

/* ------------------------------------------------------------------ */
/* To'lovlar                                                           */
/* ------------------------------------------------------------------ */
export const PAYMENT_PROVIDERS = [
  { value: "payme", label: "Payme", description: "Payme ilovasi yoki karta orqali" },
  { value: "click", label: "Click", description: "Click ilovasi yoki karta orqali" },
  { value: "manual", label: "O'tkazma", description: "Karta/bank o'tkazmasi — admin tasdiqlaydi" },
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]["value"];

export const PAYMENT_STATE_LABEL: Record<"created" | "pending" | "paid" | "released" | "cancelled" | "refunded", string> = {
  created: "Yaratildi",
  pending: "Kutilmoqda",
  paid: "To'landi (eskrou)",
  released: "Mutaxassisga o'tkazildi",
  cancelled: "Bekor qilindi",
  refunded: "Qaytarildi",
};

export const ORDER_PAYMENT_STATE_LABEL: Record<"none" | "awaiting" | "paid" | "released" | "refunded", string> = {
  none: "Narx kelishilmagan",
  awaiting: "To'lov kutilmoqda",
  paid: "To'langan (eskrou)",
  released: "Yakunlangan, pul o'tkazildi",
  refunded: "Pul qaytarildi",
};

export const PAYOUT_STATE_LABEL: Record<"requested" | "approved" | "paid" | "rejected", string> = {
  requested: "So'ralgan",
  approved: "Tasdiqlangan",
  paid: "To'langan",
  rejected: "Rad etilgan",
};

/** Platforma sozlamalari kalitlari va standart qiymatlari (admin o'zgartiradi) */
export const PLATFORM_DEFAULTS = {
  commissionPct: 10, // mijoz to'lovidan platformaga qoladigan foiz (Upwork uslubi)
  commissionPctNew: 15, // yangi mutaxassis (bajarilgan buyurtmalar kam) — F21
  commissionPctTop: 7, // "Top mutaxassis" — F21
  minPayout: 100_000, // minimal pul chiqarish (so'm)
  minOrderAmount: 50_000,
  // Mutaxassis oylik obunasi (mijozlar uchun bepul) — subscriptions/access.ts
  subscriptionPrice: 50_000, // 1 oy narxi (so'm)
  subscriptionTrialDays: 30, // yangi mutaxassis uchun bepul sinov
  subscriptionGraceDays: 3, // muddat tugagach imtiyozli kunlar
  subscriptionEnforced: 1, // 1 — obunasizlar katalogdan yashiriladi; 0 — o'chirilgan
  urgentPct: 20, // shoshilinch buyurtma ustamasi (%)
  usdRate: 12_700, // 1 USD = so'm (admin belgilaydi, taxminiy narx ko'rsatish uchun)
} as const;

/* ------------------------------------------------------------------ */
/* Obuna (mutaxassislar uchun oylik to'lov)                            */
/* ------------------------------------------------------------------ */
/** Obuna rejalari: oylar soni va chegirma (%) — narx planPrice() (subscriptions/access.ts) bilan hisoblanadi */
export const SUBSCRIPTION_PLANS = [
  { months: 1, discountPct: 0 },
  { months: 3, discountPct: 5 },
  { months: 6, discountPct: 10 },
  { months: 12, discountPct: 20 },
] as const;
export type SubscriptionPlanMonths = (typeof SUBSCRIPTION_PLANS)[number]["months"];
/** Obuna hisobi id prefiksi (Payme account.order_id / Click merchant_trans_id eskrou to'lovlaridan ajratish uchun) */
export const SUBSCRIPTION_INVOICE_PREFIX = "sub_";
/**
 * Obuna tizimi ishga tushgan sana (UTC). Bepul sinov max(createdAt, shu sana)'dan hisoblanadi —
 * shu sanagacha ro'yxatdan o'tgan mutaxassislar deploy bilan katalogdan yashirinib qolmaydi, ularga ham to'liq sinov muddati beriladi.
 */
export const SUBSCRIPTION_LAUNCH_AT = Date.UTC(2026, 9, 13);

/* ------------------------------------------------------------------ */
/* Ish turlari, paketlar, sharh mezonlari                              */
/* ------------------------------------------------------------------ */
export const WORK_TYPES = [
  { slug: "toy", label: "To'y" },
  { slug: "reklama", label: "Reklama" },
  { slug: "korporativ", label: "Korporativ" },
  { slug: "kontent-smm", label: "Kontent / SMM" },
  { slug: "musiqiy-klip", label: "Musiqiy klip" },
  { slug: "hujjatli", label: "Hujjatli film" },
  { slug: "talim", label: "Ta'lim" },
  { slug: "kochmas-mulk", label: "Ko'chmas mulk" },
  { slug: "mahsulot", label: "Mahsulot / e-commerce" },
  { slug: "tadbir", label: "Tadbir" },
] as const;
export type WorkTypeSlug = (typeof WORK_TYPES)[number]["slug"];
export const WORK_TYPE_BY_SLUG: Record<string, (typeof WORK_TYPES)[number]> = Object.fromEntries(WORK_TYPES.map((w) => [w.slug, w]));

export const PACKAGE_TIERS = [
  { key: "basic", label: "Boshlang'ich" },
  { key: "standard", label: "Standart" },
  { key: "premium", label: "Premium" },
] as const;
export type PackageTierKey = (typeof PACKAGE_TIERS)[number]["key"];

export const RATING_CRITERIA = [
  { key: "quality", label: "Sifat" },
  { key: "timeliness", label: "Muddat" },
  { key: "communication", label: "Muloqot" },
] as const;
export type RatingCriterionKey = (typeof RATING_CRITERIA)[number]["key"];

/** Foydalanish shartlari versiyasi — o'zgarsa foydalanuvchilardan qayta rozilik so'raladi */
export const TERMS_VERSION = "2026-10-13";

/* ------------------------------------------------------------------ */
/* E'lonlar va takliflar                                               */
/* ------------------------------------------------------------------ */
export const JOB_STATUSES = ["open", "hired", "closed"] as const;
export type JobStatusValue = (typeof JOB_STATUSES)[number];
export const JOB_STATUS_LABEL: Record<JobStatusValue, string> = {
  open: "Ochiq",
  hired: "Mutaxassis tanlandi",
  closed: "Yopilgan",
};

export const PROPOSAL_STATUSES = ["pending", "shortlisted", "accepted", "declined", "withdrawn"] as const;
export type ProposalStatusValue = (typeof PROPOSAL_STATUSES)[number];
export const PROPOSAL_STATUS_LABEL: Record<ProposalStatusValue, string> = {
  pending: "Ko'rib chiqilmoqda",
  shortlisted: "Saralanganlar ro'yxatida",
  accepted: "Qabul qilindi",
  declined: "Rad etildi",
  withdrawn: "Qaytarib olindi",
};

/** Bitta mutaxassis kuniga yuborishi mumkin bo'lgan takliflar soni */
export const PROPOSAL_DAILY_LIMIT = 10;
/** E'lon shuncha kundan keyin avtomatik yopiladi (jobs.expiresAt) */
export const JOB_TTL_DAYS = 30;
