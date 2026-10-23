import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { loadConversationFor, setPrefs } from "@/lib/chat/dm";
import { enforceLimit } from "@/lib/security/rate-limit";

const schema = z
  .object({ archived: z.boolean().optional(), muted: z.boolean().optional(), pinned: z.boolean().optional(), folderId: z.string().max(64).nullable().optional() })
  .refine((v) => v.archived !== undefined || v.muted !== undefined || v.pinned !== undefined || v.folderId !== undefined, { message: "Kamida bitta sozlama kerak" });

/** PATCH { archived?, muted?, pinned? } — suhbatning shaxsiy sozlamalari (faqat men uchun). Javob: yangi holat */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  await enforceLimit("social", session.sub);
  return ok(await setPrefs(id, session.sub, input));
});
