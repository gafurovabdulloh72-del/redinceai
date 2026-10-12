import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { portfolioItems, specialists } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { rateLimit } from "@/lib/security/rate-limit";

/** Portfolio limiti — POST, sahifa va reorder bir xil qiymatni ishlatadi */
export const MAX_PORTFOLIO_ITEMS = 30;

/**
 * Mutaxassis ishlarini 0..n-1 qilib qayta raqamlaydi (sortOrder, keyin createdAt bo'yicha).
 * O'chirishdan keyin bo'shliq/takror qolmasin — kabinet va ommaviy profil bir xil tartibni ko'rsatsin.
 */
export async function renumberPortfolio(specialistId: string) {
  const rows = await db
    .select({ id: portfolioItems.id, sortOrder: portfolioItems.sortOrder })
    .from(portfolioItems)
    .where(eq(portfolioItems.specialistId, specialistId))
    .orderBy(asc(portfolioItems.sortOrder), asc(portfolioItems.createdAt));
  for (const [i, r] of rows.entries()) {
    if (r.sortOrder !== i) await db.update(portfolioItems).set({ sortOrder: i }).where(eq(portfolioItems.id, r.id));
  }
}

/**
 * Tahrirlash va tartiblash uchun yengil limit (soatiga 120) — qo'shish limitidan (kunlik 60) alohida,
 * strelkalar bilan ketma-ket tartiblash kunlik limitni yeb qo'ymasin.
 */
export function enforceEditLimit(userId: string) {
  return rateLimit(`portfolioEdit:${userId}`, 120, 60 * 60_000);
}

/** Tartibni o'zgartirish so'rovi: ids — egasining BARCHA ishlari yangi tartibda */
export const reorderSchema = z.object({ ids: z.array(z.string().trim().min(1).max(64)).min(1).max(MAX_PORTFOLIO_ITEMS) });

/**
 * Egasining ishlarini berilgan tartibda 0..n-1 qilib yozadi (bitta UPDATE … CASE).
 * Ro'yxat to'liq va faqat o'z ishlaridan iborat bo'lishi shart — aks holda 409 (eskirgan sahifa).
 */
export async function reorderPortfolio(userId: string, ids: string[]): Promise<number> {
  if (new Set(ids).size !== ids.length) throw new ApiError(422, "Ro'yxatda takror ish bor");

  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, userId), columns: { id: true } });
  if (!sp) throw new ApiError(400, "Avval mutaxassis profilini to'ldiring");

  const own = await db.select({ id: portfolioItems.id }).from(portfolioItems).where(eq(portfolioItems.specialistId, sp.id));
  const ownIds = new Set(own.map((r) => r.id));
  if (ids.length !== ownIds.size || ids.some((id) => !ownIds.has(id))) throw new ApiError(409, "Ro'yxat eskirgan — sahifani yangilab, qayta urinib ko'ring");

  const cases = sql.join(
    ids.map((id, i) => sql`when ${id} then ${i}`),
    sql` `,
  );
  await db
    .update(portfolioItems)
    .set({ sortOrder: sql`case ${portfolioItems.id} ${cases} else ${portfolioItems.sortOrder} end` })
    .where(and(eq(portfolioItems.specialistId, sp.id), inArray(portfolioItems.id, ids)));
  return ids.length;
}
