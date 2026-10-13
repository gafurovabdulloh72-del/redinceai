import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, notifications, type OrderMessage } from "@/lib/db/schema";
import { notify } from "@/lib/notifications";
import { orderHref, type OrderWithParties } from "@/lib/payments/service";
import { uid } from "@/lib/utils";
import type { OrderRole } from "./access";

/** Chat xabari DTO — foydalanuvchi ID'lari chiqmaydi (kim yozgani: mine + sender roli) */
export interface ChatMessageDto {
  id: string;
  body: string;
  attachments: OrderMessage["attachments"];
  /** Joriy ko'ruvchi yozganmi */
  mine: boolean;
  sender: "client" | "specialist" | "system";
  senderName: string | null;
  /** ms; o'qilmagan bo'lsa null */
  readAt: number | null;
  createdAt: number;
}

export function toChatDto(m: OrderMessage, order: OrderWithParties, viewerId: string): ChatMessageDto {
  const sender = m.senderId == null ? "system" : m.senderId === order.clientId ? "client" : "specialist";
  return {
    id: m.id,
    body: m.body,
    attachments: m.attachments ?? [],
    mine: m.senderId != null && m.senderId === viewerId,
    sender,
    senderName: sender === "system" ? null : sender === "client" ? order.client.name : order.specialist.user.name,
    readAt: m.readAt?.getTime() ?? null,
    createdAt: m.createdAt.getTime(),
  };
}

/** Chatga ochiladigan havola (bildirishnomadan) */
export const chatHref = (orderId: string) => `${orderHref(orderId)}&chat=1`;

/** Tizim xabari (senderId null) — holat o'zgarishi, video havola va h.k. Hech qachon xato tashlamaydi */
export async function postSystemMessage(orderId: string, body: string): Promise<void> {
  try {
    await db.insert(messages).values({ id: uid(), orderId, senderId: null, body: body.slice(0, 4000), attachments: [], createdAt: new Date() });
  } catch (e) {
    console.error("[chat:system]", e);
  }
}

/**
 * Qarshi tomonga «yangi xabar» bildirishnomasi. Saytdagi ro'yxat to'lib ketmasin: shu buyurtma bo'yicha o'qilmagan
 * message_new bo'lsa yangisi yozilmaydi; email notify() ichida buyurtma bo'yicha 30 daqiqada 1 ta bilan cheklangan.
 */
export async function notifyNewMessage(order: OrderWithParties, senderRole: OrderRole, preview: string): Promise<void> {
  const toUserId = senderRole === "client" ? order.specialist.userId : order.clientId;
  const senderName = senderRole === "client" ? order.client.name : order.specialist.user.name;
  const href = chatHref(order.id);
  try {
    const pending = await db.query.notifications.findFirst({
      where: and(eq(notifications.userId, toUserId), eq(notifications.type, "message_new"), eq(notifications.href, href), isNull(notifications.readAt)),
      columns: { id: true },
    });
    if (pending) return;
  } catch {
    /* tekshiruvsiz davom etadi */
  }
  const text = preview.replace(/\s+/g, " ").trim();
  await notify(toUserId, "message_new", `Yangi xabar: ${order.title}`, `${senderName}: ${text.length > 140 ? `${text.slice(0, 140)}…` : text || "fayl yubordi"}`, href, { mailKey: order.id });
}
