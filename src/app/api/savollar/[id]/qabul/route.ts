import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { acceptAnswer } from "@/lib/qa/service";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ answerId: z.string().trim().min(5).max(80) });

/** POST — «Eng foydali» belgisi (faqat savol egasi; qayta bosish — bekor) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { answerId } = await parseBody(req, schema);
  return ok(await acceptAnswer(session.sub, id, answerId));
});
