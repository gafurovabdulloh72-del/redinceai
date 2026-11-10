import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { DM_TTL_OPTIONS, loadConversationFor, setDmTtl } from "@/lib/chat/dm";
import { isBlockedEither } from "@/lib/privacy/blocks";

const schema = z.object({ seconds: z.number().int().refine((v) => (DM_TTL_OPTIONS as readonly number[]).includes(v), { error: "Noto'g'ri muddat" }) });

/** PATCH { seconds } — o'z-o'zidan yo'qoladigan xabarlar muddati (ikki tomon uchun umumiy). Blok juftligida o'zgartirib bo'lmaydi */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  if (await isBlockedEither(session.sub, found.peer.id)) throw new ApiError(403, "Bu foydalanuvchi bilan yozishish mumkin emas");
  await enforceLimit("social", session.sub);
  return ok({ seconds: await setDmTtl(found.conv, session.sub, input.seconds) });
});
