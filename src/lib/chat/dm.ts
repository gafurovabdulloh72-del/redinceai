import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { protectAttachments } from "@/lib/media/private-url";
import { callPreview } from "@/lib/call/format";
import { db } from "@/lib/db";
import { conversations, dmConversationPrefs, dmFolders, dmMessageReactions, dmMessages, groupMembers, specialists, users, type Conversation, type FileAttachment } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { blockedPeerIds } from "@/lib/privacy/blocks";
import { escapeLike, uid } from "@/lib/utils";
import { bustGroupInbox } from "./inbox";
import { TYPING_WINDOW_MS, quoteKind, toQuote, type QuoteView } from "./quote";
import { DM_BODY_MAX, DM_EDIT_WINDOW_MS, DM_REACTIONS, type ReactionSummary } from "./constants";

export { DM_BODY_MAX };

/**
 * Ichki chat (DM) — buyurtmadan mustaqil, ikki foydalanuvchi o'rtasida.
 * Suhbat juftlik bo'yicha yagona (aId < bId); o'qilganlik har tomon uchun o'z vaqt belgisi bilan.
 * Qo'shimcha: tahrirlash (3 soat), o'chirish (men uchun / hamma uchun, doim mumkin), reaksiyalar, qadash,
 * yo'naltirish, qidiruv, media ro'yxati, suhbat sozlamalari (arxiv / ovozsiz / qadash).
 *
 * KO'RINISH QOIDASI (yagona): xabar ko'ruvchiga faqat (a) muddati o'tmagan (`expires_at`) va (b) u «men uchun
 * o'chirmagan» (`hidden_for`) bo'lsa ko'rinadi. Bu shart ro'yxatdagi parcha, o'qilmaganlar soni, qidiruv, iqtibos,
 * qadash, yo'naltirish va media ro'yxatlarida BIR XIL qo'llanadi (`notExpired()` + `notHiddenFor()`).
 */

/** Suhbatdagi "qarshi tomon" — ichki (server) ko'rinish; klientga faqat `toPeerView` orqali chiqadi */
export interface DmPeer {
  id: string;
  username: string | null;
  name: string;
  avatarUrl: string | null;
  role: string;
  isBanned: boolean;
  /** Oxirgi chatdagi faollik — "onlayn" ko'rsatkichi uchun (null — hali chat ochmagan) */
  lastSeenAt: Date | null;
  /** Oxirgi tizimga kirish — lastSeenAt bo'lmaganda "oxirgi faollik" shundan ko'rsatiladi */
  lastLoginAt: Date | null;
  /** Mutaxassis profili slug'i (bor bo'lsa) — ism bosilganda profilga o'tadi; mijozlarda null */
  slug?: string | null;
  /** Tasdiqlangan mutaxassis — chat sarlavhasida ko'k belgi */
  isVerified?: boolean;
  /** Maxfiylik: onlayn holatini ko'rsatadimi; kim yozishi mumkin */
  showOnline: boolean;
  dmPolicy: string;
}

const PEER_COLUMNS = { id: true, username: true, name: true, avatarUrl: true, role: true, isBanned: true, lastSeenAt: true, lastLoginAt: true, showOnline: true, dmPolicy: true } as const;

/**
 * Qarshi tomonning KLIENTGA chiqadigan ko'rinishi (ro'yxat va suhbat sarlavhasi uchun BIR XIL).
 * Maxfiylik: `showOnline=false` yoki blok juftligi bo'lsa onlayn/oxirgi faollik vaqtlari null; `dmPolicy`, `showOnline`,
 * `lastLoginAt`, `role` kabi ichki maydonlar umuman chiqmaydi. Vaqtlar — ms (klient `Date.now()` bilan solishtiradi).
 */
export interface PeerView {
  id: string;
  username: string | null;
  name: string;
  avatarUrl: string | null;
  isBanned: boolean;
  slug: string | null;
  isVerified: boolean;
  /** Chatdagi real faollik (ms) — «Onlayn» belgisi shundan; yashirin bo'lsa null */
  lastSeenAt: number | null;
  /** Oxirgi faollik (ms): chat faolligi bo'lmasa tizimga kirish vaqti; yashirin bo'lsa null */
  lastActiveAt: number | null;
}

export function toPeerView(p: DmPeer, hidePresence = false): PeerView {
  const show = p.showOnline !== false && !hidePresence;
  return {
    id: p.id,
    username: p.username,
    name: p.name,
    avatarUrl: p.avatarUrl,
    isBanned: p.isBanned,
    slug: p.slug ?? null,
    isVerified: Boolean(p.isVerified),
    lastSeenAt: show && p.lastSeenAt ? p.lastSeenAt.getTime() : null,
    lastActiveAt: show ? ((p.lastSeenAt ?? p.lastLoginAt)?.getTime() ?? null) : null,
  };
}

/** Shu oraliqda faollik bo'lsa — "onlayn" deb ko'rsatiladi */
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;

/** Ovozli xabar biriktirmasi */
const isVoice = (a: FileAttachment) => a.type.startsWith("audio/") || /\.(?:weba|m4a|ogg)$/i.test(a.url);

/**
 * Oxirgi faollikni belgilash — chat so'rovlarida chaqiriladi.
 * Har so'rovda yozmaslik uchun: faqat 60 soniyadan eski bo'lsa yangilanadi (bitta shartli UPDATE).
 */
export async function touchLastSeen(meId: string): Promise<void> {
  const now = Date.now();
  await db
    .update(users)
    .set({ lastSeenAt: new Date(now) })
    .where(and(eq(users.id, meId), or(sql`${users.lastSeenAt} is null`, sql`${users.lastSeenAt} < ${now - 60_000}`)));
}

function pair(u1: string, u2: string): [string, string] {
  return u1 < u2 ? [u1, u2] : [u2, u1];
}

export function peerOf(conv: Pick<Conversation, "aId" | "bId">, meId: string): string {
  return conv.aId === meId ? conv.bId : conv.aId;
}

function myReadAt(conv: Conversation, meId: string): number {
  const t = conv.aId === meId ? conv.aReadAt : conv.bReadAt;
  return t ? t.getTime() : 0;
}

/** Suhbatni topish yoki yaratish (ikkala foydalanuvchi mavjud va bloklanmagan bo'lishi chaqiruvchida tekshiriladi) */
export async function getOrCreateConversation(meId: string, otherId: string): Promise<Conversation> {
  const [aId, bId] = pair(meId, otherId);
  const found = await db.query.conversations.findFirst({ where: and(eq(conversations.aId, aId), eq(conversations.bId, bId)) });
  if (found) return found;
  const row: typeof conversations.$inferInsert = { id: uid(), aId, bId, createdBy: meId, createdAt: new Date() };
  // Poyga: parallel ikki so'rov bir juftlikni yaratsa — unique indeks ikkinchisini yiqitadi, qayta o'qiymiz
  try {
    await db.insert(conversations).values(row);
  } catch {
    const again = await db.query.conversations.findFirst({ where: and(eq(conversations.aId, aId), eq(conversations.bId, bId)) });
    if (again) return again;
    throw new Error("Suhbat yaratilmadi");
  }
  return { ...row, lastMessageAt: null, aReadAt: null, bReadAt: null, aTypingAt: null, bTypingAt: null, pinnedMessageId: null, createdAt: row.createdAt! } as Conversation;
}

