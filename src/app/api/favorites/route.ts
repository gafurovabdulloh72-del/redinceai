import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { favorites, specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { favoriteSchema } from "@/lib/validators";
import { listFavoriteIds, listFavoriteSpecialists } from "@/lib/queries";
import { enforceLimit } from "@/lib/security/rate-limit";

/** O'z sevimlilari: ?ids=1 — faqat ID'lar (tugmalar holati uchun), aks holda to'liq ro'yxat (toListItem orqali maskalangan) */
export const GET = handler(async (req) => {
  const session = await requireSession();
  if (new URL(req.url).searchParams.get("ids") === "1") return ok({ ids: await listFavoriteIds(session.sub) });
  const items = await listFavoriteSpecialists(session.sub, { userId: session.sub, role: session.role });
  return ok({ items, total: items.length });
});

/** Sevimlilarga qo'shish — takror bo'lsa jim o'tadi (insert-or-ignore) */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const { specialistId } = await parseBody(req, favoriteSchema);
  await enforceLimit("favorites", session.sub);

  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.id, specialistId),
    columns: { id: true, userId: true },
    with: { user: { columns: { isBanned: true } } },
  });
  // Bloklangan / o'chirilgan profil sevimlilarga qo'shilmaydi (olib tashlash — DELETE — har doim ishlaydi)
  if (!sp || sp.user.isBanned) throw new ApiError(404, "Mutaxassis topilmadi");
  if (sp.userId === session.sub) throw new ApiError(400, "O'z profilingizni sevimlilarga qo'sha olmaysiz");

  await db.insert(favorites).values({ userId: session.sub, specialistId: sp.id }).onConflictDoNothing();
  return ok({ favorite: true }, { status: 201 });
});

/** Sevimlilardan olib tashlash: ?specialistId= */
export const DELETE = handler(async (req) => {
  const session = await requireSession();
  const { specialistId } = parseQuery(req.url, favoriteSchema);
  await db.delete(favorites).where(and(eq(favorites.userId, session.sub), eq(favorites.specialistId, specialistId)));
  return ok({ favorite: false });
});
