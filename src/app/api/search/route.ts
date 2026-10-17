import { z } from "zod";
import { handler, ok, parseQuery } from "@/lib/api";
import { globalSearch } from "@/lib/search/service";

/** GET ?q= — global qidiruv (⌘K paleti). 2 belgidan kam bo'lsa bo'sh */
export const GET = handler(async (req) => {
  const { q } = parseQuery(req.url, z.object({ q: z.string().trim().max(80).optional().default("") }));
  if (q.length < 2) return ok({ sections: [] });
  return ok({ sections: await globalSearch(q) });
});