/* ------------------------------------------------------------------ */
/* Suhbat sozlamalari (har tomon o'ziniki): arxiv / ovozsiz / qadash   */
/* ------------------------------------------------------------------ */
export interface ConvPrefs {
  archived: boolean;
  muted: boolean;
  pinned: boolean;
  /** Papka (dm_folders.id) yoki null — «Hammasi» */
  folderId: string | null;
}
const DEFAULT_PREFS: ConvPrefs = { archived: false, muted: false, pinned: false, folderId: null };
const toPrefs = (r: { archived: boolean; muted: boolean; pinned: boolean; folderId: string | null }): ConvPrefs => ({ archived: r.archived, muted: r.muted, pinned: r.pinned, folderId: r.folderId });

export async function getPrefs(convId: string, meId: string): Promise<ConvPrefs> {
  const row = await db.query.dmConversationPrefs.findFirst({ where: and(eq(dmConversationPrefs.conversationId, convId), eq(dmConversationPrefs.userId, meId)) });
  return row ? toPrefs(row) : DEFAULT_PREFS;
}

async function prefsMap(meId: string, convIds: string[]): Promise<Map<string, ConvPrefs>> {
  const map = new Map<string, ConvPrefs>();
  if (!convIds.length) return map;
  const rows = await db.query.dmConversationPrefs.findMany({ where: and(eq(dmConversationPrefs.userId, meId), inArray(dmConversationPrefs.conversationId, convIds)) });
  for (const r of rows) map.set(r.conversationId, toPrefs(r));
  return map;
}

/** Sozlamani yangilash (upsert) — qaytaradi: yangi holat */
export async function setPrefs(convId: string, meId: string, patch: Partial<ConvPrefs>): Promise<ConvPrefs> {
  const cur = await db.query.dmConversationPrefs.findFirst({ where: and(eq(dmConversationPrefs.conversationId, convId), eq(dmConversationPrefs.userId, meId)) });
  if (patch.folderId) {
    const f = await db.query.dmFolders.findFirst({ where: and(eq(dmFolders.id, patch.folderId), eq(dmFolders.userId, meId)), columns: { id: true } });
    if (!f) throw new ApiError(404, "Papka topilmadi");
  }
  const next: ConvPrefs = { ...(cur ? toPrefs(cur) : DEFAULT_PREFS), ...patch };
  if (cur) await db.update(dmConversationPrefs).set({ ...next, updatedAt: new Date() }).where(eq(dmConversationPrefs.id, cur.id));
  else await db.insert(dmConversationPrefs).values({ id: uid(), conversationId: convId, userId: meId, ...next, updatedAt: new Date() });
  return next;
}

/* ------------------------------------------------------------------ */
/* Ro'yxat                                                             */
/* ------------------------------------------------------------------ */
export interface ConvListRow {
  id: string;
  peer: PeerView;
  /** Menga KO'RINADIGAN oxirgi xabar (muddati o'tgan / «men uchun o'chirilgan»lar hisobga olinmaydi) */
  last: { body: string; mine: boolean; at: number; hasFiles: boolean; voice: boolean; deleted: boolean; kind: QuoteView["kind"] } | null;
  /** Saralash vaqti (ms): oxirgi ko'rinadigan xabar, bo'lmasa suhbat yaratilgan vaqt */
  sortAt: number;
  unread: number;
  prefs: ConvPrefs;
  /** Suhbatdosh hozir yozmoqda (so'nggi 6 soniya) */
  peerTyping: boolean;
  /** Yo'qoladigan xabarlar rejimi yoqilgan (soniya; 0 — o'chiq) */
  ttlSeconds: number;
}

/**
 * Mening suhbatlarim: qarshi tomon, oxirgi xabar, o'qilmaganlar, sozlamalar (qadalganlar birinchi, keyin faollik bo'yicha).
 * Ro'yxatda FAQAT menga ko'rinadigan kamida bitta xabari bor suhbat chiqadi (Telegram qoidasi):
 *  - xabarsiz suhbat («Yozish» bosilib, hech narsa yuborilmagan) hech kimning ro'yxatida turmaydi — bo'sh qator qolmasin;
 *    u manzil orqali (`?s=<id>`) ochiladi va birinchi xabardan keyin ro'yxatga tushadi;
 *  - xabari bor, lekin menga hech biri ko'rinmaydigan suhbat («men uchun o'chirilgan» / hammasi yo'qolgan) ham chiqmaydi —
 *    yangi xabar kelsa o'zi qaytadi (`deleteConversationForMe` shunga tayanadi).
 */
