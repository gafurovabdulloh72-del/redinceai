import { handler, ok, requireSession } from "@/lib/api";
import { followState, toggleFollow } from "@/lib/groups/service";
import { enforceLimit } from "@/lib/security/rate-limit";
import { optionalViewer } from "@/app/api/groups/_lib";

type Ctx = { params: Promise<{ userId: string }> };

/** GET: obuna holati va sonlar; POST: obuna bo'lish / bekor qilish */
export const GET = handler(async (_req, ctx: Ctx) => {
  const { userId } = await ctx.params;
  const viewer = await optionalViewer();
  return ok(await followState(viewer?.id ?? null, userId));
});

export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { userId } = await ctx.params;
  await enforceLimit("social", session.sub);
  return ok(await toggleFollow(session.sub, userId));
});
