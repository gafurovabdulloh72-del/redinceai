import "server-only";
import { and, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, orders, specialists } from "@/lib/db/schema";
import { unreadDmCount } from "./dm";
import { listGroupInbox } from "./inbox";

/**
 * «Chat» nishoni (yon panel / pastki tab / brauzer sarlavhasi) uchun YAGONA manba — sahifa birinchi chizilganda (Navbar)
 * ham, jonli so'rovda (`GET /api/chat/unread`) ham aynan shu funksiya ishlaydi, shuning uchun son gidratsiyadan keyin
 * «sakramaydi» va ro'yxatdagi qatorlar bilan mos tushadi:
 *  - dm     — o'qilmagan shaxsiy xabarlar (ovozsiz suhbatlar hisobga olinmaydi);
 *  - groups — men a'zo guruh/kanallardagi o'qilmagan xabar/postlar (ovozsizlar hisobga olinmaydi) — inbox qatorlaridagi son;
 *  - orders — buyurtma chatlaridagi o'qilmagan xabarlar (buyurtma bo'yicha taqsimoti bilan — kartadagi «Chat» nishoni jonli yangilanadi).
 */
export interface ChatUnreadSummary {
  dm: number;
  groups: number;
  orders: number;
  total: number;
  /** Buyurtma id → o'qilmagan xabarlar soni (faqat 0 dan kattalari) */
  orderUnread: Record<string, number>;
}

/** Buyurtma chatlari: men tomon bo'lgan buyurtmalarda qarshi tomondan kelgan o'qilmagan xabarlar */
export async function unreadOrderMessages(meId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ orderId: messages.orderId, n: sql<number>`count(*)` })
    .from(messages)
    .innerJoin(orders, eq(orders.id, messages.orderId))
    .leftJoin(specialists, eq(specialists.id, orders.specialistId))
    .where(and(isNull(messages.readAt), isNotNull(messages.senderId), ne(messages.senderId, meId), or(eq(orders.clientId, meId), eq(specialists.userId, meId))))
    .groupBy(messages.orderId)
    .limit(200);
  const out: Record<string, number> = {};
  for (const r of rows) if (Number(r.n) > 0) out[r.orderId] = Number(r.n);
  return out;
}

/** Chat ro'yxatidagi «buyurtma chati» qatori: o'qilmagan xabari bor buyurtma (bosilsa buyurtma kartasidagi chat ochiladi) */
export interface OrderInboxRow {
  orderId: string;
  title: string;
  /** Qarshi tomon ismi (mijozga — mutaxassis, mutaxassisga — mijoz) */
  peerName: string;
  last: { body: string; at: number; hasFiles: boolean } | null;
  unread: number;
  href: string;
}

/**
 * O'qilmagan xabari bor buyurtma chatlari (B6): chat xabarlari sayt bildirishnomalariga yozilmaydi, shuning uchun
 * yagona ichki signal — «Chat» nishoni va shu qatorlar. Faqat o'qilmaganlari chiqadi (o'qilgach ro'yxatdan ketadi).
 */
export async function listOrderInbox(meId: string): Promise<OrderInboxRow[]> {
  const unread = await unreadOrderMessages(meId);
  const ids = Object.keys(unread).slice(0, 20);
  if (!ids.length) return [];
  const rows = await db.query.orders.findMany({
    where: (o, { inArray }) => inArray(o.id, ids),
    columns: { id: true, title: true, clientId: true },
    with: {
      client: { columns: { name: true } },
      specialist: { columns: { userId: true }, with: { user: { columns: { name: true } } } },
      messages: { orderBy: (m, { desc }) => [desc(m.createdAt)], limit: 1, columns: { body: true, createdAt: true, attachments: true } },
    },
  });
  return rows
    .map((o) => {
      const m = o.messages[0];
      return {
        orderId: o.id,
        title: o.title,
        peerName: o.clientId === meId ? (o.specialist?.user?.name ?? "") : (o.client?.name ?? ""),
        last: m ? { body: m.body, at: m.createdAt.getTime(), hasFiles: (m.attachments?.length ?? 0) > 0 } : null,
        unread: unread[o.id] ?? 0,
        href: `/kabinet/buyurtmalar?id=${o.id}&chat=1`,
      };
    })
    .sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0));
}

export async function chatUnreadSummary(meId: string): Promise<ChatUnreadSummary> {
  const [dm, groupRows, orderUnread] = await Promise.all([
    unreadDmCount(meId).catch(() => 0),
    listGroupInbox(meId).catch(() => []),
    unreadOrderMessages(meId).catch(() => ({}) as Record<string, number>),
  ]);
  const groups = groupRows.reduce((s, g) => s + (g.muted ? 0 : g.unread), 0);
  const ordersTotal = Object.values(orderUnread).reduce((s, n) => s + n, 0);
  return { dm, groups, orders: ordersTotal, total: dm + groups + ordersTotal, orderUnread };
}
