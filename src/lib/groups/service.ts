import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, like, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { follows, groupMembers, groupMessages, groups, notifications, postComments, postLikes, postSaves, postViews, posts, specialists, users, type FileAttachment, type Group, type GroupMember, type Post, type PostComment } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { translit, uid } from "@/lib/utils";
import type { GroupInput } from "./validators";
import { REACTION_BY_KEY, REACTION_KINDS, type ReactionKind } from "./limits";
import { notifyMentions } from "./mentions";
import { TYPING_WINDOW_MS, toQuote, type QuoteView } from "@/lib/chat/quote";
import { isBlockedEither } from "@/lib/privacy/blocks";

/**
 * Jamoalar — ijodkorlar hamjamiyati: guruhlar, a'zolik, lenta (post/like/izoh), guruh chati, obuna (follow).
 * Barcha egalik tekshiruvlari shu yerda; route'lar faqat sessiya + validatsiya + limit bilan shug'ullanadi.
 * Sayt admini (role=admin) har qanday jamoada moderator huquqiga ega (shikoyatlar uchun).
 */

/* ------------------------------------------------------------------ */
/* DTO                                                                 */
/* ------------------------------------------------------------------ */
export interface UserBrief {
  id: string;
  name: string;
  avatarUrl: string | null;
  username: string | null;
  /** Mutaxassis profili slug'i (bor bo'lsa) — ismga bosilganda profilga o'tadi */
  slug: string | null;
  /** So'nggi 5 daqiqada faol bo'lgan (lastSeenAt) — yashil nuqta */
  online: boolean;
}

export type MembershipState = "owner" | "admin" | "member" | "pending" | "banned" | null;

export interface GroupView {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string | null;
  region: string | null;
  coverUrl: string | null;
  isPrivate: boolean;
  /** group — hamma a'zo yozadi; channel — faqat egasi/adminlar yozadi */
  kind: "group" | "channel";
  /** Rasmiy kanal: hamma avtomatik a'zo, tepada qadalgan, chiqib bo'lmaydi */
  isOfficial: boolean;
  membersCount: number;
  postsCount: number;
  pendingCount: number;
  lastActivityAt: number | null;
  createdAt: number;
  owner: UserBrief;
  membership: MembershipState;
  /** Ko'ruvchi boshqara oladimi (egasi/admin yoki sayt admini) */
  canManage: boolean;
  /** Ko'ruvchi lentani/chatni ko'ra oladimi (ochiq jamoa — hamma; yopiq — faqat faol a'zo/moderator) */
  canView: boolean;
  /** Post yoza oladimi: guruhda — faol a'zo; kanalda — faqat egasi/adminlar (sayt admini ham) */
  canPost: boolean;
  /** Taklif kodi — faqat boshqaruvchilarga qaytadi */
  inviteCode: string | null;
  /** Taklif havolasi muddati/limiti/ishlatilgani — faqat boshqaruvchilarga */
  invite: { expiresAt: number | null; maxUses: number | null; uses: number } | null;
  /** Ko'ruvchi bildirishnomalarni o'chirganmi (doimiy yoki `mutedUntil`gacha) */
  muted: boolean;
  mutedUntil: number | null;
  /** Efir eslatmalari yoqilganmi (a'zo sozlamasi) */
  eventReminders: boolean;
  /** Jamoa qoidalari (markdown-lite) — hammaga */
  rules: string | null;
  /** Xush kelibsiz matni — faqat boshqaruvchilarga */
  welcomeText: string | null;
  /** Muqova vertikal joylashuvi (0–100), null = markaz */
  coverPosition: number | null;
  /** Chatda qadalgan xabar id'si */
  pinnedMessageId: string | null;
}

export interface PostView {
  id: string;
  groupId: string | null;
  body: string;
  media: FileAttachment[];
  likesCount: number;
  commentsCount: number;
  /** Ko'rishlar soni (noyob, kuniga 1) */
  viewsCount: number;
  isPinned: boolean;
  /** Jonli efir / yig'ilish e'loni bo'lsa — vaqti (ms) va havolasi */
  eventAt: number | null;
  eventUrl: string | null;
  /** Nashrdan keyin tahrirlangan */
  edited: boolean;
  createdAt: number;
  author: UserBrief;
  /** Menda reaksiya bormi (myReaction !== null) — eski klientlar uchun saqlangan */
  likedByMe: boolean;
  /** Mening reaksiyam: heart | fire | clap | haha | wow | like; null — yo'q */
  myReaction: ReactionKind | null;
  /** Reaksiyalar kesimi (faqat 0 dan kattalari) — umumiy soni likesCount */
  reactions: ReactionCounts;
  /** Saqlanganlarimda (bookmark) bormi */
  savedByMe: boolean;
  canDelete: boolean;
}

export type ReactionCounts = Partial<Record<ReactionKind, number>>;

export interface CommentView {
  id: string;
  body: string;
  createdAt: number;
  author: UserBrief;
  canDelete: boolean;
}

export interface GroupMessageView {
  id: string;
  body: string;
  attachments: FileAttachment[];
  at: number;
  mine: boolean;
  sender: UserBrief;
  /** Javob berilgan xabar (iqtibos); o'chirilgan bo'lsa "Xabar o'chirilgan" */
  replyTo: QuoteView | null;
  /** Soft delete: matn/fayllar bo'sh, o'rnida «Xabar o'chirilgan» */
  deleted: boolean;
  edited: boolean;
  /** Ko'ruvchi o'chira oladimi (o'ziniki yoki moderator) / tahrirlay oladimi (o'ziniki, 24 soat) */
  canDelete: boolean;
  canEdit: boolean;
}

type Viewer = { id: string; role: string } | null;

/** O'z xabarini tahrirlash oynasi */
export const MESSAGE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Yordamchilar                                                        */
/* ------------------------------------------------------------------ */
const MANAGER_ROLES = new Set(["owner", "admin"]);

function isSiteAdmin(v: Viewer): boolean {
  return v?.role === "admin";
}

/** Foydalanuvchilarning qisqa kartochkalari (ism, avatar, taxallus, mutaxassis slug'i) — bitta so'rovda */
export async function briefUsers(ids: string[]): Promise<Map<string, UserBrief>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const map = new Map<string, UserBrief>();
  if (!unique.length) return map;
  const rows = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl, username: users.username, slug: specialists.slug, lastSeenAt: users.lastSeenAt, showOnline: users.showOnline })
    .from(users)
    .leftJoin(specialists, eq(specialists.userId, users.id))
    .where(inArray(users.id, unique));
  const since = Date.now() - ONLINE_WINDOW_MS;
  for (const r of rows) {
    // showOnline=false — maxfiylik: yashil nuqta hech kimga ko'rinmaydi
    map.set(r.id, { id: r.id, name: r.name, avatarUrl: r.avatarUrl, username: r.username, slug: r.slug ?? null, online: Boolean(r.showOnline && r.lastSeenAt && r.lastSeenAt.getTime() > since) });
  }
  return map;
}

/** "Onlayn" deb hisoblanadigan oyna */
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

const UNKNOWN: Omit<UserBrief, "id"> = { name: "Foydalanuvchi", avatarUrl: null, username: null, slug: null, online: false };

/** Nomdan URL slug: translit + qisqa suffiks (nomlar takrorlansa ham yagona) */
export function groupSlugFor(name: string): string {
  const base =
    translit(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "jamoa";
  return `${base}-${uid().slice(0, 6)}`;
}

export async function getMembership(groupId: string, userId: string | null | undefined): Promise<GroupMember | null> {
  if (!userId) return null;
  return (await db.query.groupMembers.findFirst({ where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)) })) ?? null;
}

function membershipState(m: GroupMember | null): MembershipState {
  if (!m) return null;
  if (m.status === "pending") return "pending";
  if (m.status === "banned") return "banned";
  return m.role;
}

function canManageWith(m: GroupMember | null, viewer: Viewer): boolean {
  if (isSiteAdmin(viewer)) return true;
  return Boolean(m && m.status === "active" && MANAGER_ROLES.has(m.role));
}

function canViewWith(group: Pick<Group, "isPrivate">, m: GroupMember | null, viewer: Viewer): boolean {
  if (!group.isPrivate) return true;
  if (isSiteAdmin(viewer)) return true;
  return Boolean(m && m.status === "active");
}

async function toGroupView(group: Group, viewer: Viewer): Promise<GroupView> {
  const [m, owner] = await Promise.all([getMembership(group.id, viewer?.id), briefUsers([group.ownerId])]);
  const canManage = canManageWith(m, viewer);
  // Kutayotgan so'rovlar soni faqat boshqaruvchiga kerak — boshqalarga so'rov bajarilmaydi
  const pending = canManage
    ? await db
        .select({ n: sql<number>`count(*)` })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.status, "pending")))
    : [];
  const mutedUntil = m?.mutedUntil && m.mutedUntil.getTime() > Date.now() ? m.mutedUntil.getTime() : null;
  return {
    id: group.id,
    slug: group.slug,
    name: group.name,
    description: group.description,
    category: group.category,
    region: group.region,
    coverUrl: group.coverUrl,
    isPrivate: group.isPrivate,
    kind: group.kind,
    isOfficial: group.isOfficial,
    membersCount: group.membersCount,
    postsCount: group.postsCount,
    pendingCount: canManage ? Number(pending[0]?.n ?? 0) : 0,
    lastActivityAt: group.lastActivityAt?.getTime() ?? null,
    createdAt: group.createdAt.getTime(),
    owner: owner.get(group.ownerId) ?? { id: group.ownerId, ...UNKNOWN },
    membership: membershipState(m),
    canManage,
    canView: canViewWith(group, m, viewer),
    canPost: canPostWith(group, m, viewer),
    inviteCode: canManage ? (group.inviteCode ?? null) : null,
    invite: canManage ? { expiresAt: group.inviteExpiresAt?.getTime() ?? null, maxUses: group.inviteMaxUses ?? null, uses: group.inviteUses ?? 0 } : null,
    muted: Boolean(m?.muted) || mutedUntil !== null,
    mutedUntil,
    eventReminders: m?.eventReminders !== false,
    rules: group.rules?.trim() ? group.rules : null,
    welcomeText: canManage ? (group.welcomeText ?? null) : null,
    coverPosition: group.coverPosition ?? null,
    pinnedMessageId: group.pinnedMessageId ?? null,
  };
}

