import { z } from "zod";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { DM_BODY_MAX, deleteDm, dmQuotes, editDm, loadConversationFor, toDmView } from "@/lib/chat/dm";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string; mid: string }> };

const editSchema = z.object({ body: z.string().trim().max(DM_BODY_MAX) });

/** PATCH { body } — xabarni tahrirlash (faqat o'z xabari, 15 daqiqa ichida) */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id, mid } = await ctx.params;
  const input = await parseBody(req, editSchema);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  await enforceLimit("dmEdit", session.sub);
  const m = await editDm(found.conv, session.sub, mid, input.body);
  const quotes = await dmQuotes(id, [m]);
  return ok(toDmView(m, session.sub, quotes));
});

const delQuery = z.object({ scope: z.enum(["me", "all"]).default("me") });

/** DELETE ?scope=me|all — men uchun (istalgan xabar) yoki hamma uchun (faqat o'z xabari) o'chirish */
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
