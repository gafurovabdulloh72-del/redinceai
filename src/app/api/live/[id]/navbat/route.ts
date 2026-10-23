import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { decideWaiting, waitingList } from "@/lib/live/zoom";

export const runtime = "nodejs";

/** GET — kutish xonasidagi navbat (boshlovchi/hammuallif) */
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok({ items: await waitingList(id, { id: session.sub, role: session.role }) });
});

const bodySchema = z.object({ userId: z.string().min(1).max(64), allow: z.boolean() });

/** POST — ruxsat berish yoki rad etish; `userId: "*"` — navbatdagi hammasiga ruxsat */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, bodySchema);
  const r = await decideWaiting(id, { id: session.sub, role: session.role }, input.userId, input.allow);
  return ok(r);
});
