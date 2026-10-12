import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviews } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { reviewReplySchema } from "@/lib/validators";
import { enforceLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";

/**
 * Mutaxassisning sharhga javobi (F43/F4). Faqat sharh tegishli bo'lgan profil egasi yozadi;
 * bo'sh satr — javobni o'chiradi. Har bir sharhga bitta javob (qayta yuborilsa — yangilanadi).
 */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  // Avval tekshiruv, keyin limit — 422 javoblar limitni yemasin
  const { reply } = await parseBody(req, reviewReplySchema);
  await enforceLimit("reviewReply", session.sub);

  const row = await db.query.reviews.findFirst({
    where: eq(reviews.id, id),
    columns: { id: true, specialistId: true },
    with: { specialist: { columns: { userId: true, slug: true } } },
  });
  if (!row) throw new ApiError(404, "Sharh topilmadi");
  if (row.specialist.userId !== session.sub) throw new ApiError(403, "Faqat profil egasi javob yoza oladi");

  const text = reply.trim();
  const replyAt = text ? new Date() : null;
  await db
    .update(reviews)
    .set({ reply: text || null, replyAt })
    .where(eq(reviews.id, row.id));
  await audit(session.sub, text ? "review_reply" : "review_reply_deleted", { targetType: "review", targetId: row.id, meta: { specialistId: row.specialistId } }, req);
  return ok({ id: row.id, reply: text || null, replyAt: replyAt ? replyAt.getTime() : null });
});
