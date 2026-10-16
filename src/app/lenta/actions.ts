"use server";

import { getLentaItems, type LentaPage } from "@/lib/lenta";

/** Lentaning keyingi sahifasi (scroll-end / "Yana yuklash") — kursor noto'g'ri bo'lsa birinchi sahifa emas, bo'sh natija xavfsizroq emas: lib o'zi e'tiborsiz qoldiradi */
export async function loadMoreLenta(cursor: string): Promise<LentaPage> {
  if (typeof cursor !== "string" || !cursor) return { items: [], nextCursor: null };
  return getLentaItems(8, cursor);
}