export async function listConversations(meId: string, limit = 60, folder?: string | null): Promise<ConvListRow[]> {
  const rows = await db.query.conversations.findMany({
    where: and(or(eq(conversations.aId, meId), eq(conversations.bId, meId)), sql`${conversations.lastMessageAt} is not null`),
    orderBy: [desc(sql`coalesce(${conversations.lastMessageAt}, ${conversations.createdAt})`)],
    limit,
    with: {
      a: { columns: PEER_COLUMNS },
      b: { columns: PEER_COLUMNS },
      // Oxirgi KO'RINADIGAN xabar: muddati o'tmagan va men uchun o'chirilmagan (aks holda qator bo'sh qolardi yoki o'chgan matn ko'rinardi)
      messages: {
        where: (m, { and: all, or: any, isNull: nil, gt: after }) => all(any(nil(m.expiresAt), after(m.expiresAt, new Date())), sql`not exists (select 1 from json_each(coalesce(${m.hiddenFor}, '[]')) where value = ${meId})`),
        orderBy: [desc(dmMessages.createdAt)],
        limit: 1,
        columns: { id: true, senderId: true, body: true, attachments: true, createdAt: true, deletedAt: true, call: true },
      },
    },
  });
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  // O'qilmaganlar — bitta guruhlangan so'rov (har suhbatga alohida count emas); ko'rinmaydigan xabarlar sanalmaydi
  const [unreadRows, prefs, blocked, spRows] = await Promise.all([
    db
      .select({ convId: dmMessages.conversationId, n: sql<number>`count(*)` })
      .from(dmMessages)
      .innerJoin(conversations, eq(conversations.id, dmMessages.conversationId))
      .where(
        and(
          inArray(dmMessages.conversationId, ids),
          ne(dmMessages.senderId, meId),
          isNull(dmMessages.deletedAt),
          notExpired(),
          notHiddenFor(meId),
          gt(dmMessages.createdAt, sql`coalesce(case when ${conversations.aId} = ${meId} then ${conversations.aReadAt} else ${conversations.bReadAt} end, 0)`),
        ),
      )
      .groupBy(dmMessages.conversationId),
    prefsMap(meId, ids),
    blockedPeerIds(meId),
    // Tasdiqlangan mutaxassis belgisi va profil havolasi — bitta so'rovda (har qatorga alohida emas)
    db
      .select({ userId: specialists.userId, slug: specialists.slug, isVerified: specialists.isVerified })
      .from(specialists)
      .where(inArray(specialists.userId, rows.map((c) => (c.aId === meId ? c.bId : c.aId)))),
  ]);
  const unread = new Map(unreadRows.map((r) => [r.convId, Number(r.n)]));
  const sp = new Map(spRows.map((r) => [r.userId, r]));
  const now = Date.now();

  const out: ConvListRow[] = [];
  for (const c of rows) {
    const peer = { ...(c.aId === meId ? c.b : c.a) } as DmPeer;
    const m = c.messages[0];
    // Menga ko'rinadigan xabari yo'q suhbat — ro'yxatda yo'q (yangi xabar kelguncha)
    if (!m) continue;
    const s = sp.get(peer.id);
    peer.slug = s?.slug ?? null;
    peer.isVerified = Boolean(s?.isVerified);
    const peerTypingAt = c.aId === meId ? c.bTypingAt : c.aTypingAt;
    const isBlocked = blocked.has(peer.id);
    out.push({
      id: c.id,
      peer: toPeerView(peer, isBlocked),
      last: {
        body: m.deletedAt ? "" : m.call ? callPreview(m.call, m.senderId === meId) : m.body,
        mine: m.senderId === meId,
        at: m.createdAt.getTime(),
        hasFiles: !m.deletedAt && (m.attachments?.length ?? 0) > 0,
        voice: !m.deletedAt && (m.attachments ?? []).some(isVoice),
        deleted: Boolean(m.deletedAt),
        kind: m.deletedAt ? "text" : quoteKind(m.attachments ?? []),
      },
      sortAt: m.createdAt.getTime(),
      unread: unread.get(c.id) ?? 0,
      prefs: prefs.get(c.id) ?? DEFAULT_PREFS,
      // Blok juftligida «yozmoqda» ham ko'rinmaydi
      peerTyping: !isBlocked && Boolean(peerTypingAt && now - peerTypingAt.getTime() < TYPING_WINDOW_MS),
      ttlSeconds: c.ttlSeconds,
    });
  }
  // Papka filtri: `folder` berilsa faqat shu papkadagilar («arxiv» — arxivlanganlar)
  const filtered = !folder ? out : folder === "arxiv" ? out.filter((r) => r.prefs.archived) : out.filter((r) => r.prefs.folderId === folder);
  // Qadalganlar tepada; qolganlari menga ko'rinadigan oxirgi faollik bo'yicha
  filtered.sort((x, y) => Number(y.prefs.pinned) - Number(x.prefs.pinned) || y.sortAt - x.sortAt);
  return filtered;
}

/** Suhbatga a'zolik tekshiruvi bilan yuklash */
export async function loadConversationFor(meId: string, convId: string) {
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, convId),
    with: { a: { columns: PEER_COLUMNS }, b: { columns: PEER_COLUMNS } },
  });
  if (!conv || (conv.aId !== meId && conv.bId !== meId)) return null;
  const peer = (conv.aId === meId ? conv.b : conv.a) as DmPeer;
  // Qarshi tomon mutaxassis bo'lsa — profil slug'i (ism bosilganda /mutaxassislar/<slug>'ga o'tadi)
  if (peer.role === "specialist") {
    const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, peer.id), columns: { slug: true, isVerified: true } });
    peer.slug = sp?.slug ?? null;
    peer.isVerified = Boolean(sp?.isVerified);
  }
  // Qarshi tomon suhbatni oxirgi marta qachon o'qigani — ✓✓ (o'qildi) belgisi uchun
  const peerReadAt = conv.aId === meId ? conv.bReadAt : conv.aReadAt;
  return { conv, peer, peerReadAt, myReadAt: myReadAt(conv, meId) };
}

/* ------------------------------------------------------------------ */
/* Xabarlar                                                            */
/* ------------------------------------------------------------------ */
type DmRow = typeof dmMessages.$inferSelect;

const visibleTo = (meId: string) => (m: Pick<DmRow, "hiddenFor">) => !(m.hiddenFor ?? []).includes(meId);

/** O'z-o'zidan yo'qoladigan xabar vaqti o'tgan bo'lsa so'rovlarda chiqmaydi (cron keyinroq o'chiradi) */
const notExpired = () => or(isNull(dmMessages.expiresAt), gt(dmMessages.expiresAt, new Date()));
/** «Men uchun o'chirilgan» emas (hidden_for JSON ro'yxatida men yo'q) — SQL darajasida (sanash/qidiruv/sahifalash uchun) */
const notHiddenFor = (meId: string) => sql`not exists (select 1 from json_each(coalesce(${dmMessages.hiddenFor}, '[]')) where value = ${meId})`;
/** Xabar hozir ko'ruvchiga ko'rinadimi (qator darajasida — bitta xabar ustidagi amallar uchun) */
const isLive = (m: Pick<DmRow, "expiresAt" | "hiddenFor">, meId: string) => !(m.expiresAt && m.expiresAt.getTime() <= Date.now()) && !(m.hiddenFor ?? []).includes(meId);

/** Bir sahifadagi xabarlar soni (birinchi ochilish va «eskiroq» sahifalar) */
export const DM_PAGE = 80;
/** Qidiruv/qadalgan xabarga sakrashda bir so'rovda yuklanadigan eng ko'p xabar (undan uzoqdagisi uchun tarix yuqoriga aylantiriladi) */
export const DM_JUMP_MAX = 1200;
/** Sakrashda nishon xabardan oldingi kontekst */
const JUMP_CONTEXT = 20;

export interface MessagePage {
  rows: DmRow[];
  /** Bu oynadan ESKIROQ xabarlar bormi (yuqoriga aylantirganda yuklash uchun) */
  hasMore: boolean;
}

/** (createdAt, id) bo'yicha qat'iy «oldin» sharti — bir xil millisoniyadagi xabarlar sahifa chegarasida yo'qolmasin */
const before = (at: Date, id: string) => or(lt(dmMessages.createdAt, at), and(eq(dmMessages.createdAt, at), lt(dmMessages.id, id)));

/**
 * Xabarlar (eski → yangi). «Men uchun o'chirilgan» va muddati o'tganlar chiqmaydi.
 *  - `afterId`  — faqat undan keyingilar (polling);
 *  - `beforeId` — undan OLDINGI bir sahifa (yuqoriga aylantirish, C1);
 *  - `fromId`   — shu xabardan (biroz oldingi kontekst bilan) eng yangisigacha — qidiruv/qadalgan xabarga sakrash;
 *                 oraliq `DM_JUMP_MAX` dan uzun bo'lsa 422 (klient «tarixni aylantiring» deydi);
 *  - hech biri — oxirgi `limit` ta.
 */
