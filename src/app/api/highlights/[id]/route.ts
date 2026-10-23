import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { addToHighlight, deleteHighlight, highlightItems } from "@/lib/social/instagram";

type Ctx = { params: Promise<{ id: string }> };

/** GET: to'plam ichidagi story nusxalari. POST {storyId}: qo'shish. DELETE: to'plamni o'chirish */
export const GET = handler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const data = await highlightItems(id);
  if (!data) throw new ApiError(404, "To'plam topilmadi");
  return ok(data);
});

export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { storyId } = await parseBody(req, z.object({ storyId: z.string().min(1).max(64) }));
  return ok(await addToHighlight(id, session.sub, storyId));
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await deleteHighlight(id, session.sub, session.role === "admin");
  return ok({ deleted: true });
});
