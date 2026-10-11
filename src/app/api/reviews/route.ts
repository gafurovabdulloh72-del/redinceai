import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviews, specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { reviewDeleteSchema, reviewSchema } from "@/lib/validators";
import { hasAcceptedOrderWith, recalcRating } from "@/lib/queries";
import { enforceLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { uid } from "@/lib/utils";

export const POST = handler(async (req) => {
  const session = await requireSession();
  // Avval tekshiruv, keyin limit — 422 javoblar limitni yemasin (POST /api/orders bilan bir xil tartib)
  const input = await parseBody(req, reviewSchema);
  await enforceLimit("reviews", session.sub);

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

  // "Haqiqiy fikr" sharti: yangi sharh faqat shu mutaxassis bilan qabul qilingan/bajarilgan buyurtmasi borlardan;
  // avval qoldirilgan sharhni tahrirlash mumkin
  if (!existing && !(await hasAcceptedOrderWith(session.sub, sp.id))) {
    throw new ApiError(403, "Sharh faqat shu mutaxassis bilan buyurtmangiz qabul qilingach qoldiriladi");
  }

  if (existing) {
    await db.update(reviews).set({ rating: input.rating, text: input.text }).where(eq(reviews.id, existing.id));
  } else {
    await db.insert(reviews).values({ id: uid(), specialistId: sp.id, authorId: session.sub, rating: input.rating, text: input.text });
  }
  await recalcRating(sp.id);
  return ok({ saved: true, updated: Boolean(existing) }, { status: existing ? 200 : 201 });
});

/** O'z sharhini o'chirish (?specialistId=); admin — &authorId= bilan boshqa muallifnikini ham (moderatsiya) */
export const DELETE = handler(async (req) => {
  const session = await requireSession();
  const { specialistId, authorId } = parseQuery(req.url, reviewDeleteSchema);
  if (authorId && authorId !== session.sub && session.role !== "admin") throw new ApiError(403, "Ruxsat yo'q");
  const target = authorId ?? session.sub;

  const row = await db.query.reviews.findFirst({
    where: and(eq(reviews.specialistId, specialistId), eq(reviews.authorId, target)),
    columns: { id: true },
  });
  if (!row) throw new ApiError(404, "Sharh topilmadi");

  await db.delete(reviews).where(eq(reviews.id, row.id));
  await recalcRating(specialistId);
  await audit(session.sub, "review_deleted", { targetType: "review", targetId: row.id, meta: { specialistId, authorId: target, byAdmin: target !== session.sub } }, req);
  return ok({ deleted: true });
});
