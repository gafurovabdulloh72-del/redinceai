import "server-only";
import { and, count, desc, eq, gt, ne, or } from "drizzle-orm";
import { db } from "./db";
import { savedSearches, specialists } from "./db/schema";
import { notify } from "./notifications";
import { specialistFilterConds } from "./queries";
import { specialistFilterSchema, type SpecialistFilter } from "./validators";
import { SAVED_SEARCH_KEYS, describeSavedQuery } from "@/components/specialists/saved-search-label";

/**
 * Saqlangan qidiruvlar (F53): /mutaxassislar filtrlari nom bilan saqlanadi, yangi mos mutaxassislar paydo bo'lsa
 * egasiga bitta bildirishnoma ketadi (checkSavedSearchAlerts — kunlik cron'dan chaqiriladi, ulash integratorda).
 */

/** Bitta foydalanuvchi uchun saqlangan qidiruvlar chegarasi */
export const MAX_SAVED_SEARCHES = 20;

type FilterOnly = Omit<SpecialistFilter, "page" | "limit" | "sort">;

/**
 * Querystring'ni tekshirib kanonik ko'rinishga keltiradi: faqat ma'lum kalitlar, noto'g'ri qiymatlar tashlab yuboriladi,
 * standart qiymatlar (sort=rating, 0) yozilmaydi. Natija — saqlanadigan satr va filtr.
 */
export function canonicalSavedQuery(raw: string): { query: string; filter: SpecialistFilter } {
  const src = new URLSearchParams(raw.replace(/^\?/, ""));
  const flat: Record<string, string> = {};
  for (const k of SAVED_SEARCH_KEYS) {
    const v = src.get(k)?.trim();
    if (v) flat[k] = v;
  }
  let res = specialistFilterSchema.safeParse(flat);
  if (!res.success) {
    const bad = new Set(res.error.issues.map((i) => String(i.path[0])));
    for (const k of bad) delete flat[k];
    res = specialistFilterSchema.safeParse(flat);
  }
  const filter = res.success ? res.data : specialistFilterSchema.parse({});
  const out = new URLSearchParams();
  for (const k of SAVED_SEARCH_KEYS) {
    if (!(k in flat)) continue;
    const v = filter[k as keyof SpecialistFilter];
    if (v == null || v === "" || v === 0 || v === "0" || (k === "sort" && v === "rating")) continue;
    out.set(k, String(v));
  }
  return { query: out.toString(), filter };
}

/** Kabinet ro'yxati uchun DTO (userId chiqmaydi) */
export async function listSavedSearches(userId: string) {
  const rows = await db.query.savedSearches.findMany({ where: eq(savedSearches.userId, userId), orderBy: [desc(savedSearches.createdAt)] });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    query: r.query,
    summary: describeSavedQuery(r.query),
    notify: r.notify,
    lastNotifiedAt: r.lastNotifiedAt ? r.lastNotifiedAt.getTime() : null,
    createdAt: r.createdAt.getTime(),
  }));
}
export type SavedSearchDTO = Awaited<ReturnType<typeof listSavedSearches>>[number];

/**
 * Har bir notify=true qidiruv uchun: lastNotifiedAt (bo'lmasa — saqlangan vaqt) dan keyin qo'shilgan yoki yangilangan,
 * katalogda ko'rinadigan (bloklanmagan, obunasi faol) va filtrga mos mutaxassislarni sanaydi; bor bo'lsa — bitta
 * "saved_search" bildirishnomasi. "Hozir ochiq" filtri vaqtga bog'liq — ogohlantirishda e'tiborsiz. Egasining o'z profili sanalmaydi.
 * lastNotifiedAt har safar yangilanadi (oyna siljiydi) — bir mutaxassis haqida qayta-qayta xabar kelmaydi.
 */
export async function checkSavedSearchAlerts(now: Date = new Date()): Promise<{ checked: number; notified: number }> {
  const rows = await db.query.savedSearches.findMany({
    where: eq(savedSearches.notify, true),
    with: { user: { columns: { id: true, role: true, isBanned: true } } },
  });
  let notified = 0;
  for (const row of rows) {
    if (row.user.isBanned) continue;
    try {
      const since = row.lastNotifiedAt ?? row.createdAt;
      const { query, filter } = canonicalSavedQuery(row.query);
      const { page: _p, limit: _l, sort: _s, openNow: _o, ...rest } = filter;
      void _p;
      void _l;
      void _s;
      void _o;
      const f: FilterOnly = rest;
      const conds = await specialistFilterConds(f, { userId: row.user.id, role: row.user.role });
      conds.push(or(gt(specialists.createdAt, since), gt(specialists.updatedAt, since))!, ne(specialists.userId, row.user.id));
      const [{ n }] = await db.select({ n: count() }).from(specialists).where(and(...conds));
      if (n > 0) {
        const params = new URLSearchParams(query);
        params.set("sort", "newest");
        await notify(
          row.user.id,
          "saved_search",
          `«${row.name}» qidiruvingizga ${n} ta yangi mutaxassis mos keldi`,
          describeSavedQuery(query),
          `/mutaxassislar?${params.toString()}`,
        );
        notified++;
      }
      await db.update(savedSearches).set({ lastNotifiedAt: now }).where(eq(savedSearches.id, row.id));
    } catch (e) {
      console.error("[saved-search]", row.id, e);
    }
  }
  return { checked: rows.length, notified };
}