export async function listMessages(convId: string, meId: string, opts: { afterId?: string | null; beforeId?: string | null; fromId?: string | null; limit?: number } = {}): Promise<MessagePage> {
  const limit = opts.limit ?? DM_PAGE;
  const base = and(eq(dmMessages.conversationId, convId), notExpired(), notHiddenFor(meId));
  const cursor = async (id: string) => (await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, id), eq(dmMessages.conversationId, convId)), columns: { id: true, createdAt: true } })) ?? null;

  if (opts.afterId) {
    const c = await cursor(opts.afterId);
    if (c) {
      const rows = await db.query.dmMessages.findMany({ where: and(base, gt(dmMessages.createdAt, c.createdAt)), orderBy: [asc(dmMessages.createdAt), asc(dmMessages.id)], limit: 200 });
      return { rows, hasMore: false };
    }
  }
  if (opts.beforeId) {
    const c = await cursor(opts.beforeId);
    if (!c) return { rows: [], hasMore: false };
    const rows = await db.query.dmMessages.findMany({ where: and(base, before(c.createdAt, c.id)), orderBy: [desc(dmMessages.createdAt), desc(dmMessages.id)], limit: limit + 1 });
    return { rows: rows.slice(0, limit).reverse(), hasMore: rows.length > limit };
  }
  if (opts.fromId) {
    const c = await cursor(opts.fromId);
    if (!c) throw new ApiError(404, "Xabar topilmadi");
    const [older, newer] = await Promise.all([
      db.query.dmMessages.findMany({ where: and(base, before(c.createdAt, c.id)), orderBy: [desc(dmMessages.createdAt), desc(dmMessages.id)], limit: JUMP_CONTEXT + 1 }),
      db.query.dmMessages.findMany({ where: and(base, or(gt(dmMessages.createdAt, c.createdAt), and(eq(dmMessages.createdAt, c.createdAt), sql`${dmMessages.id} >= ${c.id}`))), orderBy: [asc(dmMessages.createdAt), asc(dmMessages.id)], limit: DM_JUMP_MAX + 1 }),
    ]);
    if (newer.length > DM_JUMP_MAX) throw new ApiError(422, "Xabar juda eski — tarixni yuqoriga aylantirib oching");
    return { rows: [...older.slice(0, JUMP_CONTEXT).reverse(), ...newer], hasMore: older.length > JUMP_CONTEXT };
  }
  // Birinchi ochilish: OXIRGI `limit` ta xabar — teskari tartibda olib, eski → yangi qilib qaytaramiz
  const rows = await db.query.dmMessages.findMany({ where: base, orderBy: [desc(dmMessages.createdAt), desc(dmMessages.id)], limit: limit + 1 });
  return { rows: rows.slice(0, limit).reverse(), hasMore: rows.length > limit };
}

/** Polling: `since`dan keyin tahrirlangan/o'chirilgan eski xabarlar (klient joyida yangilaydi) */
export async function changedMessages(convId: string, meId: string, since: number, limit = 50): Promise<DmRow[]> {
  if (!since) return [];
  const s = new Date(since);
  return db.query.dmMessages.findMany({
    where: and(eq(dmMessages.conversationId, convId), notExpired(), notHiddenFor(meId), or(gt(dmMessages.editedAt, s), gt(dmMessages.deletedAt, s))),
    orderBy: [desc(dmMessages.createdAt)],
    limit,
  });
}

const GONE_QUOTE = (id: string, senderName = ""): QuoteView => ({ id, body: "Xabar o'chirildi", senderName, kind: "text" });

/**
 * Iqtiboslar: xabarlar ichidagi replyToId'lar bo'yicha asl xabarlar (faqat shu suhbatdan).
 * O'chirilgan, muddati o'tgan yoki (`meId` berilsa) men uchun o'chirilgan asl xabar matni chiqmaydi — «Xabar o'chirildi».
 */
export async function dmQuotes(convId: string, rows: Array<{ replyToId: string | null }>, meId?: string): Promise<Map<string, QuoteView>> {
  const ids = [...new Set(rows.map((r) => r.replyToId).filter((x): x is string => Boolean(x)))];
  const map = new Map<string, QuoteView>();
  if (!ids.length) return map;
  const originals = await db.query.dmMessages.findMany({ where: and(eq(dmMessages.conversationId, convId), inArray(dmMessages.id, ids)) });
  const senderIds = [...new Set(originals.map((o) => o.senderId))];
  const names = new Map((await db.query.users.findMany({ where: inArray(users.id, senderIds), columns: { id: true, name: true } })).map((u) => [u.id, u.name]));
  for (const o of originals) {
    const gone = Boolean(o.deletedAt) || !isLive(o, meId ?? "");
    map.set(o.id, gone ? GONE_QUOTE(o.id, names.get(o.senderId) ?? "") : toQuote(o, names.get(o.senderId) ?? "Foydalanuvchi"));
  }
  return map;
}

/** Qadalgan xabar (iqtibos ko'rinishida) — yo'q / o'chirilgan / muddati o'tgan / men uchun o'chirilgan bo'lsa null */
export async function pinnedQuote(conv: Conversation, meId?: string): Promise<QuoteView | null> {
  if (!conv.pinnedMessageId) return null;
  const m = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, conv.pinnedMessageId), eq(dmMessages.conversationId, conv.id)) });
  if (!m || m.deletedAt || !isLive(m, meId ?? "")) return null;
  const sender = await db.query.users.findFirst({ where: eq(users.id, m.senderId), columns: { name: true } });
  return toQuote(m, sender?.name ?? "Foydalanuvchi");
}

/* ------------------------------------------------------------------ */
/* Reaksiyalar                                                         */
/* ------------------------------------------------------------------ */
export type ReactionMap = Map<string, ReactionSummary[]>;

/** Reaksiyalar jonli sinxronlanadigan oyna: suhbatning so'nggi shuncha xabari */
const REACTION_WINDOW = 200;

/** Suhbatdagi so'nggi oynadagi (200 ta) xabarlar reaksiyalari — bitta guruhlangan so'rov; `msgIds` berilsa faqat o'shalar */
export async function reactionsFor(convId: string, meId: string, msgIds?: string[]): Promise<ReactionMap> {
  const map: ReactionMap = new Map();
  const scope = msgIds
    ? inArray(dmMessageReactions.messageId, msgIds)
    : inArray(dmMessageReactions.messageId, db.select({ id: dmMessages.id }).from(dmMessages).where(eq(dmMessages.conversationId, convId)).orderBy(desc(dmMessages.createdAt)).limit(REACTION_WINDOW));
  if (msgIds && !msgIds.length) return map;
  const rows = await db
    .select({ messageId: dmMessageReactions.messageId, emoji: dmMessageReactions.emoji, n: sql<number>`count(*)`, mine: sql<number>`sum(case when ${dmMessageReactions.userId} = ${meId} then 1 else 0 end)` })
    .from(dmMessageReactions)
    .where(scope)
    .groupBy(dmMessageReactions.messageId, dmMessageReactions.emoji);
  for (const r of rows) {
    const list = map.get(r.messageId) ?? [];
    list.push({ emoji: r.emoji, count: Number(r.n), mine: Number(r.mine) > 0 });
    map.set(r.messageId, list);
  }
  return map;
}

