import { handler, ok, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { deleteStory } from "@/lib/stories/service";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE: o'z story'sini o'chirish (admin — har qandayini) */
export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  await enforceLimit("stories", session.sub);
  const { id } = await ctx.params;
  await deleteStory(id, { id: session.sub, role: session.role });
  return ok({ deleted: true });
});
