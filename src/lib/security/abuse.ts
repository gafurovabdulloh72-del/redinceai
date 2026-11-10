import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, like, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits, users } from "@/lib/db/schema";

/**
 * HISOB TUZOG'I (2026-11-10, egasi talabi: «haker o'zini mijoz yoki ijodkor qilib buzmasin»).
 *
 * Ro'yxatdan o'tgan hujumchi ichkaridan teshik qidiradi: begona ID'larni terib chiqadi (IDOR), admin yo'llarini sinaydi,
 * so'rovga hujum imzolarini qo'shadi. Har bir urinish serverda baribir RAD etiladi (403/404) — lekin urinishning O'ZI signal.
 * Bu modul shunday rad etishlarni HISOB bo'yicha sanaydi:
 *   - bir soat ichida TURLI manzillarga ruxsatsiz urinishlar «ball» to'playdi (bitta manzilni qayta-qayta so'rash — masalan
 *     sahifaning 403 qaytaruvchi so'rovni takrorlashi — bir marta sanaladi: oddiy foydalanuvchi adashib ball yig'maydi);
 *   - admin yo'liga urinish va URL'dagi hujum imzosi ko'proq ball beradi;
 *   - ALERT_SCORE ga yetsa — adminlarga xabar + audit yozuvi (kuniga bir marta, hisob bloklanmaydi);
 *   - FREEZE_SCORE ga yetsa — hisob FREEZE_MS ga «muzlatiladi»: barcha API so'rovlari 429 (ommaviy terib chiqish to'xtaydi),
 *     ochiq sessiyalari yopiladi. Admin panelidan odatdagidek bloklash/blokdan chiqarish mumkin.
 * Foydalanuvchiga chiqadigan xabar ATAYLAB umumiy — nima uchun va qanday aniqlangani aytilmaydi.
 * Holat `rate_limits` jadvalida (serverless'da ham ishlaydi); muzlatilganlar ro'yxati 60 s xotira keshida.
 */
const WINDOW_MS = 60 * 60 * 1000;
export const ABUSE_ALERT_SCORE = 30;
export const ABUSE_FREEZE_SCORE = 120;
const FREEZE_MS = 60 * 60 * 1000;
const WEIGHT = { denied: 1, admin: 5, probe: 10, canary: 60 } as const;
export type AbuseKind = keyof typeof WEIGHT;

export const ABUSE_FROZEN_MESSAGE = "Hisobingiz vaqtincha cheklandi. Birozdan keyin qayta urinib ko'ring yoki qo'llab-quvvatlashga yozing";

const keyOf = (userId: string) => `abuse:${userId}`;
const frozenKey = (userId: string) => `frozen:${userId}`;

async function bump(key: string, by: number, windowMs: number): Promise<number> {
  const now = Date.now();
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: by, resetAt: now + windowMs })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} <= ${now} then ${by} else ${rateLimits.count} + ${by} end`,
        resetAt: sql`case when ${rateLimits.resetAt} <= ${now} then ${now + windowMs} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return Number(row?.count ?? by);
}

/**
 * Ruxsatsiz urinishni qayd etish. Xato tashlamaydi (javobni buzmaydi). `path` — yo'l + query (kesiladi).
 * Admin hisobi sanalmaydi (admin panel o'zi ko'p narsani tekshirib ko'radi).
 */
export async function noteAbuse(user: { id: string; role: string }, kind: AbuseKind, path: string, ip?: string | null): Promise<void> {
  try {
    if (user.role === "admin") return;
    // Bir manzil — soatiga bir marta (takror so'rov/polling ball bermaydi)
    const once = createHash("sha256").update(`${user.id}|${kind}|${path.slice(0, 300)}`).digest("hex").slice(0, 24);
    if ((await bump(`abuse1:${once}`, 1, WINDOW_MS)) !== 1) return;
    const w = WEIGHT[kind];
    const score = await bump(keyOf(user.id), w, WINDOW_MS);
    const crossed = (t: number) => score >= t && score - w < t;
    if (crossed(ABUSE_FREEZE_SCORE)) await freeze(user.id, score, path, ip ?? null);
    else if (crossed(ABUSE_ALERT_SCORE)) await alert(user.id, score, path, ip ?? null, false);
  } catch (e) {
    console.error("[abuse]", e);
  }
}

