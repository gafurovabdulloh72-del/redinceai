import "server-only";
import { and, asc, desc, eq, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionItems, collections, groupMembers, groups, posts, users, videoProgress, watchLater, type Collection } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { uid } from "@/lib/utils";
import { buildFeedItems, type FeedItem, type FeedPage, type FeedRowLite } from "@/lib/feed";
import { notBlockedCondition } from "@/lib/privacy/blocks";

/**
 * Kutubxona: ko'rish tarixi (davom ettirish), «keyinroq ko'rish» navbati va to'plamlar (pleylist).
 * Hammasi faqat egasiga tegishli; postlarni ko'rish huquqi lenta bilan bir xil tekshiriladi
 * (bloklangan muallif, yopiq jamoa — chiqmaydi).
 */
type Viewer = { id: string; role: string };

export const COLLECTION_TITLE_MAX = 80;
export const COLLECTION_DESC_MAX = 300;
/** Bitta foydalanuvchida ko'pi bilan shuncha to'plam */
export const COLLECTIONS_MAX = 50;
/** Bitta to'plamda ko'pi bilan shuncha post */
export const COLLECTION_ITEMS_MAX = 300;
/** Tarix shuncha kundan keyin tozalanadi (cron) */
export const HISTORY_KEEP_DAYS = 90;

const feedSelect = { p: posts, gslug: groups.slug, gname: groups.name, gkind: groups.kind, goff: groups.isOfficial } as const;

/** Postni ko'ra olish sharti (lenta bilan bir xil): ochiq jamoa yoki a'zo bo'lgan jamoa, bloklanmagan muallif */
function visibleConds(viewer: Viewer): SQL[] {
  const myGroups = db.select({ id: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.userId, viewer.id), eq(groupMembers.status, "active")));
  const conds: SQL[] = [eq(users.isBanned, false), notBlockedCondition(posts.authorId, viewer.id)];
  if (viewer.role !== "admin") conds.push(or(isNull(posts.groupId), eq(groups.isPrivate, false), inArray(posts.groupId, myGroups))!);
  return conds;
}

/* ------------------------------------------------------------------ */
/* Ko'rish holati: davom ettirish va tarix                             */
/* ------------------------------------------------------------------ */

/** Videoni qaysi joyda to'xtatgani (soniya). `done` — oxirigacha ko'rilgan (oxirgi 15 s ichida) */
export async function saveProgress(userId: string, postId: string, positionSec: number, durationSec: number): Promise<void> {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId), columns: { id: true } });
  if (!post) throw new ApiError(404, "Post topilmadi");
  const pos = Math.max(0, Math.floor(positionSec));
  const dur = Math.max(0, Math.floor(durationSec));
  const done = dur > 0 && pos >= dur - 15;
  const now = new Date();
  const existing = await db.query.videoProgress.findFirst({ where: and(eq(videoProgress.userId, userId), eq(videoProgress.postId, postId)), columns: { id: true } });
  if (existing) {
    await db.update(videoProgress).set({ positionSec: pos, durationSec: dur || undefined, done, updatedAt: now }).where(eq(videoProgress.id, existing.id));
    return;
  }
  await db.insert(videoProgress).values({ id: uid(), userId, postId, positionSec: pos, durationSec: dur, done, updatedAt: now });
}

/** Bir nechta post uchun ko'rish holati — pleyer ochilganda «davom ettirish» joyi */
export async function progressFor(userId: string, postIds: string[]): Promise<Map<string, { positionSec: number; durationSec: number; done: boolean }>> {
  if (!postIds.length) return new Map();
  const rows = await db.query.videoProgress.findMany({ where: and(eq(videoProgress.userId, userId), inArray(videoProgress.postId, postIds)) });
  return new Map(rows.map((r) => [r.postId, { positionSec: r.positionSec, durationSec: r.durationSec, done: r.done }]));
}

export interface HistoryPage extends FeedPage {
  /** Har bir post uchun to'xtagan joyi */
  progress: Record<string, { positionSec: number; durationSec: number; done: boolean }>;
}

