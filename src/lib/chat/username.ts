import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { slugify } from "@/lib/utils";

/**
 * Chat taxallusi (@username): ro'yxatdan o'tishda ismdan avtomatik yasaladi,
 * profil sozlamalarida o'zgartiriladi. Chat havolasi: /yozish/<username>.
 */

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,18})[a-z0-9]$/;
export const USERNAME_HINT = "3–20 belgi: kichik lotin harflari, raqam va chiziqcha (-); chetlarida chiziqcha bo'lmasin";

/** Sayt yo'llari va texnik so'zlar bilan to'qnashmasin */
const RESERVED = new Set([
  "admin", "kabinet", "api", "chat", "yozish", "auth", "xarita", "mutaxassislar", "ishlar", "narxlar",
  "yordam", "oferta", "maxfiylik", "uploads", "u", "c", "kasb", "egalari", "kasbegalari", "support", "info", "root", "null",
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, "");
}

export function validateUsername(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const v = normalizeUsername(raw);
  if (!USERNAME_RE.test(v)) return { ok: false, error: USERNAME_HINT };
  if (RESERVED.has(v)) return { ok: false, error: "Bu taxallus band (tizim so'zi)" };
  return { ok: true, value: v };
}

/** Ismdan asos: "Abdulloh G'ofurov" → "abdulloh-gofurov" (bo'sh bo'lsa "user") */
export function usernameBase(name: string): string {
  const base = slugify(name).replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "").slice(0, 14);
  return base.length >= 3 && !RESERVED.has(base) ? base : `user`;
}

/** Band bo'lmagan taxallus: asos, keyin asos-2, asos-3… (poyga holati uchun oxiri tasodifiy qo'shimcha) */
export async function generateUsername(name: string): Promise<string> {
  const base = usernameBase(name);
  const taken = async (u: string) => Boolean(await db.query.users.findFirst({ where: eq(users.username, u), columns: { id: true } }));
  if (!(await taken(base))) return base;
  for (let i = 2; i <= 30; i++) {
    const v = `${base}-${i}`.slice(0, 20);
    if (!(await taken(v))) return v;
  }
  return `${base.slice(0, 13)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Taxallusi yo'q eski foydalanuvchilarga bir martalik to'ldirish (deploy'da db-prepare chaqiradi) */
export async function backfillUsernames(): Promise<number> {
  const empty = await db.query.users.findMany({ where: isNull(users.username), columns: { id: true, name: true } });
  for (const u of empty) {
    await db.update(users).set({ username: await generateUsername(u.name) }).where(and(eq(users.id, u.id), isNull(users.username)));
  }
  return empty.length;
}

/** Taxallusni o'zgartirish: band emasligini tekshirib yangilaydi (o'z taxallusiga ruxsat) */
export async function setUsername(userId: string, raw: string): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const v = validateUsername(raw);
  if (!v.ok) return v;
  const holder = await db.query.users.findFirst({ where: and(eq(users.username, v.value), ne(users.id, userId)), columns: { id: true } });
  if (holder) return { ok: false, error: "Bu taxallus band — boshqasini tanlang" };
  await db.update(users).set({ username: v.value }).where(eq(users.id, userId));
  return { ok: true, value: v.value };
}
