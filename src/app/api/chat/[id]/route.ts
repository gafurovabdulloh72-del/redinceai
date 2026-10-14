import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertOwnUploads, attachmentListSchema } from "@/app/api/orders/_lib/attachments";
import { DM_BODY_MAX, listMessages, loadConversationFor, markRead, sendDm, touchLastSeen } from "@/lib/chat/dm";
import { enforceLimit } from "@/lib/security/rate-limit";

/**
 * GET: suhbat sarlavhasi (qarshi tomon) + xabarlar; ?after=<msgId> — faqat yangilari (polling).
 * O'qish suhbatni "o'qilgan" deb belgilaydi.
 */
export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  const after = new URL(req.url).searchParams.get("after");
  const items = await listMessages(id, after);
  await Promise.all([markRead(found.conv, session.sub), touchLastSeen(session.sub)]);
  return ok({
    peer: {
      id: found.peer.id,
      username: found.peer.username,
      name: found.peer.name,
      avatarUrl: found.peer.avatarUrl,
      isBanned: found.peer.isBanned,
      lastSeenAt: found.peer.lastSeenAt ? found.peer.lastSeenAt.getTime() : null,
    },
    /** Qarshi tomon o'qigan vaqt (ms) — bundan oldingi mening xabarlarim "✓✓ o'qildi" */
    peerReadAt: found.peerReadAt ? found.peerReadAt.getTime() : 0,
    items: items.map((m) => ({ id: m.id, mine: m.senderId === session.sub, body: m.body, attachments: m.attachments, at: m.createdAt.getTime() })),
  });
});

const sendSchema = z.object({
  body: z.string().trim().max(DM_BODY_MAX).optional().default(""),
  attachments: attachmentListSchema().optional().default([]),
});

/** POST: xabar yuborish (matn yoki fayl — kamida bittasi) */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, sendSchema);
  if (!input.body && input.attachments.length === 0) throw new ApiError(422, "Xabar matni yoki fayl kerak", { body: "Bo'sh xabar" });

  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  if (found.peer.isBanned) throw new ApiError(403, "Bu foydalanuvchiga yozib bo'lmaydi");

  // Faqat o'zi yuklagan fayllarni biriktira oladi (boshqa birovning faylini ulab bo'lmaydi)
  await assertOwnUploads(session.sub, input.attachments.map((a) => a.url));
  await enforceLimit("messages", session.sub);
  const m = await sendDm(found.conv, session.sub, input.body, input.attachments);
  return ok({ id: m.id, mine: true, body: m.body, attachments: m.attachments, at: m.createdAt.getTime() }, { status: 201 });
});
