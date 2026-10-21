import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { setCoursePublished } from "@/lib/mentorship/service";

type Ctx = { params: Promise<{ id: string }> };

/** POST { publish } — kursni chop etish / yashirish (faqat egasi) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { publish } = await parseBody(req, z.object({ publish: z.boolean() }));
  await setCoursePublished(session.sub, id, publish, session.role === "admin");
  return ok({ published: publish });
});
