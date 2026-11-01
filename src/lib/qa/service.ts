import "server-only";
import { and, desc, eq, isNull, like, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { answerVotes, questionAnswers, questions, specialists, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { CATEGORY_GROUPS, type CategoryGroupSlug } from "@/lib/categories";
import { notify } from "@/lib/notifications";
import { assertNotSpam } from "@/lib/security/spam-filter";
import { uid } from "@/lib/utils";

/**
 * Savol-javob / Maslahat (2026-11-01, KEYINGI-REJA 4): hamjamiyat bir-biriga maslahat beradi.
 * Qoidalar: savol — har kirgan foydalanuvchi; javob — har kirgan foydalanuvchi, bir savolga 1 ta;
 * foydali belgisi (upvote) — toggle, o'z javobiga bo'lmaydi; «Eng foydali» (qabul) — faqat savol
 * egasi, bitta (almashtirsa eski yechiladi); o'z savoliga javob yozib bo'lmaydi. Tartib:
 * qabul qilingan javob yuqorida, qolganlari foydali soni bo'yicha.
 */

export const QUESTION_TITLE_MIN = 10;
export const QUESTION_TITLE_MAX = 150;
export const QUESTION_BODY_MAX = 4000;
export const ANSWER_MIN = 10;
export const ANSWER_MAX = 4000;

const GROUP_SLUGS = CATEGORY_GROUPS.map((g) => g.slug) as string[];

export interface QaAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Mutaxassis bo'lsa — kasbi va ommaviy sahifa slug'i */
  title: string | null;
  slug: string | null;
  isMentorish: boolean;
}

export interface QuestionCard {
  id: string;
  title: string;
  category: string | null;
  categoryName: string | null;
  answersCount: number;
  viewsCount: number;
  answered: boolean;
  createdAt: number;
  author: QaAuthor;
}

export interface AnswerView {
  id: string;
  body: string;
  upvotesCount: number;
  isAccepted: boolean;
  votedByMe: boolean;
  mine: boolean;
  createdAt: number;
  author: QaAuthor;
}

export interface QuestionDetail extends QuestionCard {
  body: string;
  mine: boolean;
  answers: AnswerView[];
  myAnswerId: string | null;
}

const groupName = (slug: string | null) => CATEGORY_GROUPS.find((g) => g.slug === slug)?.name ?? null;

const authorSelect = {
  uId: users.id,
  uName: users.name,
  uAvatar: users.avatarUrl,
  spTitle: specialists.title,
  spSlug: specialists.slug,
} as const;

function toAuthor(r: { uId: string; uName: string; uAvatar: string | null; spTitle: string | null; spSlug: string | null }): QaAuthor {
  return { id: r.uId, name: r.uName, avatarUrl: r.uAvatar, title: r.spTitle, slug: r.spSlug, isMentorish: Boolean(r.spTitle) };
}

export interface QuestionFilter {
  tab?: "all" | "open" | "answered";
  category?: string;
  q?: string;
  /** createdAt ms kursori (shu vaqtdan eskilari) */
  cursor?: number;
  limit?: number;
}

export async function listQuestions(f: QuestionFilter = {}): Promise<{ items: QuestionCard[]; nextCursor: number | null }> {
  const limit = Math.min(Math.max(f.limit ?? 20, 1), 50);
  const where = and(
    f.tab === "open" ? isNull(questions.acceptedAnswerId) : undefined,
    f.tab === "answered" ? sql`${questions.acceptedAnswerId} IS NOT NULL` : undefined,
    f.category && GROUP_SLUGS.includes(f.category) ? eq(questions.category, f.category) : undefined,
    f.q ? or(like(questions.title, `%${f.q}%`), like(questions.body, `%${f.q}%`)) : undefined,
    f.cursor ? lt(questions.createdAt, new Date(f.cursor)) : undefined,
  );
  const rows = await db
    .select({
      id: questions.id,
      title: questions.title,
      category: questions.category,
      acceptedAnswerId: questions.acceptedAnswerId,
      answersCount: questions.answersCount,
      viewsCount: questions.viewsCount,
      createdAt: questions.createdAt,
      ...authorSelect,
    })
    .from(questions)
    .innerJoin(users, eq(users.id, questions.userId))
    .leftJoin(specialists, eq(specialists.userId, questions.userId))
    .where(where)
    .orderBy(desc(questions.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      categoryName: groupName(r.category),
      answersCount: r.answersCount,
      viewsCount: r.viewsCount,
      answered: r.acceptedAnswerId !== null,
      createdAt: r.createdAt.getTime(),
      author: toAuthor(r),
    })),
    nextCursor: rows.length > limit ? page[page.length - 1].createdAt.getTime() : null,
  };
}

