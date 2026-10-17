import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { IMAGE_URL_RE } from "@/components/chat/attachments";
import { assertCanManage, deleteGroup, getGroupView, isGroupOwner, setOfficial, updateGroup } from "@/lib/groups/service";
import { groupPatchSchema } from "@/lib/groups/validators";
import { audit } from "@/lib/security/audit";
import { groupOr404, optionalViewer } from "../_lib";

type Ctx = { params: Promise<{ slug: string }> };

/** GET: jamoa kartasi (ko'ruvchiga mos a'zolik/huquqlar bilan) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const view = await getGroupView(slug, await optionalViewer());
  if (!view) throw new ApiError(404, "Jamoa topilmadi");
  return ok(view);
});

/** PATCH: nom/tavsif/yo'nalish/hudud/muqova/yopiqlik — egasi yoki admin */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const group = await groupOr404(slug);
  const viewer = { id: session.sub, role: session.role };
  await assertCanManage(group, viewer);
  const patch = await parseBody(req, groupPatchSchema);
  if (patch.coverUrl) {
    if (!IMAGE_URL_RE.test(patch.coverUrl)) throw new ApiError(422, "Muqova rasm bo'lishi kerak", { coverUrl: "Rasmni sayt orqali yuklang" });
    if (patch.coverUrl !== group.coverUrl) await assertOwnUploads(session.sub, [patch.coverUrl], [], "coverUrl");
  }
  const { isOfficial, ...rest } = patch;
  let row = await updateGroup(group, rest);
  // Rasmiy kanal belgisi — faqat sayt admini; yoqilganda barcha foydalanuvchilar a'zo qilinadi
  if (isOfficial !== undefined) {
    if (session.role !== "admin") throw new ApiError(403, "Rasmiy kanal belgisini faqat sayt admini o'zgartiradi");
    row = await setOfficial(row, isOfficial);
  }
  await audit(session.sub, "group_update", { targetType: "group", targetId: group.id, meta: { fields: Object.keys(patch) } }, req);
  return ok(await getGroupView(row.slug, viewer));
});

/** DELETE: jamoani o'chirish — faqat egasi (yoki sayt admini); postlar/chat kaskad bilan ketadi */
export const DELETE = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const group = await groupOr404(slug);
  if (!isGroupOwner(group, { id: session.sub, role: session.role })) throw new ApiError(403, "Jamoani faqat egasi o'chira oladi");
  await deleteGroup(group.id);
  await audit(session.sub, "group_delete", { targetType: "group", targetId: group.id, meta: { name: group.name } }, req);
  return ok({ deleted: true });
});
