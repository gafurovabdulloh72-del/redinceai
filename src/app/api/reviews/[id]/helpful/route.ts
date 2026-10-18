import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviews } from "@/lib/db/schema";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { toggleReviewVote } from "@/lib/queries";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/reviews/[id]/helpful — «Foydali» ovozini almashtiradi (bor bo'lsa olib tashlaydi).
 * Kirgan har qanday foydalanuvchi; o'z sharhiga ovoz berib bo'lmaydi. Javob: { voted, n }.
 */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const row = await db.query.reviews.findFirst({ where: eq(reviews.id, id), columns: { id: true, authorId: true } });
  if (!row) throw new ApiError(404, "Sharh topilmadi");
  if (row.authorId === session.sub) throw new ApiError(400, "O'z sharhingizga ovoz bera olmaysiz");
  await enforceLimit("social", session.sub);
  return ok(await toggleReviewVote(row.id, session.sub));
});