export async function getQuestion(id: string, viewerId: string | null, opts: { countView?: boolean } = {}): Promise<QuestionDetail | null> {
  const [q] = await db
    .select({
      id: questions.id,
      userId: questions.userId,
      title: questions.title,
      body: questions.body,
      category: questions.category,
      acceptedAnswerId: questions.acceptedAnswerId,
      answersCount: questions.answersCount,
      viewsCount: questions.viewsCount,
      createdAt: questions.createdAt,
      ...authorSelect,
    })
    .from(questions)
    .innerJoin(users, eq(users.id, questions.userId))
    .leftJoin(specialists, eq(specialists.userId, questions.userId))
    .where(eq(questions.id, id))
    .limit(1);
  if (!q) return null;
  // Ko'rish hisobi — egasidan boshqa odam sahifani ochganda (taxminiy, noyoblik talab qilinmaydi)
  if (opts.countView && viewerId !== q.userId) {
    await db.update(questions).set({ viewsCount: sql`${questions.viewsCount} + 1` }).where(eq(questions.id, id)).catch(() => undefined);
  }
  const rows = await db
    .select({
      id: questionAnswers.id,
      userId: questionAnswers.userId,
      body: questionAnswers.body,
      upvotesCount: questionAnswers.upvotesCount,
      createdAt: questionAnswers.createdAt,
      ...authorSelect,
    })
    .from(questionAnswers)
    .innerJoin(users, eq(users.id, questionAnswers.userId))
    .leftJoin(specialists, eq(specialists.userId, questionAnswers.userId))
    .where(eq(questionAnswers.questionId, id))
    .orderBy(desc(questionAnswers.upvotesCount), questionAnswers.createdAt);
  const myVotes = viewerId
    ? new Set(
        (
          await db
            .select({ answerId: answerVotes.answerId })
            .from(answerVotes)
            .innerJoin(questionAnswers, eq(questionAnswers.id, answerVotes.answerId))
            .where(and(eq(answerVotes.userId, viewerId), eq(questionAnswers.questionId, id)))
        ).map((v) => v.answerId),
      )
    : new Set<string>();
  const answers: AnswerView[] = rows
    .map((r) => ({
      id: r.id,
      body: r.body,
      upvotesCount: r.upvotesCount,
      isAccepted: q.acceptedAnswerId === r.id,
      votedByMe: myVotes.has(r.id),
      mine: viewerId === r.userId,
      createdAt: r.createdAt.getTime(),
      author: toAuthor(r),
    }))
    // Qabul qilingan javob doim yuqorida
    .sort((a, b) => Number(b.isAccepted) - Number(a.isAccepted));
  return {
    id: q.id,
    title: q.title,
    body: q.body,
    category: q.category,
    categoryName: groupName(q.category),
    answersCount: q.answersCount,
    viewsCount: q.viewsCount + (opts.countView && viewerId !== q.userId ? 1 : 0),
    answered: q.acceptedAnswerId !== null,
    createdAt: q.createdAt.getTime(),
    author: toAuthor(q),
    mine: viewerId === q.userId,
    answers,
    myAnswerId: answers.find((a) => a.mine)?.id ?? null,
  };
}

export async function askQuestion(userId: string, input: { title: string; body?: string; category?: string | null }): Promise<{ id: string }> {
  const title = input.title.trim();
  const body = (input.body ?? "").trim();
  if (title.length < QUESTION_TITLE_MIN) throw new ApiError(422, `Savol kamida ${QUESTION_TITLE_MIN} ta belgi bo'lsin`, { title: "Qisqa" });
  await assertNotSpam(`${title}\n${body}`, "title");
  const category = input.category && GROUP_SLUGS.includes(input.category) ? (input.category as CategoryGroupSlug) : null;
  const id = uid();
  await db.insert(questions).values({ id, userId, title: title.slice(0, QUESTION_TITLE_MAX), body: body.slice(0, QUESTION_BODY_MAX), category });
  return { id };
}

export async function answerQuestion(userId: string, questionId: string, bodyRaw: string): Promise<{ id: string }> {
  const body = bodyRaw.trim();
  if (body.length < ANSWER_MIN) throw new ApiError(422, `Javob kamida ${ANSWER_MIN} ta belgi bo'lsin`, { body: "Qisqa" });
  await assertNotSpam(body);
  const q = await db.query.questions.findFirst({ where: eq(questions.id, questionId), columns: { id: true, userId: true, title: true } });
  if (!q) throw new ApiError(404, "Savol topilmadi");
  if (q.userId === userId) throw new ApiError(422, "O'z savolingizga javob yozib bo'lmaydi — savolni tahrirlang");
  const id = uid();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(questionAnswers).values({ id, questionId, userId, body: body.slice(0, ANSWER_MAX) });
      await tx.update(questions).set({ answersCount: sql`${questions.answersCount} + 1` }).where(eq(questions.id, questionId));
    });
  } catch (e) {
    let msg = "";
    for (let cur: unknown = e; cur instanceof Error; cur = cur.cause) msg += cur.message + "\n";
    if (msg.includes("question_answers")) throw new ApiError(409, "Siz bu savolga allaqachon javob yozgansiz");
    throw e;
  }
  await notify(q.userId, "post_comment", "Savolingizga javob yozildi", `«${q.title.slice(0, 80)}» savolingizga yangi javob keldi.`, `/savollar/${questionId}`).catch(() => undefined);
  return { id };
}

