import "server-only";
import { and, asc, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { stories, storyViews, users, type FileAttachment, type PostMusic } from "@/lib/db/schema";
import { briefUsers } from "@/lib/groups/service";
import { STORY_TTL_MS } from "@/lib/social/limits";
import { assertQuota } from "@/lib/social/quota";
import { uid } from "@/lib/utils";
import type { AuthorStories, StoryRailItem, StoryView } from "./types";

type Viewer = { id: string; role: string } | null;

/**
 * Story'lar (Instagram uslubi): 24 soat yashaydi, hammaga ochiq (bloklangan hisob muallifi chiqmaydi).
 * Qator tartibi: o'zim → ko'rilmaganlar (yangisi birinchi) → ko'rilganlar. Limit — lib/social/quota (oddiy: sutkada 4).
 */
export async function createStory(authorId: string, input: { media: FileAttachment | null; caption: string; bg: string | null; music: PostMusic | null }): Promise<{ id: string }> {
  await assertQuota(authorId, "story");
  const now = Date.now();
  const id = uid();
  await db.insert(stories).values({
    id,
    authorId,
    media: input.media,
    caption: input.caption || null,
    bg: input.media ? null : (input.bg ?? "coral"),
    music: input.music,
    createdAt: new Date(now),
    expiresAt: new Date(now + STORY_TTL_MS),
  });
  return { id };
}

/** Faol story'lari bor mualliflar (bloklanmagan) — qator uchun */
export async function storyRail(viewer: Viewer, limit = 30): Promise<StoryRailItem[]> {
  const now = new Date();
  const rows = await db
    .select({ authorId: stories.authorId, n: sql<number>`count(*)`, latest: sql<number>`max(${stories.createdAt})` })
    .from(stories)
    .innerJoin(users, eq(users.id, stories.authorId))
    .where(and(gt(stories.expiresAt, now), eq(users.isBanned, false)))
    .groupBy(stories.authorId)
    .orderBy(desc(sql`max(${stories.createdAt})`))
    .limit(limit);
  if (!rows.length) return [];
  // Ko'ruvchi har muallifdan nechtasini ko'rgan
  const seenBy = new Map<string, number>();
  if (viewer) {
    const seen = await db
      .select({ authorId: stories.authorId, n: sql<number>`count(*)` })
      .from(storyViews)
      .innerJoin(stories, eq(stories.id, storyViews.storyId))
      .where(and(eq(storyViews.viewerId, viewer.id), gt(stories.expiresAt, now), inArray(stories.authorId, rows.map((r) => r.authorId))))
      .groupBy(stories.authorId);
    for (const s of seen) seenBy.set(s.authorId, Number(s.n));
  }
  const brief = await briefUsers(rows.map((r) => r.authorId));
  const items = rows
    .map((r) => {
      const author = brief.get(r.authorId);
      if (!author) return null;
      const isMe = viewer?.id === r.authorId;
      return { author, count: Number(r.n), latestAt: Number(r.latest), allSeen: isMe || (seenBy.get(r.authorId) ?? 0) >= Number(r.n), isMe };
    })
    .filter((x): x is StoryRailItem => x !== null);
  return items.sort((a, b) => Number(b.isMe) - Number(a.isMe) || Number(a.allSeen) - Number(b.allSeen) || b.latestAt - a.latestAt);
}

/** Bitta muallifning faol story'lari (eskisi birinchi — Instagram tartibi) */
export async function authorStories(authorId: string, viewer: Viewer): Promise<AuthorStories | null> {
  const author = (await briefUsers([authorId])).get(authorId);
  if (!author) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, authorId), columns: { isBanned: true } });
  if (!u || u.isBanned) return null;
  const rows = await db.query.stories.findMany({ where: and(eq(stories.authorId, authorId), gt(stories.expiresAt, new Date())), orderBy: [asc(stories.createdAt)] });
  if (!rows.length) return null;
  const isMe = viewer?.id === authorId;
  const canSeeViews = isMe || viewer?.role === "admin";
  const seen = viewer
    ? new Set((await db.select({ id: storyViews.storyId }).from(storyViews).where(and(eq(storyViews.viewerId, viewer.id), inArray(storyViews.storyId, rows.map((r) => r.id))))).map((r) => r.id))
    : new Set<string>();
  const items: StoryView[] = rows.map((r) => ({
    id: r.id,
    media: r.media ?? null,
    caption: r.caption,
    bg: r.bg,
    music: r.music ?? null,
    createdAt: r.createdAt.getTime(),
    expiresAt: r.expiresAt.getTime(),
    seen: isMe || seen.has(r.id),
    viewsCount: canSeeViews ? r.viewsCount : null,
  }));
  return { author, items, isMe };
}

/** Ko'rildi: bir marta yoziladi; muallifning o'zi hisoblanmaydi */
export async function markStoryViewed(storyId: string, viewerId: string): Promise<void> {
  const s = await db.query.stories.findFirst({ where: eq(stories.id, storyId), columns: { authorId: true, expiresAt: true } });
  if (!s || s.authorId === viewerId) return;
  const res = await db.insert(storyViews).values({ id: uid(), storyId, viewerId }).onConflictDoNothing();
  if (res.rowsAffected) await db.update(stories).set({ viewsCount: sql`${stories.viewsCount} + 1` }).where(eq(stories.id, storyId));
}

export async function deleteStory(storyId: string, viewer: { id: string; role: string }): Promise<void> {
  const s = await db.query.stories.findFirst({ where: eq(stories.id, storyId), columns: { authorId: true } });
  if (!s) throw new ApiError(404, "Story topilmadi");
  if (s.authorId !== viewer.id && viewer.role !== "admin") throw new ApiError(403, "Faqat muallif o'chira oladi");
  await db.delete(stories).where(eq(stories.id, storyId));
}

/** Kim ko'rdi — faqat muallif/admin */
export async function storyViewers(storyId: string, viewer: { id: string; role: string }) {
  const s = await db.query.stories.findFirst({ where: eq(stories.id, storyId), columns: { authorId: true } });
  if (!s) throw new ApiError(404, "Story topilmadi");
  if (s.authorId !== viewer.id && viewer.role !== "admin") throw new ApiError(403, "Ruxsat yo'q");
  const rows = await db.query.storyViews.findMany({ where: eq(storyViews.storyId, storyId), orderBy: [desc(storyViews.createdAt)], limit: 200 });
  const brief = await briefUsers(rows.map((r) => r.viewerId));
  return rows.map((r) => ({ user: brief.get(r.viewerId), at: r.createdAt.getTime() })).filter((x) => x.user);
}

/** Cron: muddati 3 kundan oldin tugagan story'lar o'chiriladi (ko'rishlar kaskad bilan) */
export async function purgeExpiredStories(): Promise<number> {
  const res = await db.delete(stories).where(lt(stories.expiresAt, new Date(Date.now() - 3 * 86_400_000)));
  return res.rowsAffected;
}
