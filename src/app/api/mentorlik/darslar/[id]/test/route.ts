import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { quizSubmitSchema } from "@/lib/mentorship/validators";
import { submitQuiz } from "@/lib/mentorship/learning";
import { enforceLimit } from "@/lib/security/rate-limit";

/** POST {answers:[idx…]} — dars testini topshirish */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, quizSubmitSchema);
  await enforceLimit("comments", session.sub);
  return ok(await submitQuiz(session.sub, id, input.answers, session.role === "admin"));
});
