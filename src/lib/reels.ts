import "server-only";
import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { follows, portfolioItems, postComments, postLikes, postSaves, postViews, posts, specialists, users, type PostMusic } from "@/lib/db/schema";
import { briefUsers, toPostViews, type UserBrief } from "@/lib/groups/service";
import type { ReactionKind } from "@/lib/groups/limits";
import { getSettings } from "@/lib/payments/settings";
import { listableCondition } from "@/lib/subscriptions/access";

/**
 * Reels (/lenta): saytga yuklangan BARCHA media-postlar (profil postlari — video va rasm) + mutaxassislarning portfolio videolari.
 * Tartiblar:
 *  · foryou («Siz uchun») — trend: faollik (reaksiya×3 + izoh×4 + saqlash×5 + ko'rish×0.3) vaqt bilan so'nadi (HN uslubi)
 *  · new («Yangi») — eng yangisi birinchi
 *  · top («Top hafta») — so'nggi 7 kundagi eng faol (kam bo'lsa 30 kunga kengayadi), har biriga o'rin raqami
 * Nomzodlar to'plami cheklangan (so'nggi 400 post + 200 ish) — hisob JS'da, sahifalash offset kursor bilan.
 * Kontakt yoki shaxsiy maydon chiqmaydi (privacy qoidasi).
 */
export type ReelsMode = "foryou" | "new" | "top";

export interface ReelAuthor extends UserBrief {
  category: string | null;
  regionSlug: string | null;
  isVerified: boolean;
  rating: number;
  reviewCount: number;
}

export interface ReelItem {
  /** "p:<postId>" yoki "w:<portfolioId>" */
  key: string;
  kind: "post" | "work";
  postId: string | null;
  /** Asosiy media: video yoki rasm */
  mediaType: "video" | "image";
  mediaUrl: string;
  /** Qo'shimcha rasmlar (karusel) — faqat rasmli post */
  extraImages: string[];
  posterUrl: string | null;
  caption: string;
  music: PostMusic | null;
  createdAt: number;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  savesCount: number;
  myReaction: ReactionKind | null;
  savedByMe: boolean;
  canDelete: boolean;
  author: ReelAuthor;
  /** Top tartibida — o'rin (1, 2, 3 …) */
  rank: number | null;
}

export interface ReelsPage {
  items: ReelItem[];
  nextCursor: string | null;
}

type Viewer = { id: string; role: string } | null;

const VIDEO_RE = /\.(?:mp4|webm|mov|m4v)(?:$|\?)/i;
const IMAGE_RE = /\.(?:jpe?g|png|webp|gif)(?:$|\?)/i;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface Candidate {
  key: string;
  kind: "post" | "work";
  id: string;
  authorId: string;
  createdAt: number;
  engagement: number;
}

const engagementOf = (likes: number, comments: number, saves: number, views: number) => likes * 3 + comments * 4 + saves * 5 + views * 0.3;
const trendScore = (e: number, createdAt: number, now: number) => (e + 2) / Math.pow((now - createdAt) / HOUR + 2, 1.3);

/** Nomzodlar ro'yxati qisqa muddat keshlanadi — tablar almashganda 3 ta og'ir so'rov har safar takrorlanmasin */
let candCache: { at: number; data: Promise<Candidate[]> } | null = null;
const CAND_TTL_MS = 10_000;
function candidates(): Promise<Candidate[]> {
  if (candCache && Date.now() - candCache.at < CAND_TTL_MS) return candCache.data.then((d) => [...d]);
  const data = loadCandidates();
  candCache = { at: Date.now(), data };
  data.catch(() => {
    if (candCache?.data === data) candCache = null;
  });
  return data.then((d) => [...d]);
}

