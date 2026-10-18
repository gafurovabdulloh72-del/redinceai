import "server-only";
import { and, desc, eq, inArray, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { follows, specialists, userBlocks, users } from "@/lib/db/schema";
import { uid } from "@/lib/utils";

/**
 * Bloklash va maxfiylik qoidalari (ijtimoiy tarmoq 4-blok).
 * Blok ikki tomonlama ta'sir qiladi: bloklangan juftlik bir-biriga yoza olmaydi, obuna bo'la olmaydi,
 * profil postlariga izoh/reaksiya qo'ya olmaydi, lentada bir-birining postlarini ko'rmaydi, @eslatma yetmaydi.
 * Maxfiylik: dmPolicy (kim yozishi mumkin), commentPolicy (kim izoh yozadi), showOnline (onlayn nuqta/oxirgi faollik).
 */
export type DmPolicy = "all" | "following" | "none";
export type CommentPolicy = "all" | "followers" | "none";

/** Ikki foydalanuvchi orasida (istalgan yo'nalishda) blok bormi */
export async function isBlockedEither(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const row = await db.query.userBlocks.findFirst({
    where: or(and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)), and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a))),
    columns: { id: true },
  });
  return Boolean(row);
}

/** Blok holati: men bloklaganmanmi / u meni bloklaganmi */
export async function blockState(me: string, other: string): Promise<{ byMe: boolean; me: boolean }> {
  if (me === other) return { byMe: false, me: false };
  const rows = await db.query.userBlocks.findMany({
    where: or(and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, other)), and(eq(userBlocks.blockerId, other), eq(userBlocks.blockedId, me))),
    columns: { blockerId: true },
  });
  return { byMe: rows.some((r) => r.blockerId === me), me: rows.some((r) => r.blockerId === other) };
}

/** Bloklash: yozuv + ikki tomonlama obunani uzish (Instagram kabi) */
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) throw new ApiError(400, "O'zingizni bloklab bo'lmaydi");
  const target = await db.query.users.findFirst({ where: eq(users.id, blockedId), columns: { id: true } });
  if (!target) throw new ApiError(404, "Foydalanuvchi topilmadi");
  await db.transaction(async (tx) => {
    const dup = await tx.query.userBlocks.findFirst({ where: and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)), columns: { id: true } });
    if (!dup) await tx.insert(userBlocks).values({ id: uid(), blockerId, blockedId, createdAt: new Date() });
    await tx.delete(follows).where(or(and(eq(follows.followerId, blockerId), eq(follows.followingId, blockedId)), and(eq(follows.followerId, blockedId), eq(follows.followingId, blockerId))));
  });
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await db.delete(userBlocks).where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
}

export interface BlockedUserRow {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  slug: string | null;
  blockedAt: number;
}

/** Men bloklaganlar ro'yxati (kabinet → Xavfsizlik → Bloklanganlar) */
export async function listBlocked(me: string): Promise<BlockedUserRow[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, username: users.username, avatarUrl: users.avatarUrl, slug: specialists.slug, at: userBlocks.createdAt })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedId))
    .leftJoin(specialists, eq(specialists.userId, users.id))
    .where(eq(userBlocks.blockerId, me))
    .orderBy(desc(userBlocks.createdAt));
  return rows.map((r) => ({ id: r.id, name: r.name, username: r.username, avatarUrl: r.avatarUrl, slug: r.slug ?? null, blockedAt: r.at.getTime() }));
}

/** Lenta/qidiruv uchun: men bilan blok munosabatida bo'lgan barcha foydalanuvchilar (ikki yo'nalish) */
export async function blockedPeerIds(me: string): Promise<Set<string>> {
  const rows = await db.query.userBlocks.findMany({ where: or(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, me)), columns: { blockerId: true, blockedId: true } });
  return new Set(rows.map((r) => (r.blockerId === me ? r.blockedId : r.blockerId)));
}

/** SQL sharti: `column` blok juftligimdagi foydalanuvchilardan emas (lenta so'rovlari uchun) */
export function notBlockedCondition(column: SQLWrapper, me: string): SQL {
  return sql`${column} not in (select blocked_id from user_blocks where blocker_id = ${me} union select blocker_id from user_blocks where blocked_id = ${me})`;
}

/** Ro'yxatdan blok juftligidagilarni olib tashlash (eslatmalar, takliflar) */
export async function filterBlocked(me: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return ids;
  const rows = await db.query.userBlocks.findMany({
    where: or(and(eq(userBlocks.blockerId, me), inArray(userBlocks.blockedId, ids)), and(eq(userBlocks.blockedId, me), inArray(userBlocks.blockerId, ids))),
    columns: { blockerId: true, blockedId: true },
  });
  const bad = new Set(rows.map((r) => (r.blockerId === me ? r.blockedId : r.blockerId)));
  return ids.filter((id) => !bad.has(id));
}

async function followsExists(followerId: string, followingId: string): Promise<boolean> {
  const row = await db.query.follows.findFirst({ where: and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)), columns: { id: true } });
  return Boolean(row);
}

/**
 * Shaxsiy xabar yozish mumkinmi. Blok — har doim yo'q. dmPolicy: all — hamma; following — faqat qabul qiluvchi
 * obuna bo'lgan odamlar; none — hech kim. `existing=true` (suhbatda xabarlar bor) — siyosat yangi suhbatlarga tegishli, davom etadi.
 */
export async function assertCanDm(senderId: string, recipient: { id: string; dmPolicy: string }, existing = false): Promise<void> {
  if (await isBlockedEither(senderId, recipient.id)) throw new ApiError(403, "Bu foydalanuvchi bilan yozishish mumkin emas");
  if (existing) return;
  if (recipient.dmPolicy === "none") throw new ApiError(403, "Foydalanuvchi shaxsiy xabarlarni yopib qo'ygan");
  if (recipient.dmPolicy === "following" && !(await followsExists(recipient.id, senderId))) throw new ApiError(403, "Foydalanuvchiga faqat u obuna bo'lgan odamlar yoza oladi");
}

/** Profil postiga (jamoasiz) izoh/reaksiya: blok — yo'q; izohda muallifning commentPolicy'si */
export async function assertCanInteractProfilePost(actorId: string, authorId: string, kind: "comment" | "react"): Promise<void> {
  if (actorId === authorId) return;
  if (await isBlockedEither(actorId, authorId)) throw new ApiError(403, "Bu muallif bilan o'zaro amal mumkin emas");
  if (kind !== "comment") return;
  const author = await db.query.users.findFirst({ where: eq(users.id, authorId), columns: { commentPolicy: true } });
  if (!author) throw new ApiError(404, "Muallif topilmadi");
  if (author.commentPolicy === "none") throw new ApiError(403, "Muallif izohlarni yopib qo'ygan");
  if (author.commentPolicy === "followers" && !(await followsExists(actorId, authorId))) throw new ApiError(403, "Izohni faqat muallifning obunachilari yozadi — avval obuna bo'ling");
}
