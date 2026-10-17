import { handler, ok, requireSession } from "@/lib/api";
import { joinGroup, leaveGroup } from "@/lib/groups/service";
import { enforceLimit } from "@/lib/security/rate-limit";
import { groupOr404 } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };

/** POST: qo'shilish (ochiq — darhol, yopiq — so'rov); DELETE: chiqish */
export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  await enforceLimit("social", session.sub);
  const group = await groupOr404(slug);
  const membership = await joinGroup(group, session.sub);
  return ok({ membership });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  await enforceLimit("social", session.sub);
  const group = await groupOr404(slug);
  await leaveGroup(group, session.sub);
  return ok({ membership: null });
});
