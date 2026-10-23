import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { optionalViewer } from "@/app/api/groups/_lib";
import { COLLECTION_DESC_MAX, COLLECTION_TITLE_MAX, deleteCollection, getCollection, reorderCollection, updateCollection } from "@/lib/social/library";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };
const patchSchema = z.object({
  title: z.string().trim().min(1).max(COLLECTION_TITLE_MAX).optional(),
  description: z.string().trim().max(COLLECTION_DESC_MAX).nullable().optional(),
  isPublic: z.boolean().optional(),
  /** Tartibni o'zgartirish: postId'lar yangi ketma-ketlikda */
  order: z.array(z.string().max(64)).max(300).optional(),
});

/** GET: to'plam va postlari (yopiq bo'lsa — faqat egasi/admin) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const viewer = await optionalViewer();
  const data = await getCollection(id, viewer);
  if (!data) throw new ApiError(404, "To'plam topilmadi");
  return ok(data);
});

/** PATCH: nom/tavsif/ochiqlik yoki tartib */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, patchSchema);
  await enforceLimit("social", session.sub);
  const viewer = { id: session.sub, role: session.role };
  if (input.order) await reorderCollection(id, viewer, input.order);
  const { order: _order, ...rest } = input;
  void _order;
  if (Object.keys(rest).length === 0) return ok({ reordered: true });
  return ok(await updateCollection(id, viewer, rest));
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await deleteCollection(id, { id: session.sub, role: session.role });
  return ok({ deleted: true });
});
