import { and, asc, desc, eq, gt, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { uid } from "@/lib/utils";
import { loadOrderForParty } from "../../_lib/access";
import { assertOwnUploads, attachmentListSchema, uniqueAttachments } from "../../_lib/attachments";
import { notifyNewMessage, toChatDto } from "../../_lib/messages";

const PAGE = 200;

const querySchema = z.object({
  /** Shu vaqtdan keyingi xabarlar (ISO yoki ms) — polling uchun */
  after: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const ms = /^\d+$/.test(v) ? Number(v) : Date.parse(v);
      if (!Number.isFinite(ms)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Vaqt noto'g'ri" });
        return z.NEVER;
      }
      return new Date(ms);
    }),
});

const postSchema = z
  .object({
    body: z.string().max(4000, "Xabar 4000 belgidan oshmasin").optional().default(""),
    attachments: attachmentListSchema().optional().default([]),
  })
  .transform((v) => ({ body: v.body.replace(/\r\n/g, "\n").trim(), attachments: uniqueAttachments(v.attachments) }))
  .refine((v) => v.body.length > 0 || v.attachments.length > 0, { message: "Xabar matnini yozing", path: ["body"] });

/**
 * Buyurtma chati (F34): tomonlar (mijoz, mutaxassis) va admin (faqat o'qiydi).
 * GET — xabarlar (?after= bo'lsa faqat yangilari); tomon ochganda qarshi tomon xabarlari o'qilgan deb belgilanadi.
 * `readUpTo` — o'z xabarlarimdan qarshi tomon o'qigan eng oxirgisining vaqti (o'qildi belgilari uchun).
 */
export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { after } = parseQuery(req.url, querySchema);
  const { order, role } = await loadOrderForParty(id, session);

  const rows = after
    ? await db.query.messages.findMany({ where: and(eq(messages.orderId, id), gt(messages.createdAt, after)), orderBy: [asc(messages.createdAt)], limit: PAGE })
    : (await db.query.messages.findMany({ where: eq(messages.orderId, id), orderBy: [desc(messages.createdAt)], limit: PAGE })).reverse();

  if (role !== "admin") {
    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(eq(messages.orderId, id), isNull(messages.readAt), isNotNull(messages.senderId), ne(messages.senderId, session.sub)));
  }
  const [last] =
    role === "admin"
      ? [null]
      : await db
          .select({ at: sql<number | null>`max(${messages.createdAt})` })
          .from(messages)
          .where(and(eq(messages.orderId, id), eq(messages.senderId, session.sub), isNotNull(messages.readAt)));

  return ok({
    messages: rows.map((m) => toChatDto(m, order, session.sub)),
    readUpTo: last?.at != null ? Number(last.at) : null,
    role,
    canWrite: role !== "admin",
  });
});

/** Xabar yuborish: matn 1–4000 belgi va/yoki 5 tagacha fayl (/api/upload). Limit: 60 xabar / 10 daqiqa */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, postSchema);
  const { order, role } = await loadOrderForParty(id, session, { write: true });
  await enforceLimit("messages", session.sub);
  if (role === "admin") throw new ApiError(403, "Administrator faqat o'qiy oladi");
  await assertOwnUploads(
    session.sub,
    input.attachments.map((a) => a.url),
  );

  const [row] = await db.insert(messages).values({ id: uid(), orderId: id, senderId: session.sub, body: input.body, attachments: input.attachments, createdAt: new Date() }).returning();
  await notifyNewMessage(order, role, input.body || `${input.attachments.length} ta fayl`);
  return ok({ message: toChatDto(row, order, session.sub) }, { status: 201 });
});
