import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { liveAccess } from "@/lib/live/service";
import { saveCaption, transcript } from "@/lib/live/zoom";

export const runtime = "nodejs";

/** GET — transkript (efir subtitrlari ketma-ket) */
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await ctx.params;
  return ok({ items: await transcript(id) });
});

const bodySchema = z.object({ body: z.string().min(1).max(300), atSec: z.number().int().min(0).max(86_400) });

/** POST — sahnadagi odam nutqining matni (brauzer nutq tanish); tomoshabinlar data kanalidan oladi */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  await enforceLimit("liveWrite", session.sub);
  const { id } = await ctx.params;
  const input = await parseBody(req, bodySchema);
  const viewer = { id: session.sub, role: session.role };
  // Subtitr faqat gapirish huquqi borlardan (sahnada yoki boshqaruvchi)
  const { moderator, staged } = await liveAccess(id, viewer);
  if (!moderator && !staged) return ok({ skipped: true });
  await saveCaption(id, viewer, input.body, input.atSec);
  return ok({ saved: true });
});
