import { count, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { portfolioItems, specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { portfolioItemSchema } from "@/lib/validators";
import { uid, youtubeId } from "@/lib/utils";
import { enforceLimit } from "@/lib/security/rate-limit";
import { MAX_PORTFOLIO_ITEMS as MAX_ITEMS, enforceEditLimit, reorderPortfolio, reorderSchema } from "./_shared";

export const POST = handler(async (req) => {
  const session = await requireSession(["specialist", "admin"]);
  const input = await parseBody(req, portfolioItemSchema);
  // Avval tekshiruv, keyin limit — 422 javoblar kunlik limitni yemasin
  await enforceLimit("portfolio", session.sub);

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

/** Tartibni o'zgartirish (eski manzil; yangisi — PUT /api/portfolio/reorder): ids — egasining BARCHA ishlari yangi tartibda */
export const PATCH = handler(async (req) => {
  const session = await requireSession(["specialist", "admin"]);
  const { ids } = await parseBody(req, reorderSchema);
  await enforceEditLimit(session.sub);
  return ok({ reordered: await reorderPortfolio(session.sub, ids) });
});