/** Ko'rish tarixi: oxirgi ko'rilgan birinchi */
export async function listHistory(viewer: Viewer, opts: { cursor?: number | null; limit?: number } = {}): Promise<HistoryPage> {
  const limit = Math.min(30, Math.max(1, opts.limit ?? 12));
  const conds = [eq(videoProgress.userId, viewer.id), ...visibleConds(viewer)];
  if (opts.cursor) conds.push(lt(videoProgress.updatedAt, new Date(opts.cursor)));
  const rows = await db
    .select({ ...feedSelect, at: videoProgress.updatedAt, pos: videoProgress.positionSec, dur: videoProgress.durationSec, done: videoProgress.done })
    .from(videoProgress)
    .innerJoin(posts, eq(posts.id, videoProgress.postId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(groups, eq(groups.id, posts.groupId))
    .where(and(...conds))
    .orderBy(desc(videoProgress.updatedAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const items = await buildFeedItems(page as FeedRowLite[], viewer);
  const progress: HistoryPage["progress"] = {};
  for (const r of page) progress[r.p.id] = { positionSec: r.pos, durationSec: r.dur, done: r.done };
  return { items, nextCursor: rows.length > limit ? page[page.length - 1].at.getTime() : null, progress };
}

/** Tarixdan bitta yozuvni yoki hammasini o'chirish */
export async function clearHistory(userId: string, postId?: string): Promise<void> {
  if (postId) await db.delete(videoProgress).where(and(eq(videoProgress.userId, userId), eq(videoProgress.postId, postId)));
  else await db.delete(videoProgress).where(eq(videoProgress.userId, userId));
}

/** Cron: eski tarix yozuvlarini tozalash */
export async function purgeOldHistory(days = HISTORY_KEEP_DAYS): Promise<number> {
  const res = await db.delete(videoProgress).where(lt(videoProgress.updatedAt, new Date(Date.now() - days * 86_400_000)));
  return res.rowsAffected ?? 0;
}

/* ------------------------------------------------------------------ */
/* Keyinroq ko'rish                                                    */
/* ------------------------------------------------------------------ */

export async function toggleWatchLater(userId: string, postId: string): Promise<{ queued: boolean }> {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId), columns: { id: true } });
  if (!post) throw new ApiError(404, "Post topilmadi");
  const existing = await db.query.watchLater.findFirst({ where: and(eq(watchLater.userId, userId), eq(watchLater.postId, postId)), columns: { id: true } });
  if (existing) {
    await db.delete(watchLater).where(eq(watchLater.id, existing.id));
    return { queued: false };
  }
  await db.insert(watchLater).values({ id: uid(), userId, postId });
  return { queued: true };
}

export async function listWatchLater(viewer: Viewer, opts: { cursor?: number | null; limit?: number } = {}): Promise<FeedPage> {
  const limit = Math.min(30, Math.max(1, opts.limit ?? 12));
  const conds = [eq(watchLater.userId, viewer.id), ...visibleConds(viewer)];
  if (opts.cursor) conds.push(lt(watchLater.createdAt, new Date(opts.cursor)));
  const rows = await db
    .select({ ...feedSelect, at: watchLater.createdAt })
    .from(watchLater)
    .innerJoin(posts, eq(posts.id, watchLater.postId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(groups, eq(groups.id, posts.groupId))
    .where(and(...conds))
    .orderBy(desc(watchLater.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const items = await buildFeedItems(page as FeedRowLite[], viewer);
  return { items, nextCursor: rows.length > limit ? page[page.length - 1].at.getTime() : null };
}

/** Bir nechta post uchun «navbatdami» belgisi */
export async function watchLaterSet(userId: string, postIds: string[]): Promise<Set<string>> {
  if (!postIds.length) return new Set();
  const rows = await db.query.watchLater.findMany({ where: and(eq(watchLater.userId, userId), inArray(watchLater.postId, postIds)), columns: { postId: true } });
  return new Set(rows.map((r) => r.postId));
}

/* ------------------------------------------------------------------ */
/* To'plamlar (pleylist)                                               */
/* ------------------------------------------------------------------ */

export interface CollectionView {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  itemsCount: number;
  updatedAt: number;
  owner: { id: string; name: string } | null;
}

const toView = (c: Collection, owner?: { id: string; name: string } | null): CollectionView => ({
  id: c.id,
  title: c.title,
  description: c.description,
  coverUrl: c.coverUrl,
  isPublic: c.isPublic,
  itemsCount: c.itemsCount,
  updatedAt: c.updatedAt.getTime(),
  owner: owner ?? null,
});

/** Egasining to'plamlari (o'zi uchun — yopiqlari bilan); `publicOnly` — begona ko'ruvchi uchun */
export async function listCollections(ownerId: string, publicOnly: boolean): Promise<CollectionView[]> {
  const conds: SQL[] = [eq(collections.ownerId, ownerId)];
  if (publicOnly) conds.push(eq(collections.isPublic, true));
  const rows = await db.query.collections.findMany({ where: and(...conds), orderBy: [desc(collections.updatedAt)], limit: COLLECTIONS_MAX });
  return rows.map((c) => toView(c));
}

export async function createCollection(ownerId: string, input: { title: string; description?: string | null; isPublic?: boolean }): Promise<CollectionView> {
  const title = input.title.trim().slice(0, COLLECTION_TITLE_MAX);
  if (!title) throw new ApiError(422, "Nom bo'sh bo'lmasin", { title: "Nom kiriting" });
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(collections).where(eq(collections.ownerId, ownerId));
  if (Number(n) >= COLLECTIONS_MAX) throw new ApiError(422, `Ko'pi bilan ${COLLECTIONS_MAX} ta to'plam`);
  const now = new Date();
  const [row] = await db
    .insert(collections)
    .values({ id: uid(), ownerId, title, description: input.description?.trim().slice(0, COLLECTION_DESC_MAX) || null, isPublic: input.isPublic ?? true, createdAt: now, updatedAt: now })
    .returning();
  return toView(row);
}

async function own(id: string, viewer: Viewer): Promise<Collection> {
  const c = await db.query.collections.findFirst({ where: eq(collections.id, id) });
  if (!c) throw new ApiError(404, "To'plam topilmadi");
  if (c.ownerId !== viewer.id && viewer.role !== "admin") throw new ApiError(403, "Bu to'plam sizniki emas");
  return c;
}

export async function updateCollection(id: string, viewer: Viewer, patch: { title?: string; description?: string | null; isPublic?: boolean }): Promise<CollectionView> {
  const c = await own(id, viewer);
  const set: Partial<typeof collections.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined) {
    const t = patch.title.trim().slice(0, COLLECTION_TITLE_MAX);
    if (!t) throw new ApiError(422, "Nom bo'sh bo'lmasin", { title: "Nom kiriting" });
    set.title = t;
  }
  if (patch.description !== undefined) set.description = patch.description?.trim().slice(0, COLLECTION_DESC_MAX) || null;
  if (patch.isPublic !== undefined) set.isPublic = patch.isPublic;
  const [row] = await db.update(collections).set(set).where(eq(collections.id, c.id)).returning();
  return toView(row);
}

export async function deleteCollection(id: string, viewer: Viewer): Promise<void> {
  const c = await own(id, viewer);
  await db.delete(collections).where(eq(collections.id, c.id));
}

/** Postni to'plamga qo'shish / olib tashlash (muqova birinchi postdan avtomatik olinadi) */
export async function toggleInCollection(id: string, viewer: Viewer, postId: string): Promise<{ added: boolean; itemsCount: number }> {
  const c = await own(id, viewer);
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId), columns: { id: true, media: true } });
  if (!post) throw new ApiError(404, "Post topilmadi");
  const existing = await db.query.collectionItems.findFirst({ where: and(eq(collectionItems.collectionId, c.id), eq(collectionItems.postId, postId)), columns: { id: true } });
  if (existing) {
    await db.delete(collectionItems).where(eq(collectionItems.id, existing.id));
    const left = Math.max(0, c.itemsCount - 1);
    await db.update(collections).set({ itemsCount: left, updatedAt: new Date() }).where(eq(collections.id, c.id));
    return { added: false, itemsCount: left };
  }
  if (c.itemsCount >= COLLECTION_ITEMS_MAX) throw new ApiError(422, `To'plamda ko'pi bilan ${COLLECTION_ITEMS_MAX} ta post`);
  const [{ maxPos }] = await db.select({ maxPos: sql<number>`coalesce(max(${collectionItems.position}), -1)` }).from(collectionItems).where(eq(collectionItems.collectionId, c.id));
  await db.insert(collectionItems).values({ id: uid(), collectionId: c.id, postId, position: Number(maxPos) + 1 });
  const cover = c.coverUrl ?? post.media.find((m) => m.poster)?.poster ?? post.media.find((m) => !m.type.startsWith("video/"))?.url ?? null;
  const count = c.itemsCount + 1;
  await db.update(collections).set({ itemsCount: count, coverUrl: cover, updatedAt: new Date() }).where(eq(collections.id, c.id));
  return { added: true, itemsCount: count };
}

/** Tartibni yangilash: berilgan postId'lar ketma-ketligi bo'yicha */
export async function reorderCollection(id: string, viewer: Viewer, postIds: string[]): Promise<void> {
  const c = await own(id, viewer);
  const rows = await db.query.collectionItems.findMany({ where: eq(collectionItems.collectionId, c.id), columns: { id: true, postId: true } });
  const byPost = new Map(rows.map((r) => [r.postId, r.id]));
  let i = 0;
  for (const pid of postIds) {
    const rid = byPost.get(pid);
    if (!rid) continue;
    await db.update(collectionItems).set({ position: i++ }).where(eq(collectionItems.id, rid));
  }
  await db.update(collections).set({ updatedAt: new Date() }).where(eq(collections.id, c.id));
}

export interface CollectionDetail {
  collection: CollectionView;
  items: FeedItem[];
  canManage: boolean;
}

/** To'plam va uning postlari (tartib bo'yicha). Yopiq to'plamni faqat egasi/admin ko'radi */
export async function getCollection(id: string, viewer: Viewer | null): Promise<CollectionDetail | null> {
  const c = await db.query.collections.findFirst({ where: eq(collections.id, id) });
  if (!c) return null;
  const canManage = Boolean(viewer && (viewer.id === c.ownerId || viewer.role === "admin"));
  if (!c.isPublic && !canManage) return null;
  const owner = await db.query.users.findFirst({ where: eq(users.id, c.ownerId), columns: { id: true, name: true } });
  const conds: SQL[] = [eq(collectionItems.collectionId, c.id), eq(users.isBanned, false)];
  if (viewer) conds.push(...visibleConds(viewer));
  else conds.push(or(isNull(posts.groupId), eq(groups.isPrivate, false))!);
  const rows = await db
    .select({ ...feedSelect, pos: collectionItems.position })
    .from(collectionItems)
    .innerJoin(posts, eq(posts.id, collectionItems.postId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(groups, eq(groups.id, posts.groupId))
    .where(and(...conds))
    .orderBy(asc(collectionItems.position))
    .limit(COLLECTION_ITEMS_MAX);
  const items = await buildFeedItems(rows as FeedRowLite[], viewer);
  return { collection: toView(c, owner ?? null), items, canManage };
}

/** Postni qaysi to'plamlarimga qo'shganman (tanlash oynasi uchun) */
export async function collectionsForPost(ownerId: string, postId: string): Promise<Array<CollectionView & { has: boolean }>> {
  const rows = await db.query.collections.findMany({ where: eq(collections.ownerId, ownerId), orderBy: [desc(collections.updatedAt)], limit: COLLECTIONS_MAX });
  if (!rows.length) return [];
  const has = await db.query.collectionItems.findMany({
    where: and(
      eq(collectionItems.postId, postId),
      inArray(
        collectionItems.collectionId,
        rows.map((r) => r.id),
      ),
    ),
    columns: { collectionId: true },
  });
  const set = new Set(has.map((h) => h.collectionId));
  return rows.map((c) => ({ ...toView(c), has: set.has(c.id) }));
}
