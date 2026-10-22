import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assignmentSubmissions, certificates, courses, enrollments, lessonCompletions, lessonComments, lessons, mentors, quizAttempts, roadmaps, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { uid } from "@/lib/utils";

/** Dars testi: talabaga to'g'ri javoblarsiz */
export type QuizPublic = { passPct: number; questions: Array<{ q: string; options: string[] }> };

async function lessonWithAccess(lessonId: string, userId: string, admin: boolean) {
  const l = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!l) throw new ApiError(404, "Dars topilmadi");
  const c = await db.query.courses.findFirst({ where: eq(courses.id, l.courseId), with: { mentor: { columns: { id: true, userId: true } } } });
  if (!c) throw new ApiError(404, "Kurs topilmadi");
  const isOwner = c.mentor.userId === userId;
  const enrolled = Boolean(await db.query.enrollments.findFirst({ where: and(eq(enrollments.courseId, c.id), eq(enrollments.userId, userId)), columns: { id: true } }));
  return { l, c, isOwner, enrolled, access: isOwner || admin || enrolled };
}

/* ------------------------------ Test ------------------------------ */
export function publicQuiz(q: NonNullable<(typeof lessons.$inferSelect)["quiz"]> | null | undefined): QuizPublic | null {
  if (!q || !q.questions?.length) return null;
  return { passPct: q.passPct, questions: q.questions.map((x) => ({ q: x.q, options: x.options })) };
}

export async function quizPassed(userId: string, lessonId: string): Promise<boolean> {
  const a = await db.query.quizAttempts.findFirst({ where: and(eq(quizAttempts.userId, userId), eq(quizAttempts.lessonId, lessonId), eq(quizAttempts.passed, true)), columns: { id: true } });
  return Boolean(a);
}

/** Testni topshirish: foiz hisoblanadi; to'g'ri javoblar faqat o'tgandan keyin ko'rsatiladi */
export async function submitQuiz(userId: string, lessonId: string, answers: number[], admin = false) {
  const { l, access } = await lessonWithAccess(lessonId, userId, admin);
  if (!access) throw new ApiError(403, "Avval kursga yoziling");
  const quiz = l.quiz;
  if (!quiz?.questions.length) throw new ApiError(404, "Bu darsda test yo'q");
  if (answers.length !== quiz.questions.length) throw new ApiError(422, "Barcha savollarga javob bering");
  const right = quiz.questions.map((q, i) => answers[i] === q.correct);
  const scorePct = Math.round((right.filter(Boolean).length / quiz.questions.length) * 100);
  const passed = scorePct >= quiz.passPct;
  await db.insert(quizAttempts).values({ id: uid(), userId, lessonId, scorePct, passed });
  return { scorePct, passed, passPct: quiz.passPct, correct: passed ? quiz.questions.map((q) => q.correct) : null, wrong: passed ? [] : right.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0) };
}

/* --------------------------- Sertifikat --------------------------- */
const certCode = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();

/** Kurs to'liq tugagan bo'lsa (barcha darslar + testlar) sertifikat beradi; yangi bo'lsa kodni qaytaradi */
export async function maybeIssueCertificate(userId: string, courseId: string): Promise<{ code: string; isNew: boolean } | null> {
  const lessonRows = await db.query.lessons.findMany({ where: eq(lessons.courseId, courseId), columns: { id: true, quiz: true } });
  if (!lessonRows.length) return null;
  const done = await db.query.lessonCompletions.findMany({ where: and(eq(lessonCompletions.userId, userId), eq(lessonCompletions.courseId, courseId)), columns: { lessonId: true } });
  const doneSet = new Set(done.map((d) => d.lessonId));
  if (!lessonRows.every((l) => doneSet.has(l.id))) return null;
  for (const l of lessonRows) if (l.quiz?.questions.length && !(await quizPassed(userId, l.id))) return null;
  const existing = await db.query.certificates.findFirst({ where: and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)) });
  if (existing) return { code: existing.code, isNew: false };
  const code = certCode();
  await db.insert(certificates).values({ id: uid(), code, userId, courseId }).onConflictDoNothing();
  const c = await db.query.courses.findFirst({ where: eq(courses.id, courseId), columns: { title: true } });
  await notify(userId, "subscription_paid", "Tabriklaymiz! Sertifikat tayyor 🎓", `«${c?.title ?? "Kurs"}» kursi tugatildi — sertifikatni yuklab oling.`, `/sertifikat/${code}`, { skipMail: true }).catch(() => undefined);
  return { code, isNew: true };
}

