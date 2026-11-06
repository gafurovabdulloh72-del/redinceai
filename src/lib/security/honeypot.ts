import "server-only";
import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { blockedIps, honeypotHits } from "@/lib/db/schema";
import { uid } from "@/lib/utils";

/**
 * HONEYPOT / TUZOQ (2026-11-06): hujumchilar uchun tuzoq va avtomatik IP bloklash.
 *
 * G'oya: skaner botlar doim mashhur zaif yo'llarni qidiradi (`/wp-admin`, `/.env`, `/.git/config`,
 * `/phpmyadmin`…). HECH QANDAY haqiqiy foydalanuvchi bu yo'llarga kirmaydi — demak har bir urinish aniq
 * hujum signali. Tuzoq: (1) urinishni jurnalga yozadi, (2) ishonarli SOXTA javob qaytarib vaqtini o'g'irlaydi,
 * (3) soxta `.env` ichida CANARY (tuzoq) kalit beradi — agar kimdir uni ISHLATSA, bu 100% hujumchi,
 * (4) bir IP chegaradan ko'p tushsa — avtomatik bloklaydi (API qatlamida 403, muddat o'tgach o'chadi).
 *
 * Bloklash FAQAT API qatlamida (`handler()` — Node, bazaga kirish bor): eng qimmatli nishon shu yerda.
 * Sahifalar edge middleware'da (bazasiz) — u yerda blok qilinmaydi, lekin sahifalardan ma'lumot oqmaydi.
 */

/** Tuzoq yo'llari — hech bir haqiqiy mijoz/bot (Google/Yandex ham) bularni so'ramaydi */
export const HONEYPOT_PATHS: readonly string[] = [
  "/wp-admin", "/wp-login.php", "/wp-content", "/xmlrpc.php", "/wordpress",
  "/.env", "/.env.local", "/.env.production", "/.git/config", "/.git/HEAD",
  "/phpmyadmin", "/pma", "/adminer.php", "/administrator", "/admin.php",
  "/config.php", "/configuration.php", "/backup.sql", "/backup.zip", "/db.sql", "/dump.sql",
  "/.aws/credentials", "/.ssh/id_rsa", "/server-status", "/actuator/env", "/.vscode/sftp.json",
  "/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php", "/shell.php", "/cmd.php", "/.well-known/security.txt.bak",
];
/** Yo'l tuzoqmi — aniq moslik yoki shu prefiks bilan boshlanishi (`/.git/config`, `/wp-admin/...`) */
export function isHoneypotPath(pathname: string): boolean {
  const p = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  return HONEYPOT_PATHS.some((h) => p === h || p.startsWith(h + "/"));
}

/** CANARY (tuzoq) qiymatlari — soxta `.env`da beriladi; ishlatilsa aniq hujum (lib bu qiymatlarni kuzatadi) */
export const CANARY_TOKEN = "ke_live_sk_4Fq8Zx2Rn7Wv3Lm9Tb6Yc1Hd5Gj0Kp"; // soxta — hech qayerda haqiqiy emas
export const CANARY_ADMIN_PATH = "/boshqaruv-7731"; // soxta "maxfiy admin" yo'li
export const isCanaryToken = (s: string | null | undefined) => Boolean(s) && s === CANARY_TOKEN;

/** Avtomatik blok chegarasi: 24 soat oynasida shuncha tuzoq urinishdan keyin IP bloklanadi */
export const AUTO_BLOCK_THRESHOLD = 4;
const AUTO_BLOCK_MS = 24 * 60 * 60 * 1000; // 1 kun
const CANARY_BLOCK_MS = 30 * 24 * 60 * 60 * 1000; // canary = 30 kun
const WINDOW_MS = 24 * 60 * 60 * 1000;

type HoneypotKind = "scan" | "fakeLogin" | "canary";

/* ---- Bloklangan IP keshi (Node jarayonida, 60 s TTL) — har API so'rovida bazaga bormaslik uchun ---- */
let cache: { at: number; set: Set<string> } | null = null;
const CACHE_TTL = 60_000;

async function loadBlocked(): Promise<Set<string>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL) return cache.set;
  try {
    const rows = await db
      .select({ ip: blockedIps.ip })
      .from(blockedIps)
      .where(or(isNull(blockedIps.until), gt(blockedIps.until, new Date(now))));
    cache = { at: now, set: new Set(rows.map((r) => r.ip)) };
  } catch {
    // Baza javob bermasa — bor keshni saqlaymiz, yo'q bo'lsa bo'sh (xavfsiz tomon: hech kimni bloklamaymiz)
    cache = cache ?? { at: now, set: new Set() };
  }
  return cache.set;
}
/** Keshni darhol bekor qilish (blok qo'shil/olingach) */
function bustCache() {
  cache = null;
}

/** IP bloklanganmi (keshdan, arzon) — `handler()` shuni chaqiradi */
export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  return (await loadBlocked()).has(ip);
}

/** Qo'lda yoki avtomatik bloklash (upsert): manual=true doimiy va avtomatik tozalashdan himoyalangan */
export async function blockIp(ip: string, reason: string, opts: { manual?: boolean; ms?: number } = {}): Promise<void> {
  if (!ip || ip === "unknown") return;
  const until = opts.manual ? null : new Date(Date.now() + (opts.ms ?? AUTO_BLOCK_MS));
  await db
    .insert(blockedIps)
    .values({ ip, reason: reason.slice(0, 200), hits: 1, until, manual: Boolean(opts.manual) })
    .onConflictDoUpdate({
      target: blockedIps.ip,
      set: {
        reason: reason.slice(0, 200),
        hits: sql`${blockedIps.hits} + 1`,
        // Qo'lda blok doimiy qoladi; avtomatik blok muddati uzaytiriladi
        until: opts.manual ? null : until,
        ...(opts.manual ? { manual: true } : {}),
      },
    });
  bustCache();
}

