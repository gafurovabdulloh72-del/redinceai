import { z } from "zod";
import { CATEGORIES, EXPERIENCE_LEVELS, ORDER_STATUSES, PACKAGE_TIERS, REGIONS, REPORT_REASONS, VISIBILITY_FIELDS, VISIBILITY_LEVELS, WEEKDAYS, WORK_TYPES } from "./constants";
import { normalizeUzPhone } from "./utils";

/* ------------------------------------------------------------------ */
/* Zod xabarlarini o'zbekchaga o'girish (maxsus message berilmagan hollar) */
/* ------------------------------------------------------------------ */
const uzErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") return { message: "Majburiy maydon" };
      if (issue.expected === "integer") return { message: "Butun son kiriting" };
      if (issue.expected === "number") return { message: "Son kiriting" };
      if (issue.expected === "boolean") return { message: "Ha yoki yo'q bo'lishi kerak" };
      return { message: "Qiymat turi noto'g'ri" };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "Ro'yxatdagi qiymatlardan birini tanlang" };
    case z.ZodIssueCode.too_small: {
      const n = Number(issue.minimum);
      if (issue.type === "string") return { message: n <= 1 ? "Maydonni to'ldiring" : `Kamida ${n} ta belgi` };
      if (issue.type === "number") return { message: `Qiymat ${n} dan kam bo'lmasin` };
      if (issue.type === "array") return { message: n <= 1 ? "Kamida bittasini tanlang" : `Kamida ${n} tasini tanlang` };
      break;
    }
    case z.ZodIssueCode.too_big: {
      const n = Number(issue.maximum);
      if (issue.type === "string") return { message: `Ko'pi bilan ${n} ta belgi` };
      if (issue.type === "number") return { message: `Qiymat ${n} dan oshmasin` };
      if (issue.type === "array") return { message: `Ko'pi bilan ${n} ta tanlash mumkin` };
      break;
    }
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Email noto'g'ri" };
      if (issue.validation === "url") return { message: "Havola noto'g'ri" };
      return { message: "Format noto'g'ri" };
    case z.ZodIssueCode.invalid_literal:
    case z.ZodIssueCode.invalid_union:
    case z.ZodIssueCode.invalid_union_discriminator:
      return { message: "Qiymat noto'g'ri" };
    default:
      break;
  }
  return { message: ctx.defaultError === "Required" ? "Majburiy maydon" : "Qiymat noto'g'ri" };
};
z.setErrorMap(uzErrorMap);

const regionSlugs = REGIONS.map((r) => r.slug) as [string, ...string[]];
const categorySlugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];
const experienceValues = EXPERIENCE_LEVELS.map((e) => e.value) as unknown as ["junior", "middle", "senior", "expert"];
const workTypeSlugs = WORK_TYPES.map((w) => w.slug) as unknown as [string, ...string[]];
const packageKeys = PACKAGE_TIERS.map((t) => t.key) as unknown as ["basic", "standard", "premium"];

const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{9,16}$/, "Telefon raqami noto'g'ri (masalan: +998 90 123 45 67)")
  // O'zbekiston raqamlari bazaga kanonik "+998XXXXXXXXX" ko'rinishida tushadi (A21); boshqalari — kiritilganicha
  .transform((v) => normalizeUzPhone(v) ?? v);
export const optionalPhone = phone.optional().or(z.literal(""));

/** Parol siyosati: kamida 8 belgi, harf va raqam */
export const strongPassword = z
  .string()
  .min(8, "Parol kamida 8 ta belgi")
  .max(100)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Parolda harf ham, raqam ham bo'lsin");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Ism kamida 2 ta belgi").max(60),
  email: z.string().trim().toLowerCase().email("Email noto'g'ri"),
  password: strongPassword,
  gender: z.enum(["male", "female"]).optional().nullable(),
  phone: optionalPhone,
  role: z.enum(["client", "specialist"]).default("client"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email noto'g'ri"),
  password: z.string().min(1, "Parolni kiriting"),
});

