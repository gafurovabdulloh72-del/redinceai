import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { setProfilePostPinned } from "@/lib/profile/posts";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ pinned: z.boolean() });

/**
 * POST /api/profil/postlar/[id]/pin  { pinned: true|false } — profil (shaxsiy) postini qadash/olish.
 * Faqat muallif (specialist/admin roli — profil posti faqat ularda bo'ladi); bitta qadalgan post, oldingisi avtomatik olinadi.
 */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession(["specialist", "admin"]);
  const { id } = await ctx.params;
  const { pinned } = await parseBody(req, schema);
  await enforceLimit("social", session.sub);
  const res = await setProfilePostPinned(id, session.sub, pinned);
  if (!res.ok) throw new ApiError(res.reason === "notfound" ? 404 : 403, res.reason === "notfound" ? "Post topilmadi" : "Faqat muallif qadaydi");
  return ok({ id, isPinned: res.isPinned });
});