/** Post yozish huquqi: guruhda faol a'zo, kanalda faqat boshqaruvchilar (sayt admini hamma joyda) */
function canPostWith(group: Pick<Group, "kind">, m: GroupMember | null, viewer: Viewer): boolean {
  if (!viewer) return false;
  if (group.kind === "channel") return canManageWith(m, viewer);
  return isSiteAdmin(viewer) || Boolean(m && m.status === "active");
}

/** Sayt adminlari — har yangi jamoa/kanalga avtomatik admin a'zo bo'ladi (boshqarish va nazorat uchun) */
async function siteAdminIds(): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.isBanned, false)));
  return rows.map((r) => r.id);
}

async function touchActivity(groupId: string) {
  await db.update(groups).set({ lastActivityAt: new Date() }).where(eq(groups.id, groupId));
}

/* ------------------------------------------------------------------ */
/* Jamoalar                                                            */
/* ------------------------------------------------------------------ */
/** Katalog tartibi: faollik (standart), yangi ochilgan, a'zolar soni */
export type GroupSort = "active" | "new" | "members";

export async function listGroups(
  opts: { q?: string; category?: string; region?: string; mine?: boolean; kind?: "group" | "channel"; official?: boolean; limit?: number; sort?: GroupSort },
  viewer: Viewer,
): Promise<GroupListItem[]> {
  const conds = [];
  // Rasmiy kanal har doim tepada; keyin tanlangan tartib
  const orderBy =
    opts.sort === "new"
      ? [desc(groups.isOfficial), desc(groups.createdAt)]
      : opts.sort === "members"
        ? [desc(groups.isOfficial), desc(groups.membersCount), desc(groups.lastActivityAt)]
        : [desc(groups.isOfficial), desc(groups.lastActivityAt), desc(groups.createdAt)];
  if (opts.kind) conds.push(eq(groups.kind, opts.kind));
  if (opts.official !== undefined) conds.push(eq(groups.isOfficial, opts.official));
  if (opts.q) {
    const needle = `%${translit(opts.q).replace(/[%_]/g, "")}%`;
    conds.push(or(like(sql`lower(${groups.name})`, needle), like(sql`lower(${groups.description})`, needle)));
  }
  if (opts.category) conds.push(eq(groups.category, opts.category));
  if (opts.region) conds.push(eq(groups.region, opts.region));

  let rows: Group[];
  if (opts.mine && viewer) {
    const joined = await db
      .select({ g: groups })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(and(eq(groupMembers.userId, viewer.id), eq(groupMembers.status, "active"), ...conds))
      .orderBy(...orderBy)
      .limit(opts.limit ?? 30);
    rows = joined.map((r) => r.g);
  } else if (opts.mine) {
    rows = [];
  } else {
    rows = await db.query.groups.findMany({
      where: conds.length ? and(...conds) : undefined,
      orderBy,
      limit: opts.limit ?? 30,
    });
  }
  if (!rows.length) return [];

  const [owners, memberships] = await Promise.all([
    briefUsers(rows.map((g) => g.ownerId)),
    viewer
      ? db.query.groupMembers.findMany({
          where: and(
            eq(groupMembers.userId, viewer.id),
            inArray(
              groupMembers.groupId,
              rows.map((g) => g.id),
            ),
          ),
        })
      : Promise.resolve([] as GroupMember[]),
  ]);
  const byGroup = new Map(memberships.map((m) => [m.groupId, m]));
  return rows.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    description: g.description,
    category: g.category,
    region: g.region,
    coverUrl: g.coverUrl,
    isPrivate: g.isPrivate,
    kind: g.kind,
    isOfficial: g.isOfficial,
    membersCount: g.membersCount,
    postsCount: g.postsCount,
    lastActivityAt: g.lastActivityAt?.getTime() ?? null,
    createdAt: g.createdAt.getTime(),
    owner: owners.get(g.ownerId) ?? { id: g.ownerId, ...UNKNOWN },
    membership: membershipState(byGroup.get(g.id) ?? null),
    coverPosition: g.coverPosition ?? null,
    hasUnread: hasUnreadFor(g, byGroup.get(g.id) ?? null),
  }));
}

/** Yo'nalish bo'yicha ochiq (rasmiy bo'lmagan) jamoalar soni — katalog chiplaridagi raqamlar */
export async function categoryCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ category: groups.category, n: sql<number>`count(*)` })
    .from(groups)
    .where(eq(groups.isOfficial, false))
    .groupBy(groups.category);
  const out: Record<string, number> = {};
  for (const r of rows) if (r.category) out[r.category] = Number(r.n);
  return out;
}

/** O'xshash jamoalar: avval shu yo'nalish, keyin shu hudud (o'zi chiqarilgan), faollik bo'yicha */
export async function similarGroups(group: Group, viewer: Viewer, limit = 4): Promise<GroupListItem[]> {
  const conds = [sql`${groups.id} != ${group.id}`, eq(groups.isOfficial, false)];
  const match = group.category && group.region ? or(eq(groups.category, group.category), eq(groups.region, group.region)) : group.category ? eq(groups.category, group.category) : group.region ? eq(groups.region, group.region) : undefined;
  if (match) conds.push(match);
  const rows = await db.query.groups.findMany({
    where: and(...conds),
    orderBy: [desc(sql`${groups.category} = ${group.category ?? ""}`), desc(groups.lastActivityAt)],
    limit,
  });
  if (!rows.length) return [];
  const [owners, memberships] = await Promise.all([
    briefUsers(rows.map((g) => g.ownerId)),
    viewer ? db.query.groupMembers.findMany({ where: and(eq(groupMembers.userId, viewer.id), inArray(groupMembers.groupId, rows.map((g) => g.id))) }) : Promise.resolve([] as GroupMember[]),
  ]);
  const byGroup = new Map(memberships.map((m) => [m.groupId, m]));
  return rows.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    description: g.description,
    category: g.category,
    region: g.region,
    coverUrl: g.coverUrl,
    isPrivate: g.isPrivate,
    kind: g.kind,
    isOfficial: g.isOfficial,
    membersCount: g.membersCount,
    postsCount: g.postsCount,
    lastActivityAt: g.lastActivityAt?.getTime() ?? null,
    createdAt: g.createdAt.getTime(),
    owner: owners.get(g.ownerId) ?? { id: g.ownerId, ...UNKNOWN },
    membership: membershipState(byGroup.get(g.id) ?? null),
    coverPosition: g.coverPosition ?? null,
    hasUnread: false,
  }));
}

export interface GroupStats {
  /** So'nggi 7 kunda: postlar, chat xabarlari, yangi a'zolar, faol (post/xabar yozgan) a'zolar */
  postsWeek: number;
  messagesWeek: number;
  joinedWeek: number;
  activeWeek: number;
}

export async function groupStats(groupId: string): Promise<GroupStats> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [p, m, j, a1, a2] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(posts).where(and(eq(posts.groupId, groupId), gt(posts.createdAt, since))),
    db.select({ n: sql<number>`count(*)` }).from(groupMessages).where(and(eq(groupMessages.groupId, groupId), gt(groupMessages.createdAt, since), isNull(groupMessages.deletedAt))),
    db.select({ n: sql<number>`count(*)` }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active"), gt(groupMembers.createdAt, since))),
    db.selectDistinct({ id: posts.authorId }).from(posts).where(and(eq(posts.groupId, groupId), gt(posts.createdAt, since))),
    db.selectDistinct({ id: groupMessages.senderId }).from(groupMessages).where(and(eq(groupMessages.groupId, groupId), gt(groupMessages.createdAt, since))),
  ]);
  return { postsWeek: Number(p[0]?.n ?? 0), messagesWeek: Number(m[0]?.n ?? 0), joinedWeek: Number(j[0]?.n ?? 0), activeWeek: new Set([...a1.map((r) => r.id), ...a2.map((r) => r.id)]).size };
}

export interface MediaItem {
  postId: string;
  url: string;
  type: string;
  name: string;
  createdAt: number;
}

