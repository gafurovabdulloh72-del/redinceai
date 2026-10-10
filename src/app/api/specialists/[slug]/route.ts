import { ApiError, handler, ok } from "@/lib/api";
import { getSpecialistBySlug } from "@/lib/queries";

export const GET = handler(async (_req, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const sp = await getSpecialistBySlug(slug);
  if (!sp) throw new ApiError(404, "Mutaxassis topilmadi");
  return ok(sp);
});