/** Foydali belgisi (upvote): toggle. O'z javobiga bo'lmaydi. Natija — hozirgi holat */
export async function voteAnswer(userId: string, answerId: string): Promise<{ voted: boolean; upvotesCount: number }> {
  const a = await db.query.questionAnswers.findFirst({ where: eq(questionAnswers.id, answerId), columns: { id: true, userId: true } });
  if (!a) throw new ApiError(404, "Javob topilmadi");
  if (a.userId === userId) throw new ApiError(422, "O'z javobingizni belgilab bo'lmaydi");
  return db.transaction(async (tx) => {
    const prev = await tx.query.answerVotes.findFirst({ where: and(eq(answerVotes.answerId, answerId), eq(answerVotes.userId, userId)) });
    if (prev) {
      await tx.delete(answerVotes).where(eq(answerVotes.id, prev.id));
      await tx.update(questionAnswers).set({ upvotesCount: sql`max(${questionAnswers.upvotesCount} - 1, 0)` }).where(eq(questionAnswers.id, answerId));
    } else {
      await tx.insert(answerVotes).values({ id: uid(), answerId, userId });
      await tx.update(questionAnswers).set({ upvotesCount: sql`${questionAnswers.upvotesCount} + 1` }).where(eq(questionAnswers.id, answerId));
    }
    const [row] = await tx.select({ c: questionAnswers.upvotesCount }).from(questionAnswers).where(eq(questionAnswers.id, answerId)).limit(1);
    return { voted: !prev, upvotesCount: row?.c ?? 0 };
  });
}

/** «Eng foydali» — faqat savol egasi; qayta bosish — belgini olib tashlaydi, boshqasiga — ko'chiradi */
export async function acceptAnswer(userId: string, questionId: string, answerId: string): Promise<{ acceptedAnswerId: string | null }> {
  const q = await db.query.questions.findFirst({ where: eq(questions.id, questionId), columns: { id: true, userId: true, title: true, acceptedAnswerId: true } });
  if (!q) throw new ApiError(404, "Savol topilmadi");
  if (q.userId !== userId) throw new ApiError(403, "Faqat savol egasi belgilaydi");
  const a = await db.query.questionAnswers.findFirst({ where: and(eq(questionAnswers.id, answerId), eq(questionAnswers.questionId, questionId)), columns: { id: true, userId: true } });
  if (!a) throw new ApiError(404, "Javob topilmadi");
  const next = q.acceptedAnswerId === answerId ? null : answerId;
  await db.update(questions).set({ acceptedAnswerId: next }).where(eq(questions.id, questionId));
  if (next) {
    await notify(a.userId, "post_like", "Javobingiz eng foydali deb belgilandi ⭐", `«${q.title.slice(0, 80)}» savolida javobingiz tanlandi. Rahmat!`, `/savollar/${questionId}`).catch(() => undefined);
  }
  return { acceptedAnswerId: next };
}

export async function deleteQuestion(userId: string, isAdmin: boolean, questionId: string): Promise<void> {
  const q = await db.query.questions.findFirst({ where: eq(questions.id, questionId), columns: { id: true, userId: true } });
  if (!q) throw new ApiError(404, "Savol topilmadi");
  if (q.userId !== userId && !isAdmin) throw new ApiError(403, "Ruxsat yo'q");
  await db.delete(questions).where(eq(questions.id, questionId)); // cascade: javoblar + ovozlar
}

export async function deleteAnswer(userId: string, isAdmin: boolean, answerId: string): Promise<void> {
  const a = await db.query.questionAnswers.findFirst({ where: eq(questionAnswers.id, answerId), columns: { id: true, userId: true, questionId: true } });
  if (!a) throw new ApiError(404, "Javob topilmadi");
  if (a.userId !== userId && !isAdmin) throw new ApiError(403, "Ruxsat yo'q");
  await db.transaction(async (tx) => {
    await tx.delete(questionAnswers).where(eq(questionAnswers.id, answerId));
    await tx.update(questions).set({ answersCount: sql`max(${questions.answersCount} - 1, 0)` }).where(eq(questions.id, a.questionId));
    // Qabul qilingan javob o'chsa — belgini tozalaymiz
    await tx.update(questions).set({ acceptedAnswerId: null }).where(and(eq(questions.id, a.questionId), eq(questions.acceptedAnswerId, answerId)));
  });
}