/** Jamoa postlaridagi rasm/videolar (yangi → eski) — «Media» bo'limi */
export async function listGroupMedia(group: Group, limit = 60): Promise<MediaItem[]> {
  const rows = await db.query.posts.findMany({ where: and(eq(posts.groupId, group.id), sql`json_array_length(${posts.media}) > 0`), orderBy: [desc(posts.createdAt)], limit: 200, columns: { id: true, media: true, createdAt: true } });
  const out: MediaItem[] = [];
  for (const p of rows) {
    for (const a of p.media) {
      if (!a.type.startsWith("image/") && !a.type.startsWith("video/")) continue;
      out.push({ postId: p.id, url: a.url, type: a.type, name: a.name, createdAt: p.createdAt.getTime() });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Efirlar: yaqinlashayotganlar (eng yaqini birinchi) va o'tganlar (eng yaqin o'tgani birinchi) */
export async function listEvents(group: Group, viewer: Viewer, limit = 20): Promise<{ upcoming: PostView[]; past: PostView[] }> {
  const m = await getMembership(group.id, viewer?.id);
  const manager = canManageWith(m, viewer);
  const edge = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const [up, past] = await Promise.all([
    db.query.posts.findMany({ where: and(eq(posts.groupId, group.id), gt(posts.eventAt, edge)), orderBy: [asc(posts.eventAt)], limit }),
    db.query.posts.findMany({ where: and(eq(posts.groupId, group.id), isNotNull(posts.eventAt), lt(posts.eventAt, edge)), orderBy: [desc(posts.eventAt)], limit }),
  ]);
  const [a, b] = await Promise.all([toPostViews(up, viewer, manager), toPostViews(past, viewer, manager)]);
  return { upcoming: a, past: b };
}

/** A'zo oxirgi ko'rganidan keyin faollik bo'lganmi (lenta/chat) — "yangi" nuqtasi uchun */
function hasUnreadFor(g: Group, m: GroupMember | null): boolean {
  if (!m || m.status !== "active" || !g.lastActivityAt) return false;
  if (!m.lastReadAt) return g.postsCount > 0;
  return g.lastActivityAt.getTime() > m.lastReadAt.getTime() + 1000;
}

export type GroupListItem = Omit<GroupView, "pendingCount" | "canManage" | "canView" | "canPost" | "inviteCode" | "invite" | "muted" | "mutedUntil" | "eventReminders" | "rules" | "welcomeText" | "pinnedMessageId"> & { hasUnread: boolean };

export async function loadGroupBySlug(slug: string): Promise<Group | null> {
  return (await db.query.groups.findFirst({ where: eq(groups.slug, slug) })) ?? null;
}

/** Slug yoki eski slug (prev_slug) bo'yicha — sahifa eski manzilni yangisiga yo'naltiradi */
export async function loadGroupByAnySlug(slug: string): Promise<Group | null> {
  const g = await loadGroupBySlug(slug);
  if (g) return g;
  return (await db.query.groups.findFirst({ where: eq(groups.prevSlug, slug) })) ?? null;
}

/** Slug qoidasi: 3–40 belgi, kichik lotin harf/raqam/defis; boshi-oxiri defis emas */
export const GROUP_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED_SLUGS = new Set(["yangi", "sozlash", "api", "admin"]);

export async function getGroupView(slug: string, viewer: Viewer): Promise<GroupView | null> {
  const g = await loadGroupBySlug(slug);
  return g ? toGroupView(g, viewer) : null;
}

export async function createGroup(ownerId: string, input: GroupInput, opts: { isOfficial?: boolean } = {}): Promise<Group> {
  const id = uid();
  const now = new Date();
  // Sayt adminlari (egasidan tashqari) avtomatik "admin" a'zo — foydalanuvchi ochgan har bir kanal/guruhni boshqara oladi
  const admins = (await siteAdminIds()).filter((a) => a !== ownerId);
  const row: typeof groups.$inferInsert = {
    id,
    slug: groupSlugFor(input.name),
    name: input.name,
    description: input.description ?? "",
    category: input.category ?? null,
    region: input.region ?? null,
    coverUrl: input.coverUrl || null,
    isPrivate: Boolean(input.isPrivate),
    kind: input.kind ?? "group",
    isOfficial: Boolean(opts.isOfficial),
    ownerId,
    membersCount: 1 + admins.length,
    postsCount: 0,
    lastActivityAt: now,
    createdAt: now,
  };
  // Slug to'qnashuvi (unique indeks) — 500 o'rniga yangi suffiks bilan qayta urinish (3 marta)
  for (let attempt = 0; ; attempt++) {
    try {
      await db.transaction(async (tx) => {
        await tx.insert(groups).values(row);
        await tx.insert(groupMembers).values([
          { id: uid(), groupId: id, userId: ownerId, role: "owner", status: "active", lastReadAt: now, createdAt: now },
          ...admins.map((userId) => ({ id: uid(), groupId: id, userId, role: "admin" as const, status: "active" as const, lastReadAt: now, createdAt: now })),
        ]);
      });
      break;
    } catch (e) {
      const unique = /unique|constraint/i.test(e instanceof Error ? e.message : String(e));
      if (!unique || attempt >= 2) throw e;
      row.slug = groupSlugFor(input.name);
    }
  }
  const created = {
    ...row,
    description: row.description ?? "",
    category: row.category ?? null,
    region: row.region ?? null,
    coverUrl: row.coverUrl ?? null,
    isPrivate: row.isPrivate ?? false,
    membersCount: 1 + admins.length,
    postsCount: 0,
    lastActivityAt: now,
    createdAt: now,
  } as Group;
  if (created.isOfficial) await backfillOfficialMembers(created.id);
  return created;
}

/** Rasmiy kanal belgisi (faqat sayt admini): yoqilganda barcha mavjud foydalanuvchilar a'zo qilinadi */
export async function setOfficial(group: Group, value: boolean): Promise<Group> {
  if (group.isOfficial === value) return group;
  if (value && group.kind !== "channel") throw new ApiError(422, "Rasmiy bo'lishi uchun bu kanal bo'lishi kerak", { isOfficial: "Avval turini «Kanal» qiling" });
  if (value && group.isPrivate) throw new ApiError(422, "Rasmiy kanal yopiq bo'la olmaydi", { isOfficial: "Avval yopiqlikni o'chiring" });
  const [row] = await db.update(groups).set({ isOfficial: value }).where(eq(groups.id, group.id)).returning();
  if (value) await backfillOfficialMembers(group.id);
  return row;
}

/** Rasmiy kanalga hali a'zo bo'lmagan barcha (bloklanmagan) foydalanuvchilarni qo'shish; a'zolar soni qayta hisoblanadi */
export async function backfillOfficialMembers(groupId: string): Promise<number> {
  const existing = new Set((await db.query.groupMembers.findMany({ where: eq(groupMembers.groupId, groupId), columns: { userId: true } })).map((m) => m.userId));
  const all = await db.select({ id: users.id }).from(users).where(eq(users.isBanned, false));
  const missing = all.map((u) => u.id).filter((id) => !existing.has(id));
  const now = new Date();
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100).map((userId) => ({ id: uid(), groupId, userId, role: "member" as const, status: "active" as const, lastReadAt: now, createdAt: now }));
    await db.insert(groupMembers).values(chunk).onConflictDoNothing();
  }
  await recountMembers(groupId);
  return missing.length;
}

async function recountMembers(groupId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")));
  await db.update(groups).set({ membersCount: Number(n) }).where(eq(groups.id, groupId));
}

/** Yangi ro'yxatdan o'tgan foydalanuvchi — barcha rasmiy kanallarga avtomatik a'zo (Telegram'dagi qadalgan kanal kabi) */
export async function joinOfficialChannels(userId: string): Promise<void> {
  const official = await db.query.groups.findMany({ where: eq(groups.isOfficial, true), columns: { id: true } });
  if (!official.length) return;
  const now = new Date();
  await db
    .insert(groupMembers)
    .values(official.map((g) => ({ id: uid(), groupId: g.id, userId, role: "member" as const, status: "active" as const, lastReadAt: now, createdAt: now })))
    .onConflictDoNothing();
  await Promise.all(official.map((g) => recountMembers(g.id)));
}

export async function updateGroup(group: Group, patch: Partial<GroupInput> & { slug?: string; rules?: string; welcomeText?: string; coverPosition?: number | null }): Promise<Group> {
  const set: Partial<typeof groups.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.category !== undefined) set.category = patch.category ?? null;
  if (patch.region !== undefined) set.region = patch.region ?? null;
  if (patch.coverUrl !== undefined) set.coverUrl = patch.coverUrl || null;
  if (patch.isPrivate !== undefined) set.isPrivate = patch.isPrivate;
  if (patch.kind !== undefined) set.kind = patch.kind;
  if (patch.rules !== undefined) set.rules = patch.rules.trim() || null;
  if (patch.welcomeText !== undefined) set.welcomeText = patch.welcomeText.trim() || null;
  if (patch.coverPosition !== undefined) set.coverPosition = patch.coverPosition === null ? null : Math.min(100, Math.max(0, Math.round(patch.coverPosition)));
  if (set.isPrivate && group.isOfficial) throw new ApiError(422, "Rasmiy kanal yopiq bo'la olmaydi", { isPrivate: "Rasmiy kanal hammaga ochiq" });
  if (set.kind === "group" && group.isOfficial) throw new ApiError(422, "Rasmiy kanal guruhga aylantirilmaydi", { kind: "Avval rasmiy belgisini oling" });
  // Slug: egasi o'zgartiradi; eskisi prev_slug'da qoladi (yo'naltirish), boshqa jamoaniki bo'lsa — 409
  if (patch.slug !== undefined && patch.slug !== group.slug) {
    const slug = patch.slug.trim().toLowerCase();
    if (!GROUP_SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) throw new ApiError(422, "Manzil noto'g'ri", { slug: "3–40 belgi: kichik lotin harf, raqam, defis" });
    const taken = await db.query.groups.findFirst({ where: and(or(eq(groups.slug, slug), eq(groups.prevSlug, slug)), sql`${groups.id} != ${group.id}`), columns: { id: true } });
    if (taken) throw new ApiError(409, "Bu manzil band", { slug: "Boshqa manzil tanlang" });
    set.slug = slug;
    set.prevSlug = group.slug;
  }
  if (!Object.keys(set).length) return group;
  const [row] = await db.update(groups).set(set).where(eq(groups.id, group.id)).returning();
  return row;
}

export async function deleteGroup(groupId: string): Promise<void> {
  await db.delete(groups).where(eq(groups.id, groupId));
}

