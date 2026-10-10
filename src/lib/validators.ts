import { z } from "zod";
import { CATEGORIES, EXPERIENCE_LEVELS, ORDER_STATUSES, REGIONS } from "./constants";

const regionSlugs = REGIONS.map((r) => r.slug) as [string, ...string[]];
const categorySlugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];
const experienceValues = EXPERIENCE_LEVELS.map((e) => e.value) as unknown as ["junior", "middle", "senior", "expert"];

const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{9,16}$/, "Telefon raqami noto'g'ri (masalan: +998 90 123 45 67)");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Ism kamida 2 ta belgi").max(60),
  email: z.string().trim().toLowerCase().email("Email noto'g'ri"),
  password: z.string().min(6, "Parol kamida 6 ta belgi").max(100),
  phone: phone.optional().or(z.literal("")),
  role: z.enum(["client", "specialist"]).default("client"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email noto'g'ri"),
  password: z.string().min(1, "Parolni kiriting"),
});

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Havola http:// yoki https:// bilan boshlanishi kerak")
  .optional()
  .or(z.literal(""));

export const specialistProfileSchema = z.object({
  title: z.string().trim().min(5, "Sarlavha kamida 5 ta belgi").max(90),
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
});

export const portfolioItemSchema = z.object({
  title: z.string().trim().min(2).max(100),
  type: z.enum(["image", "video", "link"]),
  url: z.string().trim().url("Havola noto'g'ri").max(500),
  thumbnailUrl: optionalUrl,
  description: z.string().trim().max(500).optional().or(z.literal("")),
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
