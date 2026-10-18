import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { assertCanManage, canModeratePost, deletePost, editPost, loadPost, setPostPinned } from "@/lib/groups/service";
import { markPostEdited } from "@/lib/groups/posts-extra";
import { feedItemById } from "@/lib/feed";
import { POST_BODY_MAX } from "@/lib/groups/limits";
import { audit } from "@/lib/security/audit";
import { optionalViewer } from "@/app/api/groups/_lib";

type Ctx = { params: Promise<{ id: string }> };
const patchSchema = z.object({
  body: z.string().trim().min(1, "Matn bo'sh").max(POST_BODY_MAX).optional(),
  isPinned: z.boolean().optional(),
});

/** GET: bitta post lenta elementi sifatida (so'rovnoma, manba chipi bilan) — ko'ra olmasa 404 (yopiq jamoa, blok, ban) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const viewer = await optionalViewer();
  const item = await feedItemById(id, viewer);
  if (!item) throw new ApiError(404, "Post topilmadi");
  return ok(item);
});

/** PATCH: matnni tahrirlash (faqat muallif) yoki qadash/olish (jamoa egasi/admin, sayt admini) */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, patchSchema);
  let post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  const viewer = { id: session.sub, role: session.role };
  let editedAt: number | null = post.editedAt?.getTime() ?? null;
  if (input.body !== undefined) {
    if (post.authorId !== session.sub && session.role !== "admin") throw new ApiError(403, "Faqat muallif tahrirlaydi");
    if (input.body !== post.body) {
      post = await editPost(post, input.body);
      editedAt = await markPostEdited(post.id);
    }
  }
  if (input.isPinned !== undefined) {
    const group = post.groupId ? await db.query.groups.findFirst({ where: eq(groups.id, post.groupId) }) : null;
    if (!group) throw new ApiError(400, "Faqat jamoa postini qadash mumkin");
    await assertCanManage(group, viewer);
    post = await setPostPinned(post, input.isPinned);
    await audit(session.sub, "post_pin", { targetType: "post", targetId: post.id, meta: { pinned: input.isPinned } }, req);
  }
  return ok({ id: post.id, isPinned: post.isPinned, body: post.body, editedAt });
});

/** DELETE: postni o'chirish — muallif, jamoa egasi/admin yoki sayt admini */
export const DELETE = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (!(await canModeratePost(post, { id: session.sub, role: session.role }))) throw new ApiError(403, "Ruxsat yo'q");
  await deletePost(post);
  if (post.authorId !== session.sub) await audit(session.sub, "post_delete", { targetType: "post", targetId: post.id, meta: { authorId: post.authorId } }, req);
  return ok({ deleted: true });
});