/** Qo'shilish: ochiq jamoa — darhol a'zo; yopiq — so'rov (egasi/adminlar bildirishnoma oladi) */
/** Taklif kodi hozir yaroqlimi: mos, muddati o'tmagan, limiti tugamagan */
function inviteValid(group: Group, invite?: string | null): boolean {
  if (!invite || !group.inviteCode || invite !== group.inviteCode) return false;
  if (group.inviteExpiresAt && group.inviteExpiresAt.getTime() < Date.now()) return false;
  if (group.inviteMaxUses !== null && group.inviteMaxUses !== undefined && (group.inviteUses ?? 0) >= group.inviteMaxUses) return false;
  return true;
}

export async function joinGroup(group: Group, userId: string, invite?: string | null, note?: string | null): Promise<MembershipState> {
  const existing = await getMembership(group.id, userId);
  const now = new Date();
  // Taklif havolasi to'g'ri bo'lsa — yopiq jamoaga ham darhol a'zo
  const viaInvite = inviteValid(group, invite);
  if (existing) {
    if (existing.status === "banned") throw new ApiError(403, "Siz bu jamoadan chiqarilgansiz");
    // Kutayotgan so'rov + yaroqli taklif → darhol faollashadi (ilgari "pending" qolib ketardi)
    if (existing.status === "pending" && viaInvite) {
      await db.transaction(async (tx) => {
        await tx.update(groupMembers).set({ status: "active", lastReadAt: now }).where(eq(groupMembers.id, existing.id));
        await tx.update(groups).set({ membersCount: sql`${groups.membersCount} + 1`, lastActivityAt: now, inviteUses: sql`coalesce(${groups.inviteUses}, 0) + 1` }).where(eq(groups.id, group.id));
      });
      await sendWelcome(group, userId);
      return "member";
    }
    return membershipState(existing);
  }
  const status = group.isPrivate && !viaInvite ? "pending" : "active";
  await db.transaction(async (tx) => {
    await tx.insert(groupMembers).values({ id: uid(), groupId: group.id, userId, role: "member", status, lastReadAt: now, createdAt: now, joinNote: status === "pending" ? note?.trim().slice(0, 200) || null : null });
    if (status === "active") await tx.update(groups).set({ membersCount: sql`${groups.membersCount} + 1`, lastActivityAt: now, ...(viaInvite ? { inviteUses: sql`coalesce(${groups.inviteUses}, 0) + 1` } : {}) }).where(eq(groups.id, group.id));
  });
  if (status === "active") await sendWelcome(group, userId);
  if (status === "pending") {
    const managers = await db.query.groupMembers.findMany({
      where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.status, "active"), inArray(groupMembers.role, ["owner", "admin"])),
      columns: { userId: true },
    });
    const who = (await briefUsers([userId])).get(userId)?.name ?? "Foydalanuvchi";
    await Promise.all(
      managers.map((m) => notify(m.userId, "group_request", `«${group.name}»ga qo'shilish so'rovi`, `${who} jamoaga qo'shilmoqchi — A'zolar bo'limida tasdiqlang.`, `/jamoalar/${group.slug}?tab=azolar`)),
    );
  }
  return status === "active" ? "member" : "pending";
}

/** Egasi yozgan xush kelibsiz matni — yangi a'zoga sayt ichi bildirishnoma (email yo'q) */
async function sendWelcome(group: Group, userId: string): Promise<void> {
  const text = group.welcomeText?.trim();
  if (!text) return;
  await notify(userId, "group_joined", `Xush kelibsiz: ${group.name}`, text.slice(0, 300), `/jamoalar/${group.slug}`, { skipMail: true }).catch(() => undefined);
}

export async function leaveGroup(group: Group, userId: string): Promise<void> {
  const m = await getMembership(group.id, userId);
  if (!m) return;
  // Chiqarilgan a'zo "chiqish" bilan ban yozuvini o'chirib qayta qo'shila olmasin
  if (m.status === "banned") throw new ApiError(403, "Siz bu jamoadan chiqarilgansiz");
  if (group.isOfficial && m.status === "active") throw new ApiError(400, "Bu rasmiy kanal — undan chiqib bo'lmaydi. Bildirishnomalarni jim qilishingiz mumkin.");
  if (m.role === "owner") throw new ApiError(400, "Egasi jamoadan chiqa olmaydi — avval boshqa a'zoni admin qilib, jamoani o'chiring yoki qoldiring");
  await db.transaction(async (tx) => {
    await tx.delete(groupMembers).where(eq(groupMembers.id, m.id));
    if (m.status === "active") await tx.update(groups).set({ membersCount: sql`max(${groups.membersCount} - 1, 0)` }).where(eq(groups.id, group.id));
  });
}

export interface MemberView {
  user: UserBrief;
  role: GroupMember["role"];
  status: GroupMember["status"];
  joinedAt: number;
  /** So'rov izohi (faqat pending) */
  note: string | null;
}

export type MemberStatus = "active" | "pending" | "banned";

export async function listMembers(groupId: string, status: MemberStatus = "active", limit = 200): Promise<MemberView[]> {
  const rows = await db.query.groupMembers.findMany({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, status)),
    orderBy: [asc(groupMembers.createdAt)],
    limit,
  });
  const briefs = await briefUsers(rows.map((r) => r.userId));
  const rank: Record<GroupMember["role"], number> = { owner: 0, admin: 1, member: 2 };
  return rows
    .map((r) => ({ user: briefs.get(r.userId) ?? { id: r.userId, ...UNKNOWN }, role: r.role, status: r.status, joinedAt: r.createdAt.getTime(), note: r.status === "pending" ? (r.joinNote ?? null) : null }))
    .sort((a, b) => rank[a.role] - rank[b.role] || a.joinedAt - b.joinedAt);
}

/** CSV eksport (egasi): ism, taxallus, rol, qo'shilgan sana — kontaktlar (email/telefon) ATAYLAB yo'q */
export async function membersCsv(groupId: string): Promise<string> {
  const rows = await listMembers(groupId, "active", 5000);
  const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = ["Ism,Taxallus,Rol,Qo'shilgan"];
  for (const m of rows) lines.push([cell(m.user.name), cell(m.user.username ? `@${m.user.username}` : ""), cell(m.role === "owner" ? "Egasi" : m.role === "admin" ? "Admin" : "A'zo"), cell(new Date(m.joinedAt).toISOString().slice(0, 10))].join(","));
  return `﻿${lines.join("\r\n")}`;
}

/** Barcha kutayotgan so'rovlarni tasdiqlash — har biriga bildirishnoma; qaytadi: nechta */
export async function approveAllPending(group: Group, actor: { id: string; role: string }): Promise<number> {
  const actorM = await getMembership(group.id, actor.id);
  if (!canManageWith(actorM, actor)) throw new ApiError(403, "Faqat jamoa egasi yoki admini");
  const pending = await db.query.groupMembers.findMany({ where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.status, "pending")), columns: { id: true, userId: true } });
  if (!pending.length) return 0;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(groupMembers).set({ status: "active", lastReadAt: now, joinNote: null }).where(inArray(groupMembers.id, pending.map((p) => p.id)));
    await tx.update(groups).set({ membersCount: sql`${groups.membersCount} + ${pending.length}`, lastActivityAt: now }).where(eq(groups.id, group.id));
  });
  for (let i = 0; i < pending.length; i += 25) {
    await Promise.all(pending.slice(i, i + 25).map((p) => notify(p.userId, "group_joined", `«${group.name}» jamoasiga qabul qilindingiz`, "Endi lenta va chat sizga ochiq.", `/jamoalar/${group.slug}`).catch(() => undefined)));
  }
  await Promise.all(pending.map((p) => sendWelcome(group, p.userId)));
  return pending.length;
}

export type MemberActionKind = "approve" | "reject" | "remove" | "promote" | "demote" | "unban";

