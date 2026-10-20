import "server-only";
import { and, asc, desc, eq, inArray, like, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseReviews, courses, enrollments, lessonCompletions, lessons, mentors, users } from "@/lib/db/schema";
import { uid, slugify, escapeLike } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import type { CourseInput, LessonInput, MentorApplyInput, CourseReviewInput } from "./validators";
import { MENTOR_LIMITS, type CourseLevel } from "./format";

export interface MentorLite {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
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
  mentor: { name: string; avatarUrl: string | null; headline: string; userId: string };
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

function mentorLite(row: { id: string; userId: string; headline: string; rating: number; coursesCount: number; studentsCount: number; user: { name: string; avatarUrl: string | null } }): MentorLite {
  return { id: row.id, userId: row.userId, name: row.user.name, avatarUrl: row.user.avatarUrl, headline: row.headline, rating: row.rating, coursesCount: row.coursesCount, studentsCount: row.studentsCount };
}

/** Tasdiqlangan mentorlar (katalog uchun) */
export async function listMentors(limit = 12): Promise<MentorLite[]> {
  const rows = await db.query.mentors.findMany({
    where: eq(mentors.isApproved, true),
    orderBy: [desc(mentors.studentsCount), desc(mentors.rating)],
    limit,
    with: { user: { columns: { name: true, avatarUrl: true } } },
  });
  return rows.map(mentorLite);
}

function toCard(c: typeof courses.$inferSelect & { mentor: { userId: string; user: { name: string; avatarUrl: string | null }; headline: string } }): CourseCard {
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
    mentor: { name: c.mentor.user.name, avatarUrl: c.mentor.user.avatarUrl, headline: c.mentor.headline, userId: c.mentor.userId },
  };
}

/** Ommaviy kurslar katalogi (chop etilgan) — filtr/qidiruv/sahifalash */
export async function listCourses(opts: { category?: string; level?: string; q?: string; cursor?: number | null; limit?: number } = {}): Promise<{ items: CourseCard[]; nextCursor: number | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 18, 1), 48);
  const conds = [eq(courses.isPublished, true)];
  if (opts.category) conds.push(eq(courses.category, opts.category));
  if (opts.level) conds.push(eq(courses.level, opts.level as CourseLevel));
  if (opts.q) {
    const term = `%${escapeLike(opts.q.toLowerCase())}%`;
    const m = or(sql`lower(${courses.title}) like ${term} escape '\\'`, sql`lower(${courses.summary}) like ${term} escape '\\'`);
    if (m) conds.push(m);
  }
  if (opts.cursor) conds.push(lt(courses.createdAt, new Date(opts.cursor)));
  const rows = await db.query.courses.findMany({
    where: and(...conds),
    orderBy: [desc(courses.createdAt)],
    limit: limit + 1,
    with: { mentor: { columns: { userId: true, headline: true }, with: { user: { columns: { name: true, avatarUrl: true } } } } },
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(toCard);
  return { items, nextCursor: hasMore ? items[items.length - 1].createdAt : null };
}

export interface CourseDetail extends CourseCard {
  mentorBio: string;
  isOwner: boolean;
  enrolled: boolean;
  progressPct: number;
  completedLessonIds: string[];
  lessons: Array<{ id: string; position: number; title: string; durationMin: number; isPreview: boolean; locked: boolean; completed: boolean }>;
  reviews: Array<{ id: string; rating: number; body: string; createdAt: number; name: string; avatarUrl: string | null }>;
  myReview: { rating: number; body: string } | null;
}

/** Kurs sahifasi (slug bo'yicha) — ko'ruvchiga moslab (yozilish, egalik, qulflangan darslar) */
export async function getCourseBySlug(slug: string, viewerId: string | null, isAdmin = false): Promise<CourseDetail | null> {
  const c = await db.query.courses.findFirst({
    where: eq(courses.slug, slug),
    with: { mentor: { columns: { userId: true, headline: true, bio: true }, with: { user: { columns: { name: true, avatarUrl: true } } } } },
  });
  if (!c) return null;
  const isOwner = Boolean(viewerId && c.mentor.userId === viewerId);
  if (!c.isPublished && !isOwner && !isAdmin) return null;

  const [lessonRows, enrollment, reviewRows] = await Promise.all([
    db.query.lessons.findMany({ where: eq(lessons.courseId, c.id), orderBy: [asc(lessons.position)] }),
    viewerId ? db.query.enrollments.findFirst({ where: and(eq(enrollments.courseId, c.id), eq(enrollments.userId, viewerId)) }) : Promise.resolve(undefined),
    db.query.courseReviews.findMany({ where: eq(courseReviews.courseId, c.id), orderBy: [desc(courseReviews.createdAt)], limit: 20 }),
  ]);
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
    mentorBio: c.mentor.bio,
    isOwner,
    enrolled,
    progressPct: enrollment?.progressPct ?? 0,
    completedLessonIds: [...completedSet],
    lessons: lessonRows.map((l) => ({ id: l.id, position: l.position, title: l.title, durationMin: l.durationMin, isPreview: l.isPreview, locked: !(access || l.isPreview), completed: completedSet.has(l.id) })),
    reviews: reviewRows.map((r) => ({ id: r.id, rating: r.rating, body: r.body, createdAt: r.createdAt.getTime(), name: rmap.get(r.userId)?.name ?? "Foydalanuvchi", avatarUrl: rmap.get(r.userId)?.avatarUrl ?? null })),
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

  const siblings = await db.query.lessons.findMany({ where: eq(lessons.courseId, c.id), orderBy: [asc(lessons.position)], columns: { id: true, title: true, position: true } });
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
  };
}

