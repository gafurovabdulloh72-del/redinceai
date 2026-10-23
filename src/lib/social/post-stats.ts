import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, postComments, postLikes, postSaves, postViews, posts, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { getMembership } from "@/lib/groups/service";

/**
 * Post (kanal e'loni yoki profil posti) statistikasi — FAQAT muallif, jamoa boshqaruvchisi
 * yoki sayt admini ko'radi. Telegram kanal statistikasi naqshi: ko'rishlar, reaksiyalar,
 * izohlar, saqlashlar va eng faol izohchilar.
 */

type Viewer = { id: string; role: string };

export interface PostStats {
  views: number;
  /** Noyob ko'ruvchilar (post_views jurnali bo'yicha; kun kesimida noyob) */
  uniqueViews: number;
  likes: number;
  comments: number;
  saves: number;
  /** Reaksiyalar turlari bo'yicha: heart/fire/clap/haha/wow/like */
  reactions: Array<{ emoji: string; count: number }>;
  /** Eng faol izohchilar (3 tagacha) */
  topCommenters: Array<{ name: string; count: number }>;
  /** Izohlar/ko'rishlar nisbati (foiz, 1 kasrli) */
  engagement: number;
  createdAt: number;
}

/** Statistika ko'rish huquqi: muallif · jamoa boshqaruvchisi · sayt admini */
async function assertCanSeeStats(postId: string, v: Viewer) {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId), columns: { id: true, authorId: true, groupId: true, likesCount: true, commentsCount: true, viewsCount: true, createdAt: true } });
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (post.authorId === v.id || v.role === "admin") return post;
  if (post.groupId) {
    const g = await db.query.groups.findFirst({ where: eq(groups.id, post.groupId), columns: { ownerId: true } });
    if (g?.ownerId === v.id) return post;
    const m = await getMembership(post.groupId, v.id);
    if (m && m.status === "active" && (m.role === "owner" || m.role === "admin")) return post;
  }
  throw new ApiError(403, "Statistika faqat muallif va boshqaruvchilar uchun");
}

export async function postStats(postId: string, v: Viewer): Promise<PostStats> {
  const post = await assertCanSeeStats(postId, v);
  const [uniq, reactions, saves, commenters] = await Promise.all([
    db.select({ n: sql<number>`count(distinct ${postViews.viewerKey})` }).from(postViews).where(eq(postViews.postId, postId)),
    db.select({ emoji: postLikes.reaction, n: sql<number>`count(*)` }).from(postLikes).where(eq(postLikes.postId, postId)).groupBy(postLikes.reaction).orderBy(desc(sql`count(*)`)),
    db.select({ n: sql<number>`count(*)` }).from(postSaves).where(eq(postSaves.postId, postId)),
    db
      .select({ name: users.name, n: sql<number>`count(*)` })
      .from(postComments)
      .innerJoin(users, eq(users.id, postComments.authorId))
      .where(eq(postComments.postId, postId))
      .groupBy(users.id, users.name)
      .orderBy(desc(sql`count(*)`))
      .limit(3),
  ]);
  const views = post.viewsCount;
  const comments = post.commentsCount;
  return {
    views,
    uniqueViews: Number(uniq[0]?.n ?? 0),
    likes: post.likesCount,
    comments,
    saves: Number(saves[0]?.n ?? 0),
    reactions: reactions.map((r) => ({ emoji: r.emoji ?? "heart", count: Number(r.n) })),
    topCommenters: commenters.map((c) => ({ name: c.name ?? "Ishtirokchi", count: Number(c.n) })),
    engagement: views > 0 ? Math.round(((post.likesCount + comments) / views) * 1000) / 10 : 0,
    createdAt: post.createdAt.getTime(),
  };
}
