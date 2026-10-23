import { ApiError, handler, ok } from "@/lib/api";
import { optionalViewer } from "@/app/api/groups/_lib";
import { getCollection } from "@/lib/social/library";

type Ctx = { params: Promise<{ id: string }> };

/** GET: to'plam postlari lenta ko'rinishida (HomeFeed manbasi; sahifalash yo'q — hammasi bir sahifada) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const data = await getCollection(id, await optionalViewer());
  if (!data) throw new ApiError(404, "To'plam topilmadi");
  return ok({ items: data.items, nextCursor: null });
});
