import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports, reviews } from "@/lib/db/schema";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { recalcRating } from "@/lib/queries";
import { audit } from "@/lib/security/audit";

/** Admin: sharhni o'chirish (moderatsiya, F88) — reyting qayta hisoblanadi, shu sharh bo'yicha ochiq shikoyatlar yopiladi */
export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const row = await db.query.reviews.findFirst({ where: eq(reviews.id, id), columns: { id: true, specialistId: true, authorId: true, rating: true } });
  if (!row) throw new ApiError(404, "Sharh topilmadi");

  await db.delete(reviews).where(eq(reviews.id, id));
  await recalcRating(row.specialistId);
  await db
    .update(reports)
    .set({ status: "closed", resolvedBy: session.sub })
    .where(and(eq(reports.targetType, "review"), eq(reports.targetId, id), eq(reports.status, "open")));
  await audit(session.sub, "review_deleted", { targetType: "review", targetId: id, meta: { admin: true, specialistId: row.specialistId, authorId: row.authorId, rating: row.rating } }, req);
  return ok({ deleted: true, specialistId: row.specialistId });
});
