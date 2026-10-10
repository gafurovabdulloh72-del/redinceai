import { z } from "zod";
import { CATEGORIES, EXPERIENCE_LEVELS, ORDER_STATUSES, REGIONS, VISIBILITY_FIELDS, VISIBILITY_LEVELS, WEEKDAYS } from "./constants";

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

const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{9,16}$/, "Telefon raqami noto'g'ri (masalan: +998 90 123 45 67)");
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

export const httpUrl = z.string().trim().max(500).refine((v) => HTTP_OR_UPLOAD_RE.test(v), URL_MSG);

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || HTTP_OR_UPLOAD_RE.test(v), URL_MSG)
  .optional()
  .or(z.literal(""));

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
  languages: z.array(z.enum(["uz", "ru", "en", "kaa", "tg"])).min(1).default(["uz"]),
  telegram: z.string().trim().max(60).optional().or(z.literal("")),
  instagram: z.string().trim().max(60).optional().or(z.literal("")),
  youtube: optionalUrl,
  website: optionalUrl,
  coverUrl: optionalUrl,
  isAvailable: z.boolean().default(true),
  })
  .refine((d) => d.priceTo == null || d.priceTo === 0 || d.priceTo >= d.priceFrom, {
    message: "Maksimal narx minimaldan kam bo'lmasin",
    path: ["priceTo"],
  });

export const portfolioItemSchema = z.object({
  title: z.string().trim().min(2).max(100),
  type: z.enum(["image", "video", "link"]),
  url: httpUrl,
  thumbnailUrl: optionalUrl,
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

/** Akkaunt ma'lumotlari (PATCH /api/profile) */
export const accountSchema = z.object({
  name: z.string().trim().min(2, "Ism kamida 2 ta belgi").max(60),
  phone: optionalPhone,
  avatarUrl: optionalUrl,
  gender: z.enum(["male", "female"]).optional().nullable(),
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

export const privacyUpdateSchema = z.object({
  visibility: visibilitySchema,
  schedule: scheduleSchema.optional(),
  vacationUntil: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
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
  amount: z.coerce.number().int().min(50_000, "Kamida 50 000 so'm").max(1_000_000_000),
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
  minPayout: z.coerce.number().int().min(0).max(100_000_000),
  minOrderAmount: z.coerce.number().int().min(0).max(100_000_000),
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

export const specialistFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  region: z.string().optional(),
  category: z.string().optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  experience: z.string().optional(),
  verified: z.enum(["1", "0"]).optional(),
  gender: z.enum(["male", "female"]).optional(),
  sort: z.enum(["rating", "price_asc", "price_desc", "newest", "popular"]).default("rating"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export type SpecialistFilter = z.infer<typeof specialistFilterSchema>;
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