/** Moderator amallari: tasdiqlash / rad etish / chiqarish / admin qilish / adminlikdan olish / qaytarish (unban) */
export async function memberAction(group: Group, actor: { id: string; role: string }, targetUserId: string, action: MemberActionKind): Promise<void> {
  const actorM = await getMembership(group.id, actor.id);
  if (!canManageWith(actorM, actor)) throw new ApiError(403, "Faqat jamoa egasi yoki admini");
  if (targetUserId === actor.id) throw new ApiError(400, "O'zingiz ustida amal bajarib bo'lmaydi");
  const target = await getMembership(group.id, targetUserId);
  if (!target) throw new ApiError(404, "A'zo topilmadi");
  if (target.role === "owner") throw new ApiError(400, "Egasi ustida amal bajarib bo'lmaydi");
  const isOwner = actorM?.role === "owner" || isSiteAdmin(actor);
  const now = new Date();

  switch (action) {
    case "unban": {
      // Chiqarilganni qaytarish: yozuv o'chiriladi — odam yana qo'shilish so'rovi yubora oladi
      if (target.status !== "banned") return;
      await db.delete(groupMembers).where(eq(groupMembers.id, target.id));
      return;
    }
    case "approve": {
      if (target.status !== "pending") return;
      await db.transaction(async (tx) => {
        await tx.update(groupMembers).set({ status: "active", lastReadAt: now, joinNote: null }).where(eq(groupMembers.id, target.id));
        await tx.update(groups).set({ membersCount: sql`${groups.membersCount} + 1`, lastActivityAt: now }).where(eq(groups.id, group.id));
      });
      await notify(targetUserId, "group_joined", `«${group.name}» jamoasiga qabul qilindingiz`, "Endi lenta va chat sizga ochiq.", `/jamoalar/${group.slug}`);
      await sendWelcome(group, targetUserId);
      return;
    }
    case "reject": {
      if (target.status !== "pending") return;
      await db.delete(groupMembers).where(eq(groupMembers.id, target.id));
      return;
    }
    case "remove": {
      // Admin boshqa adminni chiqara olmaydi — faqat egasi
      if (target.role === "admin" && !isOwner) throw new ApiError(403, "Adminni faqat egasi chiqara oladi");
      await db.transaction(async (tx) => {
        await tx.update(groupMembers).set({ status: "banned", role: "member" }).where(eq(groupMembers.id, target.id));
        if (target.status === "active") await tx.update(groups).set({ membersCount: sql`max(${groups.membersCount} - 1, 0)` }).where(eq(groups.id, group.id));
      });
      return;
    }
    case "promote":
    case "demote": {
      if (!isOwner) throw new ApiError(403, "Adminlarni faqat egasi tayinlaydi");
      if (target.status !== "active") throw new ApiError(400, "Faqat faol a'zo");
      await db.update(groupMembers).set({ role: action === "promote" ? "admin" : "member" }).where(eq(groupMembers.id, target.id));
      return;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Lenta: postlar, like, izohlar                                       */
/* ------------------------------------------------------------------ */
export async function assertActiveMember(group: Group, viewer: Viewer): Promise<GroupMember | null> {
  if (!viewer) throw new ApiError(401, "Avval tizimga kiring");
  const m = await getMembership(group.id, viewer.id);
  if (isSiteAdmin(viewer)) return m;
  if (!m || m.status !== "active") throw new ApiError(403, "Bu amal faqat jamoa a'zolari uchun — avval qo'shiling");
  return m;
}

export async function createPost(
  group: Group,
  authorId: string,
  body: string,
  media: FileAttachment[],
  event: { at: number | null; url: string | null } = { at: null, url: null },
): Promise<Post> {
  const now = new Date();
  const row: typeof posts.$inferInsert = {
    id: uid(),
    groupId: group.id,
    authorId,
    body,
    media,
    likesCount: 0,
    commentsCount: 0,
    isPinned: false,
    eventAt: event.at ? new Date(event.at) : null,
    eventUrl: event.url || null,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction(async (tx) => {
    await tx.insert(posts).values(row);
    await tx.update(groups).set({ postsCount: sql`${groups.postsCount} + 1`, lastActivityAt: now }).where(eq(groups.id, group.id));
  });
  // Muallif o'z postidan keyin "yangi" nuqtasini ko'rmasin
  await markGroupRead(group.id, authorId).catch(() => undefined);
  const href = `/jamoalar/${group.slug}?post=${row.id}`;
  // @username eslatmalari (yopiq jamoada faqat a'zolarga)
  try {
    const who = (await briefUsers([authorId])).get(authorId)?.name ?? "Foydalanuvchi";
    await notifyMentions({ text: body, actorId: authorId, actorName: who, href, where: "post", group });
  } catch (e) {
    console.error("[post:mentions]", e);
  }
  // Kanal posti yoki efir e'loni — a'zolarga bildirishnoma (sayt + Telegram; email emas — kvota)
  if (group.kind === "channel" || event.at) {
    const snippet = body.replace(/\s+/g, " ").trim().slice(0, 140) || (media.length ? "Yangi media" : "");
    if (event.at) {
      await notifyMembers(group, authorId, "live_event", `Jonli efir: ${group.name}`, `${formatEventDate(event.at)} — ${snippet || "efir/yig'ilish e'lon qilindi"}`, href);
    } else {
      await notifyMembers(group, authorId, "channel_post", group.name, snippet, href);
    }
  }
  return { ...row, likesCount: 0, commentsCount: 0, isPinned: false, eventAt: row.eventAt ?? null, eventUrl: row.eventUrl ?? null } as Post;
}

function formatEventDate(ms: number): string {
  return new Date(ms).toLocaleString("uz-UZ", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
}

/** A'zolarga (muallifdan tashqari) 25 talik guruhlarda bildirishnoma — minglab a'zoda navbatga o'tkaziladi (reja 2-bosqich) */
async function notifyMembers(group: Group, exceptUserId: string, type: "channel_post" | "live_event", title: string, body: string, href: string): Promise<void> {
  const now = new Date();
  const members = await db.query.groupMembers.findMany({
    where: and(
      eq(groupMembers.groupId, group.id),
      eq(groupMembers.status, "active"),
      eq(groupMembers.muted, false),
      // Vaqtincha jim qilinganlar (muted_until kelajakda) va efir eslatmasini o'chirganlar chetlab o'tiladi
      or(isNull(groupMembers.mutedUntil), lt(groupMembers.mutedUntil, now)),
      ...(type === "live_event" ? [or(isNull(groupMembers.eventReminders), eq(groupMembers.eventReminders, true))] : []),
    ),
    columns: { userId: true },
  });
  const ids = members.map((m) => m.userId).filter((id) => id !== exceptUserId);
  for (let i = 0; i < ids.length; i += 25) {
    await Promise.all(ids.slice(i, i + 25).map((id) => notify(id, type, title, body, href, { skipMail: true }).catch(() => undefined)));
  }
}

/** Yaqinlashayotgan efir/yig'ilishlar (vaqti o'tmagan), eng yaqini birinchi */
export async function upcomingEvents(groupId: string, viewer: Viewer, limit = 3): Promise<PostView[]> {
  const m = await getMembership(groupId, viewer?.id);
  const rows = await db.query.posts.findMany({
    where: and(eq(posts.groupId, groupId), gt(posts.eventAt, new Date(Date.now() - 2 * 60 * 60 * 1000))),
    orderBy: [asc(posts.eventAt)],
    limit,
  });
  return toPostViews(rows, viewer, canManageWith(m, viewer));
}

/** Post yozish huquqi: guruhda faol a'zo, kanalda faqat egasi/adminlar */
export async function assertCanPost(group: Group, viewer: Viewer): Promise<GroupMember | null> {
  const m = await assertActiveMember(group, viewer);
  if (!canPostWith(group, m, viewer)) throw new ApiError(403, "Kanalga faqat egasi va adminlar yozadi — siz izoh qoldirishingiz va yoqtirishingiz mumkin");
  return m;
}

const asReaction = (s: string): ReactionKind => (REACTION_KINDS.includes(s as ReactionKind) ? (s as ReactionKind) : "heart");

/** Postlar bo'yicha reaksiya kesimi: postId → { heart: 3, fire: 1 } */
export async function reactionCounts(postIds: string[]): Promise<Map<string, ReactionCounts>> {
  const map = new Map<string, ReactionCounts>();
  if (!postIds.length) return map;
  const rows = await db
    .select({ postId: postLikes.postId, reaction: postLikes.reaction, n: sql<number>`count(*)` })
    .from(postLikes)
    .where(inArray(postLikes.postId, postIds))
    .groupBy(postLikes.postId, postLikes.reaction);
  for (const r of rows) {
    const cur = map.get(r.postId) ?? {};
    const k = asReaction(r.reaction);
    cur[k] = (cur[k] ?? 0) + Number(r.n);
    map.set(r.postId, cur);
  }
  return map;
}

export async function toPostViews(rows: Post[], viewer: Viewer, manager: boolean): Promise<PostView[]> {
  if (!rows.length) return [];
  const ids = rows.map((p) => p.id);
  const [authors, mine, counts, saves] = await Promise.all([
    briefUsers(rows.map((p) => p.authorId)),
    viewer
      ? db.query.postLikes.findMany({ where: and(eq(postLikes.userId, viewer.id), inArray(postLikes.postId, ids)), columns: { postId: true, reaction: true } })
      : Promise.resolve([] as Array<{ postId: string; reaction: string }>),
    reactionCounts(ids),
    viewer
      ? db.query.postSaves.findMany({ where: and(eq(postSaves.userId, viewer.id), inArray(postSaves.postId, ids)), columns: { postId: true } })
      : Promise.resolve([] as Array<{ postId: string }>),
  ]);
  const myMap = new Map(mine.map((l) => [l.postId, asReaction(l.reaction)] as const));
  const savedSet = new Set(saves.map((x) => x.postId));
  return rows.map((p) => ({
    id: p.id,
    groupId: p.groupId,
    body: p.body,
    media: p.media,
    likesCount: p.likesCount,
    commentsCount: p.commentsCount,
    viewsCount: p.viewsCount,
    isPinned: p.isPinned,
    eventAt: p.eventAt?.getTime() ?? null,
    eventUrl: p.eventUrl ?? null,
    edited: p.updatedAt.getTime() - p.createdAt.getTime() > 60_000,
    createdAt: p.createdAt.getTime(),
    author: authors.get(p.authorId) ?? { id: p.authorId, ...UNKNOWN },
    likedByMe: myMap.has(p.id),
    myReaction: myMap.get(p.id) ?? null,
    reactions: counts.get(p.id) ?? {},
    savedByMe: savedSet.has(p.id),
    canDelete: Boolean(viewer && (viewer.id === p.authorId || manager)),
  }));
}

/** Jamoa lentasi: yangi → eski, cursor = oxirgi postning createdAt (ms) */
export async function listPosts(group: Group, viewer: Viewer, cursor?: number | null, limit = 20): Promise<{ items: PostView[]; nextCursor: number | null }> {
  const m = await getMembership(group.id, viewer?.id);
  // Qadalgan postlar faqat birinchi sahifada, tepada (3 tagacha); asosiy ro'yxat qadalmaganlardan
  const [pinned, rows] = await Promise.all([
    cursor ? Promise.resolve([] as Post[]) : db.query.posts.findMany({ where: and(eq(posts.groupId, group.id), eq(posts.isPinned, true)), orderBy: [desc(posts.createdAt)], limit: 3 }),
    db.query.posts.findMany({
      where: cursor ? and(eq(posts.groupId, group.id), eq(posts.isPinned, false), lt(posts.createdAt, new Date(cursor))) : and(eq(posts.groupId, group.id), eq(posts.isPinned, false)),
      orderBy: [desc(posts.createdAt)],
      limit: limit + 1,
    }),
  ]);
  const page = rows.slice(0, limit);
  const items = await toPostViews([...pinned, ...page], viewer, canManageWith(m, viewer));
  return { items, nextCursor: rows.length > limit ? page[page.length - 1].createdAt.getTime() : null };
}

export async function loadPost(id: string): Promise<Post | null> {
  return (await db.query.posts.findFirst({ where: eq(posts.id, id) })) ?? null;
}

export async function canModeratePost(post: Post, viewer: Viewer): Promise<boolean> {
  if (!viewer) return false;
  if (viewer.id === post.authorId || isSiteAdmin(viewer)) return true;
  if (!post.groupId) return false;
  return canManageWith(await getMembership(post.groupId, viewer.id), viewer);
}

export async function deletePost(post: Post): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(posts).where(eq(posts.id, post.id));
    if (post.groupId) await tx.update(groups).set({ postsCount: sql`max(${groups.postsCount} - 1, 0)` }).where(eq(groups.id, post.groupId));
  });
}

export interface ReactionResult {
  liked: boolean;
  likesCount: number;
  myReaction: ReactionKind | null;
  reactions: ReactionCounts;
}

/** Postning doimiy havolasi: jamoa posti → /jamoalar/<slug>?post=, profil posti → /mutaxassislar/<slug>?post= */
export async function postHref(post: Post): Promise<string> {
  if (post.groupId) {
    const g = await db.query.groups.findFirst({ where: eq(groups.id, post.groupId), columns: { slug: true } });
    if (g) return `/jamoalar/${g.slug}?post=${post.id}`;
  }
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, post.authorId), columns: { slug: true } });
  return sp ? `/mutaxassislar/${sp.slug}?post=${post.id}` : `/?post=${post.id}`;
}

