import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, dmConversationPrefs, dmMessageReactions, dmMessages, specialists, users, type Conversation, type FileAttachment } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { escapeLike, uid } from "@/lib/utils";
import { TYPING_WINDOW_MS, quoteKind, toQuote, type QuoteView } from "./quote";
import { DM_BODY_MAX, DM_EDIT_WINDOW_MS, DM_REACTIONS, type ReactionSummary } from "./constants";

export { DM_BODY_MAX };

/**
 * Ichki chat (DM) — buyurtmadan mustaqil, ikki foydalanuvchi o'rtasida.
 * Suhbat juftlik bo'yicha yagona (aId < bId); o'qilganlik har tomon uchun o'z vaqt belgisi bilan.
 * Qo'shimcha: tahrirlash (15 daqiqa), o'chirish (men uchun / hamma uchun), reaksiyalar, qadash,
 * yo'naltirish, qidiruv, media ro'yxati, suhbat sozlamalari (arxiv / ovozsiz / qadash).
 */

/** Suhbatdagi "qarshi tomon" — ro'yxat va sarlavha uchun qisqa DTO */
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
  /** Maxfiylik: onlayn holatini ko'rsatadimi; kim yozishi mumkin */
  showOnline: boolean;
  dmPolicy: string;
}

const PEER_COLUMNS = { id: true, username: true, name: true, avatarUrl: true, role: true, isBanned: true, lastSeenAt: true, lastLoginAt: true, showOnline: true, dmPolicy: true } as const;

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
}
const DEFAULT_PREFS: ConvPrefs = { archived: false, muted: false, pinned: false };

export async function getPrefs(convId: string, meId: string): Promise<ConvPrefs> {
  const row = await db.query.dmConversationPrefs.findFirst({ where: and(eq(dmConversationPrefs.conversationId, convId), eq(dmConversationPrefs.userId, meId)) });
  return row ? { archived: row.archived, muted: row.muted, pinned: row.pinned } : DEFAULT_PREFS;
}

async function prefsMap(meId: string, convIds: string[]): Promise<Map<string, ConvPrefs>> {
  const map = new Map<string, ConvPrefs>();
  if (!convIds.length) return map;
  const rows = await db.query.dmConversationPrefs.findMany({ where: and(eq(dmConversationPrefs.userId, meId), inArray(dmConversationPrefs.conversationId, convIds)) });
  for (const r of rows) map.set(r.conversationId, { archived: r.archived, muted: r.muted, pinned: r.pinned });
  return map;
}

/** Sozlamani yangilash (upsert) — qaytaradi: yangi holat */
export async function setPrefs(convId: string, meId: string, patch: Partial<ConvPrefs>): Promise<ConvPrefs> {
  const cur = await db.query.dmConversationPrefs.findFirst({ where: and(eq(dmConversationPrefs.conversationId, convId), eq(dmConversationPrefs.userId, meId)) });
  const next: ConvPrefs = { ...(cur ? { archived: cur.archived, muted: cur.muted, pinned: cur.pinned } : DEFAULT_PREFS), ...patch };
  if (cur) await db.update(dmConversationPrefs).set({ ...next, updatedAt: new Date() }).where(eq(dmConversationPrefs.id, cur.id));
  else await db.insert(dmConversationPrefs).values({ id: uid(), conversationId: convId, userId: meId, ...next, updatedAt: new Date() });
  return next;
}

/* ------------------------------------------------------------------ */
/* Ro'yxat                                                             */
/* ------------------------------------------------------------------ */
export interface ConvListRow {
  id: string;
  peer: DmPeer;
  last: { body: string; mine: boolean; at: number; hasFiles: boolean; voice: boolean; deleted: boolean } | null;
  unread: number;
  prefs: ConvPrefs;
  /** Suhbatdosh hozir yozmoqda (so'nggi 6 soniya) */
  peerTyping: boolean;
}

/**
 * Mening suhbatlarim: qarshi tomon, oxirgi xabar, o'qilmaganlar, sozlamalar (qadalganlar birinchi, keyin faollik bo'yicha).
 * Xabarsiz suhbat faqat uni ochgan tomonga ko'rinadi (dm_policy'ni /yozish orqali chetlab o'tib bo'lmasin).
 */
