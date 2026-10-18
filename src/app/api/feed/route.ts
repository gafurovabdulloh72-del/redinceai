import { z } from "zod";
import { handler, ok, parseQuery } from "@/lib/api";
import { optionalViewer } from "@/app/api/groups/_lib";
import { homeFeed } from "@/lib/feed";

const querySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  scope: z.enum(["all", "following"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

/** GET ?cursor=<ms>&scope=all|following — bosh sahifa lentasi (ommaviy; "following" faqat kirganlarga ma'no beradi) */
export const GET = handler(async (req) => {
  const { cursor, scope, limit } = parseQuery(req.url, querySchema);
  const viewer = await optionalViewer();
  return ok(await homeFeed(viewer, { cursor: cursor ?? null, scope, limit }));
});
