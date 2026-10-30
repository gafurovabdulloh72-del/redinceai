import "server-only";
import { and, asc, desc, eq, gt, inArray, like, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseReviews, courseSaves, courses, enrollments, groups, lessonCompletions, lessons, mentors, users } from "@/lib/db/schema";
import { uid, slugify, escapeLike } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import type { CourseInput, LessonInput, MentorApplyInput, MentorProfileInput, CourseReviewInput } from "./validators";
import { createGroup, updateGroup } from "@/lib/groups/service";
import { MENTOR_LIMITS, type CourseLevel } from "./format";
import { maybeIssueCertificate, myCertificateCode, mySubmission, publicQuiz, quizPassed, type QuizPublic } from "./learning";
import { learningStreak } from "./streak";

export interface MentorLite {
  id: string;
  userId: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
  photoUrl: string | null;
  roleLabel: string | null;
  headline: string;
  rating: number;
  coursesCount: number;
  studentsCount: number;
}

export interface CourseCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverUrl: string | null;
  category: string;
  level: string;
  priceFrom: number;
  lessonsCount: number;
  studentsCount: number;
  rating: number;
  reviewsCount: number;
  createdAt: number;
  /** Barcha darslar davomiyligi (daqiqa) — katalog kartasida «N soat» */
  totalMin: number;
  mentor: { name: string; avatarUrl: string | null; headline: string; userId: string; slug: string | null };
}

/** Foydalanuvchining mentor yozuvi (bo'lsa) */
export async function getMentorForUser(userId: string) {
  return (await db.query.mentors.findFirst({ where: eq(mentors.userId, userId) })) ?? null;
}

/** Mentor bo'lish arizasi (yoki mavjud arizani yangilash — hali tasdiqlanmagan bo'lsa) */
export async function applyAsMentor(userId: string, input: MentorApplyInput) {
  const existing = await getMentorForUser(userId);
  if (existing?.isApproved) throw new ApiError(409, "Siz allaqachon mentor sifatida tasdiqlangansiz");
  if (existing) {
    await db.update(mentors).set({ headline: input.headline, bio: input.bio, expertise: input.expertise, appliedAt: new Date() }).where(eq(mentors.id, existing.id));
    return { id: existing.id, pending: true };
  }
  const id = uid();
  await db.insert(mentors).values({ id, userId, headline: input.headline, bio: input.bio, expertise: input.expertise, appliedAt: new Date() });
  return { id, pending: true };
}

function mentorLite(row: typeof mentors.$inferSelect & { user: { name: string; avatarUrl: string | null } }): MentorLite {
  return { id: row.id, userId: row.userId, slug: row.slug, name: row.user.name, avatarUrl: row.user.avatarUrl, photoUrl: row.photoUrl, roleLabel: row.roleLabel, headline: row.headline, rating: row.rating, coursesCount: row.coursesCount, studentsCount: row.studentsCount };
}

/** Tasdiqlangan mentorlar (katalog uchun); sahifasi (slug) bor bo'lganlar */
export async function listMentors(limit = 12): Promise<MentorLite[]> {
  const rows = await db.query.mentors.findMany({
    where: and(eq(mentors.isApproved, true), sql`${mentors.slug} is not null`),
    orderBy: [desc(mentors.studentsCount), desc(mentors.rating)],
    limit,
    with: { user: { columns: { name: true, avatarUrl: true } } },
  });
  return rows.map(mentorLite);
}

function toCard(c: typeof courses.$inferSelect & { mentor: { userId: string; slug: string | null; user: { name: string; avatarUrl: string | null }; headline: string } }): CourseCard {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    summary: c.summary,
    coverUrl: c.coverUrl,
    category: c.category,
    level: c.level,
    priceFrom: c.priceFrom,
    lessonsCount: c.lessonsCount,
    studentsCount: c.studentsCount,
    rating: c.rating,
    reviewsCount: c.reviewsCount,
    createdAt: c.createdAt.getTime(),
    totalMin: Number((c as { totalMin?: number | null }).totalMin ?? 0),
    mentor: { name: c.mentor.user.name, avatarUrl: c.mentor.user.avatarUrl, headline: c.mentor.headline, userId: c.mentor.userId, slug: c.mentor.slug },
  };
}

