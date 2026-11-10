import "server-only";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers, groupMessages, groups, posts, users, type FileAttachment } from "@/lib/db/schema";
import { quoteKind, type QuoteView } from "./quote";

/**
 * YAGONA CHAT INBOX (Telegram uslubi, 2026-11-01): «Chat» bo'limida shaxsiy suhbatlar bilan
 * bir qatorda men a'zo bo'lgan GURUHLAR va KANALLAR ham turadi. Bu fayl guruh/kanal qatorlarini
 * beradi (DM qatorlari — dm.ts `listConversations`); mijoz ikkalasini bitta ro'yxatga qo'shib,
 * qadalganlar tepada, qolganlar oxirgi faollik bo'yicha saralaydi.
 * Oxirgi xabar: guruh uchun — chatdagi oxirgi xabar, kanal uchun — oxirgi post.
 * O'qilmaganlar: `group_members.lastReadAt` dan keyingi xabarlar (guruh) / postlar (kanal) soni.
 * Papka/pin: `group_members.folderId/pinnedAt` — DM papkalari (dm_folders) bilan umumiy papkalar.
 */

export interface GroupInboxRow {
  kind: "group" | "channel";
  /** groups.id — pin/papka PATCH shu bo'yicha */
  id: string;
  slug: string;
  name: string;
  coverUrl: string | null;
  isOfficial: boolean;
  membersCount: number;
  /** `kind` — biriktirma turi (matn bo'lmasa parchada «Rasm» / «Video» / «Fayl» / «Ovozli xabar» chiqadi) */
  last: { body: string; at: number; by: string | null; hasFiles: boolean; kind: QuoteView["kind"] } | null;
  /** Kanal uchun: oxirgi post id (qator bosilganda to'g'ridan o'sha post ochiladi, kamchilik #2) */
  lastPostId?: string | null;
  unread: number;
  muted: boolean;
  pinned: boolean;
  folderId: string | null;
  /** Ko'ruvchi bu jamoani boshqaradimi (egasi/admin) — panelda Sozlash tugmasi uchun */
  canManage: boolean;
  /** Ko'ruvchi egasimi — egasi «Chiqish»ni ko'rmaydi (jamoadan chiqa olmaydi) */
  isOwner: boolean;
  /** Chat ro'yxatida arxivlangan (faqat o'z a'zoligim sozlamasi) */
  archived: boolean;
  /** Hozir yozayotgan a'zo nomi (kamchilik #3) — keshdan tashqari, har so'rovda yangi hisoblanadi */
  typing?: string | null;
}

/**
 * Guruhlarimda hozir yozayotganlar (kamchilik #3): group_members.typingAt oxirgi 6 soniyada
 * yangilangan a'zolar (o'zimdan boshqa). Inbox keshi 60 s bo'lgani uchun bu ALOHIDA, arzon
 * so'rov — /api/chat har chaqirilganda yangi bajariladi va qatorlarga qo'shiladi.
 */
export async function groupTypingNames(meId: string): Promise<Map<string, string>> {
  const since = new Date(Date.now() - 6000);
  const rows = await db
    .select({ groupId: groupMembers.groupId, name: users.name })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(gt(groupMembers.typingAt, since), sql`${groupMembers.userId} != ${meId}`, eq(groupMembers.status, "active"), sql`${groupMembers.groupId} in (select group_id from group_members gm2 where gm2.user_id = ${meId} and gm2.status = 'active')`))
    .limit(30);
  const out = new Map<string, string>();
  for (const r of rows) if (!out.has(r.groupId)) out.set(r.groupId, r.name);
  return out;
}

/**
 * Kesh (60 s): /api/chat har 20 soniyada so'raladi va har safar 4-5 ta so'rov ketardi.
 * Kesh urilganda faqat bitta arzon tekshiruv (a'zoliklarim bo'yicha eng so'nggi faollik) bajariladi —
 * yangi xabar/post kelgan zahoti (lastActivityAt oshadi) kesh o'z-o'zidan eskiradi, shuning uchun
 * yangi xabarlar kechikmaydi. O'zim o'qisam/pin qilsam `bustGroupInbox` darhol tozalaydi.
 * Serverless'da instansiya ichidagi Map — eng yomoni bir instansiyada 60 s eski mute holati.
 */
const inboxCache = new Map<string, { at: number; key: string; rows: GroupInboxRow[] }>();
const INBOX_TTL_MS = 60_000;

/** Foydalanuvchining guruh-inbox keshini bekor qilish (o'qildi/pin/papka/a'zolik o'zgarganda) */
export function bustGroupInbox(userId: string) {
  inboxCache.delete(userId);
}