/** Faqat http(s) yoki o'zimizning /uploads/ yo'li — javascript:, data:, ftp: va h.k. rad etiladi */
export const HTTP_OR_UPLOAD_RE = /^(https?:\/\/[^\s]+|\/uploads\/[\w-]+\.(?:jpe?g|png|webp|gif))$/i;
const URL_MSG = "Havola http:// yoki https:// bilan boshlanishi kerak";
/** Rasm manzili: faqat https:// yoki /uploads/ — CSP img-src http: rasmlarni bloklaydi (ko'rinmay qoladi) */
export const IMAGE_URL_RE = /^(https:\/\/[^\s]+|\/uploads\/[\w-]+\.(?:jpe?g|png|webp|gif))$/i;
const IMAGE_URL_MSG = "Rasm havolasi https:// bilan boshlanishi kerak (yoki rasmni yuklang)";

export const httpUrl = z.string().trim().max(500).refine((v) => HTTP_OR_UPLOAD_RE.test(v), URL_MSG);

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || HTTP_OR_UPLOAD_RE.test(v), URL_MSG)
  .optional()
  .or(z.literal(""));

const optionalImageUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || IMAGE_URL_RE.test(v), IMAGE_URL_MSG)
  .optional()
  .or(z.literal(""));

/* ---------- Profil qo'shimchalari: paketlar (F31), tariflar (F70), sertifikatlar (F64), ish turlari (F52) ---------- */
export const MAX_PACKAGE_FEATURES = 6;
export const MAX_CERTIFICATES = 10;
const money = z.coerce.number().int().min(0).max(1_000_000_000);

export const servicePackageSchema = z.object({
  key: z.enum(packageKeys),
  title: z.string().trim().min(2, "Paket nomi kamida 2 ta belgi").max(60),
  price: z.coerce.number().int().min(1_000, "Narx kamida 1 000 so'm").max(1_000_000_000),
  deliveryDays: z.coerce.number().int().min(1, "Muddat kamida 1 kun").max(365),
  revisions: z.coerce.number().int().min(0).max(20),
  features: z.array(z.string().trim().min(1).max(80)).max(MAX_PACKAGE_FEATURES).default([]),
});
export const packagesSchema = z
  .array(servicePackageSchema)
  .max(3)
  .refine((list) => new Set(list.map((p) => p.key)).size === list.length, "Har bir paket darajasi bir marta bo'lsin")
  // Har doim basic → standard → premium tartibida saqlanadi
  .transform((list) => [...list].sort((a, b) => packageKeys.indexOf(a.key) - packageKeys.indexOf(b.key)));

const HTTPS_RE = /^https:\/\/[^\s]+$/i;
export const certificateSchema = z.object({
  title: z.string().trim().min(2, "Nomi kamida 2 ta belgi").max(100),
  issuer: z.string().trim().min(2, "Kim bergani kamida 2 ta belgi").max(100),
  year: z.coerce
    .number()
    .int()
    .min(1970, "Yil 1970 dan kam bo'lmasin")
    .refine((y) => y <= new Date().getUTCFullYear() + 1, "Yil kelajakda bo'lmasin"),
  url: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || HTTPS_RE.test(v), "Havola https:// bilan boshlanishi kerak")
    .optional()
    .transform((v) => v || undefined),
});
export const certificatesSchema = z.array(certificateSchema).max(MAX_CERTIFICATES);

export const workTypesSchema = z
  .array(z.enum(workTypeSlugs))
  .max(WORK_TYPES.length)
  .transform((list) => [...new Set(list)]);

/** Tariflar: 0 / bo'sh — ko'rsatilmaydi (kalit saqlanmaydi) */
export const ratesSchema = z
  .object({ hourly: money.nullable().optional(), daily: money.nullable().optional(), project: money.nullable().optional() })
  .transform((r) => {
    const out: { hourly?: number; daily?: number; project?: number } = {};
    if (r.hourly) out.hourly = r.hourly;
    if (r.daily) out.daily = r.daily;
    if (r.project) out.project = r.project;
    return out;
  });

