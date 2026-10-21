import { handler, ok, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { markStoryViewed } from "@/lib/stories/service";

type Ctx = { params: Promise<{ id: string }> };

/** POST: story ko'rildi (bir marta yoziladi) */
export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await enforceLimit("views", session.sub);
  await markStoryViewed(id, session.sub);
  return ok({ ok: true });
});
