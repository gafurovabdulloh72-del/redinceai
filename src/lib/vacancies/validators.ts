import { z } from "zod";
import { REGIONS } from "@/lib/constants";
import "@/lib/validators";
import {
  COVER_LETTER_MAX,
  PROFESSION_SLUGS,
  REMOTE_REGION,
  RESUME_LINKS_MAX,
  RESUME_SKILLS_MAX,
  RESUME_SUMMARY_MAX,
  VACANCY_DESC_MAX,
  VACANCY_DESC_MIN,
  VACANCY_REQ_MAX,
  VACANCY_SKILLS_MAX,
  VACANCY_TITLE_MAX,
  VACANCY_TITLE_MIN,
} from "./format";

const regionSlugs = REGIONS.map((r) => r.slug) as [string, ...string[]];

/** "" / null / 0 → null; aks holda butun son (so'm) */
const money = z
  .preprocess(
    (v) => (v === "" || v == null ? null : typeof v === "string" ? v.replace(/\s/g, "") : v),
    z.coerce.number().int("Butun son kiriting").min(0).max(1_000_000_000, "Summa juda katta").nullable(),
  )
  .transform((v) => (v && v > 0 ? v : null));

const regionField = z
  .union([z.enum(regionSlugs), z.literal(REMOTE_REGION), z.literal(""), z.null()], { errorMap: () => ({ message: "Hududni tanlang" }) })
  .optional()
  .transform((v) => (v && v !== REMOTE_REGION ? v : null));

const skillsField = (max: number) =>
  z
    .array(z.string().trim().min(1).max(40, "Ko'nikma 40 belgidan oshmasin"))
    .max(max, `Ko'pi bilan ${max} ta ko'nikma`)
    .default([])
    .transform((arr) => {
      const seen = new Set<string>();
      return arr.filter((s) => {
        const k = s.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    });

const httpsUrl = z.string().trim().max(300).regex(/^https:\/\/\S+$/, "Havola https:// bilan boshlanishi kerak");

const vacancyFields = z.object({
  title: z.string().trim().min(VACANCY_TITLE_MIN, `Sarlavha kamida ${VACANCY_TITLE_MIN} ta belgi`).max(VACANCY_TITLE_MAX),
  company: z.string().trim().max(80, "Kompaniya nomi 80 belgidan oshmasin").optional().default(""),
  profession: z.enum(PROFESSION_SLUGS, { errorMap: () => ({ message: "Kasbni tanlang" }) }),
  description: z.string().trim().min(VACANCY_DESC_MIN, `Tavsif kamida ${VACANCY_DESC_MIN} ta belgi — vazifa va shartlarni yozing`).max(VACANCY_DESC_MAX),
  requirements: z.string().trim().max(VACANCY_REQ_MAX).optional().default(""),
  format: z.enum(["remote", "hybrid", "office"]).default("remote"),
  employment: z.enum(["full", "part", "project", "internship"]).default("full"),
  experience: z.enum(["none", "junior", "middle", "senior"]).default("none"),
  salaryMin: money.optional().transform((v) => v ?? null),
  salaryMax: money.optional().transform((v) => v ?? null),
  regionSlug: regionField,
  skills: skillsField(VACANCY_SKILLS_MAX),
  applyUrl: httpsUrl.optional().or(z.literal("")).transform((v) => (v ? v : null)),
});

function salaryCheck(v: { salaryMin: number | null; salaryMax: number | null }, ctx: z.RefinementCtx) {
  if (v.salaryMin && v.salaryMax && v.salaryMax < v.salaryMin) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["salaryMax"], message: "Maksimal maosh minimaldan kam bo'lmasin" });
  }
}

export const vacancyInputSchema = vacancyFields.superRefine(salaryCheck);
export type VacancyInput = z.infer<typeof vacancyInputSchema>;

export const vacancyPatchSchema = vacancyFields.partial().extend({ status: z.enum(["open", "closed"]).optional(), extend: z.boolean().optional() }).superRefine((v, ctx) => {
  if (v.salaryMin !== undefined && v.salaryMax !== undefined) salaryCheck({ salaryMin: v.salaryMin, salaryMax: v.salaryMax }, ctx);
});

export const resumeInputSchema = z.object({
  title: z.string().trim().min(3, "Lavozim kamida 3 ta belgi").max(100),
  profession: z.enum(PROFESSION_SLUGS, { errorMap: () => ({ message: "Kasbni tanlang" }) }),
  summary: z.string().trim().max(RESUME_SUMMARY_MAX).optional().default(""),
  skills: skillsField(RESUME_SKILLS_MAX),
  experience: z.enum(["none", "junior", "middle", "senior"]).default("none"),
  expectedSalary: money.optional().transform((v) => v ?? null),
  format: z.enum(["any", "remote", "hybrid", "office"]).default("any"),
  regionSlug: regionField,
  links: z
    .array(z.object({ label: z.string().trim().min(1, "Nomi").max(30, "Nomi 30 belgidan oshmasin"), url: httpsUrl }))
    .max(RESUME_LINKS_MAX, `Ko'pi bilan ${RESUME_LINKS_MAX} ta havola`)
    .default([]),
  isPublic: z.boolean().default(true),
});
export type ResumeInput = z.infer<typeof resumeInputSchema>;

export const applicationInputSchema = z.object({
  coverLetter: z.string().trim().max(COVER_LETTER_MAX, `Ko'pi bilan ${COVER_LETTER_MAX} belgi`).optional().default(""),
});

export const applicationStatusSchema = z.object({ status: z.enum(["viewed", "shortlisted", "rejected", "hired"]) });

export const vacancyFilterSchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  profession: z.enum(PROFESSION_SLUGS).optional().or(z.literal("")).default(""),
  format: z.enum(["remote", "hybrid", "office"]).optional().or(z.literal("")).default(""),
  employment: z.enum(["full", "part", "project", "internship"]).optional().or(z.literal("")).default(""),
  experience: z.enum(["none", "junior", "middle", "senior"]).optional().or(z.literal("")).default(""),
  region: z.string().trim().max(40).optional().default(""),
  min: z.coerce.number().int().min(0).optional().default(0),
  sort: z.enum(["newest", "salary_high"]).optional().default("newest"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});
export type VacancyFilter = z.infer<typeof vacancyFilterSchema>;

export const resumeFilterSchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  profession: z.enum(PROFESSION_SLUGS).optional().or(z.literal("")).default(""),
  experience: z.enum(["none", "junior", "middle", "senior"]).optional().or(z.literal("")).default(""),
  format: z.enum(["any", "remote", "hybrid", "office"]).optional().or(z.literal("")).default(""),
  region: z.string().trim().max(40).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});
export type ResumeFilter = z.infer<typeof resumeFilterSchema>;
