import { runEventReminders } from "@/lib/events/reminders";
import { z } from "zod";
import { handler, ok, parseQuery } from "@/lib/api";
import { optionalViewer } from "@/app/api/groups/_lib";
import { homeFeed } from "@/lib/feed";
import { normalizeTag } from "@/lib/groups/limits";

const querySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  scope: z.enum(["all", "following"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(30).optional(),
  /** #teg filtri (belgisiz ham qabul qilinadi) */
  tag: z.string().trim().max(48).optional(),
});

/** GET ?cursor=<ms>&scope=all|following&tag= — bosh sahifa lentasi (ommaviy; "following" faqat kirganlarga ma'no beradi) */
export const GET = handler(async (req) => {
  void runEventReminders().catch(() => undefined);
  const { cursor, scope, limit, tag } = parseQuery(req.url, querySchema);
  const viewer = await optionalViewer();
  return ok(await homeFeed(viewer, { cursor: cursor ?? null, scope, limit, tag: tag ? normalizeTag(tag) : null }));
});
