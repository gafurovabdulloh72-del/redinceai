import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { moderateParticipant } from "@/lib/live/service";

export const runtime = "nodejs";

const bodySchema = z.object({ identity: z.string().min(1).max(64), action: z.enum(["kick", "allow", "revoke", "mute"]), trackSid: z.string().max(80).optional() });

/** POST — boshlovchi tomoshabinni boshqaradi: kick (chiqarish), allow (gapirishga ruxsat), revoke (ruxsatni olish), mute (mikrofonni o'chirish) */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, bodySchema);
  await moderateParticipant(id, { id: session.sub, role: session.role }, input.identity, input.action, input.trackSid);
  return ok({ done: true });
});