/** Ommaviy kurslar katalogi (chop etilgan) — filtr/qidiruv/sahifalash */
export async function listCourses(opts: { category?: string; level?: string; q?: string; price?: "free" | "paid"; sort?: "new" | "popular" | "rating" | "cheap" | "expensive"; cursor?: number | null; limit?: number } = {}): Promise<{ items: CourseCard[]; nextCursor: number | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 18, 1), 48);
  const conds = [eq(courses.isPublished, true)];
  if (opts.category) conds.push(eq(courses.category, opts.category));
  if (opts.level) conds.push(eq(courses.level, opts.level as CourseLevel));
  if (opts.q) {
    const term = `%${escapeLike(opts.q.toLowerCase())}%`;
    const m = or(sql`lower(${courses.title}) like ${term} escape '\\'`, sql`lower(${courses.summary}) like ${term} escape '\\'`);
    if (m) conds.push(m);
  }
  if (opts.price === "free") conds.push(eq(courses.priceFrom, 0));
  if (opts.price === "paid") conds.push(gt(courses.priceFrom, 0));
  const sort = opts.sort ?? "new";
  if (opts.cursor && sort === "new") conds.push(lt(courses.createdAt, new Date(opts.cursor)));
  const order = sort === "popular" ? [desc(courses.studentsCount), desc(courses.createdAt)] : sort === "rating" ? [desc(courses.rating), desc(courses.studentsCount)] : sort === "cheap" ? [asc(courses.priceFrom), desc(courses.createdAt)] : sort === "expensive" ? [desc(courses.priceFrom), desc(courses.createdAt)] : [desc(courses.createdAt)];
  const rows = await db.query.courses.findMany({
    where: and(...conds),
    orderBy: order,
    limit: limit + 1,
    with: { mentor: { columns: { userId: true, headline: true, slug: true }, with: { user: { columns: { name: true, avatarUrl: true } } } } },
    // Udemy kabi «jami N soat» — darslar davomiyligi yig'indisi (bitta korrelyatsion so'rov, N+1 emas)
    // DIQQAT: relational so'rov ichida `${courses.id}` yalang'och "id" bo'lib chiqadi (ichki jadvalga tegadi) — tashqi jadval nomi aniq yoziladi
    extras: { totalMin: sql<number>`(select coalesce(sum(l.duration_min), 0) from lessons l where l.course_id = "courses"."id")`.as("total_min") },
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((r) => toCard(r as never));
  return { items, nextCursor: hasMore ? items[items.length - 1].createdAt : null };
}

export interface CourseDetail extends CourseCard {
  /** Udemy uslubidagi bo'limlar */
  outcomes: string[];
  requirements: string[];
  audience: string;
  language: string;
  /** Barcha darslar davomiyligi (daqiqa) */
  totalMin: number;
  updatedAt: number;
  /** Udemy «Preview this course»: birinchi bepul namuna darsining videosi (muqova ustida o'ynaydi) */
  previewVideo: { lessonId: string; title: string; url: string; durationMin: number } | null;
  /** «Bu kursga kiradi» (Udemy): materiallar, testlar, vazifalar soni */
  materialsCount: number;
  quizCount: number;
  assignmentCount: number;
  /** Ko'ruvchi kursni saqlaganmi (wishlist) */
  savedByMe: boolean;
  mentorBio: string;
  refPercent: number;
  certificateCode: string | null;
  isOwner: boolean;
  enrolled: boolean;
  progressPct: number;
  completedLessonIds: string[];
  lessons: Array<{ id: string; position: number; title: string; durationMin: number; section: string; isPreview: boolean; locked: boolean; completed: boolean }>;
  reviews: Array<{ id: string; rating: number; body: string; createdAt: number; name: string; avatarUrl: string | null }>;
  /** Reyting taqsimoti: indeks 0 → 1★ … indeks 4 → 5★ (Udemy kabi chiziqlar) */
  ratingDist: [number, number, number, number, number];
  myReview: { rating: number; body: string } | null;
}

/** Kurs sahifasi (slug bo'yicha) — ko'ruvchiga moslab (yozilish, egalik, qulflangan darslar) */
export async function getCourseBySlug(slug: string, viewerId: string | null, isAdmin = false): Promise<CourseDetail | null> {
  const c = await db.query.courses.findFirst({
    where: eq(courses.slug, slug),
    with: { mentor: { columns: { userId: true, headline: true, bio: true, slug: true, refPercent: true }, with: { user: { columns: { name: true, avatarUrl: true } } } } },
  });
  if (!c) return null;
  const isOwner = Boolean(viewerId && c.mentor.userId === viewerId);
  if (!c.isPublished && !isOwner && !isAdmin) return null;

  const [lessonRows, enrollment, reviewRows, distRows, savedRow] = await Promise.all([
    db.query.lessons.findMany({ where: eq(lessons.courseId, c.id), orderBy: [asc(lessons.position)] }),
    viewerId ? db.query.enrollments.findFirst({ where: and(eq(enrollments.courseId, c.id), eq(enrollments.userId, viewerId)) }) : Promise.resolve(undefined),
    db.query.courseReviews.findMany({ where: eq(courseReviews.courseId, c.id), orderBy: [desc(courseReviews.createdAt)], limit: 20 }),
    db.select({ rating: courseReviews.rating, n: sql<number>`count(*)` }).from(courseReviews).where(eq(courseReviews.courseId, c.id)).groupBy(courseReviews.rating),
    viewerId ? db.query.courseSaves.findFirst({ where: and(eq(courseSaves.courseId, c.id), eq(courseSaves.userId, viewerId)), columns: { id: true } }) : Promise.resolve(undefined),
  ]);
  const ratingDist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const d of distRows) {
    const i = Math.min(5, Math.max(1, Math.round(Number(d.rating)))) - 1;
    ratingDist[i] += Number(d.n);
  }
  const enrolled = Boolean(enrollment);
  const access = enrolled || isOwner || isAdmin;
  const completed = viewerId && enrolled ? await db.query.lessonCompletions.findMany({ where: and(eq(lessonCompletions.userId, viewerId), eq(lessonCompletions.courseId, c.id)), columns: { lessonId: true } }) : [];
  const completedSet = new Set(completed.map((x) => x.lessonId));

  // Sharh mualliflari (ism/avatar)
  const reviewerIds = reviewRows.map((r) => r.userId);
  const reviewers = reviewerIds.length ? await db.query.users.findMany({ where: inArray(users.id, reviewerIds), columns: { id: true, name: true, avatarUrl: true } }) : [];
  const rmap = new Map(reviewers.map((u) => [u.id, u]));
  const myReviewRow = viewerId ? reviewRows.find((r) => r.userId === viewerId) : undefined;

  const card = toCard(c as never);
  return {
    ...card,
    outcomes: c.outcomes ?? [],
    requirements: c.requirements ?? [],
    audience: c.audience ?? "",
    language: c.language ?? "uz",
    totalMin: lessonRows.reduce((a, l) => a + (l.durationMin || 0), 0),
    updatedAt: c.updatedAt.getTime(),
    savedByMe: Boolean(savedRow),
    materialsCount: lessonRows.reduce((a, l) => a + (l.materials?.length ?? 0), 0),
    quizCount: lessonRows.filter((l) => l.quiz && l.quiz.questions?.length).length,
    assignmentCount: lessonRows.filter((l) => l.assignment && l.assignment.trim()).length,
    previewVideo: (() => {
      const pv = lessonRows.find((l) => l.isPreview && l.videoUrl);
      return pv && pv.videoUrl ? { lessonId: pv.id, title: pv.title, url: pv.videoUrl, durationMin: pv.durationMin } : null;
    })(),
    mentorBio: c.mentor.bio,
    refPercent: c.mentor.refPercent,
    certificateCode: viewerId && enrolled ? await myCertificateCode(viewerId, c.id) : null,
    isOwner,
    enrolled,
    progressPct: enrollment?.progressPct ?? 0,
    completedLessonIds: [...completedSet],
    lessons: lessonRows.map((l) => ({ id: l.id, position: l.position, title: l.title, durationMin: l.durationMin, section: l.section ?? "", isPreview: l.isPreview, locked: !(access || l.isPreview), completed: completedSet.has(l.id) })),
    reviews: reviewRows.map((r) => ({ id: r.id, rating: r.rating, body: r.body, createdAt: r.createdAt.getTime(), name: rmap.get(r.userId)?.name ?? "Foydalanuvchi", avatarUrl: rmap.get(r.userId)?.avatarUrl ?? null })),
    ratingDist,
    myReview: myReviewRow ? { rating: myReviewRow.rating, body: myReviewRow.body } : null,
  };
}

