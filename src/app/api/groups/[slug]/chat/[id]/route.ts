import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertActiveMember, assertCanManage, deleteGroupMessage, editGroupMessage, loadGroupMessage, setPinnedMessage } from "@/lib/groups/service";
import { messagePatchSchema } from "@/lib/groups/validators";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { groupOr404 } from "../../../_lib";

type Ctx = { params: Promise<{ slug: string; id: string }> };

/** PATCH {body?} — o'z xabarini tahrirlash (24 soat); {pinned} — qadash/olish (egasi/admin) */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug, id } = await ctx.params;
  const input = await parseBody(req, messagePatchSchema);
  if (input.body === undefined && input.pinned === undefined) throw new ApiError(422, "O'zgarish yo'q");
  await enforceLimit("messages", session.sub);
  const group = await groupOr404(slug);
  const viewer = { id: session.sub, role: session.role };
  await assertActiveMember(group, viewer);
  const msg = await loadGroupMessage(group, id);
  if (!msg) throw new ApiError(404, "Xabar topilmadi");
  if (input.body !== undefined) await editGroupMessage(viewer, msg, input.body);
  if (input.pinned !== undefined) {
    await assertCanManage(group, viewer);
    if (input.pinned && msg.deletedAt) throw new ApiError(400, "O'chirilgan xabarni qadab bo'lmaydi");
    await setPinnedMessage(group, input.pinned ? msg.id : group.pinnedMessageId === msg.id ? null : group.pinnedMessageId);
    await audit(session.sub, "group_message_pin", { targetType: "group", targetId: group.id, meta: { messageId: msg.id, pinned: input.pinned } }, req);
  }
  return ok({ id: msg.id, pinned: input.pinned ?? group.pinnedMessageId === msg.id });
});

/** DELETE — o'z xabarini (yoki moderator har qandayini) o'chirish; o'rnida «Xabar o'chirilgan» qoladi */
export const DELETE = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug, id } = await ctx.params;
  await enforceLimit("messages", session.sub);
  const group = await groupOr404(slug);
  const viewer = { id: session.sub, role: session.role };
  await assertActiveMember(group, viewer);
  const msg = await loadGroupMessage(group, id);
  if (!msg) throw new ApiError(404, "Xabar topilmadi");
  await deleteGroupMessage(group, viewer, msg);
  if (msg.senderId !== session.sub) await audit(session.sub, "group_message_delete", { targetType: "group", targetId: group.id, meta: { messageId: msg.id, senderId: msg.senderId } }, req);
  return ok({ deleted: true });
});
