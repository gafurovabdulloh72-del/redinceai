import "server-only";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { closeFriends, postTags, posts, scheduledPosts, stories, storyHighlightItems, storyHighlights, storyStickerAnswers, users, type FileAttachment, type PostMusic, type StorySticker } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { uid } from "@/lib/utils";
import { briefUsers, type UserBrief } from "@/lib/groups/service";
import { notify } from "@/lib/notifications";
import { isBlockedEither } from "@/lib/privacy/blocks";

/**
 * Instagram naqshlari: odamlarni belgilash (tag) va hamkorlik, yaqin do'stlar ro'yxati,
 * story stikerlari (so'rovnoma/savol/hisoblagich/havola) va javoblari, Highlights to'plamlari,
 * postni rejalashtirish, izohlarning so'z filtri.
 */

export const TAGS_MAX = 20;
export const CLOSE_FRIENDS_MAX = 200;
export const HIGHLIGHTS_MAX = 30;
export const HIGHLIGHT_ITEMS_MAX = 100;
/** Rejalashtirish: eng uzog'i 60 kun, eng yaqini 5 daqiqa */
export const SCHEDULE_MAX_MS = 60 * 86_400_000;
export const SCHEDULE_MIN_MS = 5 * 60_000;
export const SCHEDULED_MAX = 30;

/* ------------------------------------------------------------------ */
/* Odamlarni belgilash (tag) va hamkorlik                              */
/* ------------------------------------------------------------------ */

/** Postga odamlarni belgilash: bloklanganlar o'tkazib yuboriladi, belgilanganga xabar boradi */
export async function setPostTags(postId: string, authorId: string, userIds: string[], role: "tagged" | "collab" = "tagged"): Promise<string[]> {
  const ids = [...new Set(userIds)].filter((id) => id !== authorId).slice(0, TAGS_MAX);
  const existing = await db.query.postTags.findMany({ where: eq(postTags.postId, postId), columns: { userId: true } });
  const had = new Set(existing.map((e) => e.userId));
  await db.delete(postTags).where(eq(postTags.postId, postId));
  if (!ids.length) return [];
  const ok: string[] = [];
  for (const id of ids) {
    if (await isBlockedEither(authorId, id)) continue;
    ok.push(id);
  }
  if (!ok.length) return [];
  await db.insert(postTags).values(ok.map((userId) => ({ id: uid(), postId, userId, role })));
  // Yangi belgilanganlarga xabar (eski belgilar qayta xabar bermaydi)
  const fresh = ok.filter((id) => !had.has(id));
  if (fresh.length) {
    const who = (await briefUsers([authorId])).get(authorId)?.name ?? "Foydalanuvchi";
    const post = await db.query.posts.findFirst({ where: eq(posts.id, postId), columns: { authorId: true } });
    const author = post ? (await briefUsers([post.authorId])).get(post.authorId) : null;
    const href = author?.slug ? `/mutaxassislar/${author.slug}?post=${postId}` : `/?post=${postId}`;
    await Promise.all(fresh.map((id) => notify(id, "mention", `${who} sizni postda belgiladi`, null, href, { skipMail: true }).catch(() => undefined)));
  }
  return ok;
}

export interface TagView extends UserBrief {
  role: "tagged" | "collab";
}

/** Bir nechta post uchun belgilanganlar */
export async function tagsForPosts(postIds: string[]): Promise<Map<string, TagView[]>> {
  const out = new Map<string, TagView[]>();
  if (!postIds.length) return out;
  const rows = await db.query.postTags.findMany({ where: inArray(postTags.postId, postIds) });
  if (!rows.length) return out;
  const brief = await briefUsers(rows.map((r) => r.userId));
  for (const r of rows) {
    const u = brief.get(r.userId);
    if (!u) continue;
    const list = out.get(r.postId) ?? [];
    list.push({ ...u, role: r.role });
    out.set(r.postId, list);
  }
  return out;
}

/** «Menda belgilangan» postlar (profil Tagged bo'limi) — post id'lari, yangi → eski */
export async function taggedPostIds(userId: string, limit = 60): Promise<string[]> {
  const rows = await db.query.postTags.findMany({ where: eq(postTags.userId, userId), orderBy: [desc(postTags.createdAt)], limit, columns: { postId: true } });
  return rows.map((r) => r.postId);
}

