import "server-only";
import { and, asc, desc, eq, gt, inArray, like, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { follows, groupMembers, groupMessages, groups, postComments, postLikes, posts, specialists, users, type FileAttachment, type Group, type GroupMember, type Post, type PostComment } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { translit, uid } from "@/lib/utils";
import type { GroupInput } from "./validators";

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
  /** Ko'ruvchi bildirishnomalarni o'chirganmi */
  muted: boolean;
}

export interface PostView {
  id: string;
  groupId: string | null;
  body: string;
  media: FileAttachment[];
  likesCount: number;
  commentsCount: number;
  isPinned: boolean;
  /** Jonli efir / yig'ilish e'loni bo'lsa — vaqti (ms) va havolasi */
  eventAt: number | null;
  eventUrl: string | null;
  /** Nashrdan keyin tahrirlangan */
  edited: boolean;
  createdAt: number;
  author: UserBrief;
  likedByMe: boolean;
  canDelete: boolean;
}

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
}

type Viewer = { id: string; role: string } | null;

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
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl, username: users.username, slug: specialists.slug, lastSeenAt: users.lastSeenAt })
    .from(users)
    .leftJoin(specialists, eq(specialists.userId, users.id))
    .where(inArray(users.id, unique));
  const since = Date.now() - ONLINE_WINDOW_MS;
  for (const r of rows) {
    map.set(r.id, { id: r.id, name: r.name, avatarUrl: r.avatarUrl, username: r.username, slug: r.slug ?? null, online: Boolean(r.lastSeenAt && r.lastSeenAt.getTime() > since) });
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
  const [m, owner, pending] = await Promise.all([
    getMembership(group.id, viewer?.id),
    briefUsers([group.ownerId]),
    db
      .select({ n: sql<number>`count(*)` })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.status, "pending"))),
  ]);
  const canManage = canManageWith(m, viewer);
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
    muted: Boolean(m?.muted),
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
export async function listGroups(
  opts: { q?: string; category?: string; region?: string; mine?: boolean; kind?: "group" | "channel"; official?: boolean; limit?: number },
  viewer: Viewer,
): Promise<GroupListItem[]> {
  const conds = [];
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
      .orderBy(desc(groups.isOfficial), desc(groups.lastActivityAt), desc(groups.createdAt))
      .limit(opts.limit ?? 30);
    rows = joined.map((r) => r.g);
  } else if (opts.mine) {
    rows = [];
  } else {
    rows = await db.query.groups.findMany({
      where: conds.length ? and(...conds) : undefined,
      orderBy: [desc(groups.isOfficial), desc(groups.lastActivityAt), desc(groups.createdAt)],
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
    hasUnread: hasUnreadFor(g, byGroup.get(g.id) ?? null),
  }));
}

/** A'zo oxirgi ko'rganidan keyin faollik bo'lganmi (lenta/chat) — "yangi" nuqtasi uchun */
function hasUnreadFor(g: Group, m: GroupMember | null): boolean {
  if (!m || m.status !== "active" || !g.lastActivityAt) return false;
  if (!m.lastReadAt) return g.postsCount > 0;
  return g.lastActivityAt.getTime() > m.lastReadAt.getTime() + 1000;
}

export type GroupListItem = Omit<GroupView, "pendingCount" | "canManage" | "canView" | "canPost" | "inviteCode" | "muted"> & { hasUnread: boolean };

export async function loadGroupBySlug(slug: string): Promise<Group | null> {
  return (await db.query.groups.findFirst({ where: eq(groups.slug, slug) })) ?? null;
}

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
  await db.transaction(async (tx) => {
    await tx.insert(groups).values(row);
    await tx.insert(groupMembers).values([
      { id: uid(), groupId: id, userId: ownerId, role: "owner", status: "active", lastReadAt: now, createdAt: now },
      ...admins.map((userId) => ({ id: uid(), groupId: id, userId, role: "admin" as const, status: "active" as const, lastReadAt: now, createdAt: now })),
    ]);
  });
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

