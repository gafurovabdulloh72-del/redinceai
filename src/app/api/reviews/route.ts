import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviews, specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { reviewSchema } from "@/lib/validators";
import { recalcRating } from "@/lib/queries";
import { uid } from "@/lib/utils";

export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, reviewSchema);

  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.id, input.specialistId),
    columns: { id: true, userId: true },
  });
  if (!sp) throw new ApiError(404, "Mutaxassis topilmadi");
  if (sp.userId === session.sub) throw new ApiError(400, "O'zingizga sharh yoza olmaysiz");

  const existing = await db.query.reviews.findFirst({
    where: and(eq(reviews.specialistId, sp.id), eq(reviews.authorId, session.sub)),
    columns: { id: true },
  });

  if (existing) {
    await db.update(reviews).set({ rating: input.rating, text: input.text }).where(eq(reviews.id, existing.id));
  } else {
    await db.insert(reviews).values({ id: uid(), specialistId: sp.id, authorId: session.sub, rating: input.rating, text: input.text });
  }
  await recalcRating(sp.id);
  return ok({ saved: true, updated: Boolean(existing) }, { status: existing ? 200 : 201 });
});