/* ------------------------------------------------------------------ */
/* Yaqin do'stlar                                                      */
/* ------------------------------------------------------------------ */

export async function listCloseFriends(ownerId: string): Promise<UserBrief[]> {
  const rows = await db.query.closeFriends.findMany({ where: eq(closeFriends.ownerId, ownerId), orderBy: [desc(closeFriends.createdAt)], limit: CLOSE_FRIENDS_MAX, columns: { friendId: true } });
  if (!rows.length) return [];
  const brief = await briefUsers(rows.map((r) => r.friendId));
  return rows.map((r) => brief.get(r.friendId)).filter((x): x is UserBrief => Boolean(x));
}

export async function toggleCloseFriend(ownerId: string, friendId: string): Promise<{ added: boolean }> {
  if (ownerId === friendId) throw new ApiError(400, "O'zingizni qo'sha olmaysiz");
  const target = await db.query.users.findFirst({ where: eq(users.id, friendId), columns: { id: true, isBanned: true } });
  if (!target || target.isBanned) throw new ApiError(404, "Foydalanuvchi topilmadi");
  const existing = await db.query.closeFriends.findFirst({ where: and(eq(closeFriends.ownerId, ownerId), eq(closeFriends.friendId, friendId)), columns: { id: true } });
  if (existing) {
    await db.delete(closeFriends).where(eq(closeFriends.id, existing.id));
    return { added: false };
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(closeFriends).where(eq(closeFriends.ownerId, ownerId));
  if (Number(n) >= CLOSE_FRIENDS_MAX) throw new ApiError(422, `Ko'pi bilan ${CLOSE_FRIENDS_MAX} ta yaqin do'st`);
  await db.insert(closeFriends).values({ id: uid(), ownerId, friendId });
  return { added: true };
}

/** `viewer` muallifning yaqin do'stlari ro'yxatidami (yopiq post/story ko'rina oladimi) */
export async function isCloseFriend(ownerId: string, viewerId: string | null): Promise<boolean> {
  if (!viewerId) return false;
  if (ownerId === viewerId) return true;
  const row = await db.query.closeFriends.findFirst({ where: and(eq(closeFriends.ownerId, ownerId), eq(closeFriends.friendId, viewerId)), columns: { id: true } });
  return Boolean(row);
}

/** Ko'ruvchi yaqin do'sti bo'lgan mualliflar (lenta filtri uchun) */
export async function closeFriendOfIds(viewerId: string): Promise<string[]> {
  const rows = await db.query.closeFriends.findMany({ where: eq(closeFriends.friendId, viewerId), columns: { ownerId: true }, limit: 500 });
  return rows.map((r) => r.ownerId);
}

/* ------------------------------------------------------------------ */
/* Story stikerlari                                                    */
/* ------------------------------------------------------------------ */

export interface StickerState {
  sticker: StorySticker;
  /** So'rovnoma: har variant ovozi; savol: javoblar soni */
  counts: [number, number];
  answers: number;
  /** Ko'ruvchining javobi (so'rovnoma varianti) */
  myChoice: number | null;
  myText: string | null;
}

export async function stickerState(storyId: string, sticker: StorySticker, viewerId: string | null): Promise<StickerState> {
  const rows = await db.query.storyStickerAnswers.findMany({ where: eq(storyStickerAnswers.storyId, storyId), columns: { userId: true, choice: true, text: true } });
  const counts: [number, number] = [0, 0];
  for (const r of rows) if (r.choice === 0 || r.choice === 1) counts[r.choice] += 1;
  const mine = viewerId ? rows.find((r) => r.userId === viewerId) : null;
  return { sticker, counts, answers: rows.length, myChoice: mine?.choice ?? null, myText: mine?.text ?? null };
}

/** Stikerga javob: so'rovnomada variant, savolda matn. Bir foydalanuvchi — bitta javob (yangilanadi) */
export async function answerSticker(storyId: string, userId: string, input: { choice?: number; text?: string }): Promise<StickerState> {
  const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
  if (!story || !story.sticker) throw new ApiError(404, "Stiker topilmadi");
  if (story.expiresAt.getTime() < Date.now()) throw new ApiError(410, "Story muddati tugagan");
  const k = story.sticker.kind;
  if (k === "poll" && (input.choice !== 0 && input.choice !== 1)) throw new ApiError(422, "Variantni tanlang");
  if (k === "question" && !input.text?.trim()) throw new ApiError(422, "Javob bo'sh");
  if (k === "countdown" || k === "link") throw new ApiError(400, "Bu stikerga javob berilmaydi");
  const existing = await db.query.storyStickerAnswers.findFirst({ where: and(eq(storyStickerAnswers.storyId, storyId), eq(storyStickerAnswers.userId, userId)), columns: { id: true } });
  const values = { choice: k === "poll" ? (input.choice as number) : null, text: k === "question" ? (input.text as string).trim().slice(0, 300) : null };
  if (existing) await db.update(storyStickerAnswers).set(values).where(eq(storyStickerAnswers.id, existing.id));
  else await db.insert(storyStickerAnswers).values({ id: uid(), storyId, userId, ...values });
  // Savolga javob — muallifga xabar (spam bo'lmasin: faqat yangi javob)
  if (k === "question" && !existing && story.authorId !== userId) {
    const who = (await briefUsers([userId])).get(userId)?.name ?? "Foydalanuvchi";
    await notify(story.authorId, "mention", `${who} savolingizga javob berdi`, values.text, "/kabinet/story-javoblar", { skipMail: true }).catch(() => undefined);
  }
  return stickerState(storyId, story.sticker, userId);
}

/** Muallif uchun: savol stikeriga kelgan javoblar */
export async function stickerAnswers(storyId: string, ownerId: string): Promise<Array<{ user: UserBrief | null; text: string | null; choice: number | null; at: number }>> {
  const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId), columns: { authorId: true } });
  if (!story) throw new ApiError(404, "Story topilmadi");
  if (story.authorId !== ownerId) throw new ApiError(403, "Faqat muallif ko'radi");
  const rows = await db.query.storyStickerAnswers.findMany({ where: eq(storyStickerAnswers.storyId, storyId), orderBy: [desc(storyStickerAnswers.createdAt)], limit: 200 });
  const brief = await briefUsers(rows.map((r) => r.userId));
  return rows.map((r) => ({ user: brief.get(r.userId) ?? null, text: r.text, choice: r.choice, at: r.createdAt.getTime() }));
}

