import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { conversations, users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertOwnUploads, attachmentListSchema } from "@/app/api/orders/_lib/attachments";
import { DM_BODY_MAX, getOrCreateConversation, listConversations, sendDm, touchLastSeen } from "@/lib/chat/dm";
import { normalizeUsername } from "@/lib/chat/username";
import { assertCanDm } from "@/lib/privacy/blocks";
import { enforceLimit } from "@/lib/security/rate-limit";

/** GET: mening suhbatlarim (qarshi tomon, oxirgi xabar, o'qilmaganlar) */
export const GET = handler(async () => {
  const session = await requireSession();
  await touchLastSeen(session.sub);
  return ok({ items: await listConversations(session.sub) });
});

/** Tana ixtiyoriy: bo'sh bo'lsa faqat suhbat ochiladi (xabarsiz); bor bo'lsa birinchi xabar ham yuboriladi */
const startSchema = z.object({
  /** Qarshi tomon taxallusi (@siz ham bo'ladi) */
  to: z.string().trim().min(3).max(24),
  body: z.string().trim().max(DM_BODY_MAX).optional().default(""),
  attachments: attachmentListSchema().optional().default([]),
});

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
    columns: { id: true, isBanned: true, dmPolicy: true },
  });
  if (!other || other.isBanned) throw new ApiError(404, "Bunday foydalanuvchi topilmadi");
  if (other.id === session.sub) throw new ApiError(400, "O'zingizga yozib bo'lmaydi");
  // Blok va "kim yozishi mumkin" siyosati (mavjud, xabarli suhbat bo'lsa siyosat to'sqinlik qilmaydi)
  const existing = await db.query.conversations.findFirst({
    where: and(eq(conversations.aId, session.sub < other.id ? session.sub : other.id), eq(conversations.bId, session.sub < other.id ? other.id : session.sub)),
    columns: { lastMessageAt: true },
  });
  await assertCanDm(session.sub, other, Boolean(existing?.lastMessageAt));

  const conv = await getOrCreateConversation(session.sub, other.id);
  if (input.body || input.attachments.length > 0) {
    await assertOwnUploads(session.sub, input.attachments.map((a) => a.url));
    await enforceLimit("messages", session.sub);
    await sendDm(conv, session.sub, input.body, input.attachments);
  }
  return ok({ conversationId: conv.id }, { status: 201 });
});
