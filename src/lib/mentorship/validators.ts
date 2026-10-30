import { z } from "zod";
import { IMAGE_URL_RE, UPLOAD_URL_RE } from "@/components/chat/attachments";
import { MENTOR_CATEGORIES, COURSE_LEVELS, MENTOR_LIMITS } from "./format";

const categoryKeys = MENTOR_CATEGORIES.map((c) => c.key) as [string, ...string[]];
const levelKeys = COURSE_LEVELS.map((l) => l.key) as [string, ...string[]];

/** Mentor bo'lish arizasi */
export const mentorApplySchema = z.object({
  headline: z.string().trim().min(8, "Unvon kamida 8 belgi").max(MENTOR_LIMITS.headlineMax),
  bio: z.string().trim().min(40, "O'zingiz haqingizda kamida 40 belgi").max(MENTOR_LIMITS.bioMax),
  expertise: z.array(z.enum(categoryKeys)).min(1, "Kamida bitta yo'nalish").max(MENTOR_LIMITS.expertiseMax),
});
export type MentorApplyInput = z.infer<typeof mentorApplySchema>;

/** Kurs yaratish/tahrirlash */
export const courseSchema = z.object({
  title: z.string().trim().min(5, "Sarlavha kamida 5 belgi").max(MENTOR_LIMITS.courseTitleMax),
  summary: z.string().trim().max(MENTOR_LIMITS.courseSummaryMax).default(""),
  coverUrl: z.string().trim().url().max(500).nullish(),
  category: z.enum(categoryKeys).default("boshqa"),
  level: z.enum(levelKeys).default("boshlangich"),
  priceFrom: z.coerce.number().int().min(0).max(MENTOR_LIMITS.priceMax).default(0),
  outcomes: z.array(z.string().trim().min(1).max(MENTOR_LIMITS.outcomeMax)).max(MENTOR_LIMITS.outcomesMax).default([]),
  requirements: z.array(z.string().trim().min(1).max(MENTOR_LIMITS.outcomeMax)).max(MENTOR_LIMITS.requirementsMax).default([]),
  audience: z.string().trim().max(MENTOR_LIMITS.audienceMax).default(""),
  language: z.enum(["uz", "ru", "en"]).default("uz"),
});
export type CourseInput = z.infer<typeof courseSchema>;

/** Dars yaratish/tahrirlash */
export const lessonSchema = z.object({
  title: z.string().trim().min(3, "Dars nomi kamida 3 belgi").max(MENTOR_LIMITS.lessonTitleMax),
  body: z.string().trim().max(MENTOR_LIMITS.lessonBodyMax).default(""),
  videoUrl: z.string().trim().url().max(500).nullish(),
  durationMin: z.coerce.number().int().min(0).max(100000).default(0),
  isPreview: z.boolean().default(false),
  /** Dars materiallari (yuklangan fayllar) */
  materials: z
    .array(z.object({ name: z.string().trim().min(1).max(120), url: z.string().trim().max(500).refine((u) => UPLOAD_URL_RE.test(u), "Fayl sayt orqali yuklanishi kerak"), size: z.number().int().min(0).optional() }))
    .max(8)
    .default([]),
  /** Video vaqt belgilari */
  chapters: z.array(z.object({ t: z.number().int().min(0).max(86400), title: z.string().trim().min(1).max(80) })).max(30).default([]),
  /** Dars testi */
  quiz: z
    .object({
      passPct: z.number().int().min(50).max(100).default(70),
      questions: z
        .array(z.object({ q: z.string().trim().min(3).max(200), options: z.array(z.string().trim().min(1).max(120)).min(2).max(5), correct: z.number().int().min(0).max(4) }).refine((x) => x.correct < x.options.length, "To'g'ri javob variantlar ichida bo'lsin"))
        .min(1)
        .max(10),
    })
    .nullish(),
  /** Uy vazifasi topshirig'i */
  assignment: z.string().trim().max(600).default(""),
});
export type LessonInput = z.infer<typeof lessonSchema>;

export const lessonReorderSchema = z.object({
  order: z.array(z.string().min(1).max(64)).min(1).max(MENTOR_LIMITS.maxLessonsPerCourse),
});

/** Kurs sharhi */
export const courseReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(MENTOR_LIMITS.reviewMax).default(""),
});
export type CourseReviewInput = z.infer<typeof courseReviewSchema>;

const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((u) => !u || IMAGE_URL_RE.test(u), "Rasm sayt orqali yuklanishi kerak")
  .nullish()
  .transform((u) => u || null);

/** Mentor sahifasi (egasi yoki admin tahrirlaydi) */
export const mentorProfileSchema = z.object({
  roleLabel: z.string().trim().max(MENTOR_LIMITS.roleMax).nullish().transform((v) => v || null),
  headline: z.string().trim().min(4, "Sarlavha kamida 4 belgi").max(MENTOR_LIMITS.headlineMax),
  bio: z.string().trim().max(MENTOR_LIMITS.bioMax).default(""),
  expertise: z.array(z.enum(categoryKeys)).max(MENTOR_LIMITS.expertiseMax).default([]),
  photoUrl: imageUrl,
  coverUrl: imageUrl,
  highlights: z
    .array(z.object({ title: z.string().trim().min(1).max(MENTOR_LIMITS.highlightTitleMax), text: z.string().trim().max(MENTOR_LIMITS.highlightTextMax).default("") }))
    .max(MENTOR_LIMITS.highlightsMax)
    .default([]),
});
export type MentorProfileInput = z.infer<typeof mentorProfileSchema>;

/** Kurs yaratishda faqat nom kifoya (qolganini bo'lim ichida o'zgartiradi); admin boshqa mentor nomidan yaratsa mentorId beradi */
export const courseCreateSchema = courseSchema.extend({ mentorId: z.string().min(1).max(64).optional() });

/** Test javoblari: har savol uchun tanlangan variant indeksi */
export const quizSubmitSchema = z.object({ answers: z.array(z.number().int().min(0).max(4)).min(1).max(10) });
export const submissionSchema = z.object({ body: z.string().trim().max(2000).default(""), fileUrl: z.string().trim().max(500).refine((u) => !u || UPLOAD_URL_RE.test(u), "Fayl sayt orqali yuklanishi kerak").nullish() });
export const submissionReviewSchema = z.object({ status: z.enum(["reviewed", "needs_work"]), grade: z.number().int().min(0).max(100).nullish(), feedback: z.string().trim().max(1500).default(""), showcase: z.boolean().default(false) });
export const lessonCommentSchema = z.object({ body: z.string().trim().min(2, "Juda qisqa").max(1200), parentId: z.string().max(64).nullish() });
export const roadmapSchema = z.object({ title: z.string().trim().min(3).max(80), description: z.string().trim().max(300).default(""), courseIds: z.array(z.string().max(64)).min(1).max(12) });