export interface LessonView {
  id: string;
  title: string;
  body: string;
  videoUrl: string | null;
  durationMin: number;
  position: number;
  isPreview: boolean;
  course: { id: string; slug: string; title: string; lessonsCount: number };
  enrolled: boolean;
  completed: boolean;
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
  isOwner: boolean;
  /** Faqat kursga yozilgan/egasi/admin ko'radi */
  materials: Array<{ name: string; url: string; size?: number }>;
  chapters: Array<{ t: number; title: string }>;
  quiz: QuizPublic | null;
  quizPassed: boolean;
  assignment: string;
  submission: { status: string; grade: number | null; feedback: string; body: string; fileUrl: string | null } | null;
  /** Kurs 100% tugatilgan bo'lsa sertifikat kodi */
  certificateCode: string | null;
  /** Kursning barcha darslari — yon ro'yxat uchun (qulflangani `locked`) */
  siblings: Array<{ id: string; title: string; position: number; durationMin: number; section: string; completed: boolean; locked: boolean }>;
  /** Kurs bo'yicha progress (0–100) */
  progressPct: number;
}

/** Bitta dars — ko'ruvchiga ruxsat bo'lsa (yozilgan / egasi / admin / bepul namuna) */
export async function getLessonForViewer(lessonId: string, viewerId: string | null, isAdmin = false): Promise<LessonView | null> {
  const l = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!l) return null;
  const c = await db.query.courses.findFirst({ where: eq(courses.id, l.courseId), with: { mentor: { columns: { userId: true } } } });
  if (!c) return null;
  const isOwner = Boolean(viewerId && c.mentor.userId === viewerId);
  const enrollment = viewerId ? await db.query.enrollments.findFirst({ where: and(eq(enrollments.courseId, c.id), eq(enrollments.userId, viewerId)) }) : undefined;
  const enrolled = Boolean(enrollment);
  const access = enrolled || isOwner || isAdmin || l.isPreview;
  if (!access) throw new ApiError(403, "Bu darsni ko'rish uchun kursga yoziling");

  const siblings = await db.query.lessons.findMany({ where: eq(lessons.courseId, c.id), orderBy: [asc(lessons.position)], columns: { id: true, title: true, position: true, durationMin: true, isPreview: true, section: true } });
  const idx = siblings.findIndex((s) => s.id === l.id);
  const completed = viewerId ? Boolean(await db.query.lessonCompletions.findFirst({ where: and(eq(lessonCompletions.userId, viewerId), eq(lessonCompletions.lessonId, l.id)) })) : false;

  return {
    id: l.id,
    title: l.title,
    body: l.body,
    videoUrl: l.videoUrl,
    durationMin: l.durationMin,
    position: l.position,
    isPreview: l.isPreview,
    course: { id: c.id, slug: c.slug, title: c.title, lessonsCount: siblings.length },
    enrolled,
    completed,
    prev: idx > 0 ? { id: siblings[idx - 1].id, title: siblings[idx - 1].title } : null,
    next: idx >= 0 && idx < siblings.length - 1 ? { id: siblings[idx + 1].id, title: siblings[idx + 1].title } : null,
    isOwner,
    materials: enrolled || isOwner || isAdmin ? l.materials ?? [] : [],
    chapters: l.chapters ?? [],
    quiz: enrolled || isOwner || isAdmin ? publicQuiz(l.quiz) : null,
    quizPassed: viewerId ? await quizPassed(viewerId, l.id) : false,
    assignment: enrolled || isOwner || isAdmin ? l.assignment : "",
    submission: viewerId && l.assignment ? await mySubmission(viewerId, l.id).then((x) => (x ? { status: x.status, grade: x.grade, feedback: x.feedback, body: x.body, fileUrl: x.fileUrl } : null)) : null,
    certificateCode: viewerId ? await myCertificateCode(viewerId, c.id) : null,
    ...(await siblingsWithProgress(c.id, siblings, viewerId, enrolled || isOwner || isAdmin)),
  };
}

/**
 * Yon ro'yxat uchun: kursning barcha darslari + har birining «bajarildi» holati va umumiy progress.
 * Yozilmagan ko'ruvchiga faqat bepul namunalar ochiq (`locked`), qolgani qulf bilan ko'rinadi —
 * kurs tarkibi ko'rinsin, lekin ochilmasin.
 */
async function siblingsWithProgress(
  courseId: string,
  rows: Array<{ id: string; title: string; position: number; durationMin: number; isPreview: boolean; section?: string | null }>,
  viewerId: string | null,
  hasAccess: boolean,
): Promise<{ siblings: LessonView["siblings"]; progressPct: number }> {
  const done = viewerId
    ? new Set(
        (
          await db.query.lessonCompletions.findMany({
            where: and(eq(lessonCompletions.userId, viewerId), inArray(lessonCompletions.lessonId, rows.map((r) => r.id))),
            columns: { lessonId: true },
          })
        ).map((x) => x.lessonId),
      )
    : new Set<string>();
  void courseId;
  const siblings = rows.map((r) => ({ id: r.id, title: r.title, position: r.position, durationMin: r.durationMin, section: r.section ?? "", completed: done.has(r.id), locked: !hasAccess && !r.isPreview }));
  return { siblings, progressPct: rows.length ? Math.round((done.size / rows.length) * 100) : 0 };
}

