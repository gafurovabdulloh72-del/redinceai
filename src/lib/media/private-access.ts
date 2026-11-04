import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, courses, dmMessages, enrollments, groupMembers, groupMessages, groups, lessons, messages, orders, payments, subscriptionInvoices, type FileAttachment } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth";
import { parseAttachmentFileId, type PrivateFileKind } from "./private-url";

/**
 * Yopiq fayl ruxsati (5-audit): `kind` + `id` → xom saqlash manzili. Ruxsat bo'lmasa 404 (resurs borligi oshkor
 * bo'lmasin; buyurtma/efir route'lari bilan bir xil qoida). Qoidalar:
 *  - dm       — faqat suhbat ishtirokchisi (admin ham EMAS); «men uchun o'chirilgan» / o'chirilgan / muddati o'tgan → 404
 *  - group    — jamoaning faol a'zosi yoki sayt admini; o'chirilgan xabar → 404
 *  - order    — buyurtma chati: mijoz / mutaxassis / admin
 *  - orderfile — buyurtmaning o'z biriktirmalari (orders.attachments): mijoz / mutaxassis / admin
 *  - material — dars materiali: kursga yozilgan / ustoz (egasi) / admin
 *  - receipt  — qo'lda o'tkazma cheki: admin yoki hisob egasi (subscription_invoices, zaxira — payments orqali buyurtma mijozi)
 */
export interface PrivateFile {
  url: string;
  name?: string;
}

type Viewer = Pick<SessionPayload, "sub" | "role">;
const NOT_FOUND = () => new ApiError(404, "Fayl topilmadi");

function pick(list: FileAttachment[] | null | undefined, index: number, poster: boolean): PrivateFile {
  const a = (list ?? [])[index];
  if (!a) throw NOT_FOUND();
  if (poster) {
    if (!a.poster) throw NOT_FOUND();
    return { url: a.poster, name: `${a.name || "video"}.jpg` };
  }
  return { url: a.url, name: a.name };
}

async function isOrderParty(orderId: string, v: Viewer): Promise<typeof orders.$inferSelect> {
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { specialist: { columns: { userId: true } } } });
  if (!o) throw NOT_FOUND();
  const party = o.clientId === v.sub || o.specialist?.userId === v.sub || v.role === "admin";
  if (!party) throw NOT_FOUND();
  return o;
}

export async function resolvePrivateFile(kind: PrivateFileKind, id: string, v: Viewer): Promise<PrivateFile> {
  if (kind === "receipt") {
    const inv = await db.query.subscriptionInvoices.findFirst({ where: eq(subscriptionInvoices.id, id), columns: { userId: true, meta: true } });
    if (inv) {
      const url = (inv.meta as { receiptUrl?: string } | null)?.receiptUrl;
      if (!url || (v.role !== "admin" && inv.userId !== v.sub)) throw NOT_FOUND();
      return { url, name: "chek" };
    }
    const p = await db.query.payments.findFirst({ where: eq(payments.id, id), columns: { orderId: true, meta: true } });
    const url = (p?.meta as { receiptUrl?: string } | null)?.receiptUrl;
    if (!p || !url) throw NOT_FOUND();
    await isOrderParty(p.orderId, v);
    return { url, name: "chek" };
  }

  const parsed = parseAttachmentFileId(id);
  if (!parsed) throw NOT_FOUND();
  const { ownerId, index, poster } = parsed;

  switch (kind) {
    case "dm": {
      const m = await db.query.dmMessages.findFirst({ where: eq(dmMessages.id, ownerId), columns: { conversationId: true, attachments: true, deletedAt: true, hiddenFor: true, expiresAt: true } });
      if (!m || m.deletedAt || (m.hiddenFor ?? []).includes(v.sub) || (m.expiresAt && m.expiresAt.getTime() < Date.now())) throw NOT_FOUND();
      const c = await db.query.conversations.findFirst({ where: eq(conversations.id, m.conversationId), columns: { aId: true, bId: true } });
      if (!c || (c.aId !== v.sub && c.bId !== v.sub)) throw NOT_FOUND();
      return pick(m.attachments, index, poster);
    }
    case "group": {
      const m = await db.query.groupMessages.findFirst({ where: eq(groupMessages.id, ownerId), columns: { groupId: true, attachments: true, deletedAt: true } });
      if (!m || m.deletedAt) throw NOT_FOUND();
      if (v.role !== "admin") {
        const g = await db.query.groups.findFirst({ where: eq(groups.id, m.groupId), columns: { id: true } });
        const mem = g ? await db.query.groupMembers.findFirst({ where: and(eq(groupMembers.groupId, g.id), eq(groupMembers.userId, v.sub)), columns: { status: true } }) : null;
        if (!mem || mem.status !== "active") throw NOT_FOUND();
      }
      return pick(m.attachments, index, poster);
    }
    case "order": {
      const m = await db.query.messages.findFirst({ where: eq(messages.id, ownerId), columns: { orderId: true, attachments: true } });
      if (!m) throw NOT_FOUND();
      await isOrderParty(m.orderId, v);
      return pick(m.attachments, index, poster);
    }
    case "orderfile": {
      const o = await isOrderParty(ownerId, v);
      return pick(o.attachments, index, poster);
    }
    case "material": {
      const l = await db.query.lessons.findFirst({ where: eq(lessons.id, ownerId), columns: { courseId: true, materials: true } });
      if (!l) throw NOT_FOUND();
      if (v.role !== "admin") {
        const c = await db.query.courses.findFirst({ where: eq(courses.id, l.courseId), with: { mentor: { columns: { userId: true } } } });
        if (!c) throw NOT_FOUND();
        const owner = c.mentor.userId === v.sub;
        const enrolled = owner ? true : Boolean(await db.query.enrollments.findFirst({ where: and(eq(enrollments.courseId, c.id), eq(enrollments.userId, v.sub)), columns: { id: true } }));
        if (!enrolled) throw NOT_FOUND();
      }
      const mat = (l.materials ?? [])[index];
      if (!mat || poster) throw NOT_FOUND();
      return { url: mat.url, name: mat.name };
    }
  }
}
