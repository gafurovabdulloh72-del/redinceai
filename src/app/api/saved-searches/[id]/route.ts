import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { countNewMatches } from "@/lib/saved-searches";
import { rateLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** Faqat egasining yozuvi — boshqa foydalanuvchiniki 404 (mavjudligi ham oshkor bo'lmasin) */
async function own(userId: string, id: string) {
  const row = await db.query.savedSearches.findFirst({ where: and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)) });
  if (!row) throw new ApiError(404, "Qidiruv topilmadi");
  return row;
}

/** «Hozir tekshirish»: oxirgi xabardan (yoki saqlangandan) keyin mos kelgan yangi mutaxassislar soni + ochish havolasi */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await rateLimit(`savedSearchCheck:${session.sub}`, 60, 60 * 60_000);
  const row = await own(session.sub, id);
  const { n, query } = await countNewMatches(row, { userId: session.sub, role: session.role });
  const params = new URLSearchParams(query);
  params.set("sort", "newest");
  return ok({ id, newCount: n, since: (row.lastNotifiedAt ?? row.createdAt).getTime(), href: `/mutaxassislar?${params.toString()}` }, { headers: { "Cache-Control": "no-store" } });
});

const updateSchema = z
  .object({
    name: z.string().trim().min(2, "Nom kamida 2 ta belgi").max(60, "Nom 60 belgidan oshmasin").optional(),
    notify: z.boolean().optional(),
    frequency: z.enum(["daily", "weekly"]).optional(),
  })
  .refine((d) => d.name !== undefined || d.notify !== undefined || d.frequency !== undefined, "O'zgartirish uchun maydon yuboring");

/** Nomini o'zgartirish, bildirishnomani yoqish/o'chirish va/yoki chastota (daily|weekly) */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, updateSchema);
  await rateLimit(`savedSearches:${session.sub}`, 30, 60 * 60_000);
  const row = await own(session.sub, id);

  const patch: Partial<{ name: string; notify: boolean; frequency: "daily" | "weekly"; lastNotifiedAt: Date }> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.frequency !== undefined) patch.frequency = input.frequency;
  if (input.notify !== undefined) {
    patch.notify = input.notify;
    // Qayta yoqilganda — o'chiq turgan davrdagi mutaxassislar uchun ommaviy xabar kelmasin
    if (input.notify && !row.notify) patch.lastNotifiedAt = new Date();
  }
  await db.update(savedSearches).set(patch).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, session.sub)));
  return ok({ id, name: patch.name ?? row.name, notify: patch.notify ?? row.notify, frequency: patch.frequency ?? row.frequency });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await own(session.sub, id);
  await db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, session.sub)));
  return ok({ deleted: true });
});
