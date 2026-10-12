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

export interface Category {
  slug: string;
  name: string;
  plural: string;
  description: string;
  /** lucide icon nomi (UI tomonda map qilinadi) */
  icon: "video" | "scissors" | "palette" | "camera" | "sparkles" | "box" | "mic" | "pen-tool";
  accent: string;
}

export const CATEGORIES: Category[] = [
  { slug: "videograf", name: "Videograf", plural: "Videograflar", description: "To'y, reklama, event va korporativ suratga olish", icon: "video", accent: "#df7a5a" },
  { slug: "montajor", name: "Montajor", plural: "Montajorlar", description: "Video montaj, rang korreksiya, ovoz dizayni", icon: "scissors", accent: "#8b7fd1" },
  { slug: "dizayner", name: "Grafik dizayner", plural: "Dizaynerlar", description: "Logo, brending, poster, SMM dizayn", icon: "palette", accent: "#d4709a" },
  { slug: "motion-dizayner", name: "Motion dizayner", plural: "Motion dizaynerlar", description: "2D/3D animatsiya, intro, infografika", icon: "sparkles", accent: "#4fa3ad" },
  { slug: "fotograf", name: "Fotograf", plural: "Fotograflar", description: "Portret, mahsulot, to'y va event fotosessiya", icon: "camera", accent: "#cfa24e" },
  { slug: "3d-artist", name: "3D artist", plural: "3D artistlar", description: "3D modellashtirish, render, vizualizatsiya", icon: "box", accent: "#6aa884" },
  { slug: "ui-ux", name: "UI/UX dizayner", plural: "UI/UX dizaynerlar", description: "Sayt va mobil ilova interfeyslari", icon: "pen-tool", accent: "#6b8fcf" },
  { slug: "ovoz", name: "Ovoz rejissyori", plural: "Ovoz rejissyorlari", description: "Dublyaj, ovoz yozish, musiqa montaji", icon: "mic", accent: "#a3729b" },
];

export const CATEGORY_BY_SLUG: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));

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

export const SITE = {
  name: "Redince",
  tagline: "O'zbekistonning ijodiy mutaxassislar xaritasi",
  description:
    "Redince — O'zbekistonning barcha viloyatlaridagi videograf, montajor, dizayner va boshqa ijodkorlarni bir joyda topish platformasi. Xaritadan hududni tanlang va o'zingizga mos mutaxassisni toping.",
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

export const VISIBILITY_FIELDS = [
  { key: "phone", label: "Telefon raqam", default: "clients" },
  { key: "telegram", label: "Telegram", default: "public" },
  { key: "instagram", label: "Instagram", default: "public" },
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
  minPayout: 100_000, // minimal pul chiqarish (so'm)
  minOrderAmount: 50_000,
} as const;
