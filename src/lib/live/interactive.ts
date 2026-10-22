import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { livePollVotes, livePolls, liveQuestionVotes, liveQuestions, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { uid } from "@/lib/utils";
import { hostedStream, liveAccess } from "./service";

type Viewer = { id: string; role: string };

/* ------------------------------ Savollar ------------------------------ */
export type QuestionView = { id: string; body: string; votes: number; answered: boolean; name: string; mine: boolean; voted: boolean; createdAt: number };

/** Efir savollari: javob berilmaganlari ovoz bo'yicha, javob berilganlari oxirida */
export async function listQuestions(streamId: string, v: Viewer): Promise<QuestionView[]> {
  await liveAccess(streamId, v);
  const rows = await db
    .select({ id: liveQuestions.id, body: liveQuestions.body, votes: liveQuestions.votes, answered: liveQuestions.answered, userId: liveQuestions.userId, createdAt: liveQuestions.createdAt, name: users.name })
    .from(liveQuestions)
    .innerJoin(users, eq(users.id, liveQuestions.userId))
    .where(eq(liveQuestions.streamId, streamId))
    .orderBy(liveQuestions.answered, desc(liveQuestions.votes), desc(liveQuestions.createdAt))
    .limit(80);
  const mine = rows.length ? await db.query.liveQuestionVotes.findMany({ where: eq(liveQuestionVotes.userId, v.id), columns: { questionId: true } }) : [];
  const votedSet = new Set(mine.map((m) => m.questionId));
  return rows.map((r) => ({ id: r.id, body: r.body, votes: r.votes, answered: r.answered, name: r.name ?? "Ishtirokchi", mine: r.userId === v.id, voted: votedSet.has(r.id), createdAt: r.createdAt.getTime() }));
}

export async function askQuestion(streamId: string, v: Viewer, body: string): Promise<void> {
  await liveAccess(streamId, v);
  const t = body.trim().slice(0, 300);
  if (t.length < 3) throw new ApiError(422, "Savol juda qisqa", { body: "Kamida 3 belgi" });
  const n = await db.select({ n: sql<number>`count(*)` }).from(liveQuestions).where(and(eq(liveQuestions.streamId, streamId), eq(liveQuestions.userId, v.id)));
  if (Number(n[0]?.n ?? 0) >= 5) throw new ApiError(429, "Bir efirda ko'pi bilan 5 ta savol");
  await db.insert(liveQuestions).values({ id: uid(), streamId, userId: v.id, body: t });
}

/** Ovoz: bosilganda qo'shiladi, qayta bosilsa olinadi */
export async function toggleQuestionVote(streamId: string, v: Viewer, questionId: string): Promise<void> {
  await liveAccess(streamId, v);
  const q = await db.query.liveQuestions.findFirst({ where: and(eq(liveQuestions.id, questionId), eq(liveQuestions.streamId, streamId)) });
  if (!q) throw new ApiError(404, "Savol topilmadi");
  await db.transaction(async (tx) => {
    const del = await tx.delete(liveQuestionVotes).where(and(eq(liveQuestionVotes.questionId, questionId), eq(liveQuestionVotes.userId, v.id))).returning({ q: liveQuestionVotes.questionId });
    if (del.length) await tx.update(liveQuestions).set({ votes: sql`max(${liveQuestions.votes} - 1, 0)` }).where(eq(liveQuestions.id, questionId));
    else {
      await tx.insert(liveQuestionVotes).values({ questionId, userId: v.id });
      await tx.update(liveQuestions).set({ votes: sql`${liveQuestions.votes} + 1` }).where(eq(liveQuestions.id, questionId));
    }
  });
}

export async function markQuestionAnswered(streamId: string, host: Viewer, questionId: string, value: boolean): Promise<void> {
  await hostedStream(streamId, host);
  await db.update(liveQuestions).set({ answered: value }).where(and(eq(liveQuestions.id, questionId), eq(liveQuestions.streamId, streamId)));
}

/* ----------------------------- So'rovnoma ----------------------------- */
export type PollView = { id: string; question: string; options: string[]; counts: number[]; total: number; closed: boolean; myVote: number | null } | null;

export async function currentPoll(streamId: string, v: Viewer): Promise<PollView> {
  await liveAccess(streamId, v);
  const p = await db.query.livePolls.findFirst({ where: eq(livePolls.streamId, streamId), orderBy: [desc(livePolls.createdAt)] });
  if (!p) return null;
  const votes = await db.select({ idx: livePollVotes.optionIdx, n: sql<number>`count(*)` }).from(livePollVotes).where(eq(livePollVotes.pollId, p.id)).groupBy(livePollVotes.optionIdx);
  const counts = p.options.map((_, i) => Number(votes.find((x) => x.idx === i)?.n ?? 0));
  const mine = await db.query.livePollVotes.findFirst({ where: and(eq(livePollVotes.pollId, p.id), eq(livePollVotes.userId, v.id)) });
  return { id: p.id, question: p.question, options: p.options, counts, total: counts.reduce((a, b) => a + b, 0), closed: Boolean(p.closedAt), myVote: mine?.optionIdx ?? null };
}

export async function createPoll(streamId: string, host: Viewer, question: string, options: string[]): Promise<void> {
  await hostedStream(streamId, host);
  const q = question.trim().slice(0, 140);
  const opts = options.map((o) => o.trim().slice(0, 60)).filter(Boolean);
  if (q.length < 3 || opts.length < 2 || opts.length > 5) throw new ApiError(422, "Savol va 2–5 ta variant kerak");
  // Avvalgisi yopiladi — bir vaqtda bitta ochiq so'rovnoma
  await db.update(livePolls).set({ closedAt: new Date() }).where(and(eq(livePolls.streamId, streamId), sql`${livePolls.closedAt} is null`));
  await db.insert(livePolls).values({ id: uid(), streamId, question: q, options: opts });
}

export async function closePoll(streamId: string, host: Viewer): Promise<void> {
  await hostedStream(streamId, host);
  await db.update(livePolls).set({ closedAt: new Date() }).where(and(eq(livePolls.streamId, streamId), sql`${livePolls.closedAt} is null`));
}

export async function votePoll(streamId: string, v: Viewer, idx: number): Promise<void> {
  await liveAccess(streamId, v);
  const p = await db.query.livePolls.findFirst({ where: and(eq(livePolls.streamId, streamId), sql`${livePolls.closedAt} is null`), orderBy: [desc(livePolls.createdAt)] });
  if (!p) throw new ApiError(409, "So'rovnoma yopilgan");
  if (!Number.isInteger(idx) || idx < 0 || idx >= p.options.length) throw new ApiError(422, "Variant noto'g'ri");
  await db.insert(livePollVotes).values({ pollId: p.id, userId: v.id, optionIdx: idx }).onConflictDoNothing();
}

