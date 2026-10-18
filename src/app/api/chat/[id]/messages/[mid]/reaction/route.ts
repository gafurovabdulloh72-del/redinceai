import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { DM_REACTIONS } from "@/lib/chat/constants";
import { loadConversationFor, reactDm } from "@/lib/chat/dm";
import { assertCanDm } from "@/lib/privacy/blocks";
import { enforceLimit } from "@/lib/security/rate-limit";

const schema = z.object({ emoji: z.enum(DM_REACTIONS).nullable() });

/** PUT { emoji | null } — reaksiya qo'yish/almashtirish yoki olib tashlash. Javob: xabarning reaksiya yig'indisi */
export const PUT = handler(async (req, ctx: { params: Promise<{ id: string; mid: string }> }) => {
  const session = await requireSession();
  const { id, mid } = await ctx.params;
  const input = await parseBody(req, schema);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  // Blok bo'lsa reaksiya ham yo'q (siyosat — mavjud suhbat sifatida o'tadi)
  await assertCanDm(session.sub, found.peer, true);
  await enforceLimit("social", session.sub);
  return ok({ id: mid, reactions: await reactDm(found.conv, session.sub, mid, input.emoji) });
});
