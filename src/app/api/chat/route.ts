import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { attachmentListSchema } from "@/app/api/orders/_lib/attachments";
import { DM_BODY_MAX, getOrCreateConversation, listConversations, sendDm, touchLastSeen } from "@/lib/chat/dm";
import { normalizeUsername } from "@/lib/chat/username";
import { enforceLimit } from "@/lib/security/rate-limit";

/** GET: mening suhbatlarim (qarshi tomon, oxirgi xabar, o'qilmaganlar) */
export const GET = handler(async () => {
  const session = await requireSession();
  await touchLastSeen(session.sub);
  return ok({ items: await listConversations(session.sub) });
});

const startSchema = z
  .object({
    /** Qarshi tomon taxallusi (@siz ham bo'ladi) */
    to: z.string().trim().min(3).max(24),
    body: z.string().trim().max(DM_BODY_MAX).optional().default(""),
    attachments: attachmentListSchema().optional().default([]),
  })
  .refine((v) => v.body.length > 0 || v.attachments.length > 0 || true, { message: "" });

/**
 * POST: taxallus bo'yicha suhbat ochish (bor bo'lsa — topish); body berilsa birinchi xabar ham yuboriladi.
 * Javob: { conversationId } — UI /kabinet/chat?s=<id> ga olib boradi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, startSchema);
  const username = normalizeUsername(input.to);

  const other = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: { id: true, isBanned: true },
  });
  if (!other || other.isBanned) throw new ApiError(404, "Bunday foydalanuvchi topilmadi");
  if (other.id === session.sub) throw new ApiError(400, "O'zingizga yozib bo'lmaydi");

  const conv = await getOrCreateConversation(session.sub, other.id);
  if (input.body || input.attachments.length > 0) {
    await enforceLimit("messages", session.sub);
    await sendDm(conv, session.sub, input.body, input.attachments);
  }
  return ok({ conversationId: conv.id }, { status: 201 });
});
