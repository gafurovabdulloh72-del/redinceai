import { z } from "zod";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { assertCanPost, assertCanView, createPost, listPosts } from "@/lib/groups/service";
import { postInputSchema } from "@/lib/groups/validators";
import { enforceLimit } from "@/lib/security/rate-limit";
import { groupOr404, optionalViewer } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };
const querySchema = z.object({ cursor: z.coerce.number().int().positive().optional() });

/** GET: lenta (?cursor=<ms>) — ochiq jamoada hammaga, yopiqda a'zolarga */
export const GET = handler(async (req, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const { cursor } = parseQuery(req.url, querySchema);
  const group = await groupOr404(slug);
  const viewer = await optionalViewer();
  await assertCanView(group, viewer);
  return ok(await listPosts(group, viewer, cursor ?? null));
});

/** POST: yangi post (matn va/yoki 4 tagacha rasm/video) — faqat faol a'zo, 30 / soat */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const input = await parseBody(req, postInputSchema);
  if (!input.body && input.media.length === 0) throw new ApiError(422, "Matn yoki rasm kerak", { body: "Bo'sh post" });
  if (input.eventUrl && !input.eventAt) throw new ApiError(422, "Efir vaqtini kiriting", { eventAt: "Havola uchun vaqt kerak" });
  if (input.eventAt && input.eventAt < Date.now() - 60 * 60 * 1000) throw new ApiError(422, "Efir vaqti o'tib ketgan", { eventAt: "Kelajakdagi vaqtni tanlang" });
  const group = await groupOr404(slug);
  await assertCanPost(group, { id: session.sub, role: session.role });
  await enforceLimit("posts", session.sub);
  await assertOwnUploads(session.sub, input.media.map((m) => m.url), [], "media");
  const p = await createPost(group, session.sub, input.body, input.media, { at: input.eventAt ?? null, url: input.eventUrl || null });
  return ok({ id: p.id }, { status: 201 });
});
