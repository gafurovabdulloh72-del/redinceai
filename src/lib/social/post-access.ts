import "server-only";
import { and, eq, gt, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { closeFriends, groups, mentors, mentorSubs, posts, users, type Group, type Post } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { postNotHiddenCondition } from "@/lib/moderation";
import { canViewPrivateContent, privateProfileCondition } from "@/lib/privacy/private-profile";
import { isBlockedEither } from "@/lib/privacy/blocks";

/**
 * POSTNI KO'RISH HUQUQI — YAGONA MANBA (7-audit, 2026-11-10).
 *
 * Ilgari har yo'l o'zicha tekshirardi: lenta va profil ro'yxati «yaqin do'stlar» / yopiq profil / shikoyat bilan yashirilgan
 * postlarni to'g'ri yashirardi, lekin Reels, qidiruv va post ID'si bo'yicha ishlaydigan yo'llar (saqlash, «keyinroq»,
 * to'plam, izohlar, reaksiyalar) faqat jamoa yopiqligini tekshirardi — ID'ni bilgan odam yopiq postni o'qiy olardi.
 *
 * QOIDA: post ID'si yoki postlar ro'yxati bilan ishlaydigan YANGI yo'l yozsangiz —
 *   bitta post  → `assertCanViewPost(post, viewer)` (ko'ra olmasa 404/403),
 *   ro'yxat     → `where`ga `postVisibility(viewer)` qo'shing (profil postlari uchun auditoriya + yopiq profil + yashirilgan).
 * Jamoa postining yopiqligi (a'zolik) ro'yxatlarda alohida shart bilan beriladi (groups.isPrivate / a'zolik) — bu yerda emas.
 */
type Viewer = { id: string; role: string } | null;

/** «Yaqin do'stlar» auditoriyasi (SQL): ochiq post, o'ziniki, yoki ko'ruvchi muallifning yaqin do'stlari ro'yxatida. Admin — cheklovsiz. */
export function postAudienceCondition(viewer: Viewer): SQL {
  if (viewer?.role === "admin") return sql`1 = 1`;
  if (!viewer) return eq(posts.audience, "public");
  return or(eq(posts.audience, "public"), eq(posts.authorId, viewer.id), sql`${posts.authorId} in (select cf.owner_id from close_friends cf where cf.friend_id = ${viewer.id})`)!;
}

/**
 * Ro'yxatlar uchun to'liq ko'rinish sharti: shikoyat bilan yashirilgan emas (muallif/admin ko'radi) VA
 * (jamoa posti YOKI profil posti: yopiq profil qoidasi + auditoriya).
 */
export function postVisibility(viewer: Viewer): SQL {
  return and(postNotHiddenCondition(viewer), or(isNotNull(posts.groupId), and(privateProfileCondition(posts.authorId, viewer), postAudienceCondition(viewer)))!)!;
}

type PostLike = Pick<Post, "id" | "groupId" | "authorId" | "audience" | "hiddenByReports">;

/**
 * Bitta postni ko'ruvchi ko'ra oladimi. Ko'ra olmasa — xato: profil posti uchun har doim 404 (mavjudligi ham oshkor
 * bo'lmaydi), yopiq jamoa posti uchun mavjud `assertCanView` xatosi (403). Jamoa posti bo'lsa jamoani qaytaradi.
 */
export async function assertCanViewPost(post: PostLike, viewer: Viewer): Promise<Group | null> {
  const notFound = () => new ApiError(404, "Post topilmadi");
  const own = Boolean(viewer && (viewer.id === post.authorId || viewer.role === "admin"));
  if (post.groupId) {
    const group = await db.query.groups.findFirst({ where: eq(groups.id, post.groupId) });
    if (!group) throw new ApiError(404, "Jamoa topilmadi");
    const { assertCanView } = await import("@/lib/groups/service");
    await assertCanView(group, viewer);
    if (post.hiddenByReports && !own) throw notFound();
    return group;
  }
  if (own) return null;
  if (post.hiddenByReports) throw notFound();
  const author = await db.query.users.findFirst({ where: eq(users.id, post.authorId), columns: { id: true, profilePrivate: true, isBanned: true } });
  if (!author || author.isBanned) throw notFound();
  if (post.audience === "close") {
    if (!viewer) throw notFound();
    const cf = await db.query.closeFriends.findFirst({ where: and(eq(closeFriends.ownerId, post.authorId), eq(closeFriends.friendId, viewer.id)), columns: { id: true } });
    if (!cf) throw notFound();
  }
  if (!(await canViewPrivateContent(viewer, author))) throw notFound();
  if (viewer && (await isBlockedEither(viewer.id, post.authorId))) throw notFound();
  return null;
}

/** `assertCanViewPost`ning xato tashlamaydigan ko'rinishi */
export async function canViewPost(post: PostLike, viewer: Viewer): Promise<boolean> {
  try {
    await assertCanViewPost(post, viewer);
    return true;
  } catch (e) {
    if (e instanceof ApiError) return false;
    throw e;
  }
}

/**
 * Obunachilarga yopiq (pullik) post ko'ruvchi uchun QULFmi — `toPostViews` bilan bir xil qoida: muallif, admin, kanal
 * boshqaruvchisi yoki faol ustoz obunachisi ochiq ko'radi. Qulf bo'lsa matn/media/muqova HECH QAYERGA berilmasligi kerak.
 */
export async function isPostLocked(post: Pick<Post, "groupId" | "authorId" | "subscribersOnly">, viewer: Viewer): Promise<boolean> {
  if (!post.subscribersOnly || !post.groupId) return false;
  if (!viewer) return true;
  if (viewer.id === post.authorId || viewer.role === "admin") return false;
  const { getMembership } = await import("@/lib/groups/service");
  const mem = await getMembership(post.groupId, viewer.id);
  if (mem && mem.status === "active" && (mem.role === "owner" || mem.role === "admin")) return false;
  const mentor = await db.query.mentors.findFirst({ where: eq(mentors.channelId, post.groupId), columns: { id: true } });
  if (!mentor) return true;
  const sub = await db.query.mentorSubs.findFirst({ where: and(eq(mentorSubs.userId, viewer.id), eq(mentorSubs.mentorId, mentor.id), gt(mentorSubs.until, new Date())), columns: { id: true } });
  return !sub;
}

/**
 * Route'lar uchun: postni ID bo'yicha yuklaydi va KO'RISH huquqini tekshiradi (yo'q/yashirin/begona yopiq → 404, yopiq jamoa → 403).
 * `unlocked: true` — obunachilarga yopiq (pullik) post qulf bo'lsa 403: izoh/reaksiya ro'yxati ham kontent hisoblanadi.
 */
export async function loadViewablePost(id: string, viewer: Viewer, opts: { unlocked?: boolean } = {}): Promise<{ post: Post; group: Group | null }> {
  const { loadPost } = await import("@/lib/groups/service");
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  const group = await assertCanViewPost(post, viewer);
  if (opts.unlocked && (await isPostLocked(post, viewer))) throw new ApiError(403, "Bu post faqat obunachilar uchun");
  return { post, group };
}
