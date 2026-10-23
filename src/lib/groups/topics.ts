import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMessages, groupTopics, type Group } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { assertCanManage, assertActiveMember } from "@/lib/groups/service";
import { uid } from "@/lib/utils";

/**
 * Guruh mavzulari (Telegram «forum topics»): guruh chati mavzularga bo'linadi.
 * Mavzusiz (`topicId = null`) xabarlar «Umumiy» oqimda. Mavzu yaratish/yopish/o'chirish —
 * faqat boshqaruvchilar; o'chirilganda xabarlar yo'qolmaydi, «Umumiy»ga qaytadi.
 */

type Viewer = { id: string; role: string };

export const TOPIC_MAX = 20;
export const TOPIC_NAME_MAX = 40;

export interface TopicView {
  id: string;
  name: string;
  position: number;
  isClosed: boolean;
  messages: number;
  lastAt: number | null;
}

/** Guruh mavzulari (xabar soni va oxirgi faollik bilan) — faol a'zolar ko'radi */
export async function listTopics(group: Group, viewer: Viewer): Promise<TopicView[]> {
  await assertActiveMember(group, viewer);
  const rows = await db.query.groupTopics.findMany({ where: eq(groupTopics.groupId, group.id), orderBy: [asc(groupTopics.position), asc(groupTopics.createdAt)] });
  if (!rows.length) return [];
  const stats = await db
    .select({ topicId: groupMessages.topicId, n: sql<number>`count(*)`, last: sql<number>`max(${groupMessages.createdAt})` })
    .from(groupMessages)
    .where(and(eq(groupMessages.groupId, group.id), sql`${groupMessages.topicId} is not null`, sql`${groupMessages.deletedAt} is null`))
    .groupBy(groupMessages.topicId);
  const map = new Map(stats.map((s) => [s.topicId, { n: Number(s.n), last: Number(s.last) }]));
  return rows.map((r) => ({ id: r.id, name: r.name, position: r.position, isClosed: r.isClosed, messages: map.get(r.id)?.n ?? 0, lastAt: map.get(r.id)?.last ?? null }));
}

export async function createTopic(group: Group, actor: Viewer, name: string): Promise<TopicView> {
  await assertCanManage(group, actor);
  const t = name.trim().slice(0, TOPIC_NAME_MAX);
  if (!t) throw new ApiError(422, "Mavzu nomi bo'sh", { name: "Nom kerak" });
  const n = await db.$count(groupTopics, eq(groupTopics.groupId, group.id));
  if (n >= TOPIC_MAX) throw new ApiError(422, `Ko'pi bilan ${TOPIC_MAX} mavzu`);
  const id = uid();
  await db.insert(groupTopics).values({ id, groupId: group.id, name: t, createdBy: actor.id, position: n + 1 });
  return { id, name: t, position: n + 1, isClosed: false, messages: 0, lastAt: null };
}

export async function updateTopic(group: Group, actor: Viewer, id: string, patch: { name?: string; isClosed?: boolean }): Promise<void> {
  await assertCanManage(group, actor);
  const set: Partial<typeof groupTopics.$inferInsert> = {};
  if (patch.name !== undefined) {
    const t = patch.name.trim().slice(0, TOPIC_NAME_MAX);
    if (!t) throw new ApiError(422, "Mavzu nomi bo'sh", { name: "Nom kerak" });
    set.name = t;
  }
  if (patch.isClosed !== undefined) set.isClosed = patch.isClosed;
  if (!Object.keys(set).length) return;
  const r = await db.update(groupTopics).set(set).where(and(eq(groupTopics.id, id), eq(groupTopics.groupId, group.id))).returning({ id: groupTopics.id });
  if (!r.length) throw new ApiError(404, "Mavzu topilmadi");
}

/** Mavzuni o'chirish: xabarlar o'chmaydi — «Umumiy» oqimga qaytadi */
export async function deleteTopic(group: Group, actor: Viewer, id: string): Promise<{ moved: number }> {
  await assertCanManage(group, actor);
  const r = await db.delete(groupTopics).where(and(eq(groupTopics.id, id), eq(groupTopics.groupId, group.id))).returning({ id: groupTopics.id });
  if (!r.length) throw new ApiError(404, "Mavzu topilmadi");
  const moved = await db.update(groupMessages).set({ topicId: null }).where(and(eq(groupMessages.groupId, group.id), eq(groupMessages.topicId, id))).returning({ id: groupMessages.id });
  return { moved: moved.length };
}

/**
 * Xabar yuborishdan oldin mavzuni tekshirish: shu guruhdagi mavzu bo'lishi va
 * yopilgan bo'lsa faqat boshqaruvchi yozishi mumkin. `null` — «Umumiy» oqim.
 */
export async function assertTopicWritable(group: Group, actor: Viewer, topicId: string | null | undefined): Promise<string | null> {
  if (!topicId) return null;
  const t = await db.query.groupTopics.findFirst({ where: and(eq(groupTopics.id, topicId), eq(groupTopics.groupId, group.id)) });
  if (!t) throw new ApiError(422, "Mavzu topilmadi", { topicId: "Mavzu topilmadi" });
  if (t.isClosed) {
    const m = await db.query.groupTopics.findFirst({ where: eq(groupTopics.id, topicId), columns: { id: true } });
    void m;
    // Yopilgan mavzuga faqat boshqaruvchilar yozadi
    await assertCanManage(group, actor).catch(() => {
      throw new ApiError(409, "Bu mavzu yopilgan");
    });
  }
  return t.id;
}

/** Mavzu bo'yicha oxirgi xabarlar (chat ro'yxati uchun shart) */
export const topicCondition = (topicId: string | null) => (topicId ? eq(groupMessages.topicId, topicId) : sql`${groupMessages.topicId} is null`);

/** Mavzudagi oxirgi xabar vaqti (ro'yxatni saralash uchun) */
export async function latestTopicAt(groupId: string, topicId: string): Promise<number | null> {
  const r = await db.query.groupMessages.findFirst({ where: and(eq(groupMessages.groupId, groupId), eq(groupMessages.topicId, topicId)), orderBy: [desc(groupMessages.createdAt)], columns: { createdAt: true } });
  return r?.createdAt.getTime() ?? null;
}
