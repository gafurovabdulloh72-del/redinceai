import { handler, ok, requireSession } from "@/lib/api";
import { blockState, blockUser, unblockUser } from "@/lib/privacy/blocks";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ userId: string }> };

/** GET: blok holati (men → u, u → men) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { userId } = await ctx.params;
  return ok(await blockState(session.sub, userId));
});

/** POST: bloklash (obunalar ikki tomonlama uziladi) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { userId } = await ctx.params;
  await enforceLimit("blocks", session.sub);
  await blockUser(session.sub, userId);
  await audit(session.sub, "user_block", { targetType: "user", targetId: userId }, req);
  return ok({ blocked: true });
});

/** DELETE: blokdan chiqarish */
export const DELETE = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { userId } = await ctx.params;
  await enforceLimit("blocks", session.sub);
  await unblockUser(session.sub, userId);
  await audit(session.sub, "user_unblock", { targetType: "user", targetId: userId }, req);
  return ok({ blocked: false });
});