export async function getCertificate(code: string) {
  const c = await db.query.certificates.findFirst({ where: eq(certificates.code, code.toUpperCase()) });
  if (!c) return null;
  const [u, course] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, c.userId), columns: { name: true } }),
    db.query.courses.findFirst({ where: eq(courses.id, c.courseId), columns: { title: true, slug: true, lessonsCount: true }, with: { mentor: { columns: { slug: true }, with: { user: { columns: { name: true } } } } } }),
  ]);
  if (!u || !course) return null;
  return { code: c.code, issuedAt: c.issuedAt.getTime(), student: u.name, course: course.title, courseSlug: course.slug, lessons: course.lessonsCount, mentor: course.mentor.user.name, mentorSlug: course.mentor.slug };
}

export async function myCertificateCode(userId: string, courseId: string): Promise<string | null> {
  const c = await db.query.certificates.findFirst({ where: and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)), columns: { code: true } });
  return c?.code ?? null;
}

/* --------------------------- Uy vazifasi --------------------------- */
export async function mySubmission(userId: string, lessonId: string) {
  return (await db.query.assignmentSubmissions.findFirst({ where: and(eq(assignmentSubmissions.userId, userId), eq(assignmentSubmissions.lessonId, lessonId)) })) ?? null;
}

export async function submitAssignment(userId: string, lessonId: string, input: { body: string; fileUrl?: string | null }, admin = false) {
  const { l, c, enrolled, isOwner } = await lessonWithAccess(lessonId, userId, admin);
  if (!enrolled && !admin) throw new ApiError(403, isOwner ? "O'z darsingizga vazifa topshirib bo'lmaydi" : "Avval kursga yoziling");
  if (!l.assignment) throw new ApiError(404, "Bu darsda vazifa yo'q");
  if (!input.body.trim() && !input.fileUrl) throw new ApiError(422, "Matn yoki fayl qo'shing", { body: "Bo'sh" });
  const existing = await mySubmission(userId, lessonId);
  if (existing?.status === "reviewed") throw new ApiError(409, "Vazifa baholangan — qayta topshirib bo'lmaydi");
  if (existing) {
    await db.update(assignmentSubmissions).set({ body: input.body, fileUrl: input.fileUrl ?? null, status: "pending", createdAt: new Date() }).where(eq(assignmentSubmissions.id, existing.id));
  } else {
    await db.insert(assignmentSubmissions).values({ id: uid(), lessonId, courseId: c.id, userId, body: input.body, fileUrl: input.fileUrl ?? null });
  }
  await notify(c.mentor.userId, "subscription_paid", "Yangi uy vazifasi", `«${l.title}» darsi bo'yicha talaba ish topshirdi.`, "/kabinet/mentorlik/vazifalar", { skipMail: true }).catch(() => undefined);
}

async function mentorOf(userId: string, admin: boolean) {
  const m = await db.query.mentors.findFirst({ where: eq(mentors.userId, userId) });
  if (!m && !admin) throw new ApiError(403, "Faqat ustoz uchun");
  return m ?? null;
}

/** Mentorning baholanmagan (yoki barcha) vazifalari */
export async function listSubmissionsForMentor(userId: string, admin: boolean, status: "pending" | "all" = "pending") {
  const m = await mentorOf(userId, admin);
  const courseRows = m ? await db.query.courses.findMany({ where: eq(courses.mentorId, m.id), columns: { id: true, title: true } }) : await db.query.courses.findMany({ columns: { id: true, title: true } });
  if (!courseRows.length) return [];
  const rows = await db.query.assignmentSubmissions.findMany({ where: and(inArray(assignmentSubmissions.courseId, courseRows.map((c) => c.id)), status === "pending" ? eq(assignmentSubmissions.status, "pending") : undefined), orderBy: [desc(assignmentSubmissions.createdAt)], limit: 100 });
  const [us, ls] = await Promise.all([
    rows.length ? db.query.users.findMany({ where: inArray(users.id, rows.map((r) => r.userId)), columns: { id: true, name: true } }) : [],
    rows.length ? db.query.lessons.findMany({ where: inArray(lessons.id, rows.map((r) => r.lessonId)), columns: { id: true, title: true, assignment: true } }) : [],
  ]);
  const um = new Map(us.map((u) => [u.id, u.name]));
  const lm = new Map(ls.map((l) => [l.id, l]));
  const cm = new Map(courseRows.map((c) => [c.id, c.title]));
  return rows.map((r) => ({ id: r.id, student: um.get(r.userId) ?? "Talaba", course: cm.get(r.courseId) ?? "", lesson: lm.get(r.lessonId)?.title ?? "", prompt: lm.get(r.lessonId)?.assignment ?? "", body: r.body, fileUrl: r.fileUrl, status: r.status, grade: r.grade, feedback: r.feedback, showcase: r.showcase, createdAt: r.createdAt.getTime() }));
}