/* --------------------------- Mentor amallari --------------------------- */

async function requireApprovedMentor(userId: string) {
  const m = await getMentorForUser(userId);
  if (!m || !m.isApproved) throw new ApiError(403, "Avval mentor sifatida tasdiqlaning");
  return m;
}

export async function createCourse(userId: string, input: CourseInput, opts: { mentorId?: string; admin?: boolean } = {}) {
  let m: Awaited<ReturnType<typeof requireApprovedMentor>>;
  if (opts.mentorId && opts.admin) {
    const row = await db.query.mentors.findFirst({ where: eq(mentors.id, opts.mentorId) });
    if (!row || !row.isApproved) throw new ApiError(404, "Mentor topilmadi");
    m = row;
  } else {
    m = await requireApprovedMentor(userId);
  }
  // Yo'nalish ko'rsatilmasa — mentorning birinchi yo'nalishi (bo'lim ochishda hammasini so'ramaymiz)
  const category = input.category && input.category !== "boshqa" ? input.category : (m.expertise[0] ?? "boshqa");
  const id = uid();
  const slug = `${slugify(input.title) || "kurs"}-${id.slice(0, 6)}`;
  await db.transaction(async (tx) => {
    await tx.insert(courses).values({ id, mentorId: m.id, slug, title: input.title, summary: input.summary, coverUrl: input.coverUrl ?? null, category, level: input.level as CourseLevel, priceFrom: input.priceFrom, outcomes: input.outcomes, requirements: input.requirements, audience: input.audience, language: input.language });
    await tx.update(mentors).set({ coursesCount: sql`${mentors.coursesCount} + 1` }).where(eq(mentors.id, m.id));
  });
  return { id, slug };
}

/** Egalikni tekshirib kursni oladi */
async function ownedCourse(userId: string, courseId: string, isAdmin = false) {
  const c = await db.query.courses.findFirst({ where: eq(courses.id, courseId), with: { mentor: { columns: { userId: true, id: true } } } });
  if (!c) throw new ApiError(404, "Kurs topilmadi");
  if (c.mentor.userId !== userId && !isAdmin) throw new ApiError(403, "Bu kurs sizniki emas");
  return c;
}

export async function updateCourse(userId: string, courseId: string, input: CourseInput, isAdmin = false) {
  await ownedCourse(userId, courseId, isAdmin);
  await db.update(courses).set({ title: input.title, summary: input.summary, coverUrl: input.coverUrl ?? null, category: input.category, level: input.level as CourseLevel, priceFrom: input.priceFrom, outcomes: input.outcomes, requirements: input.requirements, audience: input.audience, language: input.language, updatedAt: new Date() }).where(eq(courses.id, courseId));
}

export async function setCoursePublished(userId: string, courseId: string, publish: boolean, isAdmin = false) {
  const c = await ownedCourse(userId, courseId, isAdmin);
  if (publish && c.lessonsCount < 1) throw new ApiError(422, "Kamida bitta dars qo'shing, keyin chop eting");
  await db.update(courses).set({ isPublished: publish, updatedAt: new Date() }).where(eq(courses.id, courseId));
}

export async function addLesson(userId: string, courseId: string, input: LessonInput, isAdmin = false) {
  const c = await ownedCourse(userId, courseId, isAdmin);
  if (c.lessonsCount >= MENTOR_LIMITS.maxLessonsPerCourse) throw new ApiError(422, `Kursda ko'pi bilan ${MENTOR_LIMITS.maxLessonsPerCourse} dars`);
  const id = uid();
  const pos = (c.lessonsCount ?? 0) + 1;
  await db.transaction(async (tx) => {
    await tx.insert(lessons).values({ id, courseId, position: pos, title: input.title, body: input.body, videoUrl: input.videoUrl ?? null, durationMin: input.durationMin, section: input.section ?? "", isPreview: input.isPreview, materials: input.materials, chapters: [...input.chapters].sort((a, b) => a.t - b.t), quiz: input.quiz ?? null, assignment: input.assignment });
    await tx.update(courses).set({ lessonsCount: sql`${courses.lessonsCount} + 1`, updatedAt: new Date() }).where(eq(courses.id, courseId));
  });
  return { id };
}

export async function updateLesson(userId: string, lessonId: string, input: LessonInput, isAdmin = false) {
  const l = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!l) throw new ApiError(404, "Dars topilmadi");
  await ownedCourse(userId, l.courseId, isAdmin);
  await db.update(lessons).set({ title: input.title, body: input.body, videoUrl: input.videoUrl ?? null, durationMin: input.durationMin, section: input.section ?? "", isPreview: input.isPreview, materials: input.materials, chapters: [...input.chapters].sort((a, b) => a.t - b.t), quiz: input.quiz ?? null, assignment: input.assignment }).where(eq(lessons.id, lessonId));
}

export async function deleteLesson(userId: string, lessonId: string, isAdmin = false) {
  const l = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!l) throw new ApiError(404, "Dars topilmadi");
  await ownedCourse(userId, l.courseId, isAdmin);
  await db.transaction(async (tx) => {
    await tx.delete(lessons).where(eq(lessons.id, lessonId));
    await tx.update(courses).set({ lessonsCount: sql`max(${courses.lessonsCount} - 1, 0)`, updatedAt: new Date() }).where(eq(courses.id, l.courseId));
  });
}

/* --------------------------- Talaba amallari --------------------------- */

