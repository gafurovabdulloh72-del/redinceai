import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { endLive } from "@/lib/live/service";

export const runtime = "nodejs";

const bodySchema = z.object({ peak: z.number().int().min(0).max(1_000_000).optional() });

/** DELETE — efirni tugatish (faqat boshlovchi/admin) */
export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, bodySchema).catch(() => ({ peak: undefined }));
  await endLive(id, { id: session.sub, role: session.role }, input.peak);
  return ok({ ended: true });
});