export const specialistProfileSchema = z
  .object({
  title: z
    .string()
    .trim()
    .min(5, "Sarlavha kamida 5 ta belgi")
    .max(90)
    .refine((v) => !/—\s*yangi mutaxassis$/i.test(v), "Haqiqiy sarlavha yozing (masalan: To'y videografi)"),
  category: z.enum(categorySlugs),
  regionSlug: z.enum(regionSlugs),
  city: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(2000).default(""),
  priceFrom: z.coerce.number().int().min(0).max(1_000_000_000),
  priceTo: z.coerce.number().int().min(0).max(1_000_000_000).optional().nullable(),
  experience: z.enum(experienceValues),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  /** Jihozlar (F51): "Sony FX3", "DJI Mavic 3" … */
  equipment: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  languages: z.array(z.enum(["uz", "ru", "en", "kaa", "tg"])).min(1).default(["uz"]),
  telegram: z.string().trim().max(60).optional().or(z.literal("")),
  instagram: z.string().trim().max(60).optional().or(z.literal("")),
  youtube: optionalUrl,
  website: optionalUrl,
  coverUrl: optionalImageUrl,
  isAvailable: z.boolean().default(true),
  /** Berilmasa — tegilmaydi (eski klientlar paketlarni o'chirib yubormasin) */
  packages: packagesSchema.optional(),
  certificates: certificatesSchema.optional(),
  workTypes: workTypesSchema.optional(),
  rates: ratesSchema.optional(),
  })
  .refine((d) => d.priceTo == null || d.priceTo === 0 || d.priceTo >= d.priceFrom, {
    message: "Maksimal narx minimaldan kam bo'lmasin",
    path: ["priceTo"],
  });

