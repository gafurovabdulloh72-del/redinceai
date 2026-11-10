import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { loadConversationFor, pinDm } from "@/lib/chat/dm";
import { isBlockedEither } from "@/lib/privacy/blocks";
import { enforceLimit } from "@/lib/security/rate-limit";

const schema = z.object({ messageId: z.string().trim().max(64).nullable() });

/**
 * PUT { messageId | null } — xabarni qadash / yechish (ikkala tomon ko'radi). Javob: qadalgan iqtibos yoki null.
 * Blok juftligida QADAB bo'lmaydi (qadoq qarshi tomon ekranida ko'rinadi — blokni chetlab o'tish, A15); yechish mumkin.
 */
export const PUT = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  if (input.messageId && (await isBlockedEither(session.sub, found.peer.id))) throw new ApiError(403, "Bu foydalanuvchi bilan yozishish mumkin emas");
  await enforceLimit("social", session.sub);
  return ok({ pinned: await pinDm(found.conv, input.messageId, session.sub) });
});