/* ------------------------------------------------------------------ */
/* Highlights (story to'plamlari) va arxiv                             */
/* ------------------------------------------------------------------ */

export interface HighlightView {
  id: string;
  title: string;
  coverUrl: string | null;
  itemsCount: number;
}

export async function listHighlights(ownerId: string): Promise<HighlightView[]> {
  const rows = await db.query.storyHighlights.findMany({ where: eq(storyHighlights.ownerId, ownerId), orderBy: [desc(storyHighlights.updatedAt)], limit: HIGHLIGHTS_MAX });
  return rows.map((h) => ({ id: h.id, title: h.title, coverUrl: h.coverUrl, itemsCount: h.itemsCount }));
}

export async function createHighlight(ownerId: string, title: string): Promise<HighlightView> {
  const t = title.trim().slice(0, 40);
  if (!t) throw new ApiError(422, "Nom kiriting", { title: "Nom kiriting" });
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(storyHighlights).where(eq(storyHighlights.ownerId, ownerId));
  if (Number(n) >= HIGHLIGHTS_MAX) throw new ApiError(422, `Ko'pi bilan ${HIGHLIGHTS_MAX} ta to'plam`);
  const now = new Date();
  const [row] = await db.insert(storyHighlights).values({ id: uid(), ownerId, title: t, createdAt: now, updatedAt: now }).returning();
  return { id: row.id, title: row.title, coverUrl: row.coverUrl, itemsCount: 0 };
}

export async function deleteHighlight(id: string, ownerId: string, isAdmin: boolean): Promise<void> {
  const h = await db.query.storyHighlights.findFirst({ where: eq(storyHighlights.id, id) });
  if (!h) throw new ApiError(404, "To'plam topilmadi");
  if (h.ownerId !== ownerId && !isAdmin) throw new ApiError(403, "Ruxsat yo'q");
  await db.delete(storyHighlights).where(eq(storyHighlights.id, id));
}

