import { z } from "zod";
import { eq } from "drizzle-orm";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { attachmentListSchema, assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { assertCanPost } from "@/lib/groups/service";
import { listScheduled, schedulePost } from "@/lib/social/instagram";
import { POST_BODY_MAX, POST_MEDIA_MAX } from "@/lib/groups/limits";
import { enforceLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  body: z.string().trim().max(POST_BODY_MAX, `Matn ko'pi bilan ${POST_BODY_MAX} belgi`).optional().default(""),
  media: attachmentListSchema(POST_MEDIA_MAX).optional().default([]),
  audience: z.enum(["public", "close"]).optional(),
  placeName: z.string().trim().max(80).nullable().optional(),
  tagIds: z.array(z.string().max(64)).max(20).optional(),
  /** Jamoa posti: slug (kompozitor shuni biladi) yoki id. Ikkalasi ham bo'lmasa — profil posti */
  groupSlug: z.string().trim().max(80).nullable().optional(),
  groupId: z.string().max(64).nullable().optional(),
  runAt: z.coerce.number().int().positive(),
});

/** GET: rejalashtirilgan postlarim. POST: yangi reja (5 daqiqadan 60 kungacha) */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ items: await listScheduled(session.sub) });
});

/**
 * RUXSAT (7-audit): ilgari `groupId` tekshirilmasdan saqlanar va cron postni o'sha jamoaga joylardi — istalgan mutaxassis
 * rasmiy kanalga yoki a'zo bo'lmagan yopiq jamoaga yoza olardi. Endi darhol joylashdagi bilan BIR XIL qoida:
 * jamoa posti → `assertCanPost` (faol a'zo; kanalda faqat egasi/adminlar), profil posti → faqat mutaxassis/admin.
 * Xuddi shu tekshiruv joylash paytida ham takrorlanadi (`runScheduledPosts`) — a'zolik/blok shu orada o'zgargan bo'lishi mumkin.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, schema);
  await enforceLimit("posts", session.sub);
  let groupId: string | null = null;
  if (input.groupSlug || input.groupId) {
    const group = await db.query.groups.findFirst({ where: input.groupSlug ? eq(groups.slug, input.groupSlug) : eq(groups.id, input.groupId ?? "") });
    if (!group) throw new ApiError(404, "Jamoa topilmadi");
    await assertCanPost(group, { id: session.sub, role: session.role });
    groupId = group.id;
  } else if (session.role !== "specialist" && session.role !== "admin") {
    throw new ApiError(403, "Profilga post faqat mutaxassislar uchun");
  }
  await assertOwnUploads(session.sub, input.media.flatMap((m) => (m.poster ? [m.url, m.poster] : [m.url])), [], "media");
  const row = await schedulePost(session.sub, { body: input.body, media: input.media, audience: groupId ? "public" : input.audience, placeName: input.placeName, tagIds: input.tagIds, groupId, runAt: input.runAt });
  return ok({ id: row.id, runAt: row.runAt.getTime() }, { status: 201 });
});