export async function enroll(userId: string, courseId: string, isAdmin = false) {
  const c = await db.query.courses.findFirst({ where: eq(courses.id, courseId), columns: { id: true, isPublished: true, mentorId: true, priceFrom: true }, with: { mentor: { columns: { userId: true } } } });
  if (!c || !c.isPublished) throw new ApiError(404, "Kurs topilmadi");
  // Pulli kurs: faqat to'lov orqali (purchases.startPurchase); mentor va admin sinash uchun bepul
  if (c.priceFrom > 0 && !isAdmin && c.mentor.userId !== userId) throw new ApiError(402, "Bu kurs pulli — to'lov orqali yoziling");
  const existing = await db.query.enrollments.findFirst({ where: and(eq(enrollments.courseId, courseId), eq(enrollments.userId, userId)) });
  if (existing) return { already: true };
  await db.transaction(async (tx) => {
    await tx.insert(enrollments).values({ id: uid(), courseId, userId });
    await tx.update(courses).set({ studentsCount: sql`${courses.studentsCount} + 1` }).where(eq(courses.id, courseId));
    await tx.update(mentors).set({ studentsCount: sql`${mentors.studentsCount} + 1` }).where(eq(mentors.id, c.mentorId));
  });
  return { already: false };
}

export async function completeLesson(userId: string, lessonId: string, done: boolean) {
  const l = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!l) throw new ApiError(404, "Dars topilmadi");
  const enrollment = await db.query.enrollments.findFirst({ where: and(eq(enrollments.courseId, l.courseId), eq(enrollments.userId, userId)) });
  if (!enrollment) throw new ApiError(403, "Avval kursga yoziling");
  if (done && l.quiz?.questions.length && !(await quizPassed(userId, lessonId))) throw new ApiError(422, "Avval dars testidan o'ting");
  if (done) {
    await db.insert(lessonCompletions).values({ id: uid(), userId, lessonId, courseId: l.courseId }).onConflictDoNothing();
  } else {
    await db.delete(lessonCompletions).where(and(eq(lessonCompletions.userId, userId), eq(lessonCompletions.lessonId, lessonId)));
  }
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(lessons).where(eq(lessons.courseId, l.courseId));
  const [{ doneN }] = await db.select({ doneN: sql<number>`count(*)` }).from(lessonCompletions).where(and(eq(lessonCompletions.userId, userId), eq(lessonCompletions.courseId, l.courseId)));
  const pct = total > 0 ? Math.round((Number(doneN) / Number(total)) * 100) : 0;
  await db.update(enrollments).set({ progressPct: pct, lastLessonId: lessonId }).where(eq(enrollments.id, enrollment.id));
  const cert = done && pct >= 100 ? await maybeIssueCertificate(userId, l.courseId).catch(() => null) : null;
  // O'quv seriyasi (kun ketma-ketligi) — klient toast'da ko'rsatadi
  const streak = done ? await learningStreak(userId).then((x) => x.current).catch(() => 0) : 0;
  return { progressPct: pct, completed: done, certificateCode: cert?.code ?? null, certificateNew: cert?.isNew ?? false, streak };
}

export async function addCourseReview(userId: string, courseId: string, input: CourseReviewInput) {
  const enrollment = await db.query.enrollments.findFirst({ where: and(eq(enrollments.courseId, courseId), eq(enrollments.userId, userId)) });
  if (!enrollment) throw new ApiError(403, "Faqat yozilgan talaba sharh qoldiradi");
  const c = await db.query.courses.findFirst({ where: eq(courses.id, courseId), columns: { mentorId: true } });
  if (!c) throw new ApiError(404, "Kurs topilmadi");
  await db
    .insert(courseReviews)
    .values({ id: uid(), courseId, userId, rating: input.rating, body: input.body })
    .onConflictDoUpdate({ target: [courseReviews.courseId, courseReviews.userId], set: { rating: input.rating, body: input.body, createdAt: new Date() } });
  // Kurs reytingini qayta hisoblaymiz
  const [{ avg, n }] = await db.select({ avg: sql<number>`avg(${courseReviews.rating})`, n: sql<number>`count(*)` }).from(courseReviews).where(eq(courseReviews.courseId, courseId));
  await db.update(courses).set({ rating: Math.round((Number(avg) || 0) * 10) / 10, reviewsCount: Number(n) }).where(eq(courses.id, courseId));
  // Mentor reytingi — barcha kurslari o'rtachasi
  const [{ mAvg, mN }] = await db
    .select({ mAvg: sql<number>`avg(cr.rating)`, mN: sql<number>`count(*)` })
    .from(sql`course_reviews cr join courses c on c.id = cr.course_id`)
    .where(sql`c.mentor_id = ${c.mentorId}`);
  await db.update(mentors).set({ rating: Math.round((Number(mAvg) || 0) * 10) / 10, reviewsCount: Number(mN) }).where(eq(mentors.id, c.mentorId));
}

/** Kurs tahrirlagich uchun (egasi/admin): kurs maydonlari + barcha darslar */
/**
 * O'xshash kurslar (2026-10-29): avval shu yo'nalishdagi, keyin boshqa yo'nalishdagi
 * e'lon qilingan kurslar — reyting va o'quvchi soni bo'yicha. Kurs sahifasining
 * oxiridagi «boshqa nimani o'qish mumkin» savoliga javob (vakansiyalarda allaqachon bor edi).
 */
export async function similarCourses(courseId: string, category: string, limit = 3): Promise<CourseCard[]> {
  const same = await listCourses({ category, sort: "popular", limit: limit + 1 });
  const picked = same.items.filter((c) => c.id !== courseId).slice(0, limit);
  if (picked.length >= limit) return picked;
  // Yo'nalishda yetarli kurs yo'q — umumiy mashhurlardan to'ldiramiz (takrorlanmasin)
  const seen = new Set([courseId, ...picked.map((c) => c.id)]);
  const rest = await listCourses({ sort: "popular", limit: limit + picked.length + 2 });
  return [...picked, ...rest.items.filter((c) => !seen.has(c.id))].slice(0, limit);
}

