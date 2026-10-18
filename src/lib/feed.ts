import "server-only";
import { and, desc, eq, gt, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { follows, groupMembers, groups, postSaves, posts, specialists, users, type Post } from "@/lib/db/schema";
import { briefUsers, listGroups, toPostViews, upcomingEvents, type GroupListItem, type PostView } from "@/lib/groups/service";
import { getSettings } from "@/lib/payments/settings";
import { listableCondition } from "@/lib/subscriptions/access";
import { listVacancies, type VacancyCard } from "@/lib/vacancies/service";
import { vacancyFilterSchema } from "@/lib/vacancies/validators";
import { notBlockedCondition } from "@/lib/privacy/blocks";

/**
 * Bosh sahifa lentasi (ijtimoiy tarmoq): profil postlari (groupId = null) va ochiq jamoalar/kanallar postlari bir oqimda.
 * scope "following" — faqat obuna bo'lingan ijodkorlar va a'zo bo'lingan jamoalar. Bloklangan mualliflar chiqmaydi.
 */
type Viewer = { id: string; role: string } | null;
export type FeedScope = "all" | "following";
export interface FeedItem extends PostView {
  group: { slug: string; name: string; kind: "group" | "channel"; isOfficial: boolean } | null;
  /** Yoqtirish/izoh mumkinmi: profil posti — kirgan har kim; jamoa posti — faol a'zo (sayt admini ham) */
  canInteract: boolean;
}
export interface FeedPage {
  items: FeedItem[];
  nextCursor: number | null;
}

export async function homeFeed(viewer: Viewer, opts: { cursor?: number | null; limit?: number; scope?: FeedScope } = {}): Promise<FeedPage> {
  const limit = Math.min(30, Math.max(1, opts.limit ?? 10));
  const scope: FeedScope = opts.scope === "following" && viewer ? "following" : "all";
  const conds: SQL[] = [eq(users.isBanned, false), or(isNull(posts.groupId), eq(groups.isPrivate, false))!];
  // Blok: men bloklagan / meni bloklagan mualliflarning postlari lentada chiqmaydi
  if (viewer) conds.push(notBlockedCondition(posts.authorId, viewer.id));
  if (scope === "following" && viewer) {
    const followed = db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, viewer.id));
    const myGroups = db.select({ id: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.userId, viewer.id), eq(groupMembers.status, "active")));
    conds.push(or(inArray(posts.authorId, followed), inArray(posts.groupId, myGroups))!);
  }
  if (opts.cursor) conds.push(lt(posts.createdAt, new Date(opts.cursor)));

  const rows = await db
    .select({ p: posts, gslug: groups.slug, gname: groups.name, gkind: groups.kind, goff: groups.isOfficial })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(groups, eq(groups.id, posts.groupId))
    .where(and(...conds))
    .orderBy(desc(posts.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const items = await toFeedItems(page, viewer);
  return { items, nextCursor: rows.length > limit ? page[page.length - 1].p.createdAt.getTime() : null };
}

type FeedRow = { p: Post; gslug: string | null; gname: string | null; gkind: "group" | "channel" | null; goff: boolean | null };

/** Post qatorlari → lenta elementlari (manba chipi + canInteract: profil posti — kirgan har kim; jamoa posti — faol a'zo/admin) */
async function toFeedItems(page: FeedRow[], viewer: Viewer): Promise<FeedItem[]> {
  const isAdmin = viewer?.role === "admin";
  const groupIds = Array.from(new Set(page.map((r) => r.p.groupId).filter((x): x is string => Boolean(x))));
  const [views, memberships] = await Promise.all([
    toPostViews(
      page.map((r) => r.p),
      viewer,
      isAdmin,
    ),
    viewer && groupIds.length
      ? db.query.groupMembers.findMany({ where: and(eq(groupMembers.userId, viewer.id), eq(groupMembers.status, "active"), inArray(groupMembers.groupId, groupIds)), columns: { groupId: true } })
      : Promise.resolve([] as Array<{ groupId: string }>),
  ]);
  const member = new Set(memberships.map((m) => m.groupId));
  return views.map((v, i) => {
    const r = page[i];
    const group = r.p.groupId && r.gslug && r.gname ? { slug: r.gslug, name: r.gname, kind: (r.gkind ?? "group") as "group" | "channel", isOfficial: Boolean(r.goff) } : null;
    return { ...v, group, canInteract: Boolean(viewer) && (!group || isAdmin || member.has(r.p.groupId!)) };
  });
}

/**
 * Saqlangan postlar (bookmark): yangi saqlangan → eski, cursor = post_saves.createdAt (ms).
 * Yopiq jamoadan chiqib ketilgan bo'lsa, u yerdagi saqlangan post ko'rinmaydi (kontent sizmaydi).
 */
export async function listSavedPosts(viewer: NonNullable<Viewer>, opts: { cursor?: number | null; limit?: number } = {}): Promise<FeedPage> {
  const limit = Math.min(30, Math.max(1, opts.limit ?? 10));
  const myGroups = db.select({ id: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.userId, viewer.id), eq(groupMembers.status, "active")));
  const conds: SQL[] = [eq(postSaves.userId, viewer.id), eq(users.isBanned, false)];
  if (viewer.role !== "admin") conds.push(or(isNull(posts.groupId), eq(groups.isPrivate, false), inArray(posts.groupId, myGroups))!);
  if (opts.cursor) conds.push(lt(postSaves.createdAt, new Date(opts.cursor)));
  const rows = await db
    .select({ p: posts, gslug: groups.slug, gname: groups.name, gkind: groups.kind, goff: groups.isOfficial, savedAt: postSaves.createdAt })
    .from(postSaves)
    .innerJoin(posts, eq(posts.id, postSaves.postId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(groups, eq(groups.id, posts.groupId))
    .where(and(...conds))
    .orderBy(desc(postSaves.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const items = await toFeedItems(page, viewer);
  return { items, nextCursor: rows.length > limit ? page[page.length - 1].savedAt.getTime() : null };
}

/** "Hikoyalar" qatori: so'nggi 7 kunda post joylagan ijodkorlar (profil sahifasi borlar), eng yangisi birinchi */
export interface StoryAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  slug: string;
  latestAt: number;
}
export async function storyAuthors(limit = 14): Promise<StoryAuthor[]> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const rows = await db
    .select({ authorId: posts.authorId, latest: sql<number>`max(${posts.createdAt})` })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(gt(posts.createdAt, since), eq(users.isBanned, false)))
    .groupBy(posts.authorId)
    .orderBy(desc(sql`max(${posts.createdAt})`))
    .limit(limit * 2);
  const brief = await briefUsers(rows.map((r) => r.authorId));
  return rows
    .map((r) => {
      const u = brief.get(r.authorId);
      return u?.slug ? { id: r.authorId, name: u.name, avatarUrl: u.avatarUrl, slug: u.slug, latestAt: Number(r.latest) } : null;
    })
    .filter((x): x is StoryAuthor => x !== null)
    .slice(0, limit);
}

/** O'ng panel: tavsiya etiladigan ijodkorlar (ko'rinadigan, reytingi yuqori), obuna holati bilan */
export interface SuggestedCreator {
  userId: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  title: string;
  category: string;
  isVerified: boolean;
  following: boolean;
  followers: number;
}
export async function suggestedCreators(viewer: Viewer, limit = 5): Promise<SuggestedCreator[]> {
  const settings = await getSettings();
  const rows = await db
    .select({ userId: specialists.userId, slug: specialists.slug, title: specialists.title, category: specialists.category, isVerified: specialists.isVerified, name: users.name, avatarUrl: users.avatarUrl })
    .from(specialists)
    .innerJoin(users, eq(users.id, specialists.userId))
    .where(and(eq(users.isBanned, false), eq(specialists.isHidden, false), listableCondition(settings), viewer ? sql`${specialists.userId} != ${viewer.id}` : undefined))
    .orderBy(desc(specialists.isFeatured), desc(specialists.rating), desc(specialists.reviewCount))
    .limit(limit + 6);
  const ids = rows.map((r) => r.userId);
  if (!ids.length) return [];
  const [mine, counts] = await Promise.all([
    viewer ? db.query.follows.findMany({ where: and(eq(follows.followerId, viewer.id), inArray(follows.followingId, ids)), columns: { followingId: true } }) : Promise.resolve([] as Array<{ followingId: string }>),
    db.select({ id: follows.followingId, n: sql<number>`count(*)` }).from(follows).where(inArray(follows.followingId, ids)).groupBy(follows.followingId),
  ]);
  const followed = new Set(mine.map((m) => m.followingId));
  const count = new Map(counts.map((c) => [c.id, Number(c.n)]));
  // Obuna bo'lmaganlar birinchi
  return rows
    .map((r) => ({ ...r, following: followed.has(r.userId), followers: count.get(r.userId) ?? 0 }))
    .sort((a, b) => Number(a.following) - Number(b.following))
    .slice(0, limit);
}

export interface RailData {
  creators: SuggestedCreator[];
  groups: GroupListItem[];
  vacancies: VacancyCard[];
  official: { group: GroupListItem; next: PostView | null } | null;
}
/** O'ng panel ma'lumotlari — hammasi parallel, biri yiqilsa bo'sh qaytadi */
export async function railData(viewer: Viewer): Promise<RailData> {
  const [creators, grp, vac, off] = await Promise.all([
    suggestedCreators(viewer, 5).catch(() => []),
    listGroups({ official: false, sort: "members", limit: 4 }, viewer).catch(() => []),
    listVacancies(vacancyFilterSchema.parse({ limit: 3 }))
      .then((r) => r.items)
      .catch(() => []),
    listGroups({ official: true, limit: 1 }, viewer).catch(() => []),
  ]);
  const g = off[0] ?? null;
  const next = g ? await upcomingEvents(g.id, viewer, 1).then((e) => e[0] ?? null).catch(() => null) : null;
  return { creators, groups: grp, vacancies: vac, official: g ? { group: g, next } : null };
}
