import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { dmQuotes, forwardDm, loadConversationFor, toDmView } from "@/lib/chat/dm";
import { assertCanDm } from "@/lib/privacy/blocks";
import { enforceLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  messageId: z.string().trim().min(1).max(64),
  /** Qabul qiluvchi suhbat id'si (men a'zo bo'lgan) */
  to: z.string().trim().min(1).max(64),
});

/** POST { messageId, to } — xabarni boshqa suhbatga yo'naltirish (nusxa «Yo'naltirilgan: <ism>» belgisi bilan) */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  const [from, target] = await Promise.all([loadConversationFor(session.sub, id), loadConversationFor(session.sub, input.to)]);
  if (!from) throw new ApiError(404, "Suhbat topilmadi");
  if (!target) throw new ApiError(404, "Qabul qiluvchi suhbat topilmadi", { to: "Suhbat topilmadi" });
  if (target.peer.isBanned) throw new ApiError(403, "Bu foydalanuvchiga yozib bo'lmaydi");
  // Yo'naltirish ham xabar yuborish — qabul qiluvchining blok/siyosati amal qiladi
  await assertCanDm(session.sub, target.peer, Boolean(target.conv.lastMessageAt));
  await enforceLimit("messages", session.sub);
  const m = await forwardDm(from.conv, session.sub, input.messageId, target.conv);
  const quotes = await dmQuotes(target.conv.id, [m]);
  return ok({ conversationId: target.conv.id, message: toDmView(m, session.sub, quotes) }, { status: 201 });
});