export async function listConversations(meId: string, limit = 60): Promise<ConvListRow[]> {
  const rows = await db.query.conversations.findMany({
    where: and(
      or(eq(conversations.aId, meId), eq(conversations.bId, meId)),
      or(sql`${conversations.lastMessageAt} is not null`, eq(conversations.createdBy, meId), isNull(conversations.createdBy)),
    ),
    orderBy: [desc(sql`coalesce(${conversations.lastMessageAt}, ${conversations.createdAt})`)],
    limit,
    with: {
      a: { columns: PEER_COLUMNS },
      b: { columns: PEER_COLUMNS },
      messages: { orderBy: [desc(dmMessages.createdAt)], limit: 1, columns: { id: true, senderId: true, body: true, attachments: true, createdAt: true, deletedAt: true, hiddenFor: true } },
    },
  });
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  // O'qilmaganlar — bitta guruhlangan so'rov (har suhbatga alohida count emas)
  const unreadRows = await db
    .select({ convId: dmMessages.conversationId, n: sql<number>`count(*)` })
    .from(dmMessages)
    .innerJoin(conversations, eq(conversations.id, dmMessages.conversationId))
    .where(
      and(
        inArray(dmMessages.conversationId, ids),
        ne(dmMessages.senderId, meId),
        isNull(dmMessages.deletedAt),
        gt(dmMessages.createdAt, sql`coalesce(case when ${conversations.aId} = ${meId} then ${conversations.aReadAt} else ${conversations.bReadAt} end, 0)`),
      ),
    )
    .groupBy(dmMessages.conversationId);
  const unread = new Map(unreadRows.map((r) => [r.convId, Number(r.n)]));
  const prefs = await prefsMap(meId, ids);
  const now = Date.now();

  const out: ConvListRow[] = rows.map((c) => {
    const peer = (c.aId === meId ? c.b : c.a) as DmPeer;
    const m = c.messages[0];
    const hidden = Boolean(m?.hiddenFor?.includes(meId));
    const peerTypingAt = c.aId === meId ? c.bTypingAt : c.aTypingAt;
    return {
      id: c.id,
      peer,
      last:
        m && !hidden
          ? {
              body: m.deletedAt ? "" : m.body,
              mine: m.senderId === meId,
              at: m.createdAt.getTime(),
              hasFiles: !m.deletedAt && (m.attachments?.length ?? 0) > 0,
              voice: !m.deletedAt && (m.attachments ?? []).some(isVoice),
              deleted: Boolean(m.deletedAt),
            }
          : null,
      unread: unread.get(c.id) ?? 0,
      prefs: prefs.get(c.id) ?? DEFAULT_PREFS,
      peerTyping: Boolean(peerTypingAt && now - peerTypingAt.getTime() < TYPING_WINDOW_MS),
    };
  });
  // Qadalganlar tepada (o'z tartibi saqlanadi)
  return [...out.filter((r) => r.prefs.pinned), ...out.filter((r) => !r.prefs.pinned)];
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
    const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, peer.id), columns: { slug: true } });
    peer.slug = sp?.slug ?? null;
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

/** Xabarlar (eski → yangi); afterId berilsa — faqat undan keyingilar (polling). «Men uchun o'chirilgan»lar chiqmaydi */
export async function listMessages(convId: string, meId: string, afterId?: string | null, limit = 200): Promise<DmRow[]> {
  let afterAt: Date | null = null;
  if (afterId) {
    const m = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, afterId), eq(dmMessages.conversationId, convId)), columns: { createdAt: true } });
    afterAt = m?.createdAt ?? null;
  }
  if (afterAt) {
    const rows = await db.query.dmMessages.findMany({
      where: and(eq(dmMessages.conversationId, convId), gt(dmMessages.createdAt, afterAt)),
      orderBy: [asc(dmMessages.createdAt), asc(dmMessages.id)],
      limit,
    });
    return rows.filter(visibleTo(meId));
  }
  // Birinchi ochilish: OXIRGI 200 ta xabar — teskari tartibda olib, eski → yangi qilib qaytaramiz
  const rows = await db.query.dmMessages.findMany({
    where: eq(dmMessages.conversationId, convId),
    orderBy: [desc(dmMessages.createdAt), desc(dmMessages.id)],
    limit,
  });
  return rows.reverse().filter(visibleTo(meId));
}

/** Polling: `since`dan keyin tahrirlangan/o'chirilgan eski xabarlar (klient joyida yangilaydi) */
export async function changedMessages(convId: string, meId: string, since: number, limit = 50): Promise<DmRow[]> {
  if (!since) return [];
  const s = new Date(since);
  const rows = await db.query.dmMessages.findMany({
    where: and(eq(dmMessages.conversationId, convId), or(gt(dmMessages.editedAt, s), gt(dmMessages.deletedAt, s))),
    orderBy: [desc(dmMessages.createdAt)],
    limit,
  });
  return rows.filter(visibleTo(meId));
}

