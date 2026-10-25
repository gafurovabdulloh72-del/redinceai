import { handler, ok, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { postStats } from "@/lib/social/post-stats";

/** GET — post statistikasi (muallif · jamoa boshqaruvchisi · admin) */
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  await enforceLimit("postStats", session.sub);
  const { id } = await ctx.params;
  return ok(await postStats(id, { id: session.sub, role: session.role }));
});