async function who(userId: string): Promise<string> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { name: true, email: true, role: true, username: true } });
  return u ? `${u.name} (${u.role}${u.username ? `, @${u.username}` : ""}, ${u.email})` : userId;
}

async function alert(userId: string, score: number, path: string, ip: string | null, frozen: boolean): Promise<void> {
  const [{ audit }, { notifyAdmins }] = await Promise.all([import("./audit"), import("@/lib/notifications")]);
  await audit(userId, frozen ? "abuse_frozen" : "abuse_suspected", { targetType: "user", targetId: userId, meta: { score, lastPath: path.slice(0, 200), ip } });
  const name = await who(userId);
  await notifyAdmins(
    "account",
    frozen ? "🧊 Hisob vaqtincha muzlatildi" : "🕵️ Shubhali hisob faolligi",
    frozen
      ? `${name} — bir soatda juda ko'p ruxsatsiz urinish (ball ${score}). Hisob 1 soatga cheklandi, sessiyalari yopildi. Oxirgi manzil: ${path.slice(0, 120)}`
      : `${name} — bir soatda ko'p ruxsatsiz urinish (ball ${score}): begona ma'lumot yoki admin yo'llarini sinab ko'rayotgan bo'lishi mumkin. Oxirgi manzil: ${path.slice(0, 120)}`,
    "/admin#foydalanuvchilar",
    { skipMail: true, dedupeMs: 6 * 60 * 60 * 1000 },
  ).catch(() => undefined);
}

async function freeze(userId: string, score: number, path: string, ip: string | null): Promise<void> {
  const now = Date.now();
  await db
    .insert(rateLimits)
    .values({ key: frozenKey(userId), count: 1, resetAt: now + FREEZE_MS })
    .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1`, resetAt: now + FREEZE_MS } });
  // Ochiq sessiyalar yopiladi (sessiya versiyasi) — muzlatish tugagach qayta kirishi mumkin
  await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId)).catch(() => undefined);
  frozenCache = null;
  await alert(userId, score, path, ip, true);
}

/* ---- Muzlatilgan hisoblar keshi (60 s) — har API so'rovida bazaga bormaslik uchun ---- */
let frozenCache: { at: number; map: Map<string, number> } | null = null;
const CACHE_TTL = 60_000;

async function loadFrozen(): Promise<Map<string, number>> {
  const now = Date.now();
  if (frozenCache && now - frozenCache.at < CACHE_TTL) return frozenCache.map;
  try {
    const rows = await db.select({ key: rateLimits.key, resetAt: rateLimits.resetAt }).from(rateLimits).where(and(like(rateLimits.key, "frozen:%"), gt(rateLimits.resetAt, now)));
    frozenCache = { at: now, map: new Map(rows.map((r) => [r.key.slice("frozen:".length), r.resetAt])) };
  } catch {
    frozenCache = frozenCache ?? { at: now, map: new Map() };
  }
  return frozenCache.map;
}

/** Hozir muzlatilgan hisob bormi (keshdan) — yo'q bo'lsa `handler()` sessiyani ham o'qimaydi (odatiy holat: nol xarajat) */
export async function anyAbuseFrozen(): Promise<boolean> {
  return (await loadFrozen()).size > 0;
}

/** Hisob hozir muzlatilganmi (keshdan). Xato bo'lsa — yo'q (xizmat buzilmasin). */
export async function isAbuseFrozen(userId: string): Promise<boolean> {
  const until = (await loadFrozen()).get(userId);
  return until !== undefined && until > Date.now();
}

/** Admin: muzlatishni olib tashlash va ballni nolga tushirish */
export async function clearAbuse(userId: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, frozenKey(userId)));
  await db.delete(rateLimits).where(eq(rateLimits.key, keyOf(userId)));
  frozenCache = null;
}
