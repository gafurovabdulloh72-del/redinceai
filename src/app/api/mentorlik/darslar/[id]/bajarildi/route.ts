import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { completeLesson } from "@/lib/mentorship/service";

type Ctx = { params: Promise<{ id: string }> };

/** POST { done } — darsni tugatilgan/tugatilmagan deb belgilash (yozilgan talaba) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  await enforceLimit("mentor", session.sub);
  const { id } = await ctx.params;
  const { done } = await parseBody(req, z.object({ done: z.boolean() }));
  return ok(await completeLesson(session.sub, id, done));
});