export async function unblockIp(ip: string): Promise<void> {
  await db.delete(blockedIps).where(eq(blockedIps.ip, ip));
  bustCache();
}

/**
 * Tuzoq urinishini yozadi va kerak bo'lsa IP'ni avtomatik bloklaydi + adminlarga ogohlantiradi.
 * `note` — soxta login(parolSIZ) yoki canary kalit; parol HECH QACHON saqlanmaydi.
 */
export async function recordHoneypotHit(opts: { ip: string; kind: HoneypotKind; method: string; path: string; userAgent: string; note?: string }): Promise<void> {
  const ip = (opts.ip || "unknown").slice(0, 64);
  try {
    await db.insert(honeypotHits).values({
      id: uid(),
      ip,
      kind: opts.kind,
      method: opts.method.slice(0, 10),
      path: opts.path.slice(0, 300),
      userAgent: (opts.userAgent || "").slice(0, 300),
      note: (opts.note || "").slice(0, 200),
    });
  } catch {
    /* jurnal yozilmasa ham javob buzilmasin */
  }

  // Canary kalit ishlatildi — darhol uzoq muddatli blok + ogohlantirish (eng kuchli signal)
  if (opts.kind === "canary") {
    await blockIp(ip, `Canary kalit ishlatildi: ${opts.path}`, { ms: CANARY_BLOCK_MS }).catch(() => undefined);
    await alertAdmins(ip, "🚨 Canary (tuzoq) kalit ishlatildi", `${ip} — soxta kalitni ishlatdi (${opts.path}). Bu aniq hujum. 30 kun bloklandi.`).catch(() => undefined);
    return;
  }

  // 24 soatlik oynadagi urinishlar soni
  let count = 1;
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(honeypotHits)
      .where(and(eq(honeypotHits.ip, ip), gt(honeypotHits.createdAt, new Date(Date.now() - WINDOW_MS))));
    count = Number(row?.n ?? 1);
  } catch {
    /* sanash xatosi — bitta deb olamiz */
  }
  if (count >= AUTO_BLOCK_THRESHOLD) {
    const already = await isIpBlocked(ip);
    await blockIp(ip, `Tuzoqqa ${count} marta tushdi (${opts.kind})`).catch(() => undefined);
    if (!already) await alertAdmins(ip, "🪤 IP avtomatik bloklandi", `${ip} tuzoqqa ${count} marta tushdi (oxirgi: ${opts.method} ${opts.path}). 24 soatga bloklandi.`).catch(() => undefined);
  } else if (count === 1) {
    // Birinchi urinish — ogohlantirish (dedupe: bir IP uchun soatiga bir marta)
    await alertAdmins(ip, "👀 Tuzoqqa urinish", `${ip} — ${opts.method} ${opts.path} (${opts.userAgent.slice(0, 80)})`).catch(() => undefined);
  }
}

/** Adminlarga sayt + Telegram ogohlantirishi (email yubormaydi — shovqin bo'lmasin); bir IP/soat dedupe */
async function alertAdmins(ip: string, title: string, body: string): Promise<void> {
  const { notifyAdmins } = await import("@/lib/notifications");
  await notifyAdmins("account", title, body, "/admin#tuzoq", { skipMail: true, dedupeMs: 60 * 60 * 1000 });
}

export interface HoneypotStats {
  recent: Array<{ id: string; ip: string; kind: string; method: string; path: string; userAgent: string; note: string; createdAt: number }>;
  topIps: Array<{ ip: string; n: number }>;
  blocked: Array<{ ip: string; reason: string; hits: number; until: number | null; manual: boolean; createdAt: number }>;
  total24h: number;
}

/** Admin paneli uchun: so'nggi urinishlar, eng faol IP'lar, bloklanganlar */
export async function honeypotStats(): Promise<HoneypotStats> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [recent, top, blocked, total] = await Promise.all([
    db.select().from(honeypotHits).orderBy(desc(honeypotHits.createdAt)).limit(50),
    db.select({ ip: honeypotHits.ip, n: sql<number>`count(*)` }).from(honeypotHits).groupBy(honeypotHits.ip).orderBy(desc(sql`count(*)`)).limit(10),
    db.select().from(blockedIps).orderBy(desc(blockedIps.createdAt)).limit(100),
    db.select({ n: sql<number>`count(*)` }).from(honeypotHits).where(gt(honeypotHits.createdAt, since)),
  ]);
  return {
    recent: recent.map((r) => ({ id: r.id, ip: r.ip, kind: r.kind, method: r.method, path: r.path, userAgent: r.userAgent, note: r.note, createdAt: r.createdAt.getTime() })),
    topIps: top.map((r) => ({ ip: r.ip, n: Number(r.n) })),
    blocked: blocked.map((r) => ({ ip: r.ip, reason: r.reason, hits: r.hits, until: r.until?.getTime() ?? null, manual: r.manual, createdAt: r.createdAt.getTime() })),
    total24h: Number(total[0]?.n ?? 0),
  };
}

/** Cron (kunlik): eski jurnal (30 kun) va muddati o'tgan bloklarni tozalaydi */
export async function purgeHoneypot(now = Date.now()): Promise<void> {
  await db.delete(honeypotHits).where(lt(honeypotHits.createdAt, new Date(now - 30 * 24 * 60 * 60 * 1000))).catch(() => undefined);
  await db.delete(blockedIps).where(and(eq(blockedIps.manual, false), lt(blockedIps.until, new Date(now)))).catch(() => undefined);
  bustCache();
}