export async function getCourseForOwner(userId: string, courseId: string, isAdmin = false) {
  const c = await db.query.courses.findFirst({ where: eq(courses.id, courseId), with: { mentor: { columns: { userId: true } } } });
  if (!c) return null;
  if (c.mentor.userId !== userId && !isAdmin) return null;
  const lessonRows = await db.query.lessons.findMany({ where: eq(lessons.courseId, courseId), orderBy: [asc(lessons.position)] });
  return {
    course: { id: c.id, slug: c.slug, title: c.title, summary: c.summary, coverUrl: c.coverUrl, category: c.category, level: c.level, priceFrom: c.priceFrom, isPublished: c.isPublished, lessonsCount: c.lessonsCount, studentsCount: c.studentsCount, outcomes: c.outcomes ?? [], requirements: c.requirements ?? [], audience: c.audience ?? "", language: c.language ?? "uz" },
    lessons: lessonRows.map((l) => ({ id: l.id, position: l.position, title: l.title, body: l.body, videoUrl: l.videoUrl, durationMin: l.durationMin, section: l.section ?? "", isPreview: l.isPreview, materials: l.materials ?? [], chapters: l.chapters ?? [], quiz: l.quiz ?? null, assignment: l.assignment })),
  };
}

/** Mentorning kurslari (kabinet) */
export async function listMentorCourses(userId: string) {
  const m = await getMentorForUser(userId);
  if (!m) return [];
  const rows = await db.query.courses.findMany({ where: eq(courses.mentorId, m.id), orderBy: [desc(courses.updatedAt)] });
  return rows.map((c) => ({ id: c.id, slug: c.slug, title: c.title, coverUrl: c.coverUrl, category: c.category, level: c.level, priceFrom: c.priceFrom, isPublished: c.isPublished, lessonsCount: c.lessonsCount, studentsCount: c.studentsCount, rating: c.rating, createdAt: c.createdAt.getTime() }));
}

/** Foydalanuvchi yozilgan kurslar (kabinet) */
export async function listMyEnrollments(userId: string) {
  const rows = await db.query.enrollments.findMany({
    where: eq(enrollments.userId, userId),
    orderBy: [desc(enrollments.createdAt)],
    with: { course: { with: { mentor: { columns: { userId: true, headline: true, slug: true }, with: { user: { columns: { name: true, avatarUrl: true } } } } } } },
  });
  return rows.map((e) => ({
    progressPct: e.progressPct,
    lastLessonId: e.lastLessonId,
    course: toCard(e.course as never),
  }));
}

/* --------------------------- Admin --------------------------- */

export async function listPendingMentors() {
  const rows = await db.query.mentors.findMany({ where: eq(mentors.isApproved, false), orderBy: [desc(mentors.appliedAt)], limit: 100, with: { user: { columns: { id: true, name: true, email: true, avatarUrl: true } } } });
  return rows.map((m) => ({ id: m.id, headline: m.headline, bio: m.bio, expertise: m.expertise, appliedAt: m.appliedAt?.getTime() ?? null, user: m.user }));
}

export async function setMentorApproved(mentorId: string, approved: boolean) {
  const m = await db.query.mentors.findFirst({ where: eq(mentors.id, mentorId) });
  if (!m) throw new ApiError(404, "Mentor topilmadi");
  if (approved) {
    await db.update(mentors).set({ isApproved: true, approvedAt: new Date() }).where(eq(mentors.id, mentorId));
    await ensureMentorReady(mentorId);
  }
  else await db.delete(mentors).where(eq(mentors.id, mentorId)); // rad etish — arizani o'chiradi
  return { userId: m.userId };
}

/* --------------------------- Mentor sahifasi = kanal --------------------------- */

/** Mentor sahifasini (slug) va kanalini (groups, kind=channel) tayyorlaydi — takroriy chaqirilsa zarar yo'q */
export async function ensureMentorReady(mentorId: string) {
  const m = await db.query.mentors.findFirst({ where: eq(mentors.id, mentorId), with: { user: { columns: { name: true } } } });
  if (!m) throw new ApiError(404, "Mentor topilmadi");
  let slug = m.slug;
  if (!slug) {
    const base = slugify(m.user.name) || "ustoz";
    slug = base;
    for (let i = 0; i < 5; i++) {
      const taken = await db.query.mentors.findFirst({ where: eq(mentors.slug, slug), columns: { id: true } });
      if (!taken) break;
      slug = `${base}-${uid().slice(0, 4)}`;
    }
    await db.update(mentors).set({ slug }).where(eq(mentors.id, mentorId));
  }
  let channelId = m.channelId;
  if (channelId && !(await db.query.groups.findFirst({ where: eq(groups.id, channelId), columns: { id: true } }))) channelId = null;
  if (!channelId) {
    const g = await createGroup(m.userId, { name: m.user.name.slice(0, 60), description: m.headline.slice(0, 500), category: null, region: null, coverUrl: m.coverUrl ?? "", isPrivate: false, kind: "channel" });
    channelId = g.id;
    await db.update(mentors).set({ channelId }).where(eq(mentors.id, mentorId));
  }
  return { slug, channelId };
}

export interface MentorProfile {
  id: string;
  userId: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
  isApproved: boolean;
  photoUrl: string | null;
  coverUrl: string | null;
  roleLabel: string | null;
  headline: string;
  bio: string;
  expertise: string[];
  highlights: Array<{ title: string; text: string }>;
  channelSlug: string | null;
  subPrice: number;
  refPercent: number;
  coursesCount: number;
  studentsCount: number;
  rating: number;
  reviewsCount: number;
}

