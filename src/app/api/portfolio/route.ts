import { and, count, eq, inArray, max, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { portfolioItems, specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { portfolioItemSchema } from "@/lib/validators";
import { uid, youtubeId } from "@/lib/utils";
import { enforceLimit } from "@/lib/security/rate-limit";

const MAX_ITEMS = 30;

export const POST = handler(async (req) => {
  const session = await requireSession(["specialist", "admin"]);
  await enforceLimit("portfolio", session.sub);
  const input = await parseBody(req, portfolioItemSchema);

  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, session.sub), columns: { id: true } });
  if (!sp) throw new ApiError(400, "Avval mutaxassis profilini to'ldiring");

  // Soni — limit uchun; tartib raqami — maksimal+1 (o'chirishdan keyin soni bilan to'qnashmasin)
  const [{ n, top }] = await db.select({ n: count(), top: max(portfolioItems.sortOrder) }).from(portfolioItems).where(eq(portfolioItems.specialistId, sp.id));
  if (n >= MAX_ITEMS) throw new ApiError(400, `Portfolioda ko'pi bilan ${MAX_ITEMS} ta ish bo'lishi mumkin`);

  // YouTube video uchun thumbnail avtomatik
  let thumbnailUrl = input.thumbnailUrl || null;
  if (!thumbnailUrl && input.type === "video") {
    const yt = youtubeId(input.url);
    if (yt) thumbnailUrl = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  }
  if (!thumbnailUrl && input.type === "image") thumbnailUrl = input.url;

  const id = uid();
  await db.insert(portfolioItems).values({
    id,
    specialistId: sp.id,
    title: input.title,
    type: input.type,
    url: input.url,
    thumbnailUrl,
    description: input.description || null,
    sortOrder: (top ?? -1) + 1,
  });
  return ok({ id }, { status: 201 });
});

/** Tartibni o'zgartirish: ids — egasining BARCHA ishlari yangi tartibda */
const reorderSchema = z.object({ ids: z.array(z.string().trim().min(1).max(64)).min(1).max(MAX_ITEMS) });

export const PATCH = handler(async (req) => {
  const session = await requireSession(["specialist", "admin"]);
  const { ids } = await parseBody(req, reorderSchema);
  if (new Set(ids).size !== ids.length) throw new ApiError(422, "Ro'yxatda takror ish bor");

  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, session.sub), columns: { id: true } });
  if (!sp) throw new ApiError(400, "Avval mutaxassis profilini to'ldiring");

  const own = await db.select({ id: portfolioItems.id }).from(portfolioItems).where(eq(portfolioItems.specialistId, sp.id));
  const ownIds = new Set(own.map((r) => r.id));
  if (ids.length !== ownIds.size || ids.some((id) => !ownIds.has(id))) throw new ApiError(409, "Ro'yxat eskirgan — sahifani yangilab, qayta urinib ko'ring");

  // Bitta so'rov: sortOrder = ro'yxatdagi o'rni
  const cases = sql.join(
    ids.map((id, i) => sql`when ${id} then ${i}`),
    sql` `,
  );
  await db
    .update(portfolioItems)
    .set({ sortOrder: sql`case ${portfolioItems.id} ${cases} else ${portfolioItems.sortOrder} end` })
    .where(and(eq(portfolioItems.specialistId, sp.id), inArray(portfolioItems.id, ids)));
  return ok({ reordered: ids.length });
});