const snippetOf = (text: string, n = 100) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * Reaksiya qo'yish (Facebook/Telegram uslubi): shu reaksiya bor — olib tashlanadi; boshqasi bor — almashtiriladi;
 * yo'q — qo'shiladi (likesCount +1). Muallifga "post_like" bildirishnomasi faqat yangi qo'shilganda va
 * bir odamdan bir postga 24 soatda bir marta (yoqib-o'chirib spam qilib bo'lmaydi).
 */
export async function setReaction(post: Post, userId: string, reaction: ReactionKind = "heart"): Promise<ReactionResult> {
  const existing = await db.query.postLikes.findFirst({ where: and(eq(postLikes.postId, post.id), eq(postLikes.userId, userId)) });
  const mode: "remove" | "switch" | "add" = existing ? (existing.reaction === reaction ? "remove" : "switch") : "add";
  await db.transaction(async (tx) => {
    if (mode === "remove") {
      await tx.delete(postLikes).where(eq(postLikes.id, existing!.id));
      await tx.update(posts).set({ likesCount: sql`max(${posts.likesCount} - 1, 0)` }).where(eq(posts.id, post.id));
    } else if (mode === "switch") {
      await tx.update(postLikes).set({ reaction }).where(eq(postLikes.id, existing!.id));
    } else {
      await tx.insert(postLikes).values({ id: uid(), postId: post.id, userId, reaction, createdAt: new Date() });
      await tx.update(posts).set({ likesCount: sql`${posts.likesCount} + 1` }).where(eq(posts.id, post.id));
    }
  });
  const [fresh, counts] = await Promise.all([loadPost(post.id), reactionCounts([post.id])]);
  if (mode === "add" && post.authorId !== userId) {
    try {
      const who = (await briefUsers([userId])).get(userId)?.name ?? "Foydalanuvchi";
      const href = await postHref(post);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // Ism ichidagi % va _ LIKE naqshini kengaytirmasin (escape)
      const pattern = `${who.replace(/[\\%_]/g, (c) => `\\${c}`)} %`;
      const dup = await db.query.notifications.findFirst({
        where: and(eq(notifications.userId, post.authorId), eq(notifications.type, "post_like"), eq(notifications.href, href), gt(notifications.createdAt, since), sql`${notifications.title} like ${pattern} escape '\\'`),
        columns: { id: true },
      });
      if (!dup) await notify(post.authorId, "post_like", `${who} postingizga ${REACTION_BY_KEY[reaction].emoji} qo'ydi`, snippetOf(post.body) || (post.media.length ? "Media post" : null), href, { skipMail: true });
    } catch (e) {
      console.error("[reaction:notify]", e);
    }
  }
  const myReaction = mode === "remove" ? null : reaction;
  return { liked: myReaction !== null, likesCount: fresh?.likesCount ?? post.likesCount, myReaction, reactions: counts.get(post.id) ?? {} };
}

/**
 * Ko'rish hisobi: (post, kalit, kun) noyob yozuv — bor bo'lsa hisob o'zgarmaydi; muallifning o'zi hisoblanmaydi.
 * Yozuvlar kichik (id + kalit + kun); 30 kundan eskilari cron'da tozalanadi (purgeOldViews).
 */
export async function recordView(post: Post, viewerKey: string, viewerId: string | null): Promise<number> {
  if (viewerId && viewerId === post.authorId) return post.viewsCount;
  const day = new Date().toISOString().slice(0, 10);
  try {
    await db.insert(postViews).values({ id: uid(), postId: post.id, viewerKey, day, createdAt: new Date() });
  } catch {
    return post.viewsCount; // bugun allaqachon hisoblangan (unique indeks)
  }
  await db.update(posts).set({ viewsCount: sql`${posts.viewsCount} + 1` }).where(eq(posts.id, post.id));
  return post.viewsCount + 1;
}

/** Cron: 30 kundan eski ko'rish yozuvlarini o'chirish (hisob posts.views_count'da saqlanib qoladi) */
export async function purgeOldViews(days = 30): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const res = await db.delete(postViews).where(lt(postViews.day, cutoff));
  return Number((res as unknown as { rowsAffected?: number }).rowsAffected ?? 0);
}

/** Eski nom — bitta ❤️ toggle (mavjud chaqiruvlar uchun) */
export const toggleLike = (post: Post, userId: string) => setReaction(post, userId, "heart");

/** Postni saqlash / saqlanganlardan olish (bookmark) */
export async function toggleSave(post: Post, userId: string): Promise<{ saved: boolean }> {
  const existing = await db.query.postSaves.findFirst({ where: and(eq(postSaves.postId, post.id), eq(postSaves.userId, userId)) });
  if (existing) {
    await db.delete(postSaves).where(eq(postSaves.id, existing.id));
    return { saved: false };
  }
  await db.insert(postSaves).values({ id: uid(), postId: post.id, userId, createdAt: new Date() });
  return { saved: true };
}

export async function listComments(post: Post, viewer: Viewer, limit = 100): Promise<CommentView[]> {
  const rows = await db.query.postComments.findMany({ where: eq(postComments.postId, post.id), orderBy: [asc(postComments.createdAt)], limit });
  const authors = await briefUsers(rows.map((c) => c.authorId));
  const moderator = await canModeratePost(post, viewer);
  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.getTime(),
    author: authors.get(c.authorId) ?? { id: c.authorId, ...UNKNOWN },
    canDelete: Boolean(viewer && (viewer.id === c.authorId || moderator)),
  }));
}

export async function addComment(post: Post, authorId: string, body: string): Promise<PostComment> {
  const now = new Date();
  const row: typeof postComments.$inferInsert = { id: uid(), postId: post.id, authorId, body, createdAt: now };
  await db.transaction(async (tx) => {
    await tx.insert(postComments).values(row);
    await tx.update(posts).set({ commentsCount: sql`${posts.commentsCount} + 1`, updatedAt: now }).where(eq(posts.id, post.id));
    if (post.groupId) await tx.update(groups).set({ lastActivityAt: now }).where(eq(groups.id, post.groupId));
  });
  try {
    const who = (await briefUsers([authorId])).get(authorId)?.name ?? "Foydalanuvchi";
    const href = await postHref(post);
    if (post.authorId !== authorId) await notify(post.authorId, "post_comment", `${who} postingizga izoh qoldirdi`, body.length > 100 ? `${body.slice(0, 97)}…` : body, href);
    const g = post.groupId ? await db.query.groups.findFirst({ where: eq(groups.id, post.groupId), columns: { id: true, isPrivate: true } }) : null;
    await notifyMentions({ text: body, actorId: authorId, actorName: who, href, where: "comment", group: g, excludeIds: [post.authorId] });
  } catch (e) {
    console.error("[comment:notify]", e);
  }
  return { ...row, createdAt: now } as PostComment;
}

export async function deleteComment(comment: PostComment, post: Post): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(postComments).where(eq(postComments.id, comment.id));
    await tx.update(posts).set({ commentsCount: sql`max(${posts.commentsCount} - 1, 0)` }).where(eq(posts.id, post.id));
  });
}

/* ------------------------------------------------------------------ */
/* Guruh chati (polling — DM bilan bir xil qoida)                      */
/* ------------------------------------------------------------------ */
type GroupMessageRow = typeof groupMessages.$inferSelect;

