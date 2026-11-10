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

// Yo'llar, canary qiymatlari va hujum imzolari — sof modulda (edge middleware ham shu manbadan oladi)
export { HONEYPOT_PATHS, isHoneypotPath, CANARY_TOKEN, CANARY_ADMIN_PATH, CANARY_EMAIL, isCanaryToken, isCanaryEmail, attackSignature, trapClient, type ProbeSig, type TrapClient } from "./trap-patterns";

/** Avtomatik blok chegarasi: 24 soat oynasida shuncha tuzoq urinishdan keyin IP bloklanadi */
export const AUTO_BLOCK_THRESHOLD = 4;
const AUTO_BLOCK_MS = 24 * 60 * 60 * 1000; // 1 kun
const CANARY_BLOCK_MS = 30 * 24 * 60 * 60 * 1000; // canary = 30 kun
const WINDOW_MS = 24 * 60 * 60 * 1000;

/** scan — tuzoq yo'li; fakeLogin — soxta login formasi; canary — soxta kalit/email/yo'l ishlatildi; probe — URL'da hujum imzosi (XSS/SQLi/…) */
export type HoneypotKind = "scan" | "fakeLogin" | "canary" | "probe";
/** `probe` uchun alohida, yuqoriroq chegara: qidiruvga «<script» yozib ko'rgan qiziquvchan foydalanuvchi darhol bloklanmasin */
export const PROBE_BLOCK_THRESHOLD = 10;
/** Bir IP'dan 24 soatda saqlanadigan jurnal yozuvlari chegarasi (qattiq / yumshoq) */
const MAX_HARD_ROWS = 300;
const MAX_SOFT_ROWS = 40;

/** IP'ning so'nggi 24 soatdagi tuzoq urinishlari soni (prank darajasini tanlash uchun; xato bo'lsa 0) */
export async function recentHitCount(ip: string, kind?: HoneypotKind, soft = false): Promise<number> {
  if (!ip) return 0;
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(honeypotHits)
      .where(and(eq(honeypotHits.ip, ip), eq(honeypotHits.soft, soft), gt(honeypotHits.createdAt, new Date(Date.now() - WINDOW_MS)), kind ? eq(honeypotHits.kind, kind) : undefined));
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}

/* ---- Bloklangan IP keshi (Node jarayonida, 60 s TTL) — har API so'rovida bazaga bormaslik uchun ---- */
let cache: { at: number; map: Map<string, boolean> } | null = null; // ip → manual (qo'lda blok)mi
const CACHE_TTL = 60_000;

async function loadBlocked(): Promise<Map<string, boolean>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL) return cache.map;
  try {
    const rows = await db
      .select({ ip: blockedIps.ip, manual: blockedIps.manual })
      .from(blockedIps)
      .where(or(isNull(blockedIps.until), gt(blockedIps.until, new Date(now))));
    cache = { at: now, map: new Map(rows.map((r) => [r.ip, r.manual])) };
  } catch {
    // Baza javob bermasa — bor keshni saqlaymiz, yo'q bo'lsa bo'sh (xavfsiz tomon: hech kimni bloklamaymiz)
    cache = cache ?? { at: now, map: new Map() };
  }
  return cache.map;
}
/** Keshni darhol bekor qilish (blok qo'shil/olingach) */
function bustCache() {
  cache = null;
}

/** IP aniqlanmagan (`unknown-<ua xeshi>`) — bunday kalit bir xil brauzerli HAMMANI anglatadi, bloklab bo'lmaydi */
const noIp = (ip: string) => !ip || ip.startsWith("unknown");

/** IP bloklanganmi (keshdan, arzon) */
export async function isIpBlocked(ip: string): Promise<boolean> {
  if (noIp(ip)) return false;
  return (await loadBlocked()).has(ip);
}