/**
 * Reaksiya oynasining boshlanish vaqti (ms): `reactionsFor(conv)` shu vaqtdan yangi xabarlarni qamraydi. Klient polling
 * javobidagi reaksiyalarni FAQAT shu oynadagi xabarlarga qo'llaydi — yuqoriga aylantirib yuklangan eski sahifalardagi
 * reaksiyalar o'chib ketmasin. Xabarlar oynadan kam bo'lsa 0 (hammasi qamralgan).
 */
export async function reactionWindowStart(convId: string): Promise<number> {
  const [r] = await db
    .select({ at: dmMessages.createdAt })
    .from(dmMessages)
    .where(eq(dmMessages.conversationId, convId))
    .orderBy(desc(dmMessages.createdAt))
    .limit(1)
    .offset(REACTION_WINDOW - 1);
  return r?.at ? r.at.getTime() : 0;
}

/** Reaksiya qo'yish/almashtirish (emoji) yoki olib tashlash (null) */
export async function reactDm(conv: Conversation, meId: string, msgId: string, emoji: string | null): Promise<ReactionSummary[]> {
  if (emoji && !(DM_REACTIONS as readonly string[]).includes(emoji)) throw new ApiError(422, "Bunday reaksiya yo'q", { emoji: "Noto'g'ri" });
  const m = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, msgId), eq(dmMessages.conversationId, conv.id)), columns: { id: true, deletedAt: true, expiresAt: true, hiddenFor: true } });
  if (!m || !isLive(m, meId)) throw new ApiError(404, "Xabar topilmadi");
  if (m.deletedAt) throw new ApiError(410, "O'chirilgan xabarga reaksiya qo'yib bo'lmaydi");
  const cur = await db.query.dmMessageReactions.findFirst({ where: and(eq(dmMessageReactions.messageId, msgId), eq(dmMessageReactions.userId, meId)) });
  if (!emoji) {
    if (cur) await db.delete(dmMessageReactions).where(eq(dmMessageReactions.id, cur.id));
  } else if (cur) {
    if (cur.emoji !== emoji) await db.update(dmMessageReactions).set({ emoji, createdAt: new Date() }).where(eq(dmMessageReactions.id, cur.id));
  } else {
    await db.insert(dmMessageReactions).values({ id: uid(), messageId: msgId, userId: meId, emoji, createdAt: new Date() });
  }
  return (await reactionsFor(conv.id, meId, [msgId])).get(msgId) ?? [];
}

/* ------------------------------------------------------------------ */
/* DTO                                                                 */
/* ------------------------------------------------------------------ */
/** Xabar DTO'si (klientga): iqtibos, tahrir/o'chirish holati, reaksiyalar, yo'naltirish belgisi */
export function toDmView(m: DmRow, meId: string, quotes: Map<string, QuoteView>, reactions?: ReactionMap) {
  const deleted = Boolean(m.deletedAt);
  return {
    id: m.id,
    mine: m.senderId === meId,
    body: deleted ? "" : m.call ? callPreview(m.call, m.senderId === meId) : m.body,
    // 5-audit: xom saqlash manzili chiqmaydi — `/api/media/dm/<xabar>_<indeks>` (ishtirokchi + token)
    attachments: deleted ? [] : protectAttachments("dm", m.id, m.attachments),
    call: deleted ? null : (m.call ?? null),
    at: m.createdAt.getTime(),
    replyTo: m.replyToId ? (quotes.get(m.replyToId) ?? { id: m.replyToId, body: "Xabar o'chirilgan", senderName: "", kind: "text" as const }) : null,
    editedAt: m.editedAt ? m.editedAt.getTime() : null,
    deleted,
    forwardedFrom: deleted ? null : (m.forwardedFrom ?? null),
    reactions: reactions?.get(m.id) ?? [],
    /** Yo'qoladigan xabar: shu vaqtda (ms) ikki tomonda ham o'chadi — klient vaqti kelganda ro'yxatdan olib tashlaydi */
    expiresAt: m.expiresAt ? m.expiresAt.getTime() : null,
  };
}
export type DmView = ReturnType<typeof toDmView>;

/* ------------------------------------------------------------------ */
/* Yozmoqda / o'qildi                                                  */
/* ------------------------------------------------------------------ */
/** "Yozmoqda…": mening tomonimni belgilash (on=false — o'chirish). 6 soniyadan keyin o'zi so'nadi */
export async function setDmTyping(conv: Conversation, meId: string, on: boolean): Promise<void> {
  const v = on ? new Date() : null;
  await db
    .update(conversations)
    .set(conv.aId === meId ? { aTypingAt: v } : { bTypingAt: v })
    .where(eq(conversations.id, conv.id));
}

export function peerIsTyping(conv: Conversation, meId: string): boolean {
  const t = conv.aId === meId ? conv.bTypingAt : conv.aTypingAt;
  return Boolean(t && Date.now() - t.getTime() < TYPING_WINDOW_MS);
}

/**
 * Suhbatni o'qilgan deb belgilash (mening tomonim). FAQAT o'qilmagan narsa bo'lsa yozadi — shartli UPDATE:
 * mening o'qish belgim suhbatning oxirgi xabaridan eski bo'lsagina yangilanadi. Ilgari har GET `readAt = hozir` yozardi,
 * SSE kuzatuvchisi buni «o'zgarish» deb qabul qilib, ochiq suhbat o'zini soniyasiga bir marta qayta yuklardi (QA A1).
 * Qaytaradi: belgi haqiqatan siljidimi.
 */
export async function markRead(conv: Conversation, meId: string): Promise<boolean> {
  const now = new Date();
  const mine = conv.aId === meId ? conversations.aReadAt : conversations.bReadAt;
  const res = await db
    .update(conversations)
    .set(conv.aId === meId ? { aReadAt: now } : { bReadAt: now })
    .where(and(eq(conversations.id, conv.id), sql`coalesce(${mine}, 0) < coalesce(${conversations.lastMessageAt}, 0)`));
  const changed = (res.rowsAffected ?? 0) > 0;
  if (changed) {
    // Eski chat bildirishnomalari (yangilari endi saytga yozilmaydi) — suhbat o'qilganda o'qilgan bo'ladi
    const { markChatNotificationsRead } = await import("@/lib/notifications");
    await markChatNotificationsRead(meId, `/kabinet/chat?s=${conv.id}`);
  }
  return changed;
}