/* --------------------------- Mentor amallari --------------------------- */

async function requireApprovedMentor(userId: string) {
  const m = await getMentorForUser(userId);
  if (!m || !m.isApproved) throw new ApiError(403, "Avval mentor sifatida tasdiqlaning");
  return m;
}

export async function createCourse(userId: string, input: CourseInput) {
  const m = await requireApprovedMentor(userId);
  const id = uid();
  const slug = `${slugify(input.title) || "kurs"}-${id.slice(0, 6)}`;
  await db.transaction(async (tx) => {
    await tx.insert(courses).values({ id, mentorId: m.id, slug, title: input.title, summary: input.summary, coverUrl: input.coverUrl ?? null, category: input.category, level: input.level as CourseLevel, priceFrom: input.priceFrom });
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

export async function updateCourse(userId: string, courseId: string, input: CourseInput) {
  await ownedCourse(userId, courseId);
  await db.update(courses).set({ title: input.title, summary: input.summary, coverUrl: input.coverUrl ?? null, category: input.category, level: input.level as CourseLevel, priceFrom: input.priceFrom, updatedAt: new Date() }).where(eq(courses.id, courseId));
}

export async function setCoursePublished(userId: string, courseId: string, publish: boolean) {
  const c = await ownedCourse(userId, courseId);
  if (publish && c.lessonsCount < 1) throw new ApiError(422, "Kamida bitta dars qo'shing, keyin chop eting");
  await db.update(courses).set({ isPublished: publish, updatedAt: new Date() }).where(eq(courses.id, courseId));
}

export async function addLesson(userId: string, courseId: string, input: LessonInput) {
  const c = await ownedCourse(userId, courseId);
  if (c.lessonsCount >= MENTOR_LIMITS.maxLessonsPerCourse) throw new ApiError(422, `Kursda ko'pi bilan ${MENTOR_LIMITS.maxLessonsPerCourse} dars`);
  const id = uid();
  const pos = (c.lessonsCount ?? 0) + 1;
  await db.transaction(async (tx) => {
    await tx.insert(lessons).values({ id, courseId, position: pos, title: input.title, body: input.body, videoUrl: input.videoUrl ?? null, durationMin: input.durationMin, isPreview: input.isPreview });
    await tx.update(courses).set({ lessonsCount: sql`${courses.lessonsCount} + 1`, updatedAt: new Date() }).where(eq(courses.id, courseId));
  });
  return { id };
}

export async function updateLesson(userId: string, lessonId: string, input: LessonInput) {
  const l = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!l) throw new ApiError(404, "Dars topilmadi");
  await ownedCourse(userId, l.courseId);
  await db.update(lessons).set({ title: input.title, body: input.body, videoUrl: input.videoUrl ?? null, durationMin: input.durationMin, isPreview: input.isPreview }).where(eq(lessons.id, lessonId));
}

export async function deleteLesson(userId: string, lessonId: string) {
  const l = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!l) throw new ApiError(404, "Dars topilmadi");
  await ownedCourse(userId, l.courseId);
  await db.transaction(async (tx) => {
    await tx.delete(lessons).where(eq(lessons.id, lessonId));
    await tx.update(courses).set({ lessonsCount: sql`max(${courses.lessonsCount} - 1, 0)`, updatedAt: new Date() }).where(eq(courses.id, l.courseId));
  });
}

/* --------------------------- Talaba amallari --------------------------- */

export async function enroll(userId: string, courseId: string) {
  const c = await db.query.courses.findFirst({ where: eq(courses.id, courseId), columns: { id: true, isPublished: true, mentorId: true } });
  if (!c || !c.isPublished) throw new ApiError(404, "Kurs topilmadi");
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
  if (done) {
    await db.insert(lessonCompletions).values({ id: uid(), userId, lessonId, courseId: l.courseId }).onConflictDoNothing();
  } else {
    await db.delete(lessonCompletions).where(and(eq(lessonCompletions.userId, userId), eq(lessonCompletions.lessonId, lessonId)));
  }
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(lessons).where(eq(lessons.courseId, l.courseId));
  const [{ doneN }] = await db.select({ doneN: sql<number>`count(*)` }).from(lessonCompletions).where(and(eq(lessonCompletions.userId, userId), eq(lessonCompletions.courseId, l.courseId)));
  const pct = total > 0 ? Math.round((Number(doneN) / Number(total)) * 100) : 0;
  await db.update(enrollments).set({ progressPct: pct, lastLessonId: lessonId }).where(eq(enrollments.id, enrollment.id));
  return { progressPct: pct, completed: done };
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
export async function getCourseForOwner(userId: string, courseId: string, isAdmin = false) {
  const c = await db.query.courses.findFirst({ where: eq(courses.id, courseId), with: { mentor: { columns: { userId: true } } } });
  if (!c) return null;
  if (c.mentor.userId !== userId && !isAdmin) return null;
  const lessonRows = await db.query.lessons.findMany({ where: eq(lessons.courseId, courseId), orderBy: [asc(lessons.position)] });
  return {
    course: { id: c.id, slug: c.slug, title: c.title, summary: c.summary, coverUrl: c.coverUrl, category: c.category, level: c.level, priceFrom: c.priceFrom, isPublished: c.isPublished, lessonsCount: c.lessonsCount, studentsCount: c.studentsCount },
    lessons: lessonRows.map((l) => ({ id: l.id, position: l.position, title: l.title, body: l.body, videoUrl: l.videoUrl, durationMin: l.durationMin, isPreview: l.isPreview })),
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
    with: { course: { with: { mentor: { columns: { userId: true, headline: true }, with: { user: { columns: { name: true, avatarUrl: true } } } } } } },
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
  if (approved) await db.update(mentors).set({ isApproved: true, approvedAt: new Date() }).where(eq(mentors.id, mentorId));
  else await db.delete(mentors).where(eq(mentors.id, mentorId)); // rad etish — arizani o'chiradi
  return { userId: m.userId };
}