export async function updateGroup(group: Group, patch: Partial<GroupInput>): Promise<Group> {
  const set: Partial<typeof groups.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.category !== undefined) set.category = patch.category ?? null;
  if (patch.region !== undefined) set.region = patch.region ?? null;
  if (patch.coverUrl !== undefined) set.coverUrl = patch.coverUrl || null;
  if (patch.isPrivate !== undefined) set.isPrivate = patch.isPrivate;
  if (patch.kind !== undefined) set.kind = patch.kind;
  if (set.isPrivate && group.isOfficial) throw new ApiError(422, "Rasmiy kanal yopiq bo'la olmaydi", { isPrivate: "Rasmiy kanal hammaga ochiq" });
  if (set.kind === "group" && group.isOfficial) throw new ApiError(422, "Rasmiy kanal guruhga aylantirilmaydi", { kind: "Avval rasmiy belgisini oling" });
  if (!Object.keys(set).length) return group;
  const [row] = await db.update(groups).set(set).where(eq(groups.id, group.id)).returning();
  return row;
}

export async function deleteGroup(groupId: string): Promise<void> {
  await db.delete(groups).where(eq(groups.id, groupId));
}

/** Qo'shilish: ochiq jamoa — darhol a'zo; yopiq — so'rov (egasi/adminlar bildirishnoma oladi) */
export async function joinGroup(group: Group, userId: string, invite?: string | null): Promise<MembershipState> {
  const existing = await getMembership(group.id, userId);
  if (existing) {
    if (existing.status === "banned") throw new ApiError(403, "Siz bu jamoadan chiqarilgansiz");
    return membershipState(existing);
  }
  const now = new Date();
  // Taklif havolasi to'g'ri bo'lsa — yopiq jamoaga ham darhol a'zo
  const viaInvite = Boolean(invite && group.inviteCode && invite === group.inviteCode);
  const status = group.isPrivate && !viaInvite ? "pending" : "active";
  await db.transaction(async (tx) => {
    await tx.insert(groupMembers).values({ id: uid(), groupId: group.id, userId, role: "member", status, lastReadAt: now, createdAt: now });
    if (status === "active") await tx.update(groups).set({ membersCount: sql`${groups.membersCount} + 1`, lastActivityAt: now }).where(eq(groups.id, group.id));
  });
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

export async function leaveGroup(group: Group, userId: string): Promise<void> {
  const m = await getMembership(group.id, userId);
  if (!m) return;
  if (group.isOfficial && m.status === "active") throw new ApiError(400, "Bu rasmiy kanal — undan chiqib bo'lmaydi. Bildirishnomalarni kabinetda sozlashingiz mumkin.");
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
}

export async function listMembers(groupId: string, status: "active" | "pending" = "active", limit = 200): Promise<MemberView[]> {
  const rows = await db.query.groupMembers.findMany({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, status)),
    orderBy: [asc(groupMembers.createdAt)],
    limit,
  });
  const briefs = await briefUsers(rows.map((r) => r.userId));
  const rank: Record<GroupMember["role"], number> = { owner: 0, admin: 1, member: 2 };
  return rows
    .map((r) => ({ user: briefs.get(r.userId) ?? { id: r.userId, ...UNKNOWN }, role: r.role, status: r.status, joinedAt: r.createdAt.getTime() }))
    .sort((a, b) => rank[a.role] - rank[b.role] || a.joinedAt - b.joinedAt);
}