async function toProfile(m: typeof mentors.$inferSelect & { user: { name: string; avatarUrl: string | null } }): Promise<MentorProfile> {
  const ch = m.channelId ? await db.query.groups.findFirst({ where: eq(groups.id, m.channelId), columns: { slug: true } }) : null;
  return {
    id: m.id,
    userId: m.userId,
    slug: m.slug,
    name: m.user.name,
    avatarUrl: m.user.avatarUrl,
    isApproved: m.isApproved,
    photoUrl: m.photoUrl,
    coverUrl: m.coverUrl,
    roleLabel: m.roleLabel,
    headline: m.headline,
    bio: m.bio,
    expertise: m.expertise,
    highlights: m.highlights ?? [],
    channelSlug: ch?.slug ?? null,
    subPrice: m.subPrice,
    refPercent: m.refPercent,
    coursesCount: m.coursesCount,
    studentsCount: m.studentsCount,
    rating: m.rating,
    reviewsCount: m.reviewsCount,
  };
}

/** Mentor profili id bo'yicha (kabinet/admin tahrirlagichi uchun) — egasi yoki admin */
export async function getMentorProfileForEditor(mentorId: string, viewer: { id: string; admin: boolean }): Promise<MentorProfile | null> {
  const m = await db.query.mentors.findFirst({ where: eq(mentors.id, mentorId), with: { user: { columns: { name: true, avatarUrl: true } } } });
  if (!m || (m.userId !== viewer.id && !viewer.admin)) return null;
  if (m.isApproved) await ensureMentorReady(m.id);
  const fresh = await db.query.mentors.findFirst({ where: eq(mentors.id, mentorId), with: { user: { columns: { name: true, avatarUrl: true } } } });
  return fresh ? toProfile(fresh) : null;
}

/** Ommaviy mentor sahifasi (slug bo'yicha) — faqat tasdiqlangan (egasi/admin tasdiqlanmaganini ham ko'radi) */
export async function getMentorPageBySlug(slug: string, viewer: { id: string; admin: boolean } | null) {
  const m = await db.query.mentors.findFirst({ where: eq(mentors.slug, slug), with: { user: { columns: { name: true, avatarUrl: true } } } });
  if (!m) return null;
  const can = m.isApproved || (viewer && (viewer.admin || viewer.id === m.userId));
  if (!can) return null;
  const [profile, courseRows] = await Promise.all([toProfile(m), db.query.courses.findMany({ where: and(eq(courses.mentorId, m.id), eq(courses.isPublished, true)), orderBy: [desc(courses.createdAt)] })]);
  return {
    profile,
    isOwner: Boolean(viewer && viewer.id === m.userId),
    courses: courseRows.map((c) => ({ id: c.id, slug: c.slug, title: c.title, summary: c.summary, coverUrl: c.coverUrl, category: c.category, level: c.level, priceFrom: c.priceFrom, lessonsCount: c.lessonsCount, studentsCount: c.studentsCount, rating: c.rating })),
  };
}

/** Mentor sahifasini yangilash (egasi yoki admin); kanal nomi/muqovasi/tavsifi sinxronlanadi */
export async function updateMentorProfile(mentorId: string, actor: { id: string; admin: boolean }, input: MentorProfileInput) {
  const m = await db.query.mentors.findFirst({ where: eq(mentors.id, mentorId), with: { user: { columns: { name: true } } } });
  if (!m) throw new ApiError(404, "Mentor topilmadi");
  if (m.userId !== actor.id && !actor.admin) throw new ApiError(403, "Bu sahifa sizniki emas");
  await db
    .update(mentors)
    .set({ roleLabel: input.roleLabel, headline: input.headline, bio: input.bio, expertise: input.expertise, photoUrl: input.photoUrl, coverUrl: input.coverUrl, highlights: input.highlights })
    .where(eq(mentors.id, mentorId));
  if (m.channelId) {
    const g = await db.query.groups.findFirst({ where: eq(groups.id, m.channelId) });
    if (g) await updateGroup(g, { description: input.headline.slice(0, 500), coverUrl: input.coverUrl ?? "" }).catch(() => undefined);
  }
}

/* --------------------------- Admin: mentorlarni boshqarish --------------------------- */

/** Foydalanuvchini to'g'ridan-to'g'ri mentor qiladi (ariza shart emas): tasdiqlangan holda, sahifa va kanal bilan */
export async function adminCreateMentor(userId: string) {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, name: true, isBanned: true } });
  if (!u) throw new ApiError(404, "Foydalanuvchi topilmadi");
  if (u.isBanned) throw new ApiError(422, "Bloklangan foydalanuvchini mentor qilib bo'lmaydi");
  const existing = await getMentorForUser(userId);
  let id: string;
  if (existing) {
    id = existing.id;
    if (!existing.isApproved) await db.update(mentors).set({ isApproved: true, approvedAt: new Date() }).where(eq(mentors.id, id));
  } else {
    id = uid();
    await db.insert(mentors).values({ id, userId, headline: "Mentor", bio: "", expertise: [], isApproved: true, approvedAt: new Date() });
  }
  await ensureMentorReady(id);
  return { id, created: !existing };
}

export async function adminListMentors() {
  const rows = await db.query.mentors.findMany({ orderBy: [desc(mentors.isApproved), desc(mentors.createdAt)], limit: 200, with: { user: { columns: { id: true, name: true, email: true, avatarUrl: true } } } });
  return rows.map((m) => ({ id: m.id, slug: m.slug, isApproved: m.isApproved, headline: m.headline, photoUrl: m.photoUrl, coursesCount: m.coursesCount, studentsCount: m.studentsCount, user: m.user }));
}

/** Mentorlikdan olib tashlash (kurslari va darslari o'chmaydi, faqat mentor yozuvi; kanal saqlanadi) */
export async function adminRemoveMentor(mentorId: string) {
  const m = await db.query.mentors.findFirst({ where: eq(mentors.id, mentorId), columns: { id: true } });
  if (!m) throw new ApiError(404, "Mentor topilmadi");
  await db.update(mentors).set({ isApproved: false }).where(eq(mentors.id, mentorId));
  await db.update(courses).set({ isPublished: false }).where(eq(courses.mentorId, mentorId));
}