/**
 * Kesh kaliti — bitta arzon so'rov: a'zoliklarim bo'yicha eng so'nggi guruh faolligi + a'zoliklar «imzosi»
 * (nechta faol a'zolik va eng oxirgisi qachon qo'shilgan). Imzo tufayli qo'shilish / chiqish / so'rov tasdiqlanishi
 * keshni darhol eskirtadi (bu amallar boshqa modulda — u yerdan `bustGroupInbox` chaqirilmaydi).
 */
async function inboxKey(meId: string): Promise<string> {
  const [r] = await db
    .select({
      act: sql<number | null>`max(coalesce(${groups.lastActivityAt}, ${groups.createdAt}))`,
      n: sql<number>`count(*)`,
      joined: sql<number | null>`max(${groupMembers.createdAt})`,
      members: sql<number | null>`sum(${groups.membersCount})`,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.userId, meId), eq(groupMembers.status, "active")));
  return `${Number(r?.act ?? 0)}:${Number(r?.n ?? 0)}:${Number(r?.joined ?? 0)}:${Number(r?.members ?? 0)}`;
}

/** Faollik qismi (ms) — SSE kuzatuvchisi «inbox» hodisasi uchun ham shu kalitni ishlatadi */
export const groupInboxKey = inboxKey;

export async function listGroupInbox(meId: string): Promise<GroupInboxRow[]> {
  const cached = inboxCache.get(meId);
  const key = await inboxKey(meId);
  if (cached && Date.now() - cached.at < INBOX_TTL_MS && key === cached.key) return cached.rows;
  const rows = await db
    .select({
      id: groups.id,
      slug: groups.slug,
      name: groups.name,
      kind: groups.kind,
      coverUrl: groups.coverUrl,
      isOfficial: groups.isOfficial,
      membersCount: groups.membersCount,
      lastActivityAt: groups.lastActivityAt,
      createdAt: groups.createdAt,
      lastReadAt: groupMembers.lastReadAt,
      role: groupMembers.role,
      archivedAt: groupMembers.archivedAt,
      muted: groupMembers.muted,
      mutedUntil: groupMembers.mutedUntil,
      folderId: groupMembers.folderId,
      pinnedAt: groupMembers.pinnedAt,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.userId, meId), eq(groupMembers.status, "active")))
    .orderBy(desc(sql`coalesce(${groups.lastActivityAt}, ${groups.createdAt})`))
    .limit(80);
  if (!rows.length) return [];

  const groupIds = rows.filter((r) => r.kind === "group").map((r) => r.id);
  const channelIds = rows.filter((r) => r.kind === "channel").map((r) => r.id);

  // Oxirgi xabar (guruhlar) — har guruh uchun eng so'nggi o'chirilmagan xabar, bitta so'rovda
  const lastMsgs = groupIds.length
    ? await db
        .select({ groupId: groupMessages.groupId, body: groupMessages.body, at: groupMessages.createdAt, by: users.name, files: groupMessages.attachments })
        .from(groupMessages)
        .innerJoin(users, eq(users.id, groupMessages.senderId))
        .where(and(inArray(groupMessages.groupId, groupIds), isNull(groupMessages.deletedAt), sql`${groupMessages.id} in (select id from group_messages m2 where m2.group_id = ${groupMessages.groupId} and m2.deleted_at is null order by m2.created_at desc limit 1)`))
        .limit(groupIds.length * 2)
    : [];
  // Oxirgi post (kanallar)
  const lastPosts = channelIds.length
    ? await db
        // Obunachilarga yopiq (pullik) post matni ro'yxatdagi parchada CHIQMAYDI — kanalning har a'zosi obunachi emas (7-audit);
        // shikoyat bilan yashirilgan post matni ham ko'rsatilmaydi
        .select({ groupId: posts.groupId, postId: posts.id, body: sql<string>`case when ${posts.subscribersOnly} = 1 then '🔒 Obunachilar uchun post' when ${posts.hiddenByReports} = 1 then '' else ${posts.body} end`, at: posts.createdAt, by: users.name, files: posts.media, locked: sql<number>`case when ${posts.subscribersOnly} = 1 or ${posts.hiddenByReports} = 1 then 1 else 0 end` })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .where(and(inArray(posts.groupId, channelIds), sql`${posts.id} in (select id from posts p2 where p2.group_id = ${posts.groupId} order by p2.created_at desc limit 1)`))
        .limit(channelIds.length * 2)
    : [];
  const lastBy = new Map<string, NonNullable<GroupInboxRow["last"]>>();
  const lastPostBy = new Map<string, string>();
  const put = (groupId: string | null, body: string, atDate: Date, by: string | null, files: FileAttachment[] | null) => {
    if (!groupId) return;
    const prev = lastBy.get(groupId);
    const at = atDate.getTime();
    const list = files ?? [];
    if (!prev || at > prev.at) lastBy.set(groupId, { body, at, by, hasFiles: list.length > 0, kind: quoteKind(list) });
  };
  for (const m of lastMsgs) put(m.groupId, m.body, m.at, m.by, m.files);
  // Yopiq/yashirilgan post biriktirmalari parchada ham ko'rinmaydi
  for (const m of lastPosts) put(m.groupId, m.body, m.at, m.by, Number(m.locked) ? [] : m.files);
  for (const m of lastPosts) if (m.groupId) lastPostBy.set(m.groupId, m.postId);

  // O'qilmaganlar — lastReadAt'dan keyingilar (guruh: xabarlar, kanal: postlar), guruhlangan sanash
  const unread = new Map<string, number>();
  if (groupIds.length) {
    const r = await db
      .select({ gid: groupMessages.groupId, n: sql<number>`count(*)` })
      .from(groupMessages)
      .innerJoin(groupMembers, and(eq(groupMembers.groupId, groupMessages.groupId), eq(groupMembers.userId, meId)))
      .where(and(inArray(groupMessages.groupId, groupIds), isNull(groupMessages.deletedAt), sql`${groupMessages.senderId} != ${meId}`, gt(groupMessages.createdAt, sql`coalesce(${groupMembers.lastReadAt}, 0)`)))
      .groupBy(groupMessages.groupId);
    for (const x of r) unread.set(x.gid, Number(x.n));
  }
  if (channelIds.length) {
    const r = await db
      .select({ gid: posts.groupId, n: sql<number>`count(*)` })
      .from(posts)
      .innerJoin(groupMembers, and(eq(groupMembers.groupId, posts.groupId), eq(groupMembers.userId, meId)))
      .where(and(inArray(posts.groupId, channelIds), sql`${posts.authorId} != ${meId}`, gt(posts.createdAt, sql`coalesce(${groupMembers.lastReadAt}, 0)`)))
      .groupBy(posts.groupId);
    for (const x of r) if (x.gid) unread.set(x.gid, Number(x.n));
  }

  const nowMs = Date.now();
  const out: GroupInboxRow[] = rows.map((r) => ({
    kind: r.kind === "channel" ? "channel" : "group",
    id: r.id,
    slug: r.slug,
    name: r.name,
    coverUrl: r.coverUrl,
    isOfficial: Boolean(r.isOfficial),
    membersCount: r.membersCount,
    last: lastBy.get(r.id) ?? null,
    lastPostId: lastPostBy.get(r.id) ?? null,
    unread: Math.min(unread.get(r.id) ?? 0, 999),
    // Vaqtincha jim (mutedUntil) ham «ovozsiz» — nishon hisobiga kirmaydi
    muted: Boolean(r.muted) || Boolean(r.mutedUntil && r.mutedUntil.getTime() > nowMs),
    pinned: Boolean(r.pinnedAt),
    folderId: r.folderId,
    canManage: r.role === "owner" || r.role === "admin",
    isOwner: r.role === "owner",
    archived: Boolean(r.archivedAt),
  }));
  // Xotira chegarasi: juda ko'p foydalanuvchi yig'ilib qolmasin
  if (inboxCache.size > 1000) inboxCache.clear();
  inboxCache.set(meId, { at: Date.now(), key, rows: out });
  return out;
}

/** Guruh/kanal qatorining chat sozlamasi: qadash yoki papkaga ko'chirish (faqat o'z a'zoligim) */
export async function setGroupChatPref(meId: string, groupId: string, patch: { pinned?: boolean; folderId?: string | null; muted?: boolean; archived?: boolean }): Promise<boolean> {
  const set: Record<string, unknown> = {};
  if (patch.pinned !== undefined) set.pinnedAt = patch.pinned ? new Date() : null;
  if (patch.archived !== undefined) set.archivedAt = patch.archived ? new Date() : null;
  if (patch.folderId !== undefined) set.folderId = patch.folderId;
  if (patch.muted !== undefined) set.muted = patch.muted;
  if (!Object.keys(set).length) return true;
  const res = await db
    .update(groupMembers)
    .set(set)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, meId), eq(groupMembers.status, "active")));
  bustGroupInbox(meId);
  return (res.rowsAffected ?? 0) > 0;
}