/** Xabar qatorlarini DTO'ga: o'chirilganlar bo'shatiladi, iqtiboslar yig'iladi, huquqlar hisoblanadi */
async function toMessageViews(group: Group, viewer: Viewer, rows: GroupMessageRow[], opts: { manager?: boolean } = {}): Promise<GroupMessageView[]> {
  if (!rows.length) return [];
  const manager = opts.manager ?? canManageWith(await getMembership(group.id, viewer?.id), viewer);
  const quoteIds = [...new Set(rows.map((r) => r.replyToId).filter((x): x is string => Boolean(x)))];
  const originals = quoteIds.length ? await db.query.groupMessages.findMany({ where: and(eq(groupMessages.groupId, group.id), inArray(groupMessages.id, quoteIds)) }) : [];
  const senders = await briefUsers([...rows.map((r) => r.senderId), ...originals.map((o) => o.senderId)]);
  const DELETED_QUOTE = (id: string): QuoteView => ({ id, body: "Xabar o'chirilgan", senderName: "", kind: "text" });
  const quotes = new Map(originals.map((o) => [o.id, o.deletedAt ? DELETED_QUOTE(o.id) : toQuote(o, senders.get(o.senderId)?.name ?? "Foydalanuvchi")] as const));
  const now = Date.now();
  return rows.map((r) => {
    const deleted = Boolean(r.deletedAt);
    const mine = viewer?.id === r.senderId;
    return {
      id: r.id,
      body: deleted ? "" : r.body,
      attachments: deleted ? [] : r.attachments,
      at: r.createdAt.getTime(),
      mine,
      sender: senders.get(r.senderId) ?? { id: r.senderId, ...UNKNOWN },
      replyTo: r.replyToId ? (quotes.get(r.replyToId) ?? DELETED_QUOTE(r.replyToId)) : null,
      deleted,
      edited: Boolean(r.editedAt) && !deleted,
      canDelete: !deleted && (mine || manager),
      canEdit: !deleted && mine && Boolean(r.body) && now - r.createdAt.getTime() < MESSAGE_EDIT_WINDOW_MS,
    };
  });
}

export async function listGroupMessages(group: Group, viewer: Viewer, afterId?: string | null, limit = 200): Promise<GroupMessageView[]> {
  let rows: GroupMessageRow[];
  if (afterId) {
    const m = await db.query.groupMessages.findFirst({ where: and(eq(groupMessages.id, afterId), eq(groupMessages.groupId, group.id)), columns: { createdAt: true } });
    // Noma'lum id (eski klient / boshqa guruh) — abadiy bo'sh qolmasin: oxirgi 50 ta qaytadi
    rows = m
      ? await db.query.groupMessages.findMany({ where: and(eq(groupMessages.groupId, group.id), gt(groupMessages.createdAt, m.createdAt)), orderBy: [asc(groupMessages.createdAt), asc(groupMessages.id)], limit })
      : (await db.query.groupMessages.findMany({ where: eq(groupMessages.groupId, group.id), orderBy: [desc(groupMessages.createdAt), desc(groupMessages.id)], limit: 50 })).reverse();
  } else {
    rows = (await db.query.groupMessages.findMany({ where: eq(groupMessages.groupId, group.id), orderBy: [desc(groupMessages.createdAt), desc(groupMessages.id)], limit })).reverse();
  }
  return toMessageViews(group, viewer, rows);
}

/** Tahrirlangan/o'chirilgan xabarlarning yangilanishi (polling: `since` dan keyin o'zgarganlar) */
export async function changedGroupMessages(group: Group, viewer: Viewer, since: Date, limit = 50): Promise<GroupMessageView[]> {
  const rows = await db.query.groupMessages.findMany({
    where: and(eq(groupMessages.groupId, group.id), or(gt(groupMessages.editedAt, since), gt(groupMessages.deletedAt, since))),
    orderBy: [asc(groupMessages.createdAt)],
    limit,
  });
  return toMessageViews(group, viewer, rows);
}

/** Chatda qidirish: matn bo'yicha (o'chirilganlar chiqmaydi), yangi → eski, 30 tagacha */
export async function searchGroupMessages(group: Group, viewer: Viewer, q: string, limit = 30): Promise<GroupMessageView[]> {
  const needle = `%${q.toLowerCase().replace(/[%_]/g, "")}%`;
  const rows = (
    await db.query.groupMessages.findMany({
      where: and(eq(groupMessages.groupId, group.id), isNull(groupMessages.deletedAt), like(sql`lower(${groupMessages.body})`, needle)),
      orderBy: [desc(groupMessages.createdAt)],
      limit,
    })
  ).reverse();
  return toMessageViews(group, viewer, rows);
}

export async function loadGroupMessage(group: Group, id: string): Promise<GroupMessageRow | null> {
  return (await db.query.groupMessages.findFirst({ where: and(eq(groupMessages.id, id), eq(groupMessages.groupId, group.id)) })) ?? null;
}

/** Soft delete: o'ziniki yoki moderator; qadalgan bo'lsa qadoq ham olinadi */
export async function deleteGroupMessage(group: Group, viewer: NonNullable<Viewer>, msg: GroupMessageRow): Promise<void> {
  const m = await getMembership(group.id, viewer.id);
  if (msg.senderId !== viewer.id && !canManageWith(m, viewer)) throw new ApiError(403, "Faqat o'z xabaringizni yoki moderator sifatida o'chira olasiz");
  if (msg.deletedAt) return;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(groupMessages).set({ deletedAt: now, body: "", attachments: [] }).where(eq(groupMessages.id, msg.id));
    if (group.pinnedMessageId === msg.id) await tx.update(groups).set({ pinnedMessageId: null }).where(eq(groups.id, group.id));
  });
}

/** Tahrir: faqat muallif, 24 soat ichida, matnli xabar */
export async function editGroupMessage(viewer: NonNullable<Viewer>, msg: GroupMessageRow, body: string): Promise<void> {
  if (msg.senderId !== viewer.id) throw new ApiError(403, "Faqat o'z xabaringizni tahrirlaysiz");
  if (msg.deletedAt) throw new ApiError(400, "Xabar o'chirilgan");
  if (Date.now() - msg.createdAt.getTime() > MESSAGE_EDIT_WINDOW_MS) throw new ApiError(400, "Tahrirlash muddati (24 soat) o'tgan");
  if (body === msg.body) return;
  await db.update(groupMessages).set({ body, editedAt: new Date() }).where(eq(groupMessages.id, msg.id));
}

/** Qadash/olib tashlash — boshqaruvchi; bitta qadalgan xabar */
export async function setPinnedMessage(group: Group, msgId: string | null): Promise<void> {
  await db.update(groups).set({ pinnedMessageId: msgId }).where(eq(groups.id, group.id));
}

export async function pinnedMessage(group: Group, viewer: Viewer): Promise<GroupMessageView | null> {
  if (!group.pinnedMessageId) return null;
  const row = await loadGroupMessage(group, group.pinnedMessageId);
  if (!row || row.deletedAt) return null;
  return (await toMessageViews(group, viewer, [row]))[0] ?? null;
}

export async function sendGroupMessage(group: Group, senderId: string, body: string, attachments: FileAttachment[], replyToId: string | null = null) {
  // Javob faqat shu guruhdagi xabarga
  if (replyToId) {
    const orig = await db.query.groupMessages.findFirst({ where: and(eq(groupMessages.id, replyToId), eq(groupMessages.groupId, group.id)), columns: { id: true } });
    if (!orig) throw new ApiError(422, "Javob berilayotgan xabar topilmadi", { replyToId: "Xabar topilmadi" });
  }
  const now = new Date();
  const row: typeof groupMessages.$inferInsert = { id: uid(), groupId: group.id, senderId, body, attachments, replyToId, createdAt: now };
  await db.insert(groupMessages).values(row);
  await Promise.all([touchActivity(group.id), markGroupRead(group.id, senderId), setGroupTyping(group.id, senderId, false)]);
  return { ...row, createdAt: now };
}

/** "Yozmoqda…" signali (a'zolik qatoriga vaqt) — on=false tozalaydi */
export async function setGroupTyping(groupId: string, userId: string, on: boolean): Promise<void> {
  await db
    .update(groupMembers)
    .set({ typingAt: on ? new Date() : null })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
}

/** Hozir yozayotgan a'zolar ismlari (mendan tashqari, 3 tagacha) */
export async function typingMembers(groupId: string, exceptUserId: string, limit = 3): Promise<string[]> {
  const since = new Date(Date.now() - TYPING_WINDOW_MS);
  const rows = await db
    .select({ name: users.name })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active"), gt(groupMembers.typingAt, since), sql`${groupMembers.userId} != ${exceptUserId}`))
    .limit(limit);
  return rows.map((r) => r.name);
}

export async function markGroupRead(groupId: string, userId: string): Promise<void> {
  await db.update(groupMembers).set({ lastReadAt: new Date() }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
}

/* ------------------------------------------------------------------ */
/* Obuna (follow)                                                      */
/* ------------------------------------------------------------------ */
export async function followState(viewerId: string | null, userId: string): Promise<{ following: boolean; followersCount: number; followingCount: number }> {
  const [followers, following, mine] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(follows).where(eq(follows.followingId, userId)),
    db.select({ n: sql<number>`count(*)` }).from(follows).where(eq(follows.followerId, userId)),
    viewerId ? db.query.follows.findFirst({ where: and(eq(follows.followerId, viewerId), eq(follows.followingId, userId)) }) : Promise.resolve(null),
  ]);
  return { following: Boolean(mine), followersCount: Number(followers[0]?.n ?? 0), followingCount: Number(following[0]?.n ?? 0) };
}

