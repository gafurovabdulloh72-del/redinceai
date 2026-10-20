import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { courseReviewSchema } from "@/lib/mentorship/validators";
import { addCourseReview } from "@/lib/mentorship/service";

type Ctx = { params: Promise<{ id: string }> };

/** POST { rating, body } — kursga sharh (faqat yozilgan talaba, bir marta) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, courseReviewSchema);
  await addCourseReview(session.sub, id, input);
  return ok({ ok: true }, { status: 201 });
});