export async function reviewSubmission(userId: string, admin: boolean, id: string, input: { status: "reviewed" | "needs_work"; grade?: number | null; feedback: string; showcase: boolean }) {
  const s = await db.query.assignmentSubmissions.findFirst({ where: eq(assignmentSubmissions.id, id) });
  if (!s) throw new ApiError(404, "Topshiriq topilmadi");
  const c = await db.query.courses.findFirst({ where: eq(courses.id, s.courseId), with: { mentor: { columns: { userId: true } } } });
  if (!c || (c.mentor.userId !== userId && !admin)) throw new ApiError(403, "Bu kurs sizniki emas");
  await db.update(assignmentSubmissions).set({ status: input.status, grade: input.grade ?? null, feedback: input.feedback, showcase: input.status === "reviewed" && input.showcase, reviewedAt: new Date() }).where(eq(assignmentSubmissions.id, id));
  await notify(s.userId, "subscription_paid", input.status === "reviewed" ? "Vazifangiz baholandi" : "Vazifani qayta ko'rib chiqing", input.feedback.slice(0, 140) || (input.grade != null ? `Baho: ${input.grade}/100` : ""), `/mentorlik/dars/${s.lessonId}`, { skipMail: true }).catch(() => undefined);
}

/** «Talabalar ishi»: mentor ommaga ruxsat bergan vazifalar */
export async function listShowcase(mentorId: string, limit = 12) {
  const cs = await db.query.courses.findMany({ where: eq(courses.mentorId, mentorId), columns: { id: true } });
  if (!cs.length) return [];
  const rows = await db.query.assignmentSubmissions.findMany({ where: and(inArray(assignmentSubmissions.courseId, cs.map((c) => c.id)), eq(assignmentSubmissions.showcase, true)), orderBy: [desc(assignmentSubmissions.reviewedAt)], limit });
  if (!rows.length) return [];
  const us = await db.query.users.findMany({ where: inArray(users.id, rows.map((r) => r.userId)), columns: { id: true, name: true, avatarUrl: true } });
  const um = new Map(us.map((u) => [u.id, u]));
  return rows.map((r) => ({ id: r.id, student: um.get(r.userId)?.name ?? "Talaba", avatarUrl: um.get(r.userId)?.avatarUrl ?? null, body: r.body, fileUrl: r.fileUrl, grade: r.grade }));
}

/* ----------------------- Savol-javob (izohlar) ----------------------- */
export type LessonCommentView = { id: string; parentId: string | null; body: string; createdAt: number; helpful: boolean; name: string; avatarUrl: string | null; isMentor: boolean; mine: boolean };

export async function listLessonComments(lessonId: string, viewerId: string, admin: boolean): Promise<LessonCommentView[]> {
  const { access, c } = await lessonWithAccess(lessonId, viewerId, admin);
  if (!access) throw new ApiError(403, "Savollar faqat kursga yozilganlar uchun");
  const rows = await db.query.lessonComments.findMany({ where: eq(lessonComments.lessonId, lessonId), orderBy: [asc(lessonComments.createdAt)], limit: 200 });
  const us = rows.length ? await db.query.users.findMany({ where: inArray(users.id, [...new Set(rows.map((r) => r.userId))]), columns: { id: true, name: true, avatarUrl: true } }) : [];
  const um = new Map(us.map((u) => [u.id, u]));
  return rows.map((r) => ({ id: r.id, parentId: r.parentId, body: r.body, createdAt: r.createdAt.getTime(), helpful: r.isHelpful, name: um.get(r.userId)?.name ?? "Foydalanuvchi", avatarUrl: um.get(r.userId)?.avatarUrl ?? null, isMentor: r.userId === c.mentor.userId, mine: r.userId === viewerId }));
}

export async function addLessonComment(lessonId: string, userId: string, admin: boolean, input: { body: string; parentId?: string | null }) {
  const { l, c, access } = await lessonWithAccess(lessonId, userId, admin);
  if (!access) throw new ApiError(403, "Savol berish uchun kursga yoziling");
  let parent: typeof lessonComments.$inferSelect | undefined;
  if (input.parentId) {
    parent = await db.query.lessonComments.findFirst({ where: and(eq(lessonComments.id, input.parentId), eq(lessonComments.lessonId, lessonId)) });
    if (!parent || parent.parentId) throw new ApiError(404, "Savol topilmadi");
  }
  const id = uid();
  await db.insert(lessonComments).values({ id, lessonId, userId, parentId: parent?.id ?? null, body: input.body });
  const href = `/mentorlik/dars/${lessonId}#izoh-${id}`;
  if (parent) {
    if (parent.userId !== userId) await notify(parent.userId, "post_comment", c.mentor.userId === userId ? "Ustoz savolingizga javob berdi" : "Savolingizga javob yozildi", input.body.slice(0, 140), href, { skipMail: true }).catch(() => undefined);
  } else if (c.mentor.userId !== userId) {
    await notify(c.mentor.userId, "post_comment", `Yangi savol: ${l.title}`, input.body.slice(0, 140), href, { skipMail: true }).catch(() => undefined);
  }
  return { id };
}