/** Iqtiboslar: xabarlar ichidagi replyToId'lar bo'yicha asl xabarlar (faqat shu suhbatdan) */
export async function dmQuotes(convId: string, rows: Array<{ replyToId: string | null }>): Promise<Map<string, QuoteView>> {
  const ids = [...new Set(rows.map((r) => r.replyToId).filter((x): x is string => Boolean(x)))];
  const map = new Map<string, QuoteView>();
  if (!ids.length) return map;
  const originals = await db.query.dmMessages.findMany({ where: and(eq(dmMessages.conversationId, convId), inArray(dmMessages.id, ids)) });
  const senderIds = [...new Set(originals.map((o) => o.senderId))];
  const names = new Map((await db.query.users.findMany({ where: inArray(users.id, senderIds), columns: { id: true, name: true } })).map((u) => [u.id, u.name]));
  for (const o of originals) map.set(o.id, o.deletedAt ? { id: o.id, body: "Xabar o'chirildi", senderName: names.get(o.senderId) ?? "", kind: "text" } : toQuote(o, names.get(o.senderId) ?? "Foydalanuvchi"));
  return map;
}

/** Qadalgan xabar (iqtibos ko'rinishida) — yo'q/o'chirilgan bo'lsa null */
export async function pinnedQuote(conv: Conversation): Promise<QuoteView | null> {
  if (!conv.pinnedMessageId) return null;
  const q = await dmQuotes(conv.id, [{ replyToId: conv.pinnedMessageId }]);
  return q.get(conv.pinnedMessageId) ?? null;
}

/* ------------------------------------------------------------------ */
/* Reaksiyalar                                                         */
/* ------------------------------------------------------------------ */
export type ReactionMap = Map<string, ReactionSummary[]>;

/** Suhbatdagi so'nggi oynadagi (200 ta) xabarlar reaksiyalari — bitta guruhlangan so'rov */
export async function reactionsFor(convId: string, meId: string, msgIds?: string[]): Promise<ReactionMap> {
  const map: ReactionMap = new Map();
  const scope = msgIds
    ? inArray(dmMessageReactions.messageId, msgIds)
    : inArray(dmMessageReactions.messageId, db.select({ id: dmMessages.id }).from(dmMessages).where(eq(dmMessages.conversationId, convId)).orderBy(desc(dmMessages.createdAt)).limit(200));
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

/** Reaksiya qo'yish/almashtirish (emoji) yoki olib tashlash (null) */
export async function reactDm(conv: Conversation, meId: string, msgId: string, emoji: string | null): Promise<ReactionSummary[]> {
  if (emoji && !(DM_REACTIONS as readonly string[]).includes(emoji)) throw new ApiError(422, "Bunday reaksiya yo'q", { emoji: "Noto'g'ri" });
  const m = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, msgId), eq(dmMessages.conversationId, conv.id)), columns: { id: true, deletedAt: true } });
  if (!m) throw new ApiError(404, "Xabar topilmadi");
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
    body: deleted ? "" : m.body,
    attachments: deleted ? [] : m.attachments,
    at: m.createdAt.getTime(),
    replyTo: m.replyToId ? (quotes.get(m.replyToId) ?? { id: m.replyToId, body: "Xabar o'chirilgan", senderName: "", kind: "text" as const }) : null,
    editedAt: m.editedAt ? m.editedAt.getTime() : null,
    deleted,
    forwardedFrom: deleted ? null : (m.forwardedFrom ?? null),
    reactions: reactions?.get(m.id) ?? [],
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

/** Suhbatni o'qilgan deb belgilash (mening tomonim) */
export async function markRead(conv: Conversation, meId: string) {
  const now = new Date();
  await db
    .update(conversations)
    .set(conv.aId === meId ? { aReadAt: now } : { bReadAt: now })
    .where(eq(conversations.id, conv.id));
}