/** Story'ni Highlight'ga qo'shish (nusxa saqlanadi — asl story 24 soatdan keyin o'chsa ham qoladi) */
export async function addToHighlight(highlightId: string, ownerId: string, storyId: string): Promise<{ itemsCount: number }> {
  const h = await db.query.storyHighlights.findFirst({ where: eq(storyHighlights.id, highlightId) });
  if (!h) throw new ApiError(404, "To'plam topilmadi");
  if (h.ownerId !== ownerId) throw new ApiError(403, "Bu to'plam sizniki emas");
  if (h.itemsCount >= HIGHLIGHT_ITEMS_MAX) throw new ApiError(422, "To'plam to'ldi");
  const st = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
  if (!st) throw new ApiError(404, "Story topilmadi");
  if (st.authorId !== ownerId) throw new ApiError(403, "Faqat o'z story'ingiz");
  const dup = await db.query.storyHighlightItems.findFirst({ where: and(eq(storyHighlightItems.highlightId, highlightId), eq(storyHighlightItems.storyId, storyId)), columns: { id: true } });
  if (dup) return { itemsCount: h.itemsCount };
  await db.insert(storyHighlightItems).values({ id: uid(), highlightId, storyId, media: st.media, caption: st.caption, bg: st.bg, position: h.itemsCount });
  const count = h.itemsCount + 1;
  await db.update(storyHighlights).set({ itemsCount: count, coverUrl: h.coverUrl ?? st.media?.url ?? null, updatedAt: new Date() }).where(eq(storyHighlights.id, highlightId));
  return { itemsCount: count };
}

export interface HighlightItemView {
  id: string;
  media: FileAttachment | null;
  caption: string | null;
  bg: string | null;
}

export async function highlightItems(highlightId: string): Promise<{ title: string; items: HighlightItemView[] } | null> {
  const h = await db.query.storyHighlights.findFirst({ where: eq(storyHighlights.id, highlightId) });
  if (!h) return null;
  const rows = await db.query.storyHighlightItems.findMany({ where: eq(storyHighlightItems.highlightId, highlightId), orderBy: [asc(storyHighlightItems.position)], limit: HIGHLIGHT_ITEMS_MAX });
  return { title: h.title, items: rows.map((r) => ({ id: r.id, media: r.media, caption: r.caption, bg: r.bg })) };
}

/** Story arxivi: o'zimning barcha story'larim (muddati tugagani ham, agar hali o'chmagan bo'lsa) */
export async function storyArchive(ownerId: string, limit = 60) {
  const rows = await db.query.stories.findMany({ where: eq(stories.authorId, ownerId), orderBy: [desc(stories.createdAt)], limit });
  return rows.map((s) => ({ id: s.id, media: s.media, caption: s.caption, bg: s.bg, createdAt: s.createdAt.getTime(), viewsCount: s.viewsCount, expired: s.expiresAt.getTime() < Date.now() }));
}

/* ------------------------------------------------------------------ */
/* Postni rejalashtirish                                               */
/* ------------------------------------------------------------------ */

export interface ScheduleInput {
  body: string;
  media: FileAttachment[];
  music?: PostMusic | null;
  audience?: "public" | "close";
  placeName?: string | null;
  tagIds?: string[];
  groupId?: string | null;
  runAt: number;
}

export async function schedulePost(authorId: string, input: ScheduleInput) {
  const now = Date.now();
  if (input.runAt < now + SCHEDULE_MIN_MS) throw new ApiError(422, "Kamida 5 daqiqa keyinga belgilang", { runAt: "Juda yaqin vaqt" });
  if (input.runAt > now + SCHEDULE_MAX_MS) throw new ApiError(422, "Ko'pi bilan 60 kun keyinga", { runAt: "Juda uzoq vaqt" });
  if (!input.body.trim() && input.media.length === 0) throw new ApiError(422, "Matn yoki rasm kerak", { body: "Bo'sh post" });
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(scheduledPosts).where(and(eq(scheduledPosts.authorId, authorId), eq(scheduledPosts.status, "pending")));
  if (Number(n) >= SCHEDULED_MAX) throw new ApiError(422, `Ko'pi bilan ${SCHEDULED_MAX} ta rejalashtirilgan post`);
  const [row] = await db
    .insert(scheduledPosts)
    .values({
      id: uid(),
      authorId,
      groupId: input.groupId ?? null,
      body: input.body,
      media: input.media,
      music: input.music ?? null,
      audience: input.audience ?? "public",
      placeName: input.placeName?.trim().slice(0, 80) || null,
      tagIds: (input.tagIds ?? []).slice(0, TAGS_MAX),
      runAt: new Date(input.runAt),
    })
    .returning();
  return row;
}

