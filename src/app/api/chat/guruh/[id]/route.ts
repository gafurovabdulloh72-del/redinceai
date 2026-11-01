import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { setGroupChatPref } from "@/lib/chat/inbox";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({
  pinned: z.boolean().optional(),
  /** null — «Hammasi»ga qaytarish */
  folderId: z.string().trim().max(60).nullable().optional(),
});

/** PATCH — chat ro'yxatidagi guruh/kanal qatorini qadash yoki papkaga ko'chirish (faqat o'z a'zoligim) */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  const okay = await setGroupChatPref(session.sub, id, { pinned: input.pinned, folderId: input.folderId });
  if (!okay) throw new ApiError(404, "Siz bu jamoaning a'zosi emassiz");
  return ok({ saved: true });
});
