import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { recordOrderEvent } from "@/lib/payments/service";
import { enforceLimit } from "@/lib/security/rate-limit";
import { MAX_ATTACHMENTS, MAX_ORDER_ATTACHMENTS } from "@/components/chat/attachments";
import { loadOrderForParty } from "../../_lib/access";
import { assertOwnUploads, attachmentListSchema, uniqueAttachments } from "../../_lib/attachments";
import { notifyNewMessage, postSystemMessage } from "../../_lib/messages";

const schema = z.object({ add: attachmentListSchema(MAX_ATTACHMENTS).min(1, "Fayl tanlang") });

/**
 * Buyurtmaga fayl qo'shish (F35): ikkala tomon ham (brief, TZ, referens, oraliq natija).
 * Faqat qo'shiladi (kim yuklagani saqlanmaydi — boshqa tomon faylini o'chirib yubormaslik uchun o'chirish yo'q).
 * Jami ko'pi bilan 15 ta; har bir fayl shu foydalanuvchi /api/upload orqali yuklagan bo'lishi shart.
 */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { add } = await parseBody(req, schema);
  const { order, role } = await loadOrderForParty(id, session, { write: true });
  await enforceLimit("messages", session.sub);
  if (order.status === "cancelled") throw new ApiError(400, "Bekor qilingan buyurtmaga fayl qo'shib bo'lmaydi");

  const current = order.attachments ?? [];
  const known = current.map((a) => a.url);
  const fresh = uniqueAttachments(add).filter((a) => !known.includes(a.url));
  if (!fresh.length) return ok({ attachments: current });
  if (current.length + fresh.length > MAX_ORDER_ATTACHMENTS) throw new ApiError(422, `Buyurtmaga jami ${MAX_ORDER_ATTACHMENTS} tagacha fayl biriktiriladi`, { add: `Yana ${Math.max(0, MAX_ORDER_ATTACHMENTS - current.length)} ta qo'shish mumkin` });
  await assertOwnUploads(
    session.sub,
    fresh.map((a) => a.url),
  );

  const next = [...current, ...fresh];
  await db.update(orders).set({ attachments: next, updatedAt: new Date() }).where(eq(orders.id, id));
  const who = role === "client" ? "Mijoz" : "Mutaxassis";
  const names = fresh.map((a) => a.name).join(", ");
  await recordOrderEvent(id, session.sub, "note", { note: `${who} fayl biriktirdi: ${names}` });
  await postSystemMessage(id, `${who} buyurtmaga ${fresh.length} ta fayl biriktirdi: ${names}`);
  await notifyNewMessage(order, role, `buyurtmaga ${fresh.length} ta fayl biriktirdi`);
  return ok({ attachments: next });
});
