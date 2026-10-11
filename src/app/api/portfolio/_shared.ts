import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { portfolioItems } from "@/lib/db/schema";

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