/* ------------------------------------------------------------------ */
/* Yuborish / tahrirlash / o'chirish / qadash / yo'naltirish          */
/* ------------------------------------------------------------------ */
/** Xabar yuborish: yozadi, suhbat faolligini yangilaydi, kerak bo'lsa qarshi tomonga bildirishnoma (ovozsiz suhbatda yo'q) */
export async function sendDm(conv: Conversation, meId: string, body: string, attachments: FileAttachment[], replyToId: string | null = null, opts: { forwardedFrom?: string | null } = {}) {
  const peerId = peerOf(conv, meId);
  // Javob faqat shu suhbatdagi xabarga (boshqa suhbat id'si bilan iqtibos sizdirib bo'lmaydi)
  if (replyToId) {
    const orig = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, replyToId), eq(dmMessages.conversationId, conv.id)), columns: { id: true, expiresAt: true, hiddenFor: true } });
    // Muddati o'tgan / men uchun o'chirilgan xabarga javob berib bo'lmaydi (iqtibos orqali matn qayta chiqmasin)
    if (!orig || !isLive(orig, meId)) throw new ApiError(422, "Javob berilayotgan xabar topilmadi", { replyToId: "Xabar topilmadi" });
  }
  const peerReadAt = conv.aId === peerId ? conv.aReadAt : conv.bReadAt;
  // Bildirishnoma spami bo'lmasin: qarshi tomonda allaqachon o'qilmagan xabar bo'lsa, yana yubormaymiz
  const [{ n: alreadyUnread }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(dmMessages)
    .where(and(eq(dmMessages.conversationId, conv.id), eq(dmMessages.senderId, meId), gt(dmMessages.createdAt, peerReadAt ?? new Date(0))));

  const now = new Date();
  // O'z-o'zidan yo'qoladigan suhbat: xabar necha soniyadan keyin o'chadi
  const expiresAt = conv.ttlSeconds > 0 ? new Date(now.getTime() + conv.ttlSeconds * 1000) : null;
  const msg: typeof dmMessages.$inferInsert = { id: uid(), conversationId: conv.id, senderId: meId, body, attachments, replyToId, forwardedFrom: opts.forwardedFrom ?? null, expiresAt, createdAt: now };
  await db.insert(dmMessages).values(msg);
  await db
    .update(conversations)
    .set({ lastMessageAt: now, ...(conv.aId === meId ? { aReadAt: now, aTypingAt: null } : { bReadAt: now, bTypingAt: null }) })
    .where(eq(conversations.id, conv.id));

  if (Number(alreadyUnread) === 0) {
    const peerPrefs = await getPrefs(conv.id, peerId);
    if (!peerPrefs.muted) {
      const me = await db.query.users.findFirst({ where: eq(users.id, meId), columns: { name: true } });
      const voice = attachments.some(isVoice);
      const preview = body ? (body.length > 80 ? `${body.slice(0, 77)}…` : body) : voice ? "🎤 Ovozli xabar yubordi" : "Fayl yubordi";
      await notify(peerId, "chat", `Yangi xabar — ${me?.name ?? "Foydalanuvchi"}`, preview, `/kabinet/chat?s=${conv.id}`);
    }
  }
  return { ...msg, editedAt: null, deletedAt: null, hiddenFor: null, createdAt: now } as DmRow;
}

/** Tahrirlash: faqat o'z xabari, 3 soat ichida, o'chirilmagan. O'chirish esa doim mumkin (deleteDm). */
export async function editDm(conv: Conversation, meId: string, msgId: string, body: string): Promise<DmRow> {
  const m = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, msgId), eq(dmMessages.conversationId, conv.id)) });
  if (!m || !isLive(m, meId)) throw new ApiError(404, "Xabar topilmadi");
  if (m.senderId !== meId) throw new ApiError(403, "Faqat o'z xabaringizni tahrirlay olasiz");
  if (m.deletedAt) throw new ApiError(410, "O'chirilgan xabarni tahrirlab bo'lmaydi");
  if (m.call) throw new ApiError(400, "Qo'ng'iroq yozuvini tahrirlab bo'lmaydi");
  if (Date.now() - m.createdAt.getTime() > DM_EDIT_WINDOW_MS) throw new ApiError(403, "Tahrirlash muddati (3 soat) o'tgan");
  // Biriktirmali xabarda matn — izoh (caption): bo'sh qoldirish ham mumkin; matnli xabar bo'sh bo'lmaydi
  if (!body && m.attachments.length === 0) throw new ApiError(422, "Xabar bo'sh bo'lmasin", { body: "Bo'sh xabar" });
  const editedAt = new Date();
  await db.update(dmMessages).set({ body, editedAt }).where(eq(dmMessages.id, m.id));
  return { ...m, body, editedAt };
}

/** O'chirish: scope=all — faqat o'z xabari (tana/fayllar tozalanadi); scope=me — faqat menga ko'rinmaydi */
export async function deleteDm(conv: Conversation, meId: string, msgId: string, scope: "me" | "all"): Promise<void> {
  const m = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, msgId), eq(dmMessages.conversationId, conv.id)) });
  if (!m) throw new ApiError(404, "Xabar topilmadi");
  if (scope === "all") {
    if (m.senderId !== meId) throw new ApiError(403, "Faqat o'z xabaringizni hamma uchun o'chira olasiz");
    if (!m.deletedAt) await db.update(dmMessages).set({ body: "", attachments: [], deletedAt: new Date() }).where(eq(dmMessages.id, m.id));
    if (conv.pinnedMessageId === m.id) await db.update(conversations).set({ pinnedMessageId: null }).where(eq(conversations.id, conv.id));
    return;
  }
  const hidden = m.hiddenFor ?? [];
  if (!hidden.includes(meId)) await db.update(dmMessages).set({ hiddenFor: [...hidden, meId] }).where(eq(dmMessages.id, m.id));
}

/** Qadash (messageId) yoki yechish (null) — ikkala tomon ko'radi */
export async function pinDm(conv: Conversation, msgId: string | null, meId?: string): Promise<QuoteView | null> {
  if (msgId) {
    const m = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, msgId), eq(dmMessages.conversationId, conv.id)), columns: { id: true, deletedAt: true, expiresAt: true, hiddenFor: true } });
    if (!m || m.deletedAt || !isLive(m, meId ?? "")) throw new ApiError(404, "Xabar topilmadi");
  }
  await db.update(conversations).set({ pinnedMessageId: msgId }).where(eq(conversations.id, conv.id));
  return pinnedQuote({ ...conv, pinnedMessageId: msgId }, meId);
}

/** Yo'naltirish: shu suhbatdagi xabarni boshqa suhbatga nusxa sifatida yuborish («Yo'naltirilgan: <ism>») */
export async function forwardDm(from: Conversation, meId: string, msgId: string, target: Conversation): Promise<DmRow> {
  const m = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, msgId), eq(dmMessages.conversationId, from.id)) });
  // Muddati o'tgan (yo'qolgan) xabar yo'naltirilmaydi — aks holda yangi nusxa bo'lib «tirilib» qolardi
  if (!m || m.deletedAt || m.call || !isLive(m, meId)) throw new ApiError(404, "Xabar topilmadi");
  const author = await db.query.users.findFirst({ where: eq(users.id, m.senderId), columns: { name: true } });
  return sendDm(target, meId, m.body, m.attachments, null, { forwardedFrom: m.forwardedFrom ?? author?.name ?? "Foydalanuvchi" });
}

