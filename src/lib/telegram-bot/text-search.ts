import "server-only";
import { or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * KIRILLCHA QIDIRUV (2026-11-10): SQLite `lower()` va `LIKE` faqat ASCII harflarda registrni e'tiborsiz qoldiradi —
 * «Алишер» deb saqlangan ismni `lower(name) like '%алишер%'` HECH QACHON topmaydi. Yechim (sxemasiz): so'rovning bir nechta
 * yozilish variantini (asl · kichik · KATTA · Har So'z Bosh Harf · Birinchi harf katta) `LIKE` bilan izlash — lotin harflarida
 * `LIKE`ning o'zi registrga befarq, kirillchada esa odatiy yozilishlar qamraladi.
 */
export function caseVariants(q: string): string[] {
  const t = q.trim();
  if (!t) return [];
  const lower = t.toLowerCase();
  const upper = t.toUpperCase();
  const title = lower.replace(/(^|[\s\-'’ʻ(«"])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
  const first = lower.charAt(0).toUpperCase() + lower.slice(1);
  return [...new Set([t, lower, upper, title, first])];
}

/** LIKE naqshi: `%…%`, maxsus belgilar (`%`, `_`, `\`) ekranlangan */
export const likeTerm = (s: string): string => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Ustun (yoki ifoda) so'rovning istalgan yozilish variantini o'z ichiga oladimi */
export function likeAny(col: AnyColumn | SQL, q: string): SQL {
  const parts = caseVariants(q).map((v) => sql`${col} like ${likeTerm(v)} escape '\\'`);
  return or(...parts) ?? sql`0`;
}

/** So'rovda ASCII bo'lmagan harf bormi (kirillcha) — faqat shunda qo'shimcha variantli qidiruv kerak */
export const hasNonAsciiLetter = (q: string): boolean => /[^\x00-\x7f]/.test(q) && /\p{L}/u.test(q);

/**
 * Telefon bo'yicha qidiruv. `users.phone` bazada SHIFRLANGAN (field-crypto) — `LIKE` shifrmatnda ishlamaydi. Shuning uchun
 * raqamlar Drizzle orqali ochib o'qiladi va xotirada solishtiriladi: so'rovdagi raqamlar (kamida 7 ta) saqlangan raqamning
 * OXIRIGA mos kelishi kerak (`90 123 45 67` ↔ `+998901234567`). Faqat admin qidiruvi uchun (kichik hajm; 20 000 qator chegarasi).
 */
export async function userIdsByPhone(q: string): Promise<string[]> {
  const digits = q.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return [];
  const rows = await db
    .select({ id: users.id, phone: users.phone })
    .from(users)
    .where(sql`${users.phone} is not null and ${users.phone} != ''`)
    .limit(20_000);
  return rows.filter((r) => (r.phone ?? "").replace(/\D/g, "").endsWith(digits)).map((r) => r.id).slice(0, 20);
}
