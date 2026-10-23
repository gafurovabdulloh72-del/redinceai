import { z } from "zod";
import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { clearHistory, listHistory } from "@/lib/social/library";

const query = z.object({ cursor: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(30).optional() });

/** GET: ko'rish tarixi (davom ettirish joyi bilan). DELETE ?post=<id> — bittasini, bo'lmasa hammasini tozalaydi */
export const GET = handler(async (req) => {
  const session = await requireSession();
  const { cursor, limit } = parseQuery(req.url, query);
  return ok(await listHistory({ id: session.sub, role: session.role }, { cursor: cursor ?? null, limit }));
});

export const DELETE = handler(async (req) => {
  const session = await requireSession();
  const { post } = parseQuery(req.url, z.object({ post: z.string().max(64).optional() }));
  await clearHistory(session.sub, post);
  return ok({ cleared: true });
});