/**
 * Suhbatni MEN UCHUN o'chirish (C3): undagi barcha xabarlar menga ko'rinmaydigan bo'ladi (`hidden_for` ga qo'shilaman),
 * suhbat ro'yxatimdan yo'qoladi; suhbatdoshda hech narsa o'zgarmaydi. Yangi xabar kelsa suhbat faqat yangi xabarlar bilan
 * qaytadi. Mening sozlamalarim (qadash/arxiv/papka) tozalanadi, o'qish belgim hozirga suriladi.
 */
export async function deleteConversationForMe(conv: Conversation, meId: string): Promise<number> {
  const res = await db
    .update(dmMessages)
    .set({ hiddenFor: sql`json_insert(coalesce(${dmMessages.hiddenFor}, '[]'), '$[#]', ${meId})` })
    .where(and(eq(dmMessages.conversationId, conv.id), notHiddenFor(meId)));
  await db
    .update(conversations)
    .set(conv.aId === meId ? { aReadAt: new Date(), aTypingAt: null } : { bReadAt: new Date(), bTypingAt: null })
    .where(eq(conversations.id, conv.id));
  await db.delete(dmConversationPrefs).where(and(eq(dmConversationPrefs.conversationId, conv.id), eq(dmConversationPrefs.userId, meId)));
  return res.rowsAffected ?? 0;
}

/* ------------------------------------------------------------------ */
/* Qidiruv va media                                                    */
/* ------------------------------------------------------------------ */
/** Suhbat ichida matn bo'yicha qidiruv (yangi → eski), 30 tagacha; yo'qolgan/men uchun o'chirilgan xabarlar chiqmaydi */
export async function searchDm(convId: string, meId: string, q: string, limit = 30): Promise<DmRow[]> {
  const pattern = `%${escapeLike(q.toLowerCase())}%`;
  return db.query.dmMessages.findMany({
    where: and(eq(dmMessages.conversationId, convId), isNull(dmMessages.deletedAt), notExpired(), notHiddenFor(meId), sql`lower(${dmMessages.body}) like ${pattern} escape '\\'`),
    orderBy: [desc(dmMessages.createdAt)],
    limit,
  });
}

export type MediaKind = "image" | "video" | "file" | "voice";
export interface MediaItem extends FileAttachment {
  messageId: string;
  at: number;
  mine: boolean;
}

function kindOf(a: FileAttachment): MediaKind {
  const k = quoteKind([a]);
  return k === "text" ? "file" : k;
}

/** Media paneli: tur bo'yicha biriktirmalar (yangi → eski), kursor — xabar vaqti (ms) */
export async function listDmMedia(convId: string, meId: string, kind: MediaKind, cursor?: number | null, limit = 40): Promise<{ items: MediaItem[]; nextCursor: number | null }> {
  const rows = await db.query.dmMessages.findMany({
    where: and(eq(dmMessages.conversationId, convId), isNull(dmMessages.deletedAt), notExpired(), sql`${dmMessages.attachments} != '[]'`, ...(cursor ? [lt(dmMessages.createdAt, new Date(cursor))] : [])),
    orderBy: [desc(dmMessages.createdAt)],
    limit: 60,
  });
  const items: MediaItem[] = [];
  for (const m of rows.filter(visibleTo(meId))) {
    const safe = protectAttachments("dm", m.id, m.attachments);
    m.attachments.forEach((a, i) => {
      if (kindOf(a) === kind) items.push({ ...safe[i], messageId: m.id, at: m.createdAt.getTime(), mine: m.senderId === meId });
    });
  }
  return { items: items.slice(0, limit), nextCursor: rows.length === 60 ? rows[rows.length - 1].createdAt.getTime() : null };
}

/** Ma'lumot paneli uchun: har tur bo'yicha media soni */
export async function dmMediaCounts(convId: string, meId: string): Promise<Record<MediaKind, number>> {
  const rows = await db.query.dmMessages.findMany({
    where: and(eq(dmMessages.conversationId, convId), isNull(dmMessages.deletedAt), notExpired(), sql`${dmMessages.attachments} != '[]'`),
    columns: { attachments: true, hiddenFor: true },
  });
  const out: Record<MediaKind, number> = { image: 0, video: 0, file: 0, voice: 0 };
  for (const m of rows.filter(visibleTo(meId))) for (const a of m.attachments) out[kindOf(a)]++;
  return out;
}

/** Nav badge: o'qilmagan xabarlar soni (ovozsiz qilingan suhbatlar hisobga olinmaydi) */
export async function unreadDmCount(meId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(dmMessages)
    .innerJoin(conversations, eq(conversations.id, dmMessages.conversationId))
    .where(
      and(
        ne(dmMessages.senderId, meId),
        isNull(dmMessages.deletedAt),
        // Ko'rinmaydigan (yo'qolgan / men uchun o'chirilgan) xabarlar badge'ni «osib» qo'ymasin
        notExpired(),
        notHiddenFor(meId),
        or(
          and(eq(conversations.aId, meId), gt(dmMessages.createdAt, sql`coalesce(${conversations.aReadAt}, 0)`)),
          and(eq(conversations.bId, meId), gt(dmMessages.createdAt, sql`coalesce(${conversations.bReadAt}, 0)`)),
        ),
        sql`not exists (select 1 from ${dmConversationPrefs} p where p.conversation_id = ${conversations.id} and p.user_id = ${meId} and p.muted = 1)`,
      ),
    );
  return Number(n);
}

/* ------------------------------------------------------------------ */
/* Papkalar (Telegram naqshi) va o'z-o'zidan yo'qoladigan xabarlar     */
/* ------------------------------------------------------------------ */

/** Bir foydalanuvchida ko'pi bilan shuncha papka */
export const DM_FOLDER_MAX = 10;
/** Yo'qolish muddati variantlari (soniya): o'chiq · 1 soat · 1 kun · 1 hafta */
export const DM_TTL_OPTIONS = [0, 3600, 86_400, 604_800] as const;

export interface DmFolder {
  id: string;
  name: string;
  position: number;
  count: number;
}

