import { z } from "zod";
import { handler, ok, parseQuery } from "@/lib/api";
import { optionalViewer } from "@/app/api/groups/_lib";
import { countNewPosts } from "@/lib/feed";
import { normalizeTag } from "@/lib/groups/limits";

const querySchema = z.object({
  since: z.coerce.number().int().positive(),
  scope: z.enum(["all", "following"]).optional().default("all"),
  tag: z.string().trim().max(48).optional(),
});

/** GET ?since=<ms>&scope=&tag= — shu vaqtdan keyin lentaga tushgan postlar soni («N ta yangi post» pilyulasi; 50 tagacha) */
export const GET = handler(async (req) => {
  const { since, scope, tag } = parseQuery(req.url, querySchema);
  const viewer = await optionalViewer();
  const count = await countNewPosts(viewer, { scope, tag: tag ? normalizeTag(tag) : null, since });
  return ok({ count, at: Date.now() });
});