export async function toggleFollow(followerId: string, followingId: string): Promise<{ following: boolean; followersCount: number }> {
  if (followerId === followingId) throw new ApiError(400, "O'zingizga obuna bo'lib bo'lmaydi");
  const target = await db.query.users.findFirst({ where: eq(users.id, followingId), columns: { id: true, isBanned: true } });
  if (!target || target.isBanned) throw new ApiError(404, "Foydalanuvchi topilmadi");
  if (await isBlockedEither(followerId, followingId)) throw new ApiError(403, "Bu foydalanuvchiga obuna bo'lib bo'lmaydi");
  const existing = await db.query.follows.findFirst({ where: and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)) });
  if (existing) {
    await db.delete(follows).where(eq(follows.id, existing.id));
  } else {
    await db.insert(follows).values({ id: uid(), followerId, followingId, createdAt: new Date() });
    const who = (await briefUsers([followerId])).get(followerId);
    const href = who?.slug ? `/mutaxassislar/${who.slug}` : who?.username ? `/yozish/${who.username}` : null;
    // Obuna bo'lib-chiqib spam qilib bo'lmasin: bir odamdan 24 soatda bitta "obuna bo'ldi" bildirishnomasi
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const title = `${who?.name ?? "Foydalanuvchi"} sizga obuna bo'ldi`;
    const dup = await db.query.notifications.findFirst({ where: and(eq(notifications.userId, followingId), eq(notifications.type, "follow"), eq(notifications.title, title), gt(notifications.createdAt, since)), columns: { id: true } });
    if (!dup) await notify(followingId, "follow", title, "Yangi ishlaringiz uning lentasida ko'rinadi.", href);
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(follows).where(eq(follows.followingId, followingId));
  return { following: !existing, followersCount: Number(n) };
}

export interface FollowRow extends UserBrief {
  /** Ko'ruvchi bu odamga obuna bo'lganmi */
  following: boolean;
  followersCount: number;
}

/** Obunachilar (kimlar userId'ga obuna) yoki obunalar (userId kimlarga obuna): yangi → eski, cursor = follows.createdAt */
export async function listFollowers(userId: string, kind: "followers" | "following", viewer: Viewer, cursor: number | null = null, limit = 30): Promise<{ items: FollowRow[]; nextCursor: number | null }> {
  const anchor = kind === "followers" ? follows.followingId : follows.followerId;
  const other = kind === "followers" ? follows.followerId : follows.followingId;
  const conds = [eq(anchor, userId)];
  if (cursor) conds.push(lt(follows.createdAt, new Date(cursor)));
  const rows = await db
    .select({ id: other, at: follows.createdAt })
    .from(follows)
    .innerJoin(users, eq(users.id, other))
    .where(and(...conds, eq(users.isBanned, false)))
    .orderBy(desc(follows.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const ids = page.map((r) => r.id);
  if (!ids.length) return { items: [], nextCursor: null };
  const [briefs, mine, counts] = await Promise.all([
    briefUsers(ids),
    viewer ? db.query.follows.findMany({ where: and(eq(follows.followerId, viewer.id), inArray(follows.followingId, ids)), columns: { followingId: true } }) : Promise.resolve([] as Array<{ followingId: string }>),
    db.select({ id: follows.followingId, n: sql<number>`count(*)` }).from(follows).where(inArray(follows.followingId, ids)).groupBy(follows.followingId),
  ]);
  const mineSet = new Set(mine.map((m) => m.followingId));
  const countMap = new Map(counts.map((c) => [c.id, Number(c.n)]));
  const items = page.map((r) => ({ ...(briefs.get(r.id) ?? { id: r.id, ...UNKNOWN }), following: mineSet.has(r.id), followersCount: countMap.get(r.id) ?? 0 }));
  return { items, nextCursor: rows.length > limit ? page[page.length - 1].at.getTime() : null };
}

/** Kabinet uchun: men a'zo bo'lgan jamoalar soni (nav badge/statistika) */
export async function myGroupsCount(userId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(groupMembers)
    .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "active")));
  return Number(n);
}

/** Navbar nuqtasi: a'zo bo'lgan jamoalardan nechtasida oxirgi ko'rishdan keyin faollik bor (hasUnreadFor mantiqi SQL'da) */
export async function unreadGroupsCount(userId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(
      and(
        eq(groupMembers.userId, userId),
        eq(groupMembers.status, "active"),
        isNotNull(groups.lastActivityAt),
        or(and(isNull(groupMembers.lastReadAt), gt(groups.postsCount, 0)), sql`${groups.lastActivityAt} > ${groupMembers.lastReadAt} + 1000`),
      ),
    );
  return Number(n);
}

/** Sitemap: ochiq (yopiq bo'lmagan) jamoalar — oxirgi faollik yoki yaratilgan vaqt */
export async function getSitemapGroups(): Promise<Array<{ slug: string; lastModified: Date }>> {
  const rows = await db
    .select({ slug: groups.slug, lastActivityAt: groups.lastActivityAt, createdAt: groups.createdAt })
    .from(groups)
    .where(eq(groups.isPrivate, false))
    .orderBy(desc(groups.lastActivityAt))
    .limit(2000);
  return rows.map((r) => ({ slug: r.slug, lastModified: r.lastActivityAt ?? r.createdAt }));
}

/* ------------------------------------------------------------------ */
/* Route'lar uchun ruxsat yordamchilari                                */
/* ------------------------------------------------------------------ */
/** Yopiq jamoada lenta/chat/a'zolar faqat faol a'zoga (yoki sayt adminiga) ko'rinadi */
export async function assertCanView(group: Group, viewer: Viewer): Promise<GroupMember | null> {
  const m = await getMembership(group.id, viewer?.id);
  if (!canViewWith(group, m, viewer)) throw new ApiError(403, "Bu yopiq jamoa — kontent faqat a'zolarga ko'rinadi");
  return m;
}

/** Jamoa id'si bo'yicha ko'rish (yoki `memberOnly` — a'zolik) tekshiruvi; topilmasa 404 */
export async function canViewGroupId(groupId: string, viewer: Viewer, memberOnly = false): Promise<Group> {
  const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  if (!group) throw new ApiError(404, "Jamoa topilmadi");
  if (memberOnly) await assertActiveMember(group, viewer);
  else await assertCanView(group, viewer);
  return group;
}

export async function assertCanManage(group: Group, viewer: Viewer): Promise<GroupMember | null> {
  if (!viewer) throw new ApiError(401, "Avval tizimga kiring");
  const m = await getMembership(group.id, viewer.id);
  if (!canManageWith(m, viewer)) throw new ApiError(403, "Faqat jamoa egasi yoki admini");
  return m;
}

export function isGroupOwner(group: Group, viewer: Viewer): boolean {
  return Boolean(viewer && (viewer.id === group.ownerId || isSiteAdmin(viewer)));
}

/* ------------------------------------------------------------------ */
/* Qo'shimcha: pin, tahrir, mute, taklif kodi, o'qilganlar               */
/* ------------------------------------------------------------------ */
export async function setPostPinned(post: Post, pinned: boolean): Promise<Post> {
  const [row] = await db.update(posts).set({ isPinned: pinned, updatedAt: post.updatedAt }).where(eq(posts.id, post.id)).returning();
  return row;
}

export async function editPost(post: Post, body: string): Promise<Post> {
  const [row] = await db.update(posts).set({ body, updatedAt: new Date() }).where(eq(posts.id, post.id)).returning();
  return row;
}

/** Jim qilish: `forMs` berilsa vaqtincha (muted_until), bo'lmasa doimiy; muted=false ikkalasini tozalaydi */
export async function setMuted(group: Group, userId: string, muted: boolean, forMs: number | null = null): Promise<{ muted: boolean; mutedUntil: number | null }> {
  const until = muted && forMs ? new Date(Date.now() + forMs) : null;
  await db
    .update(groupMembers)
    .set({ muted: muted && !until, mutedUntil: until })
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)));
  return { muted, mutedUntil: until?.getTime() ?? null };
}

/** Efir eslatmalari (live_event bildirishnomasi) — a'zo sozlamasi */
export async function setEventReminders(group: Group, userId: string, on: boolean): Promise<void> {
  await db.update(groupMembers).set({ eventReminders: on }).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)));
}

export interface InviteInfo {
  code: string;
  expiresAt: number | null;
  maxUses: number | null;
  uses: number;
}

/**
 * Taklif kodi: bo'lmasa yaratadi; `rotate` — eskisini bekor qilib yangisini beradi (hisob 0 dan).
 * `expiresInMs` / `maxUses` — null: cheksiz; berilsa yangi qoida (rotate'siz ham o'zgartirsa bo'ladi).
 */
export async function ensureInviteCode(group: Group, rotate = false, opts: { expiresInMs?: number | null; maxUses?: number | null } = {}): Promise<InviteInfo> {
  const set: Partial<typeof groups.$inferInsert> = {};
  let code = group.inviteCode;
  if (!code || rotate) {
    code = uid().replace(/-/g, "").slice(0, 10);
    set.inviteCode = code;
    set.inviteUses = 0;
  }
  if (opts.expiresInMs !== undefined) set.inviteExpiresAt = opts.expiresInMs ? new Date(Date.now() + opts.expiresInMs) : null;
  if (opts.maxUses !== undefined) set.inviteMaxUses = opts.maxUses ?? null;
  const [row] = Object.keys(set).length ? await db.update(groups).set(set).where(eq(groups.id, group.id)).returning() : [group];
  return { code, expiresAt: row.inviteExpiresAt?.getTime() ?? null, maxUses: row.inviteMaxUses ?? null, uses: row.inviteUses ?? 0 };
}

/** Ko'ruvchining oxirgi xabarini nechta a'zo ko'rgan (lastReadAt >= xabar vaqti) — "N kishi ko'rdi" */
export async function seenCountFor(group: Group, viewerId: string, messageAt: Date): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.status, "active"), sql`${groupMembers.userId} != ${viewerId}`, sql`${groupMembers.lastReadAt} >= ${messageAt.getTime()}`));
  return Number(n);
}
