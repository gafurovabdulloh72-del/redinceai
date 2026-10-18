import { z } from "zod";
import { ApiError, handler, ok, parseQuery, requireSession } from "@/lib/api";
import { dmMediaCounts, listDmMedia, loadConversationFor } from "@/lib/chat/dm";

const schema = z.object({
  kind: z.enum(["image", "video", "file", "voice"]).optional(),
  cursor: z.coerce.number().int().min(0).optional(),
});

/**
 * GET — media paneli. `kind`siz: har tur bo'yicha soni ({ counts }); `kind` bilan: shu tur biriktirmalari
 * (yangi → eski, 40 tadan, `cursor` — oxirgi xabar vaqti). Faqat suhbat ishtirokchisi.
 */
export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const q = parseQuery(req.url, schema);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  if (!q.kind) return ok({ counts: await dmMediaCounts(id, session.sub) });
  return ok(await listDmMedia(id, session.sub, q.kind, q.cursor ?? null));
});
