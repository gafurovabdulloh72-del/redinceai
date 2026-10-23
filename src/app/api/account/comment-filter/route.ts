import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { commentFilterWords, setCommentFilter } from "@/lib/social/instagram";

/** GET: izoh filtri so'zlari. PUT {words}: vergul bilan ajratilgan ro'yxat */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ words: await commentFilterWords(session.sub) });
});

export const PUT = handler(async (req) => {
  const session = await requireSession();
  const { words } = await parseBody(req, z.object({ words: z.string().max(2000) }));
  return ok(await setCommentFilter(session.sub, words));
});