async function loadCandidates(): Promise<Candidate[]> {
  const settings = await getSettings();
  const [postRows, workRows] = await Promise.all([
    db
      .select({ id: posts.id, authorId: posts.authorId, createdAt: posts.createdAt, likes: posts.likesCount, comments: posts.commentsCount, views: posts.viewsCount })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(and(isNull(posts.groupId), sql`${posts.media} != '[]'`, eq(users.isBanned, false)))
      .orderBy(desc(posts.createdAt))
      .limit(400),
    db
      .select({ id: portfolioItems.id, url: portfolioItems.url, authorId: specialists.userId, createdAt: portfolioItems.createdAt, rating: specialists.rating, reviews: specialists.reviewCount, verified: specialists.isVerified })
      .from(portfolioItems)
      .innerJoin(specialists, eq(portfolioItems.specialistId, specialists.id))
      .innerJoin(users, eq(users.id, specialists.userId))
      .where(and(eq(portfolioItems.type, "video"), eq(users.isBanned, false), eq(specialists.isHidden, false), listableCondition(settings)))
      .orderBy(desc(portfolioItems.createdAt))
      .limit(200),
  ]);
  const saves = postRows.length
    ? await db.select({ postId: postSaves.postId, n: sql<number>`count(*)` }).from(postSaves).where(inArray(postSaves.postId, postRows.map((p) => p.id))).groupBy(postSaves.postId)
    : [];
  const saveMap = new Map(saves.map((s) => [s.postId, Number(s.n)]));
  return [
    ...postRows.map((p) => ({ key: `p:${p.id}`, kind: "post" as const, id: p.id, authorId: p.authorId, createdAt: p.createdAt.getTime(), engagement: engagementOf(p.likes, p.comments, saveMap.get(p.id) ?? 0, p.views) })),
    // Portfolio videolari: faqat bevosita o'ynaydigan fayllar; faollik o'rniga ijodkor obro'si (reyting, sharhlar, tasdiq)
    ...workRows.filter((w) => VIDEO_RE.test(w.url)).map((w) => ({ key: `w:${w.id}`, kind: "work" as const, id: w.id, authorId: w.authorId, createdAt: w.createdAt.getTime(), engagement: w.rating * 2 + w.reviews * 0.5 + (w.verified ? 3 : 0) })),
  ];
}

function encodeCursor(offset: number): string {
  return String(offset);
}
function decodeCursor(c: string | null | undefined): number {
  const n = Number(c);
  return Number.isInteger(n) && n > 0 && n < 5000 ? n : 0;
}

/** Bir muallif ketma-ket 2 tadan ko'p chiqmasin (xilma-xillik) — tartibni yumshoq qayta joylash */
function diversify(list: Candidate[]): Candidate[] {
  const out: Candidate[] = [];
  const pending = [...list];
  while (pending.length) {
    const idx = pending.findIndex((c) => !(out.length >= 2 && out[out.length - 1].authorId === c.authorId && out[out.length - 2].authorId === c.authorId));
    out.push(...pending.splice(idx === -1 ? 0 : idx, 1));
  }
  return out;
}

export async function getReels(viewer: Viewer, mode: ReelsMode = "foryou", cursor: string | null = null, limit = 6): Promise<ReelsPage> {
  const now = Date.now();
  let list = await candidates();
  if (mode === "new") list.sort((a, b) => b.createdAt - a.createdAt);
  else if (mode === "top") {
    const week = list.filter((c) => c.kind === "post" && now - c.createdAt < 7 * DAY);
    list = (week.length >= 10 ? week : list.filter((c) => c.kind === "post" && now - c.createdAt < 30 * DAY)).sort((a, b) => b.engagement - a.engagement);
  } else list = diversify(list.sort((a, b) => trendScore(b.engagement, b.createdAt, now) - trendScore(a.engagement, a.createdAt, now)));

  const offset = decodeCursor(cursor);
  const slice = list.slice(offset, offset + limit);
  const items = await hydrate(slice, viewer, mode === "top" ? offset : null);
  return { items, nextCursor: offset + limit < list.length ? encodeCursor(offset + limit) : null };
}

/** Bitta post (havola orqali ochilganda Reels boshida turadi) */
export async function getReelByPostId(postId: string, viewer: Viewer): Promise<ReelItem | null> {
  const p = await db.query.posts.findFirst({ where: and(eq(posts.id, postId), isNull(posts.groupId)), columns: { id: true, authorId: true, createdAt: true } });
  if (!p) return null;
  const [item] = await hydrate([{ key: `p:${p.id}`, kind: "post", id: p.id, authorId: p.authorId, createdAt: p.createdAt.getTime(), engagement: 0 }], viewer, null);
  return item ?? null;
}

