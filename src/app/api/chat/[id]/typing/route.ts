import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { loadConversationFor, setDmTyping } from "@/lib/chat/dm";
import { isBlockedEither } from "@/lib/privacy/blocks";
import { enforceLimit } from "@/lib/security/rate-limit";

const schema = z.object({ typing: z.boolean().default(true) });

/**
 * POST { typing } — "yozmoqda…" signali (klient 2.5 soniyada bir marta yuboradi; 6 soniyadan keyin o'zi so'nadi).
 * Blok juftligida signal yozilmaydi (bloklangan odam «yozmoqda…» ko'rsata olmasin, A15) — 403.
 */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  await enforceLimit("typing", session.sub);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  if (input.typing && (found.peer.isBanned || (await isBlockedEither(session.sub, found.peer.id)))) throw new ApiError(403, "Bu foydalanuvchi bilan yozishish mumkin emas");
  await setDmTyping(found.conv, session.sub, input.typing);
  return ok({ typing: input.typing });
});
