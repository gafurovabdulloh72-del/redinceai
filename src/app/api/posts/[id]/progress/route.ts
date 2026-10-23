import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { saveProgress } from "@/lib/social/library";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ position: z.coerce.number().min(0).max(86_400), duration: z.coerce.number().min(0).max(86_400).optional().default(0) });

/** POST: video qaysi joyda to'xtaganini saqlash (davom ettirish + ko'rish tarixi). Klient 15 soniyada bir yuboradi */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { position, duration } = await parseBody(req, schema);
  await enforceLimit("views", session.sub);
  await saveProgress(session.sub, id, position, duration);
  return ok({ saved: true });
});