export async function setCommentHelpful(commentId: string, userId: string, admin: boolean, value: boolean) {
  const cm = await db.query.lessonComments.findFirst({ where: eq(lessonComments.id, commentId) });
  if (!cm) throw new ApiError(404, "Izoh topilmadi");
  const { isOwner } = await lessonWithAccess(cm.lessonId, userId, admin);
  if (!isOwner && !admin) throw new ApiError(403, "Faqat ustoz belgilaydi");
  await db.update(lessonComments).set({ isHelpful: value }).where(eq(lessonComments.id, commentId));
}

export async function deleteLessonComment(commentId: string, userId: string, admin: boolean) {
  const cm = await db.query.lessonComments.findFirst({ where: eq(lessonComments.id, commentId) });
  if (!cm) throw new ApiError(404, "Izoh topilmadi");
  const { isOwner } = await lessonWithAccess(cm.lessonId, userId, admin);
  if (cm.userId !== userId && !isOwner && !admin) throw new ApiError(403, "Ruxsat yo'q");
  await db.delete(lessonComments).where(sql`${lessonComments.id} = ${commentId} or ${lessonComments.parentId} = ${commentId}`);
}

/* --------------------------- Yo'l xaritalari --------------------------- */
export async function listRoadmaps(mentorId: string, viewerId: string | null) {
  const rms = await db.query.roadmaps.findMany({ where: eq(roadmaps.mentorId, mentorId), orderBy: [asc(roadmaps.createdAt)] });
  if (!rms.length) return [];
  const ids = [...new Set(rms.flatMap((r) => r.courseIds))];
  const cs = ids.length ? await db.query.courses.findMany({ where: and(inArray(courses.id, ids), eq(courses.isPublished, true)), columns: { id: true, slug: true, title: true, priceFrom: true, lessonsCount: true } }) : [];
  const cm = new Map(cs.map((c) => [c.id, c]));
  const prog = new Map<string, number>();
  if (viewerId && ids.length) {
    const en = await db.query.enrollments.findMany({ where: and(eq(enrollments.userId, viewerId), inArray(enrollments.courseId, ids)), columns: { courseId: true, progressPct: true } });
    for (const e of en) prog.set(e.courseId, e.progressPct);
  }
  return rms.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    steps: r.courseIds.map((id) => cm.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => ({ id: c.id, slug: c.slug, title: c.title, priceFrom: c.priceFrom, lessonsCount: c.lessonsCount, progressPct: prog.get(c.id) ?? null })),
  }));
}

async function ownMentor(userId: string, admin: boolean, mentorIdFor?: string) {
  const m = await db.query.mentors.findFirst({ where: mentorIdFor && admin ? eq(mentors.id, mentorIdFor) : eq(mentors.userId, userId) });
  if (!m || !m.isApproved) throw new ApiError(403, "Avval mentor sifatida tasdiqlaning");
  return m;
}

export async function saveRoadmap(userId: string, admin: boolean, input: { id?: string; title: string; description: string; courseIds: string[] }) {
  const m = await ownMentor(userId, admin);
  const own = await db.query.courses.findMany({ where: and(eq(courses.mentorId, m.id), inArray(courses.id, input.courseIds)), columns: { id: true } });
  const ownSet = new Set(own.map((c) => c.id));
  const ids = [...new Set(input.courseIds)].filter((id) => ownSet.has(id));
  if (!ids.length) throw new ApiError(422, "O'zingizning kamida bitta kursingizni tanlang", { courseIds: "Kurs tanlang" });
  if (input.id) {
    const r = await db.update(roadmaps).set({ title: input.title, description: input.description, courseIds: ids }).where(and(eq(roadmaps.id, input.id), eq(roadmaps.mentorId, m.id))).returning({ id: roadmaps.id });
    if (!r.length) throw new ApiError(404, "Yo'l xaritasi topilmadi");
    return { id: input.id };
  }
  const n = await db.query.roadmaps.findMany({ where: eq(roadmaps.mentorId, m.id), columns: { id: true } });
  if (n.length >= 6) throw new ApiError(422, "Ko'pi bilan 6 ta yo'l xaritasi");
  const id = uid();
  await db.insert(roadmaps).values({ id, mentorId: m.id, title: input.title, description: input.description, courseIds: ids });
  return { id };
}

export async function deleteRoadmap(userId: string, admin: boolean, id: string) {
  const m = await ownMentor(userId, admin);
  await db.delete(roadmaps).where(and(eq(roadmaps.id, id), eq(roadmaps.mentorId, m.id)));
}
