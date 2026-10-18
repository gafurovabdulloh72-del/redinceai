import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { loadConversationFor, setDmTyping } from "@/lib/chat/dm";
import { enforceLimit } from "@/lib/security/rate-limit";

const schema = z.object({ typing: z.boolean().default(true) });

/** POST { typing } — "yozmoqda…" signali (klient 2.5 soniyada bir marta yuboradi; 6 soniyadan keyin o'zi so'nadi) */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  await enforceLimit("typing", session.sub);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  await setDmTyping(found.conv, session.sub, input.typing);
  return ok({ typing: input.typing });
});
