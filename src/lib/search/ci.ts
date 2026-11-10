import { like, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";

/**
 * Registrga bog'liq bo'lmagan qidiruv (KIRILL bilan ham). SQLite `lower()` va `LIKE` faqat ASCII harflarini
 * katta-kichikka tenglashtiradi: `lower('Алишер')` o'zgarmaydi, shuning uchun «алишер» deb yozilgan so'rov bazadagi
 * «Алишер»ni topmasdi. Yechim: ustunni ASCII bo'yicha kichraytirib solishtirish + so'rovning yozilgan, Bosh Harfli va
 * KATTA variantlari bilan xom ustunni solishtirish (kirill uchun). `q` — tozalangan matn (foizsiz).
 */
export function ciLike(column: SQLWrapper, q: string): SQL {
  const raw = q.replace(/[%_]/g, "").trim();
  const lower = raw.toLowerCase();
  const variants = new Set<string>([raw, lower.replace(/(^|[\s\-«"(])(\p{L})/gu, (_m, pre: string, ch: string) => pre + ch.toUpperCase()), raw.toUpperCase()]);
  const conds: SQL[] = [like(sql`lower(${column})`, `%${lower}%`)];
  // ASCII-only so'rovda qo'shimcha variantlar ortiqcha (lower() yetarli)
  if (/[^\u0000-\u007f]/.test(raw)) for (const v of variants) conds.push(like(column as never, `%${v}%`));
  return or(...conds)!;
}