/**
 * Blok turi (`handler()` shuni chaqiradi): "manual" — admin qo'lda bloklagan (hamma mijozga 403);
 * "auto" — tuzoq avtomatik bloklagan (FAQAT brauzer bo'lmagan mijozga 403 — bitta NAT ortidagi haqiqiy odamlar
 * skaner tufayli qulflanib qolmasin; aks holda mobil operator IP'larini ketma-ket «tuzoqqa tushirib», saytni
 * minglab odamga yopib qo'yish mumkin edi); null — bloklanmagan.
 */
export async function ipBlockKind(ip: string): Promise<"manual" | "auto" | null> {
  if (noIp(ip)) return null;
  const manual = (await loadBlocked()).get(ip);
  return manual === undefined ? null : manual ? "manual" : "auto";
}

/** Qo'lda yoki avtomatik bloklash (upsert): manual=true doimiy va avtomatik tozalashdan himoyalangan */
export async function blockIp(ip: string, reason: string, opts: { manual?: boolean; ms?: number } = {}): Promise<void> {
  if (noIp(ip)) return;
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
export async function recordHoneypotHit(opts: { ip: string; kind: HoneypotKind; method: string; path: string; userAgent: string; note?: string; /** brauzer navigatsiyasi / qidiruv boti — faqat jurnal, blok/ogohlantirish yo'q (trap-patterns.ts `trapClient`) */ soft?: boolean }): Promise<void> {
  const ip = (opts.ip || "unknown").slice(0, 64);
  const soft = Boolean(opts.soft);
  // Shu IP'ning 24 soatlik oynadagi (shu turdagi: qattiq/yumshoq) yozuvlari — blok chegarasi va jurnal shishishiga qarshi
  let before = 0;
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(honeypotHits)
      .where(and(eq(honeypotHits.ip, ip), eq(honeypotHits.soft, soft), gt(honeypotHits.createdAt, new Date(Date.now() - WINDOW_MS))));
    before = Number(row?.n ?? 0);
  } catch {
    /* sanash xatosi — nol deb olamiz */
  }
  // Jurnal chegarasi: bir IP kuniga MAX_ROWS dan ortiq yozuv qoldirmaydi (bloklangan skaner jadvalni to'ldirib yubormasin)
  if (before < (soft ? MAX_SOFT_ROWS : MAX_HARD_ROWS)) {
    try {
      await db.insert(honeypotHits).values({
        id: uid(),
        ip,
        kind: opts.kind,
        soft,
        method: opts.method.slice(0, 10),
        path: opts.path.slice(0, 300),
        userAgent: (opts.userAgent || "").slice(0, 300),
        note: (opts.note || "").slice(0, 200),
      });
    } catch {
      /* jurnal yozilmasa ham javob buzilmasin */
    }
  }
  // Yumshoq urinish (brauzerda ochilgan havola, qidiruv boti): begunoh odam aldab yuborilgan bo'lishi mumkin — hech kim bloklanmaydi
  if (soft) return;

  // Canary kalit ishlatildi — darhol uzoq muddatli blok + ogohlantirish (eng kuchli signal)
  if (opts.kind === "canary") {
    await blockIp(ip, `Canary kalit ishlatildi: ${opts.path}`, { ms: CANARY_BLOCK_MS }).catch(() => undefined);
    await alertAdmins(ip, "🚨 Canary (tuzoq) kalit ishlatildi", `${ip} — soxta kalitni ishlatdi (${opts.path}). Bu aniq hujum. 30 kun bloklandi.`).catch(() => undefined);
    return;
  }

  const count = before + 1;
  // Imzo urinishlari (probe) yuqoriroq chegarada bloklanadi; qolgan turlar — AUTO_BLOCK_THRESHOLD
  if (count >= (opts.kind === "probe" ? PROBE_BLOCK_THRESHOLD : AUTO_BLOCK_THRESHOLD)) {
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
  recent: Array<{ id: string; ip: string; kind: string; soft: boolean; method: string; path: string; userAgent: string; note: string; createdAt: number }>;
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
    recent: recent.map((r) => ({ id: r.id, ip: r.ip, kind: r.kind, soft: r.soft, method: r.method, path: r.path, userAgent: r.userAgent, note: r.note, createdAt: r.createdAt.getTime() })),
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
