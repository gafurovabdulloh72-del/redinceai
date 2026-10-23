import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { assignBreakout, autoAssign, breakouts, createBreakouts, MAX_BREAKOUTS, setBreakoutOpen } from "@/lib/live/zoom";

export const runtime = "nodejs";

/** GET — kichik xonalar va a'zolari */
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await ctx.params;
  return ok({ items: await breakouts(id) });
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), count: z.number().int().min(2).max(MAX_BREAKOUTS), names: z.array(z.string().max(40)).max(MAX_BREAKOUTS).optional() }),
  z.object({ action: z.literal("auto"), userIds: z.array(z.string().min(1).max(64)).max(500) }),
  z.object({ action: z.literal("assign"), userId: z.string().min(1).max(64), breakoutId: z.string().max(64).nullable() }),
  z.object({ action: z.literal("open"), open: z.boolean() }),
]);

/** POST — kichik xonalarni yaratish · avtomatik taqsimlash · biriktirish · ochish/yopish */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, bodySchema);
  const actor = { id: session.sub, role: session.role };
  if (input.action === "create") return ok({ items: await createBreakouts(id, actor, input.count, input.names ?? []) });
  if (input.action === "auto") return ok({ items: await autoAssign(id, actor, input.userIds) });
  if (input.action === "assign") {
    await assignBreakout(id, actor, input.userId, input.breakoutId);
    return ok({ items: await breakouts(id) });
  }
  await setBreakoutOpen(id, actor, input.open);
  return ok({ open: input.open });
});