/** Mening papkalarim (har birida nechta chat borligi bilan: shaxsiy suhbatlar + guruh/kanallar) */
export async function listFolders(meId: string): Promise<DmFolder[]> {
  const rows = await db.query.dmFolders.findMany({ where: eq(dmFolders.userId, meId), orderBy: [asc(dmFolders.position), asc(dmFolders.createdAt)] });
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [dmCounts, groupCounts] = await Promise.all([
    db
      .select({ folderId: dmConversationPrefs.folderId, n: sql<number>`count(*)` })
      .from(dmConversationPrefs)
      .where(and(eq(dmConversationPrefs.userId, meId), inArray(dmConversationPrefs.folderId, ids)))
      .groupBy(dmConversationPrefs.folderId),
    // Guruh/kanallar ham shu papkalarga joylanadi (group_members.folder_id) — hisobga kiradi
    db
      .select({ folderId: groupMembers.folderId, n: sql<number>`count(*)` })
      .from(groupMembers)
      .where(and(eq(groupMembers.userId, meId), eq(groupMembers.status, "active"), inArray(groupMembers.folderId, ids)))
      .groupBy(groupMembers.folderId),
  ]);
  const map = new Map<string, number>();
  for (const c of [...dmCounts, ...groupCounts]) if (c.folderId) map.set(c.folderId, (map.get(c.folderId) ?? 0) + Number(c.n));
  return rows.map((r) => ({ id: r.id, name: r.name, position: r.position, count: map.get(r.id) ?? 0 }));
}

/** Papka nomi: 1–24 belgi; shu foydalanuvchida bir xil nom (katta-kichik harfga qaramay) takrorlanmaydi */
async function folderName(meId: string, name: string, exceptId?: string): Promise<string> {
  const t = name.replace(/\s+/g, " ").trim().slice(0, 24);
  if (!t) throw new ApiError(422, "Papka nomi bo'sh", { name: "Nom kerak" });
  const same = await db.query.dmFolders.findMany({ where: eq(dmFolders.userId, meId), columns: { id: true, name: true } });
  if (same.some((f) => f.id !== exceptId && f.name.toLowerCase() === t.toLowerCase())) throw new ApiError(409, "Bunday nomli papka bor", { name: "Boshqa nom tanlang" });
  return t;
}

/** Papka menga tegishlimi (guruh/DM qatorini begona yoki yo'q papkaga joylab bo'lmasin) */
export async function ownsFolder(meId: string, id: string): Promise<boolean> {
  return Boolean(await db.query.dmFolders.findFirst({ where: and(eq(dmFolders.id, id), eq(dmFolders.userId, meId)), columns: { id: true } }));
}

export async function createFolder(meId: string, name: string): Promise<DmFolder> {
  const t = await folderName(meId, name);
  const n = await db.$count(dmFolders, eq(dmFolders.userId, meId));
  if (n >= DM_FOLDER_MAX) throw new ApiError(422, `Ko'pi bilan ${DM_FOLDER_MAX} papka`);
  const id = uid();
  await db.insert(dmFolders).values({ id, userId: meId, name: t, position: n + 1 });
  return { id, name: t, position: n + 1, count: 0 };
}

export async function renameFolder(meId: string, id: string, name: string): Promise<void> {
  const t = await folderName(meId, name, id);
  const r = await db.update(dmFolders).set({ name: t }).where(and(eq(dmFolders.id, id), eq(dmFolders.userId, meId))).returning({ id: dmFolders.id });
  if (!r.length) throw new ApiError(404, "Papka topilmadi");
}

/**
 * Papkani yuqoriga/pastga surish (kamchilik #7): qo'shni bilan position almashtiriladi.
 * Pozitsiyalar avval 1..n ga normallashtiriladi (eski yozuvlarda teng bo'lishi mumkin).
 */
export async function moveFolder(meId: string, id: string, dir: "up" | "down"): Promise<void> {
  const rows = await db.query.dmFolders.findMany({ where: eq(dmFolders.userId, meId), orderBy: [asc(dmFolders.position), asc(dmFolders.createdAt)] });
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw new ApiError(404, "Papka topilmadi");
  const j = dir === "up" ? idx - 1 : idx + 1;
  if (j < 0 || j >= rows.length) return;
  const order = rows.map((r) => r.id);
  [order[idx], order[j]] = [order[j], order[idx]];
  for (let i = 0; i < order.length; i++) {
    await db.update(dmFolders).set({ position: i + 1 }).where(and(eq(dmFolders.id, order[i]), eq(dmFolders.userId, meId)));
  }
}

/** Papkani o'chirish: ichidagi suhbatlar va guruh/kanallar «Hammasi»ga qaytadi (chatlar o'chmaydi) */
export async function deleteFolder(meId: string, id: string): Promise<void> {
  const r = await db.delete(dmFolders).where(and(eq(dmFolders.id, id), eq(dmFolders.userId, meId))).returning({ id: dmFolders.id });
  if (!r.length) throw new ApiError(404, "Papka topilmadi");
  await Promise.all([
    db.update(dmConversationPrefs).set({ folderId: null }).where(and(eq(dmConversationPrefs.userId, meId), eq(dmConversationPrefs.folderId, id))),
    // Guruh/kanal qatorlari ham shu papkaga ishora qilib qolmasin (aks holda o'chirilgan papka id'si «osilib» turardi)
    db.update(groupMembers).set({ folderId: null }).where(and(eq(groupMembers.userId, meId), eq(groupMembers.folderId, id))),
  ]);
  bustGroupInbox(meId);
}

/**
 * O'z-o'zidan yo'qoladigan xabarlar muddatini belgilash (ikki tomon uchun umumiy — Telegram naqshi).
 * Mavjud xabarlarga tegmaydi; faqat shundan keyin yuborilganlar yo'qoladi.
 */
export async function setDmTtl(conv: Conversation, meId: string, seconds: number): Promise<number> {
  if (!DM_TTL_OPTIONS.includes(seconds as (typeof DM_TTL_OPTIONS)[number])) throw new ApiError(422, "Noto'g'ri muddat");
  if (conv.ttlSeconds === seconds) return seconds;
  await db.update(conversations).set({ ttlSeconds: seconds }).where(eq(conversations.id, conv.id));
  // Qarshi tomon ham bilsin — suhbatga tizim xabari sifatida emas, oddiy bildirishnoma
  const label = seconds === 0 ? "o'chirildi" : seconds === 3600 ? "1 soat" : seconds === 86_400 ? "1 kun" : "1 hafta";
  const me = await db.query.users.findFirst({ where: eq(users.id, meId), columns: { name: true } });
  await notify(peerOf(conv, meId), "chat", "Yo'qoladigan xabarlar", `${me?.name ?? "Suhbatdosh"}: ${seconds === 0 ? "yo'qolish o'chirildi" : `xabarlar ${label}dan keyin o'chadi`}`, `/kabinet/chat?s=${conv.id}`).catch(() => undefined);
  return seconds;
}

/** Cron: muddati o'tgan xabarlarni butunlay o'chirish (so'rovlarda ular allaqachon ko'rinmaydi) */
export async function purgeExpiredDms(): Promise<number> {
  const r = await db.delete(dmMessages).where(and(sql`${dmMessages.expiresAt} is not null`, lt(dmMessages.expiresAt, new Date()))).returning({ id: dmMessages.id });
  return r.length;
}