async function hydrate(slice: Candidate[], viewer: Viewer, rankBase: number | null): Promise<ReelItem[]> {
  if (!slice.length) return [];
  const postIds = slice.filter((c) => c.kind === "post").map((c) => c.id);
  const workIds = slice.filter((c) => c.kind === "work").map((c) => c.id);
  const authorIds = [...new Set(slice.map((c) => c.authorId))];
  const [postRows, workRows, spRows, saves] = await Promise.all([
    postIds.length ? db.query.posts.findMany({ where: inArray(posts.id, postIds) }) : Promise.resolve([]),
    workIds.length ? db.query.portfolioItems.findMany({ where: inArray(portfolioItems.id, workIds) }) : Promise.resolve([]),
    db
      .select({ userId: specialists.userId, category: specialists.category, regionSlug: specialists.regionSlug, isVerified: specialists.isVerified, rating: specialists.rating, reviewCount: specialists.reviewCount })
      .from(specialists)
      .where(inArray(specialists.userId, authorIds)),
    postIds.length ? db.select({ postId: postSaves.postId, n: sql<number>`count(*)` }).from(postSaves).where(inArray(postSaves.postId, postIds)).groupBy(postSaves.postId) : Promise.resolve([]),
  ]);
  const views = new Map((await toPostViews(postRows, viewer, viewer?.role === "admin")).map((v) => [v.id, v]));
  const works = new Map(workRows.map((w) => [w.id, w]));
  const sp = new Map(spRows.map((s) => [s.userId, s]));
  const saveMap = new Map(saves.map((s) => [s.postId, Number(s.n)]));
  const brief = await briefUsers(authorIds);

  const out: ReelItem[] = [];
  slice.forEach((c, i) => {
    const b = brief.get(c.authorId);
    if (!b) return;
    const s = sp.get(c.authorId);
    const author: ReelAuthor = { ...b, category: s?.category ?? null, regionSlug: s?.regionSlug ?? null, isVerified: s?.isVerified ?? false, rating: s?.rating ?? 0, reviewCount: s?.reviewCount ?? 0 };
    const rank = rankBase !== null ? rankBase + i + 1 : null;
    if (c.kind === "post") {
      const v = views.get(c.id);
      if (!v) return;
      const video = v.media.find((m) => m.type.startsWith("video/") || VIDEO_RE.test(m.url));
      const images = v.media.filter((m) => m.type.startsWith("image/") || IMAGE_RE.test(m.url)).map((m) => m.url);
      const main = video?.url ?? images[0];
      if (!main) return;
      out.push({
        key: c.key,
        kind: "post",
        postId: v.id,
        mediaType: video ? "video" : "image",
        mediaUrl: main,
        extraImages: video ? [] : images.slice(1, 10),
        posterUrl: video ? (images[0] ?? null) : null,
        caption: v.body,
        music: v.music,
        createdAt: v.createdAt,
        likesCount: v.likesCount,
        commentsCount: v.commentsCount,
        viewsCount: v.viewsCount,
        savesCount: saveMap.get(v.id) ?? 0,
        myReaction: v.myReaction,
        savedByMe: v.savedByMe,
        canDelete: v.canDelete,
        author,
        rank,
      });
    } else {
      const w = works.get(c.id);
      if (!w) return;
      out.push({
        key: c.key,
        kind: "work",
        postId: null,
        mediaType: "video",
        mediaUrl: w.url,
        extraImages: [],
        posterUrl: w.thumbnailUrl ?? null,
        caption: w.title ?? "",
        music: null,
        createdAt: w.createdAt.getTime(),
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        savesCount: 0,
        myReaction: null,
        savedByMe: false,
        canDelete: false,
        author,
        rank,
      });
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* TOP ijodkorlar reytingi (oylik; davr bo'yicha)                      */
/* ------------------------------------------------------------------ */
export interface TopCreator {
  rank: number;
  author: ReelAuthor;
  score: number;
  likes: number;
  comments: number;
  views: number;
  followers: number;
  saves: number;
}

/**
 * Berilgan davr (from–to): muallif postlariga kelgan reaksiya×3 + izoh×4 + saqlash×5 + ko'rish×0.3 + yangi obunachi×6.
 * O'z-o'ziga bergan reaksiya/izoh hisoblanmaydi.
 */
export async function topCreatorsBetween(from: Date, to: Date, limit = 20): Promise<TopCreator[]> {
  // Manipulyatsiyaga qarshi: davr oxirigacha kamida 2 kun yashagan akkauntlarning reaksiya/izoh/obunasi hisoblanadi
  const matureBefore = new Date(to.getTime() - 2 * DAY);
  const [likes, comments, saves, views, fol] = await Promise.all([
    db.select({ a: posts.authorId, n: sql<number>`count(*)` }).from(postLikes).innerJoin(posts, eq(posts.id, postLikes.postId)).innerJoin(users, eq(users.id, postLikes.userId)).where(and(gt(postLikes.createdAt, from), lt(postLikes.createdAt, to), lt(users.createdAt, matureBefore), sql`${postLikes.userId} != ${posts.authorId}`)).groupBy(posts.authorId),
    db.select({ a: posts.authorId, n: sql<number>`count(*)` }).from(postComments).innerJoin(posts, eq(posts.id, postComments.postId)).innerJoin(users, eq(users.id, postComments.authorId)).where(and(gt(postComments.createdAt, from), lt(postComments.createdAt, to), lt(users.createdAt, matureBefore), sql`${postComments.authorId} != ${posts.authorId}`)).groupBy(posts.authorId),
    db.select({ a: posts.authorId, n: sql<number>`count(*)` }).from(postSaves).innerJoin(posts, eq(posts.id, postSaves.postId)).where(and(gt(postSaves.createdAt, from), lt(postSaves.createdAt, to))).groupBy(posts.authorId),
    db.select({ a: posts.authorId, n: sql<number>`count(*)` }).from(postViews).innerJoin(posts, eq(posts.id, postViews.postId)).where(and(gt(postViews.createdAt, from), lt(postViews.createdAt, to))).groupBy(posts.authorId),
    db.select({ a: follows.followingId, n: sql<number>`count(*)` }).from(follows).innerJoin(users, eq(users.id, follows.followerId)).where(and(gt(follows.createdAt, from), lt(follows.createdAt, to), lt(users.createdAt, matureBefore))).groupBy(follows.followingId),
  ]);
  const acc = new Map<string, { likes: number; comments: number; saves: number; views: number; followers: number }>();
  const add = (rows: Array<{ a: string; n: number }>, k: "likes" | "comments" | "saves" | "views" | "followers") => {
    for (const r of rows) {
      const cur = acc.get(r.a) ?? { likes: 0, comments: 0, saves: 0, views: 0, followers: 0 };
      cur[k] += Number(r.n);
      acc.set(r.a, cur);
    }
  };
  add(likes, "likes");
  add(comments, "comments");
  add(saves, "saves");
  add(views, "views");
  add(fol, "followers");
  const scored = [...acc.entries()]
    .map(([id, v]) => ({ id, ...v, score: Math.round(engagementOf(v.likes, v.comments, v.saves, v.views) + v.followers * 6) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  // Faqat mutaxassislar (ijodkorlar) va bloklanmaganlar
  const ids = scored.slice(0, limit * 2).map((x) => x.id);
  if (!ids.length) return [];
  const spRows = await db
    .select({ userId: specialists.userId, category: specialists.category, regionSlug: specialists.regionSlug, isVerified: specialists.isVerified, rating: specialists.rating, reviewCount: specialists.reviewCount })
    .from(specialists)
    .innerJoin(users, eq(users.id, specialists.userId))
    .where(and(inArray(specialists.userId, ids), eq(users.isBanned, false), eq(specialists.isHidden, false)));
  const sp = new Map(spRows.map((s) => [s.userId, s]));
  const brief = await briefUsers(ids);
  const out: TopCreator[] = [];
  for (const x of scored) {
    const s = sp.get(x.id);
    const b = brief.get(x.id);
    if (!s || !b) continue;
    out.push({ rank: out.length + 1, author: { ...b, category: s.category, regionSlug: s.regionSlug, isVerified: s.isVerified, rating: s.rating, reviewCount: s.reviewCount }, score: x.score, likes: x.likes, comments: x.comments, views: x.views, followers: x.followers, saves: x.saves });
    if (out.length >= limit) break;
  }
  return out;
}