/** Portfolio teglari (F61): 5 tagacha, takrorsiz (katta-kichik harf farqsiz) */
export const MAX_PORTFOLIO_TAGS = 5;
export const portfolioTagsSchema = z
  .array(z.string().trim().min(1).max(30, "Teg 30 belgidan oshmasin"))
  .max(MAX_PORTFOLIO_TAGS, `Ko'pi bilan ${MAX_PORTFOLIO_TAGS} ta teg`)
  .transform((list) => {
    const seen = new Set<string>();
    return list.filter((t) => {
      const k = t.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });

export const portfolioItemSchema = z
  .object({
    title: z.string().trim().min(2).max(100),
    type: z.enum(["image", "video", "link"]),
    url: httpUrl,
    thumbnailUrl: optionalImageUrl,
    description: z.string().trim().max(500).optional().or(z.literal("")),
    tags: portfolioTagsSchema.optional(),
    /** Oldin/keyin juftligi (F63): "oldin" rasmi; url — "keyin" */
    beforeUrl: optionalImageUrl,
  })
  // "Rasm" turidagi ishning manzili rasm sifatida ko'rsatiladi — https bo'lishi shart
  .refine((d) => d.type !== "image" || IMAGE_URL_RE.test(d.url), { message: IMAGE_URL_MSG, path: ["url"] })
  .refine((d) => !d.beforeUrl || d.type === "image", { message: "Oldin/keyin juftligi faqat rasm turidagi ish uchun", path: ["beforeUrl"] });

/** Portfolio ishini tahrirlash (PATCH /api/portfolio/[id]): turi va manzili o'zgarmaydi; tags/beforeUrl berilmasa tegilmaydi */
export const portfolioEditSchema = z.object({
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  thumbnailUrl: optionalImageUrl,
  tags: portfolioTagsSchema.optional(),
  beforeUrl: optionalImageUrl,
});

/**
 * Akkaunt ma'lumotlari (PATCH /api/profile).
 * email — berilsa va joriy emaildan farq qilsa, currentPassword majburiy (route tekshiradi) va emailVerified=false bo'ladi;
 * notifyEmail — email bildirishnomalariga rozilik (kalit yuborilmasa tegilmaydi).
 */
export const accountSchema = z.object({
  name: z.string().trim().min(2, "Ism kamida 2 ta belgi").max(60),
  phone: optionalPhone,
  avatarUrl: optionalImageUrl,
  gender: z.enum(["male", "female"]).optional().nullable(),
  /** Chat taxallusi (@username) — tekshiruv va bandlik api/profile PATCH ichida (setUsername) */
  username: z.string().trim().max(24).optional(),
  email: z.string().trim().toLowerCase().email("Email noto'g'ri").max(120).optional(),
  currentPassword: z.string().max(100).optional(),
  notifyEmail: z.boolean().optional(),
});

/* ---------- Maxfiylik va ish vaqti ---------- */
const visibilityLevel = z.enum(VISIBILITY_LEVELS.map((l) => l.value) as unknown as ["public", "clients", "orders", "hidden"]);
export const visibilitySchema = z
  .object(Object.fromEntries(VISIBILITY_FIELDS.map((f) => [f.key, visibilityLevel.optional()])) as Record<(typeof VISIBILITY_FIELDS)[number]["key"], z.ZodOptional<typeof visibilityLevel>>)
  .partial();

const timeHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Vaqt HH:MM ko'rinishida");
const scheduleDay = z.object({ enabled: z.boolean(), from: timeHHMM, to: timeHHMM });
export const scheduleSchema = z
  .object({
    days: z.object(Object.fromEntries(WEEKDAYS.map((d) => [d.key, scheduleDay])) as Record<(typeof WEEKDAYS)[number]["key"], typeof scheduleDay>),
    note: z.string().trim().max(200).optional().or(z.literal("")),
  })
  .nullable();

/** Band kunlar kalendari (F41): kelgusi ~90 kun, YYYY-MM-DD */
export const MAX_BLOCKED_DATES = 120;
export const privacyUpdateSchema = z.object({
  visibility: visibilitySchema,
  schedule: scheduleSchema.optional(),
  vacationUntil: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
  blockedDates: z
    .array(z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD ko'rinishida"))
    .max(MAX_BLOCKED_DATES, `Ko'pi bilan ${MAX_BLOCKED_DATES} ta band kun`)
    .optional(),
});

/* ---------- Parol / sessiya ---------- */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Joriy parolni kiriting"),
  newPassword: strongPassword,
});
export const resetRequestSchema = z.object({ email: z.string().trim().toLowerCase().email("Email noto'g'ri") });
export const resetConfirmSchema = z.object({ token: z.string().min(16), newPassword: strongPassword });

/* ---------- To'lovlar ---------- */
export const orderAmountSchema = z.object({
  // Pastki chegarani platforma sozlamasi (minOrderAmount) boshqaradi — route xabar beradi
  amount: z.coerce.number().int().min(1_000, "Kamida 1 000 so'm").max(1_000_000_000),
});
export const checkoutSchema = z.object({
  orderId: z.string().min(1),
  provider: z.enum(["payme", "click", "manual"]),
});
export const payoutRequestSchema = z.object({
  amount: z.coerce.number().int().min(1),
  method: z.enum(["card", "bank", "cash"]).default("card"),
  details: z.string().trim().min(4, "Rekvizitlarni kiriting").max(200),
});
export const payoutDecisionSchema = z.object({
  state: z.enum(["approved", "paid", "rejected"]),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export const platformSettingsSchema = z.object({
  commissionPct: z.coerce.number().int().min(0).max(50),
  // Komissiya darajalari (F21): yangi mutaxassis va "Top mutaxassis" — berilmasa tegilmaydi
  commissionPctNew: z.coerce.number().int().min(0).max(50).optional(),
  commissionPctTop: z.coerce.number().int().min(0).max(50).optional(),
  minPayout: z.coerce.number().int().min(0).max(100_000_000),
  minOrderAmount: z.coerce.number().int().min(0).max(100_000_000),
  // Obuna va boshqa sozlamalar — berilmasa tegilmaydi
  subscriptionPrice: z.coerce.number().int().min(0).max(10_000_000).optional(),
  subscriptionTrialDays: z.coerce.number().int().min(0).max(365).optional(),
  subscriptionGraceDays: z.coerce.number().int().min(0).max(60).optional(),
  subscriptionEnforced: z.coerce.number().int().min(0).max(1).optional(),
  urgentPct: z.coerce.number().int().min(0).max(100).optional(),
  usdRate: z.coerce.number().int().min(1_000).max(100_000).optional(),
});

export const orderSchema = z.object({
  specialistId: z.string().min(1),
  title: z.string().trim().min(4, "Sarlavha juda qisqa").max(120),
  description: z.string().trim().min(15, "Loyihani batafsilroq yozing (kamida 15 belgi)").max(3000),
  budget: z.coerce.number().int().min(0).max(1_000_000_000).optional().nullable(),
  deadline: z.string().trim().max(40).optional().or(z.literal("")),
  contactPhone: phone,
});

export const orderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const reviewSchema = z.object({
  specialistId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(10, "Sharh kamida 10 ta belgi").max(1500),
});

/** DELETE /api/reviews: o'z sharhi (specialistId) yoki admin — boshqa muallifniki (authorId) */
export const reviewDeleteSchema = z.object({
  specialistId: z.string().min(1),
  authorId: z.string().min(1).optional(),
});

/** PATCH /api/reviews/[id]/reply — mutaxassisning javobi; bo'sh satr javobni o'chiradi */
export const reviewReplySchema = z.object({
  reply: z.string().trim().max(800, "Javob 800 belgidan oshmasin"),
});

/** POST /api/reports — profil yoki sharh haqida shikoyat */
export const reportSchema = z.object({
  targetType: z.enum(["specialist", "review"]),
  targetId: z.string().min(1).max(80),
  reason: z.enum(REPORT_REASONS.map((r) => r.value) as unknown as ["spam", "fake", "offensive", "fraud", "other"]),
  text: z.string().trim().max(500, "Izoh 500 belgidan oshmasin").optional().or(z.literal("")),
});

/** GET /api/search/suggest?q= */
export const suggestQuerySchema = z.object({
  q: z.string().trim().min(1).max(60),
});

/** POST /api/favorites (body) va DELETE /api/favorites (?specialistId=) */
export const favoriteSchema = z.object({ specialistId: z.string().min(1) });

export const specialistFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  // Noma'lum slug'lar 422 (API) — sahifa parseFilter'da shunchaki tashlab yuboradi
  region: z.enum(regionSlugs).optional(),
  category: z.enum(categorySlugs).optional(),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  experience: z.enum(experienceValues).optional(),
  verified: z.enum(["1", "0"]).optional(),
  /** Hozir buyurtma qabul qiladiganlar: "Band" emas va ta'tilda emas */
  available: z.enum(["1"]).optional(),
  gender: z.enum(["male", "female"]).optional(),
  /** Ko'nikma bo'yicha (F50) — specialists.skills JSON'ida aynan shu nom */
  skill: z.string().trim().max(40).optional(),
  /** Jihoz bo'yicha (F51) — specialists.equipment JSON'ida aynan shu nom */
  equipment: z.string().trim().max(40).optional(),
  /** Ish turi (F52) — specialists.workTypes JSON'ida shu slug */
  workType: z.enum(workTypeSlugs).optional(),
  /** "Hozir ochiq" (F42): ish vaqti bo'yicha hozir ochiq va ta'tilda emas (Toshkent vaqti) */
  openNow: z.enum(["1"]).optional(),
  sort: z.enum(["rating", "price_asc", "price_desc", "newest", "popular"]).default("rating"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export type SpecialistFilter = z.infer<typeof specialistFilterSchema>;

/* ---------- Saqlangan qidiruvlar (F53) ---------- */
export const savedSearchCreateSchema = z.object({
  name: z.string().trim().min(2, "Nom kamida 2 ta belgi").max(60, "Nom 60 belgidan oshmasin"),
  /** /mutaxassislar querystring'i ("category=videograf&region=samarqand") — server kanonik ko'rinishga keltiradi */
  query: z.string().trim().max(600),
  notify: z.boolean().optional(),
});
export const savedSearchUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Nom kamida 2 ta belgi").max(60, "Nom 60 belgidan oshmasin").optional(),
    notify: z.boolean().optional(),
  })
  .refine((d) => d.name !== undefined || d.notify !== undefined, "O'zgartirish uchun maydon yuboring");
export type SpecialistProfileInput = z.infer<typeof specialistProfileSchema>;
export type OrderInput = z.infer<typeof orderSchema>;

/** Zod xatolarini oddiy {field: message} ko'rinishiga keltirish */
export function flattenErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
