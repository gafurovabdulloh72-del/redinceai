import { handler, ok, requireSession } from "@/lib/api";
import { collectionsForPost } from "@/lib/social/library";

type Ctx = { params: Promise<{ id: string }> };

/** GET: mening to'plamlarim + shu post ularda bormi (tanlash oynasi uchun) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok({ items: await collectionsForPost(session.sub, id) });
});
