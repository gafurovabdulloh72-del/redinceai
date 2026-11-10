import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { ownsFolder } from "@/lib/chat/dm";
import { bustGroupInbox, setGroupChatPref } from "@/lib/chat/inbox";
import { markGroupRead } from "@/lib/groups/service";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({
  pinned: z.boolean().optional(),
  /** null — «Hammasi»ga qaytarish */
  folderId: z.string().trim().max(60).nullable().optional(),
  /** Ovozsiz qilish (guruh sahifasidagi mute bilan bir xil ustun) */
  muted: z.boolean().optional(),
  /** Arxivga olish/chiqarish (faqat chat ro'yxati ko'rinishi) */
  archived: z.boolean().optional(),
  /** true — «o'qildi deb belgilash» (lastReadAt = hozir) */
  read: z.boolean().optional(),
});

/** PATCH — chat ro'yxatidagi guruh/kanal qatori: qadash, papka, ovozsiz, o'qildi (faqat o'z a'zoligim) */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema, { onlyProvided: true });
  // Papka faqat o'zimniki bo'lishi mumkin (begona yoki o'chirilgan papka id'si «osilib» qolmasin)
  if (input.folderId && !(await ownsFolder(session.sub, input.folderId))) throw new ApiError(404, "Papka topilmadi", { folderId: "Papka topilmadi" });
  if (input.pinned !== undefined || input.folderId !== undefined || input.muted !== undefined || input.archived !== undefined) {
    const okay = await setGroupChatPref(session.sub, id, { pinned: input.pinned, folderId: input.folderId, muted: input.muted, archived: input.archived });
    if (!okay) throw new ApiError(404, "Siz bu jamoaning a'zosi emassiz");
  }
  if (input.read) {
    // Foydalanuvchining aniq amali («o'qildi deb belgilash» / qatorni ochish) — shartsiz
    await markGroupRead(id, session.sub, { force: true });
    bustGroupInbox(session.sub);
  }
  return ok({ saved: true });
});