export async function listScheduled(authorId: string) {
  const rows = await db.query.scheduledPosts.findMany({ where: eq(scheduledPosts.authorId, authorId), orderBy: [asc(scheduledPosts.runAt)], limit: 100 });
  return rows.map((r) => ({ id: r.id, body: r.body, media: r.media, runAt: r.runAt.getTime(), status: r.status, error: r.error, postId: r.postId, groupId: r.groupId }));
}

export async function cancelScheduled(id: string, authorId: string, isAdmin: boolean): Promise<void> {
  const row = await db.query.scheduledPosts.findFirst({ where: eq(scheduledPosts.id, id) });
  if (!row) throw new ApiError(404, "Topilmadi");
  if (row.authorId !== authorId && !isAdmin) throw new ApiError(403, "Ruxsat yo'q");
  if (row.status === "done") throw new ApiError(409, "Post allaqachon joylangan");
  await db.delete(scheduledPosts).where(eq(scheduledPosts.id, id));
}

/**
 * Cron: vaqti kelgan rejalashtirilgan postlarni joylaydi.
 * Profil posti `createProfilePost` orqali (obunachilarga xabar ketadi), jamoa posti — to'g'ridan-to'g'ri.
 */
export async function runScheduledPosts(now = Date.now()): Promise<{ published: number; failed: number }> {
  const due = await db.query.scheduledPosts.findMany({ where: and(eq(scheduledPosts.status, "pending"), lte(scheduledPosts.runAt, new Date(now))), limit: 50 });
  let published = 0;
  let failed = 0;
  for (const row of due) {
    try {
      // CAS: parallel cron ikki marta joylamasin
      const taken = await db
        .update(scheduledPosts)
        .set({ status: "done" })
        .where(and(eq(scheduledPosts.id, row.id), eq(scheduledPosts.status, "pending")))
        .returning({ id: scheduledPosts.id });
      if (!taken.length) continue;
      let postId: string;
      if (row.groupId) {
        const { createPost } = await import("@/lib/groups/service");
        const { groups } = await import("@/lib/db/schema");
        const group = await db.query.groups.findFirst({ where: eq(groups.id, row.groupId) });
        if (!group) throw new Error("Jamoa topilmadi");
        const p = await createPost(group, row.authorId, row.body, row.media);
        postId = p.id;
        // Musiqa jamoa postida createPost orqali o'tmaydi — alohida yoziladi
        if (row.music) await db.update(posts).set({ music: row.music }).where(eq(posts.id, p.id));
      } else {
        const { createProfilePost } = await import("@/lib/profile/posts");
        const p = await createProfilePost(row.authorId, row.body, row.media, row.music ?? null);
        postId = p.id;
      }
      if (row.audience === "close" || row.placeName) {
        await db.update(posts).set({ audience: row.audience, placeName: row.placeName }).where(eq(posts.id, postId));
      }
      if (row.tagIds.length) await setPostTags(postId, row.authorId, row.tagIds);
      await db.update(scheduledPosts).set({ postId }).where(eq(scheduledPosts.id, row.id));
      published += 1;
    } catch (e) {
      failed += 1;
      await db
        .update(scheduledPosts)
        .set({ status: "failed", error: e instanceof Error ? e.message.slice(0, 200) : "Xato" })
        .where(eq(scheduledPosts.id, row.id));
    }
  }
  return { published, failed };
}

/* ------------------------------------------------------------------ */
/* Izoh so'z filtri                                                    */
/* ------------------------------------------------------------------ */

/** Foydalanuvchining filtr so'zlari (kichik harfda) */
export async function commentFilterWords(userId: string): Promise<string[]> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { commentFilter: true } });
  return (u?.commentFilter ?? "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 100);
}

export async function setCommentFilter(userId: string, raw: string): Promise<{ words: string[] }> {
  const words = raw
    .split(",")
    .map((w) => w.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 100);
  await db.update(users).set({ commentFilter: words.join(", ") || null }).where(eq(users.id, userId));
  return { words };
}

/** Izoh post muallifining filtriga tushadimi (tushsa — yozilmaydi, muallifga ko'rinmaydi) */
export function matchesFilter(body: string, words: string[]): boolean {
  if (!words.length) return false;
  const text = body.toLowerCase();
  return words.some((w) => text.includes(w));
}
