import "server-only";
import { and, desc, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { followRequests, follows, users } from "@/lib/db/schema";
import { notify } from "@/lib/notifications";
import { uid } from "@/lib/utils";

/**
 * YOPIQ PROFIL (2026-11-04, Instagram «private account» naqshi).
 * `users.profile_private = true` bo'lsa: profil sarlavhasi va sonlar hammaga, lekin postlar/story/portfolio to'ri
 * faqat tasdiqlangan obunachilar (follows), egasi va adminga ko'rinadi. Obuna bo'lish — so'rov (`follow_requests`),
 * egasi Kabinet → Obunalar → So'rovlar'da tasdiqlaydi yoki rad etadi.
 */
type Viewer = { id: string; role: string } | null;

/** Ko'ruvchi yopiq profilning kontentini ko'ra oladimi (egasi / admin / tasdiqlangan obunachi) */
export async function canViewPrivateContent(viewer: Viewer, target: { id: string; profilePrivate: boolean }): Promise<boolean> {
  if (!target.profilePrivate) return true;
  if (!viewer) return false;
  if (viewer.id === target.id || viewer.role === "admin") return true;
  const row = await db.query.follows.findFirst({ where: and(eq(follows.followerId, viewer.id), eq(follows.followingId, target.id)), columns: { id: true } });
  return Boolean(row);
}

/**
 * SQL sharti (lenta/reels/qidiruv/story): `authorCol` yopiq profil emas, yoki ko'ruvchining o'zi, yoki ko'ruvchi unga obuna.
 * Admin — cheklovsiz. Subso'rovlar `users.profile_private` va `follows` (follower_id indeksli) bo'yicha — yopiq profillar kam.
 */
export function privateProfileCondition(authorCol: SQLWrapper, viewer: Viewer): SQL {
  if (viewer?.role === "admin") return sql`1 = 1`;
  const notPrivate = sql`${authorCol} not in (select u.id from users u where u.profile_private = 1)`;
  if (!viewer) return notPrivate;
  return sql`(${notPrivate} or ${authorCol} = ${viewer.id} or ${authorCol} in (select f.following_id from follows f where f.follower_id = ${viewer.id}))`;
}

/** Menga kelgan / men yuborgan so'rov bormi */
export async function hasFollowRequest(fromUserId: string, toUserId: string): Promise<boolean> {
  const row = await db.query.followRequests.findFirst({ where: and(eq(followRequests.fromUserId, fromUserId), eq(followRequests.toUserId, toUserId)), columns: { id: true } });
  return Boolean(row);
}

/** Yopiq profilga so'rov yuborish (idempotent): bor bo'lsa shunchaki `requested` */
export async function requestFollow(fromUserId: string, toUserId: string, fromName: string, href: string | null): Promise<{ status: "requested" }> {
  const dup = await db.query.followRequests.findFirst({ where: and(eq(followRequests.fromUserId, fromUserId), eq(followRequests.toUserId, toUserId)), columns: { id: true } });
  if (!dup) {
    await db.insert(followRequests).values({ id: uid(), fromUserId, toUserId, createdAt: new Date() });
    await notify(toUserId, "follow", `${fromName} sizga obuna bo'lishni so'radi`, "Kabinet → Obunalar → So'rovlar bo'limida tasdiqlang yoki rad eting.", "/kabinet/obunalar?tab=sorovlar").catch(() => undefined);
  }
  return { status: "requested" };
}

export async function cancelFollowRequest(fromUserId: string, toUserId: string): Promise<void> {
  await db.delete(followRequests).where(and(eq(followRequests.fromUserId, fromUserId), eq(followRequests.toUserId, toUserId)));
}

export interface FollowRequestRow {
  id: string;
  createdAt: number;
  from: { id: string; name: string; username: string | null; avatarUrl: string | null; slug: string | null };
}

/** Egasiga kelgan so'rovlar (Kabinet → Obunalar → So'rovlar) */
export async function listFollowRequests(toUserId: string, limit = 100): Promise<FollowRequestRow[]> {
  const rows = await db.query.followRequests.findMany({ where: eq(followRequests.toUserId, toUserId), orderBy: [desc(followRequests.createdAt)], limit });
  if (!rows.length) return [];
  const { briefUsers } = await import("@/lib/groups/service");
  const brief = await briefUsers(rows.map((r) => r.fromUserId));
  return rows.map((r) => {
    const u = brief.get(r.fromUserId);
    return { id: r.id, createdAt: r.createdAt.getTime(), from: { id: r.fromUserId, name: u?.name ?? "Foydalanuvchi", username: u?.username ?? null, avatarUrl: u?.avatarUrl ?? null, slug: u?.slug ?? null } };
  });
}

export async function countFollowRequests(toUserId: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(followRequests).where(eq(followRequests.toUserId, toUserId));
  return Number(row?.n ?? 0);
}

/**
 * So'rovni hal qilish — faqat egasi (toUserId = me). Tasdiq: `follows` yoziladi (CAS: so'rov o'chirilgan bo'lsa 404),
 * so'ragan odamga `follow` bildirishnomasi; rad: so'rov jimgina o'chadi.
 */
export async function decideFollowRequest(me: string, requestId: string, approve: boolean): Promise<{ approved: boolean }> {
  const req = await db.query.followRequests.findFirst({ where: and(eq(followRequests.id, requestId), eq(followRequests.toUserId, me)) });
  if (!req) throw new ApiError(404, "So'rov topilmadi");
  await db.transaction(async (tx) => {
    const del = await tx.delete(followRequests).where(eq(followRequests.id, req.id));
    if (del.rowsAffected === 0) throw new ApiError(404, "So'rov topilmadi");
    if (!approve) return;
    const existing = await tx.query.follows.findFirst({ where: and(eq(follows.followerId, req.fromUserId), eq(follows.followingId, me)), columns: { id: true } });
    if (!existing) await tx.insert(follows).values({ id: uid(), followerId: req.fromUserId, followingId: me, createdAt: new Date() });
  });
  if (approve) {
    const owner = await db.query.users.findFirst({ where: eq(users.id, me), columns: { name: true, username: true } });
    const { briefUsers } = await import("@/lib/groups/service");
    const b = (await briefUsers([me])).get(me);
    const href = b?.slug ? `/mutaxassislar/${b.slug}` : owner?.username ? `/yozish/${owner.username}` : null;
    await notify(req.fromUserId, "follow", `${owner?.name ?? "Foydalanuvchi"} obuna so'rovingizni tasdiqladi`, "Endi uning postlari va story'lari sizga ko'rinadi.", href).catch(() => undefined);
  }
  return { approved: approve };
}
