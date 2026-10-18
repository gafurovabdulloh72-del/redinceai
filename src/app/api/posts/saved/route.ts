import { z } from "zod";
import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { listSavedPosts } from "@/lib/feed";

const querySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

/** GET: mening saqlangan postlarim (faqat egasiga) — ?cursor=&limit= */
export const GET = handler(async (req) => {
  const session = await requireSession();
  const q = parseQuery(req.url, querySchema);
  return ok(await listSavedPosts({ id: session.sub, role: session.role }, { cursor: q.cursor ?? null, limit: q.limit }));
});
