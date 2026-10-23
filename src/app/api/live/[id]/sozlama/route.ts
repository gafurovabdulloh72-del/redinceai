import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { setEntryRules } from "@/lib/live/zoom";

export const runtime = "nodejs";

const bodySchema = z.object({ waitingRoom: z.boolean().optional(), passcode: z.string().max(32).nullable().optional() });

/** PATCH — kirish qoidalari: kutish xonasi va efir kodi (boshlovchi/hammuallif, efir davomida ham) */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, bodySchema);
  await setEntryRules(id, { id: session.sub, role: session.role }, input);
  return ok({ updated: true });
});
