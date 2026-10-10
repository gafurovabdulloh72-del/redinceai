import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { portfolioItems } from "@/lib/db/schema";
import { ApiError, handler, ok, requireSession } from "@/lib/api";

export const DELETE = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["specialist", "admin"]);
  const { id } = await ctx.params;

  const item = await db.query.portfolioItems.findFirst({
    where: eq(portfolioItems.id, id),
    with: { specialist: { columns: { userId: true } } },
  });
  if (!item) throw new ApiError(404, "Topilmadi");
  if (item.specialist.userId !== session.sub && session.role !== "admin") throw new ApiError(403, "Ruxsat yo'q");

  await db.delete(portfolioItems).where(eq(portfolioItems.id, id));
  return ok({ deleted: true });
});
