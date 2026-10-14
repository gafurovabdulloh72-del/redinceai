import { and, asc, desc, eq, gt, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, dmMessages, users, type Conversation, type FileAttachment } from "@/lib/db/schema";
import { notify } from "@/lib/notifications";
import { uid } from "@/lib/utils";

/**
 * Ichki chat (DM) — buyurtmadan mustaqil, ikki foydalanuvchi o'rtasida.
 * Suhbat juftlik bo'yicha yagona (aId < bId); o'qilganlik har tomon uchun o'z vaqt belgisi bilan.
 */

export const DM_BODY_MAX = 2000;

/** Suhbatdagi "qarshi tomon" — ro'yxat va sarlavha uchun qisqa DTO */
export interface DmPeer {
  id: string;
  username: string | null;
  name: string;
  avatarUrl: string | null;
  role: string;
  isBanned: boolean;
}

const PEER_COLUMNS = { id: true, username: true, name: true, avatarUrl: true, role: true, isBanned: true } as const;

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
  const row: typeof conversations.$inferInsert = { id: uid(), aId, bId, createdAt: new Date() };
  // Poyga: parallel ikki so'rov bir juftlikni yaratsa — unique indeks ikkinchisini yiqitadi, qayta o'qiymiz
  try {
    await db.insert(conversations).values(row);
  } catch {
    const again = await db.query.conversations.findFirst({ where: and(eq(conversations.aId, aId), eq(conversations.bId, bId)) });
    if (again) return again;
    throw new Error("Suhbat yaratilmadi");
  }
  return { ...row, lastMessageAt: null, aReadAt: null, bReadAt: null, createdAt: row.createdAt! } as Conversation;
}

/** Mening suhbatlarim: qarshi tomon, oxirgi xabar va o'qilmaganlar soni bilan (oxirgi faollik bo'yicha) */
export async function listConversations(meId: string, limit = 50) {
  const rows = await db.query.conversations.findMany({
    where: or(eq(conversations.aId, meId), eq(conversations.bId, meId)),
    orderBy: [desc(sql`coalesce(${conversations.lastMessageAt}, ${conversations.createdAt})`)],
    limit,
    with: {
      a: { columns: PEER_COLUMNS },
      b: { columns: PEER_COLUMNS },
      messages: { orderBy: [desc(dmMessages.createdAt)], limit: 1, columns: { id: true, senderId: true, body: true, attachments: true, createdAt: true } },
    },
  });
  // O'qilmaganlar: suhbatlar soni kam (<=50) — har biriga bitta count so'rovi yetarli
  const out = [] as Array<{
    id: string;
    peer: DmPeer;
    last: { body: string; mine: boolean; at: number; hasFiles: boolean } | null;
    unread: number;
  }>;
  for (const c of rows) {
    const peer = (c.aId === meId ? c.b : c.a) as DmPeer;
    const readAt = myReadAt(c, meId);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(dmMessages)
      .where(and(eq(dmMessages.conversationId, c.id), ne(dmMessages.senderId, meId), gt(dmMessages.createdAt, new Date(readAt))));
    const m = c.messages[0];
    out.push({
      id: c.id,
      peer,
      last: m ? { body: m.body, mine: m.senderId === meId, at: m.createdAt.getTime(), hasFiles: (m.attachments?.length ?? 0) > 0 } : null,
      unread: Number(n),
    });
  }
  return out;
}

/** Suhbatga a'zolik tekshiruvi bilan yuklash */
export async function loadConversationFor(meId: string, convId: string) {
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, convId),
    with: { a: { columns: PEER_COLUMNS }, b: { columns: PEER_COLUMNS } },
  });
  if (!conv || (conv.aId !== meId && conv.bId !== meId)) return null;
  return { conv, peer: (conv.aId === meId ? conv.b : conv.a) as DmPeer };
}

/** Xabarlar (eski → yangi); afterId berilsa — faqat undan keyingilar (polling) */
export async function listMessages(convId: string, afterId?: string | null, limit = 200) {
  let afterAt: Date | null = null;
  if (afterId) {
    const m = await db.query.dmMessages.findFirst({ where: and(eq(dmMessages.id, afterId), eq(dmMessages.conversationId, convId)), columns: { createdAt: true } });
    afterAt = m?.createdAt ?? null;
  }
  return db.query.dmMessages.findMany({
    where: afterAt ? and(eq(dmMessages.conversationId, convId), gt(dmMessages.createdAt, afterAt)) : eq(dmMessages.conversationId, convId),
    orderBy: [asc(dmMessages.createdAt), asc(dmMessages.id)],
    limit,
  });
}

/** Suhbatni o'qilgan deb belgilash (mening tomonim) */
export async function markRead(conv: Conversation, meId: string) {
  const now = new Date();
  await db
    .update(conversations)
    .set(conv.aId === meId ? { aReadAt: now } : { bReadAt: now })
    .where(eq(conversations.id, conv.id));
}

/** Xabar yuborish: yozadi, suhbat faolligini yangilaydi, kerak bo'lsa qarshi tomonga bildirishnoma */
export async function sendDm(conv: Conversation, meId: string, body: string, attachments: FileAttachment[]) {
  const peerId = peerOf(conv, meId);
  const peerReadAt = conv.aId === peerId ? conv.aReadAt : conv.bReadAt;
  // Bildirishnoma spami bo'lmasin: qarshi tomonda allaqachon o'qilmagan xabar bo'lsa, yana yubormaymiz
  const [{ n: alreadyUnread }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(dmMessages)
    .where(and(eq(dmMessages.conversationId, conv.id), eq(dmMessages.senderId, meId), gt(dmMessages.createdAt, peerReadAt ?? new Date(0))));

  const now = new Date();
  const msg: typeof dmMessages.$inferInsert = { id: uid(), conversationId: conv.id, senderId: meId, body, attachments, createdAt: now };
  await db.insert(dmMessages).values(msg);
  await db
    .update(conversations)
    .set({ lastMessageAt: now, ...(conv.aId === meId ? { aReadAt: now } : { bReadAt: now }) })
    .where(eq(conversations.id, conv.id));

  if (Number(alreadyUnread) === 0) {
    const me = await db.query.users.findFirst({ where: eq(users.id, meId), columns: { name: true } });
    const preview = body ? (body.length > 80 ? `${body.slice(0, 77)}…` : body) : "Fayl yubordi";
    await notify(peerId, "chat", `Yangi xabar — ${me?.name ?? "Foydalanuvchi"}`, preview, `/kabinet/chat?s=${conv.id}`);
  }
  return { ...msg, createdAt: now } as typeof dmMessages.$inferSelect;
}

/** Nav badge: o'qilmagan xabarli suhbatlar bo'yicha jami o'qilmaganlar soni */
export async function unreadDmCount(meId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(dmMessages)
    .innerJoin(conversations, eq(conversations.id, dmMessages.conversationId))
    .where(
      and(
        ne(dmMessages.senderId, meId),
        or(
          and(eq(conversations.aId, meId), gt(dmMessages.createdAt, sql`coalesce(${conversations.aReadAt}, 0)`)),
          and(eq(conversations.bId, meId), gt(dmMessages.createdAt, sql`coalesce(${conversations.bReadAt}, 0)`)),
        ),
      ),
    );
  return Number(n);
}
