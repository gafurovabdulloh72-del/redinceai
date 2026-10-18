import { z } from "zod";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { optionalViewer } from "@/app/api/groups/_lib";
import { postInputSchema } from "@/lib/groups/validators";
import { createProfilePost, listProfilePosts } from "@/lib/profile/posts";
import { enforceLimit } from "@/lib/security/rate-limit";

const querySchema = z.object({
  user: z.string().trim().min(1).max(64),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
  filter: z.enum(["all", "video", "photo", "text"]).optional().default("all"),
});

/** GET ?user=<userId>&cursor=<ms>&filter=video|photo|text — ijodkorning ommaviy profil lentasi */
export const GET = handler(async (req) => {
  const { user, cursor, limit, filter } = parseQuery(req.url, querySchema);
  const viewer = await optionalViewer();
  return ok(await listProfilePosts(user, viewer, { cursor: cursor ?? null, limit, filter }));
});

/** POST: o'z profiliga post (matn va/yoki 4 tagacha rasm/video) — ijodkor (mutaxassis) yoki admin, 30 / soat */
export const POST = handler(async (req) => {
  const session = await requireSession(["specialist", "admin"]);
  const input = await parseBody(req, postInputSchema);
  if (!input.body && input.media.length === 0) throw new ApiError(422, "Matn yoki rasm kerak", { body: "Bo'sh post" });
  await enforceLimit("posts", session.sub);
  await assertOwnUploads(session.sub, input.media.map((m) => m.url), [], "media");
  const p = await createProfilePost(session.sub, input.body, input.media);
  return ok({ id: p.id }, { status: 201 });
});
