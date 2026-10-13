import { z } from "zod";
import { CATEGORIES, REGIONS } from "@/lib/constants";
// validators.ts o'zbekcha xato xaritasini (z.setErrorMap) o'rnatadi — import shu uchun ham kerak
import { optionalPhone } from "@/lib/validators";
import { COVER_MAX, COVER_MIN, JOB_DESC_MAX, JOB_DESC_MIN, JOB_SKILLS_MAX, JOB_TITLE_MAX, JOB_TITLE_MIN, REMOTE_REGION } from "./format";

const regionSlugs = REGIONS.map((r) => r.slug) as [string, ...string[]];
const categorySlugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

/** "" / null / 0 → null; aks holda butun son (so'm) */
const money = z.preprocess(
  (v) => (v === "" || v == null ? null : typeof v === "string" ? v.replace(/\s/g, "") : v),
  z.coerce.number().int("Butun son kiriting").min(0).max(1_000_000_000, "Summa juda katta").nullable(),
).transform((v) => (v && v > 0 ? v : null));


/** E'lon maydonlari (yaratish va tahrirlash) */
const jobFields = z.object({
  title: z.string().trim().min(JOB_TITLE_MIN, `Sarlavha kamida ${JOB_TITLE_MIN} ta belgi`).max(JOB_TITLE_MAX),
  description: z.string().trim().min(JOB_DESC_MIN, `Tavsif kamida ${JOB_DESC_MIN} ta belgi — vazifani batafsilroq yozing`).max(JOB_DESC_MAX),
  category: z.enum(categorySlugs, { errorMap: () => ({ message: "Yo'nalishni tanlang" }) }),
  /** Hudud slug'i; "" / "remote" / null — masofaviy (istalgan hudud) */
  regionSlug: z
    .union([z.enum(regionSlugs), z.literal(REMOTE_REGION), z.literal(""), z.null()], { errorMap: () => ({ message: "Hududni tanlang" }) })
    .optional()
    .transform((v) => (v && v !== REMOTE_REGION ? v : null)),
  budgetType: z.enum(["fixed", "hourly"]).default("fixed"),
  budgetMin: money.optional().transform((v) => v ?? null),
  budgetMax: money.optional().transform((v) => v ?? null),
  deadline: z
    .string()
    .trim()
    .max(40, "Muddat 40 belgidan oshmasin")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  skills: z
    .array(z.string().trim().min(1).max(40, "Ko'nikma 40 belgidan oshmasin"))
    .max(JOB_SKILLS_MAX, `Ko'pi bilan ${JOB_SKILLS_MAX} ta ko'nikma`)
    .default([])
    .transform((arr) => {
      // Takrorlar (katta-kichik harf farqsiz) olib tashlanadi
      const seen = new Set<string>();
      return arr.filter((s) => {
        const k = s.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }),
});

function budgetCheck(v: { budgetMin: number | null; budgetMax: number | null }, ctx: z.RefinementCtx) {
  if (v.budgetMin && v.budgetMax && v.budgetMax < v.budgetMin) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budgetMax"], message: "Maksimal summa minimaldan kam bo'lmasin" });
  }
}

/** POST /api/jobs */
export const jobInputSchema = jobFields.superRefine(budgetCheck);
export type JobInput = z.infer<typeof jobInputSchema>;

/** PATCH /api/jobs/[id]: tahrirlash yoki yopish / qayta ochish */
export const jobPatchSchema = z
  .discriminatedUnion("action", [
    jobFields.extend({ action: z.literal("edit") }),
    z.object({ action: z.literal("close") }),
    z.object({ action: z.literal("reopen") }),
  ])
  .superRefine((v, ctx) => {
    if (v.action === "edit") budgetCheck(v, ctx);
  });
export type JobPatch = z.infer<typeof jobPatchSchema>;

export const JOB_SORTS = ["newest", "budget_high", "budget_low"] as const;
export type JobSort = (typeof JOB_SORTS)[number];

/** GET /api/jobs va /ishlar filtrlari */
export const jobFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.enum(categorySlugs).optional(),
  /** Hudud slug'i yoki "remote" (masofaviy) */
  region: z.union([z.enum(regionSlugs), z.literal(REMOTE_REGION)]).optional(),
  min: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  max: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  sort: z.enum(JOB_SORTS).default("newest"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});
export type JobFilter = z.infer<typeof jobFilterSchema>;

/** POST /api/proposals */
export const proposalInputSchema = z.object({
  jobId: z.string().trim().min(1).max(80),
  amount: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s/g, "") : v),
    z.coerce.number({ invalid_type_error: "Summani kiriting" }).int("Butun son kiriting").min(1_000, "Kamida 1 000 so'm").max(1_000_000_000, "Summa juda katta"),
  ),
  deliveryDays: z.coerce.number({ invalid_type_error: "Muddatni kiriting" }).int("Butun son kiriting").min(1, "Kamida 1 kun").max(365, "Ko'pi bilan 365 kun"),
  coverLetter: z.string().trim().min(COVER_MIN, `Xat kamida ${COVER_MIN} ta belgi — nega aynan siz mos ekaningizni yozing`).max(COVER_MAX, `Ko'pi bilan ${COVER_MAX} ta belgi`),
});
export type ProposalInput = z.infer<typeof proposalInputSchema>;

/** PATCH /api/proposals/[id] */
export const proposalActionSchema = z.object({
  action: z.enum(["shortlist", "decline", "accept", "withdraw"]),
  /** Qabul qilishda — mutaxassisga ko'rinadigan telefon (profildagi raqam bo'lmasa majburiy) */
  contactPhone: optionalPhone,
});
export type ProposalAction = z.infer<typeof proposalActionSchema>["action"];