/** Kabinet: mentorning kurslari ro'yxati — mentorId bo'yicha (admin uchun) */
export async function listCoursesOfMentor(mentorId: string) {
  const rows = await db.query.courses.findMany({ where: eq(courses.mentorId, mentorId), orderBy: [desc(courses.updatedAt)] });
  return rows.map((c) => ({ id: c.id, slug: c.slug, title: c.title, category: c.category, isPublished: c.isPublished, lessonsCount: c.lessonsCount, studentsCount: c.studentsCount }));
}

/** Sitemap uchun: tasdiqlangan mentorlar sahifalari */
export async function getSitemapMentors(): Promise<Array<{ slug: string; lastModified: Date }>> {
  const rows = await db.select({ slug: mentors.slug, at: mentors.approvedAt, created: mentors.createdAt }).from(mentors).where(and(eq(mentors.isApproved, true), sql`${mentors.slug} is not null`)).limit(2000);
  return rows.map((r) => ({ slug: r.slug as string, lastModified: r.at ?? r.created }));
}

/* --------------------------- Saqlangan kurslar (wishlist) --------------------------- */
/** Saqlash/olib tashlash (toggle). Chop etilmagan kursni faqat egasi/admin saqlay oladi */
export async function toggleCourseSave(courseId: string, userId: string, isAdmin = false): Promise<{ saved: boolean }> {
  const c = await db.query.courses.findFirst({ where: eq(courses.id, courseId), with: { mentor: { columns: { userId: true } } } });
  if (!c || (!c.isPublished && c.mentor.userId !== userId && !isAdmin)) throw new ApiError(404, "Kurs topilmadi");
  const existing = await db.query.courseSaves.findFirst({ where: and(eq(courseSaves.courseId, courseId), eq(courseSaves.userId, userId)) });
  if (existing) {
    await db.delete(courseSaves).where(eq(courseSaves.id, existing.id));
    return { saved: false };
  }
  await db.insert(courseSaves).values({ id: uid(), courseId, userId }).onConflictDoNothing();
  return { saved: true };
}

/** Foydalanuvchining saqlangan kurslari — yangi saqlangani birinchi, chop etilmagani ko'rinmaydi */
export async function listSavedCourses(userId: string, limit = 48): Promise<CourseCard[]> {
  const rows = await db.query.courseSaves.findMany({ where: eq(courseSaves.userId, userId), orderBy: [desc(courseSaves.createdAt)], limit });
  if (!rows.length) return [];
  const ids = rows.map((r) => r.courseId);
  const cs = await db.query.courses.findMany({
    where: and(inArray(courses.id, ids), eq(courses.isPublished, true)),
    with: { mentor: { columns: { userId: true, headline: true, slug: true }, with: { user: { columns: { name: true, avatarUrl: true } } } } },
    extras: { totalMin: sql<number>`(select coalesce(sum(l.duration_min), 0) from lessons l where l.course_id = "courses"."id")`.as("total_min") },
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return cs.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map((r) => toCard(r as never));
}

/* --------------------------- Bosh sahifa: «Davom etish» --------------------------- */
export interface ContinueLearning {
  courseTitle: string;
  courseSlug: string;
  coverUrl: string | null;
  mentorName: string;
  progressPct: number;
  lessonId: string;
  lessonTitle: string;
  lessonPosition: number;
  lessonsCount: number;
}

/**
 * Bosh sahifadagi «O'qishni davom ettirish» kartasi (Udemy/Coursera odati): tugallanmagan eng so'nggi kurs —
 * oxirgi ochilgan dars yoki birinchi bajarilmagan dars. Yozilmagan/hammasi tugagan bo'lsa null.
 */
export async function continueLearning(userId: string): Promise<ContinueLearning | null> {
  const rows = await db.query.enrollments.findMany({
    where: and(eq(enrollments.userId, userId), lt(enrollments.progressPct, 100)),
    orderBy: [desc(enrollments.createdAt)],
    limit: 5,
    with: { course: { columns: { id: true, title: true, slug: true, coverUrl: true, isPublished: true, lessonsCount: true }, with: { mentor: { columns: { id: true }, with: { user: { columns: { name: true } } } } } } },
  });
  // Oxirgi ochilgan darsi borini afzal ko'ramiz (haqiqatan o'qiyotgan)
  const e = rows.find((r) => r.lastLessonId && r.course.isPublished) ?? rows.find((r) => r.course.isPublished);
  if (!e) return null;
  const [lessonRows, done] = await Promise.all([
    db.query.lessons.findMany({ where: eq(lessons.courseId, e.course.id), orderBy: [asc(lessons.position)], columns: { id: true, title: true, position: true } }),
    db.query.lessonCompletions.findMany({ where: and(eq(lessonCompletions.userId, userId), eq(lessonCompletions.courseId, e.course.id)), columns: { lessonId: true } }),
  ]);
  if (!lessonRows.length) return null;
  const doneSet = new Set(done.map((d) => d.lessonId));
  // Oxirgi ochilgan dars bajarilgan bo'lsa — undan keyingi bajarilmagan dars
  const lastIdx = lessonRows.findIndex((l) => l.id === e.lastLessonId);
  const next = (lastIdx >= 0 && !doneSet.has(lessonRows[lastIdx].id) ? lessonRows[lastIdx] : null) ?? lessonRows.slice(Math.max(0, lastIdx)).find((l) => !doneSet.has(l.id)) ?? lessonRows.find((l) => !doneSet.has(l.id)) ?? lessonRows[0];
  return {
    courseTitle: e.course.title,
    courseSlug: e.course.slug,
    coverUrl: e.course.coverUrl,
    mentorName: e.course.mentor.user.name,
    progressPct: e.progressPct,
    lessonId: next.id,
    lessonTitle: next.title,
    lessonPosition: next.position,
    lessonsCount: lessonRows.length,
  };
}