/* ------------------------------------------------------------------ */
/* Yuborish / tahrirlash / o'chirish / qadash / yo'naltirish          */
/* ------------------------------------------------------------------ */
/** Xabar yuborish: yozadi, suhbat faolligini yangilaydi, kerak bo'lsa qarshi tomonga bildirishnoma (ovozsiz suhbatda yo'q) */
export async function sendDm(conv: Conversation, meId: string, body: string, attachments: FileAttachment[], replyToId: string | null = null, opts: { forwardedFrom?: string | null } = {}) {
  const peerId = peerOf(conv, meId);
  // Javob faqat shu suhbatdagi xabarga (boshqa suhbat id'si bilan iqtibos sizdirib bo'lmaydi)
  if (replyToId) {
    const orig = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, replyToId), eq(dmMessages.conversationId, conv.id)), columns: { id: true } });
    if (!orig) throw new ApiError(422, "Javob berilayotgan xabar topilmadi", { replyToId: "Xabar topilmadi" });
  }
  const peerReadAt = conv.aId === peerId ? conv.aReadAt : conv.bReadAt;
  // Bildirishnoma spami bo'lmasin: qarshi tomonda allaqachon o'qilmagan xabar bo'lsa, yana yubormaymiz
  const [{ n: alreadyUnread }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(dmMessages)
    .where(and(eq(dmMessages.conversationId, conv.id), eq(dmMessages.senderId, meId), gt(dmMessages.createdAt, peerReadAt ?? new Date(0))));

  const now = new Date();
  const msg: typeof dmMessages.$inferInsert = { id: uid(), conversationId: conv.id, senderId: meId, body, attachments, replyToId, forwardedFrom: opts.forwardedFrom ?? null, createdAt: now };
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

/** Tahrirlash: faqat o'z xabari, 15 daqiqa ichida, o'chirilmagan */
export async function editDm(conv: Conversation, meId: string, msgId: string, body: string): Promise<DmRow> {
  const m = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, msgId), eq(dmMessages.conversationId, conv.id)) });
  if (!m) throw new ApiError(404, "Xabar topilmadi");
  if (m.senderId !== meId) throw new ApiError(403, "Faqat o'z xabaringizni tahrirlay olasiz");
  if (m.deletedAt) throw new ApiError(410, "O'chirilgan xabarni tahrirlab bo'lmaydi");
  if (Date.now() - m.createdAt.getTime() > DM_EDIT_WINDOW_MS) throw new ApiError(403, "Tahrirlash muddati (15 daqiqa) o'tgan");
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
export async function pinDm(conv: Conversation, msgId: string | null): Promise<QuoteView | null> {
  if (msgId) {
    const m = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, msgId), eq(dmMessages.conversationId, conv.id)), columns: { id: true, deletedAt: true } });
    if (!m || m.deletedAt) throw new ApiError(404, "Xabar topilmadi");
  }
  await db.update(conversations).set({ pinnedMessageId: msgId }).where(eq(conversations.id, conv.id));
  return pinnedQuote({ ...conv, pinnedMessageId: msgId });
}

/** Yo'naltirish: shu suhbatdagi xabarni boshqa suhbatga nusxa sifatida yuborish («Yo'naltirilgan: <ism>») */
export async function forwardDm(from: Conversation, meId: string, msgId: string, target: Conversation): Promise<DmRow> {
  const m = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, msgId), eq(dmMessages.conversationId, from.id)) });
  if (!m || m.deletedAt || (m.hiddenFor ?? []).includes(meId)) throw new ApiError(404, "Xabar topilmadi");
  const author = await db.query.users.findFirst({ where: eq(users.id, m.senderId), columns: { name: true } });
  return sendDm(target, meId, m.body, m.attachments, null, { forwardedFrom: m.forwardedFrom ?? author?.name ?? "Foydalanuvchi" });
}

/* ------------------------------------------------------------------ */
/* Qidiruv va media                                                    */
/* ------------------------------------------------------------------ */
/** Suhbat ichida matn bo'yicha qidiruv (yangi → eski), 30 tagacha */
export async function searchDm(convId: string, meId: string, q: string, limit = 30): Promise<DmRow[]> {
  const pattern = `%${escapeLike(q.toLowerCase())}%`;
  const rows = await db.query.dmMessages.findMany({
    where: and(eq(dmMessages.conversationId, convId), isNull(dmMessages.deletedAt), sql`lower(${dmMessages.body}) like ${pattern} escape '\\'`),
    orderBy: [desc(dmMessages.createdAt)],
    limit: limit + 20,
  });
  return rows.filter(visibleTo(meId)).slice(0, limit);
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
    where: and(eq(dmMessages.conversationId, convId), isNull(dmMessages.deletedAt), sql`${dmMessages.attachments} != '[]'`, ...(cursor ? [lt(dmMessages.createdAt, new Date(cursor))] : [])),
    orderBy: [desc(dmMessages.createdAt)],
    limit: 60,
  });
  const items: MediaItem[] = [];
  for (const m of rows.filter(visibleTo(meId))) {
    for (const a of m.attachments) if (kindOf(a) === kind) items.push({ ...a, messageId: m.id, at: m.createdAt.getTime(), mine: m.senderId === meId });
  }
  return { items: items.slice(0, limit), nextCursor: rows.length === 60 ? rows[rows.length - 1].createdAt.getTime() : null };
}

/** Ma'lumot paneli uchun: har tur bo'yicha media soni */
export async function dmMediaCounts(convId: string, meId: string): Promise<Record<MediaKind, number>> {
  const rows = await db.query.dmMessages.findMany({
    where: and(eq(dmMessages.conversationId, convId), isNull(dmMessages.deletedAt), sql`${dmMessages.attachments} != '[]'`),
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
        or(
          and(eq(conversations.aId, meId), gt(dmMessages.createdAt, sql`coalesce(${conversations.aReadAt}, 0)`)),
          and(eq(conversations.bId, meId), gt(dmMessages.createdAt, sql`coalesce(${conversations.bReadAt}, 0)`)),
        ),
        sql`not exists (select 1 from ${dmConversationPrefs} p where p.conversation_id = ${conversations.id} and p.user_id = ${meId} and p.muted = 1)`,
      ),
    );
  return Number(n);
}