/** Moderator amallari: tasdiqlash / rad etish / chiqarish / admin qilish / adminlikdan olish */
export async function memberAction(group: Group, actor: { id: string; role: string }, targetUserId: string, action: "approve" | "reject" | "remove" | "promote" | "demote"): Promise<void> {
  const actorM = await getMembership(group.id, actor.id);
  if (!canManageWith(actorM, actor)) throw new ApiError(403, "Faqat jamoa egasi yoki admini");
  const target = await getMembership(group.id, targetUserId);
  if (!target) throw new ApiError(404, "A'zo topilmadi");
  if (target.role === "owner") throw new ApiError(400, "Egasi ustida amal bajarib bo'lmaydi");
  const isOwner = actorM?.role === "owner" || isSiteAdmin(actor);
  const now = new Date();

  switch (action) {
    case "approve": {
      if (target.status !== "pending") return;
      await db.transaction(async (tx) => {
        await tx.update(groupMembers).set({ status: "active", lastReadAt: now }).where(eq(groupMembers.id, target.id));
        await tx.update(groups).set({ membersCount: sql`${groups.membersCount} + 1`, lastActivityAt: now }).where(eq(groups.id, group.id));
      });
      await notify(targetUserId, "group_joined", `«${group.name}» jamoasiga qabul qilindingiz`, "Endi lenta va chat sizga ochiq.", `/jamoalar/${group.slug}`);
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
  // Kanal posti yoki efir e'loni — a'zolarga bildirishnoma (sayt + Telegram; email emas — kvota)
  if (group.kind === "channel" || event.at) {
    const href = `/jamoalar/${group.slug}?post=${row.id}`;
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
  const members = await db.query.groupMembers.findMany({ where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.status, "active"), eq(groupMembers.muted, false)), columns: { userId: true } });
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

async function toPostViews(rows: Post[], viewer: Viewer, manager: boolean): Promise<PostView[]> {
  if (!rows.length) return [];
  const [authors, liked] = await Promise.all([
    briefUsers(rows.map((p) => p.authorId)),
    viewer
      ? db.query.postLikes.findMany({
          where: and(
            eq(postLikes.userId, viewer.id),
            inArray(
              postLikes.postId,
              rows.map((p) => p.id),
            ),
          ),
          columns: { postId: true },
        })
      : Promise.resolve([] as Array<{ postId: string }>),
  ]);
  const likedSet = new Set(liked.map((l) => l.postId));
  return rows.map((p) => ({
    id: p.id,
    groupId: p.groupId,
    body: p.body,
    media: p.media,
    likesCount: p.likesCount,
    commentsCount: p.commentsCount,
    isPinned: p.isPinned,
    eventAt: p.eventAt?.getTime() ?? null,
    eventUrl: p.eventUrl ?? null,
    edited: p.updatedAt.getTime() - p.createdAt.getTime() > 60_000,
    createdAt: p.createdAt.getTime(),
    author: authors.get(p.authorId) ?? { id: p.authorId, ...UNKNOWN },
    likedByMe: likedSet.has(p.id),
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

export async function toggleLike(post: Post, userId: string): Promise<{ liked: boolean; likesCount: number }> {
  const existing = await db.query.postLikes.findFirst({ where: and(eq(postLikes.postId, post.id), eq(postLikes.userId, userId)) });
  let liked: boolean;
  await db.transaction(async (tx) => {
    if (existing) {
      await tx.delete(postLikes).where(eq(postLikes.id, existing.id));
      await tx.update(posts).set({ likesCount: sql`max(${posts.likesCount} - 1, 0)` }).where(eq(posts.id, post.id));
      liked = false;
    } else {
      await tx.insert(postLikes).values({ id: uid(), postId: post.id, userId, createdAt: new Date() });
      await tx.update(posts).set({ likesCount: sql`${posts.likesCount} + 1` }).where(eq(posts.id, post.id));
      liked = true;
    }
  });
  const fresh = await loadPost(post.id);
  return { liked: liked!, likesCount: fresh?.likesCount ?? post.likesCount };
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
  if (post.authorId !== authorId) {
    const who = (await briefUsers([authorId])).get(authorId)?.name ?? "Foydalanuvchi";
    const g = post.groupId ? await db.query.groups.findFirst({ where: eq(groups.id, post.groupId), columns: { slug: true } }) : null;
    await notify(post.authorId, "post_comment", `${who} postingizga izoh qoldirdi`, body.length > 100 ? `${body.slice(0, 97)}…` : body, g ? `/jamoalar/${g.slug}?post=${post.id}` : null);
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
export async function listGroupMessages(group: Group, viewer: Viewer, afterId?: string | null, limit = 200): Promise<GroupMessageView[]> {
  let rows;
  if (afterId) {
    const m = await db.query.groupMessages.findFirst({ where: and(eq(groupMessages.id, afterId), eq(groupMessages.groupId, group.id)), columns: { createdAt: true } });
    rows = m
      ? await db.query.groupMessages.findMany({ where: and(eq(groupMessages.groupId, group.id), gt(groupMessages.createdAt, m.createdAt)), orderBy: [asc(groupMessages.createdAt), asc(groupMessages.id)], limit })
      : [];
  } else {
    rows = (await db.query.groupMessages.findMany({ where: eq(groupMessages.groupId, group.id), orderBy: [desc(groupMessages.createdAt), desc(groupMessages.id)], limit })).reverse();
  }
  const senders = await briefUsers(rows.map((r) => r.senderId));
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    attachments: r.attachments,
    at: r.createdAt.getTime(),
    mine: viewer?.id === r.senderId,
    sender: senders.get(r.senderId) ?? { id: r.senderId, ...UNKNOWN },
  }));
}

export async function sendGroupMessage(group: Group, senderId: string, body: string, attachments: FileAttachment[]) {
  const now = new Date();
  const row: typeof groupMessages.$inferInsert = { id: uid(), groupId: group.id, senderId, body, attachments, createdAt: now };
  await db.insert(groupMessages).values(row);
  await Promise.all([touchActivity(group.id), markGroupRead(group.id, senderId)]);
  return { ...row, createdAt: now };
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
  const existing = await db.query.follows.findFirst({ where: and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)) });
  if (existing) {
    await db.delete(follows).where(eq(follows.id, existing.id));
  } else {
    await db.insert(follows).values({ id: uid(), followerId, followingId, createdAt: new Date() });
    const who = (await briefUsers([followerId])).get(followerId);
    await notify(followingId, "follow", `${who?.name ?? "Foydalanuvchi"} sizga obuna bo'ldi`, "Yangi ishlaringiz uning lentasida ko'rinadi.", who?.slug ? `/mutaxassislar/${who.slug}` : who?.username ? `/yozish/${who.username}` : null);
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(follows).where(eq(follows.followingId, followingId));
  return { following: !existing, followersCount: Number(n) };
}

/** Kabinet uchun: men a'zo bo'lgan jamoalar soni (nav badge/statistika) */
export async function myGroupsCount(userId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(groupMembers)
    .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "active")));
  return Number(n);
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

export async function setMuted(group: Group, userId: string, muted: boolean): Promise<void> {
  await db.update(groupMembers).set({ muted }).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)));
}

/** Taklif kodi: bo'lmasa yaratadi; `rotate` — eskisini bekor qilib yangisini beradi */
export async function ensureInviteCode(group: Group, rotate = false): Promise<string> {
  if (group.inviteCode && !rotate) return group.inviteCode;
  const code = uid().replace(/-/g, "").slice(0, 10);
  await db.update(groups).set({ inviteCode: code }).where(eq(groups.id, group.id));
  return code;
}

/** Ko'ruvchining oxirgi xabarini nechta a'zo ko'rgan (lastReadAt >= xabar vaqti) — "N kishi ko'rdi" */
export async function seenCountFor(group: Group, viewerId: string, messageAt: Date): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.status, "active"), sql`${groupMembers.userId} != ${viewerId}`, sql`${groupMembers.lastReadAt} >= ${messageAt.getTime()}`));
  return Number(n);
}
