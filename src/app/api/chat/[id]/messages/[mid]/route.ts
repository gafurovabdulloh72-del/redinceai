import { z } from "zod";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { DM_BODY_MAX, deleteDm, dmQuotes, editDm, loadConversationFor, toDmView } from "@/lib/chat/dm";
import { cleanBody } from "@/lib/chat/text";
import { isBlockedEither } from "@/lib/privacy/blocks";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string; mid: string }> };

const editSchema = z.object({ body: z.string().trim().max(DM_BODY_MAX) });

/**
 * PATCH { body } — xabarni tahrirlash (faqat o'z xabari, 3 soat ichida). Biriktirmali xabarda matn — izoh (caption).
 * Blok juftligida tahrirlab bo'lmaydi: bloklangan odam eski xabarini o'zgartirib, blok qo'ygan tomonga matn yetkaza olmasin (A15).
 */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id, mid } = await ctx.params;
  const input = await parseBody(req, editSchema);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  if (await isBlockedEither(session.sub, found.peer.id)) throw new ApiError(403, "Bu foydalanuvchi bilan yozishish mumkin emas");
  await enforceLimit("dmEdit", session.sub);
  const m = await editDm(found.conv, session.sub, mid, cleanBody(input.body));
  const quotes = await dmQuotes(id, [m], session.sub);
  return ok(toDmView(m, session.sub, quotes));
});

const delQuery = z.object({ scope: z.enum(["me", "all"]).default("me") });

/** DELETE ?scope=me|all — men uchun (istalgan xabar) yoki hamma uchun (faqat o'z xabari) o'chirish. Blok bo'lsa ham mumkin (o'z izini o'chirish) */
export const DELETE = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id, mid } = await ctx.params;
  const { scope } = parseQuery(req.url, delQuery);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  await enforceLimit("dmEdit", session.sub);
  await deleteDm(found.conv, session.sub, mid, scope);
  return ok({ id: mid, scope });
});
