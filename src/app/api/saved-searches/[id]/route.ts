import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { savedSearchUpdateSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** Faqat egasining yozuvi — boshqa foydalanuvchiniki 404 (mavjudligi ham oshkor bo'lmasin) */
async function own(userId: string, id: string) {
  const row = await db.query.savedSearches.findFirst({ where: and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)) });
  if (!row) throw new ApiError(404, "Qidiruv topilmadi");
  return row;
}

/** Nomini o'zgartirish va/yoki bildirishnomani yoqish/o'chirish */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, savedSearchUpdateSchema);
  await rateLimit(`savedSearches:${session.sub}`, 30, 60 * 60_000);
  const row = await own(session.sub, id);

  const patch: Partial<{ name: string; notify: boolean; lastNotifiedAt: Date }> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.notify !== undefined) {
    patch.notify = input.notify;
    // Qayta yoqilganda — o'chiq turgan davrdagi mutaxassislar uchun ommaviy xabar kelmasin
    if (input.notify && !row.notify) patch.lastNotifiedAt = new Date();
  }
  await db.update(savedSearches).set(patch).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, session.sub)));
  return ok({ id, name: patch.name ?? row.name, notify: patch.notify ?? row.notify });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await own(session.sub, id);
  await db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, session.sub)));
  return ok({ deleted: true });
});
