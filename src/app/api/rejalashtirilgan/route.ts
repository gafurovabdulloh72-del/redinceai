import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { attachmentListSchema, assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { listScheduled, schedulePost } from "@/lib/social/instagram";
import { POST_MEDIA_MAX } from "@/lib/groups/limits";
import { enforceLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  body: z.string().trim().max(5000).optional().default(""),
  media: attachmentListSchema(POST_MEDIA_MAX).optional().default([]),
  audience: z.enum(["public", "close"]).optional(),
  placeName: z.string().trim().max(80).nullable().optional(),
  tagIds: z.array(z.string().max(64)).max(20).optional(),
  groupId: z.string().max(64).nullable().optional(),
  runAt: z.coerce.number().int().positive(),
});

/** GET: rejalashtirilgan postlarim. POST: yangi reja (5 daqiqadan 60 kungacha) */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ items: await listScheduled(session.sub) });
});

export const POST = handler(async (req) => {
  const session = await requireSession(["specialist", "admin"]);
  const input = await parseBody(req, schema);
  await enforceLimit("posts", session.sub);
  await assertOwnUploads(session.sub, input.media.map((m) => m.url), [], "media");
  const row = await schedulePost(session.sub, input);
  return ok({ id: row.id, runAt: row.runAt.getTime() }, { status: 201 });
});
