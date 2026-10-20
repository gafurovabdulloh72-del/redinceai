import { z } from "zod";
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
});
export type CourseInput = z.infer<typeof courseSchema>;

/** Dars yaratish/tahrirlash */
export const lessonSchema = z.object({
  title: z.string().trim().min(3, "Dars nomi kamida 3 belgi").max(MENTOR_LIMITS.lessonTitleMax),
  body: z.string().trim().max(MENTOR_LIMITS.lessonBodyMax).default(""),
  videoUrl: z.string().trim().url().max(500).nullish(),
  durationMin: z.coerce.number().int().min(0).max(100000).default(0),
  isPreview: z.boolean().default(false),
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
