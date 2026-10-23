import { z } from "zod";
import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { listWatchLater } from "@/lib/social/library";

const query = z.object({ cursor: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(30).optional() });

/** GET: «Keyinroq ko'rish» navbati */
export const GET = handler(async (req) => {
  const session = await requireSession();
  const { cursor, limit } = parseQuery(req.url, query);
  return ok(await listWatchLater({ id: session.sub, role: session.role }, { cursor: cursor ?? null, limit }));
});
