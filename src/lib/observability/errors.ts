import "server-only";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { errorLogs, users } from "@/lib/db/schema";
import { describeUserAgent } from "@/lib/security/device";
import { escapeLike, uid } from "@/lib/utils";
import { cleanExtra, cleanMessage, cleanPath, cleanStack, cleanUserAgent, normalizeForFingerprint, stackFrames, tidyFrames, topFrame } from "./sanitize";

/**
 * XATOLAR JURNALI («Sentry-lite», 2026-11-10) — tashqi xizmatsiz xato kuzatuvi.
 *
 *   captureError(e, { req })            — server xatosi (handler() catch'i, instrumentation onRequestError)
 *   captureError(obj, { kind:"client" }) — brauzer xatosi (POST /api/xato)
 *
 * Kafolatlar:
 *  · HECH QACHON xato tashlamaydi va asosiy oqimni sekinlashtirmaydi (baza ishlamasa 30 s «uzgich» — qayta urinmaydi);
 *  · shaxsiy ma'lumot yozilmaydi — xabar/stek/yo'l `sanitize.ts` orqali o'tadi (query, token, email, telefon yo'q);
 *  · kutilgan xatolar yozilmaydi: `ApiError` 4xx (401/403/404/422/429…), Next boshqaruv signallari (redirect, notFound),
 *    mijoz uzgan so'rov (abort);
 *  · bir xil xato — bitta qator (`fingerprint`), takror kelganda `count`/`lastAt` oshadi, `resolvedAt` tozalanadi;
 *  · to'fon himoyasi: bitta nusxada bir xil xato 10 soniyada ≤5 marta, jami daqiqasiga ≤60 marta yoziladi (qolgani
 *    xotirada sanalib, keyingi yozuvga qo'shiladi); qatorlar soni tur bo'yicha qat'iy chegaralangan (MAX_ROWS).
 */

export type ErrorKind = "server" | "client";

/** Qatorlar chegarasi (tur bo'yicha alohida — brauzerdan kelgan axlat server xatolarini siqib chiqara olmaydi) */
export const MAX_ROWS: Record<ErrorKind, number> = { server: 1500, client: 1000 };
/** Chegaradan oshganda bir yo'la shuncha ortiqcha o'chiriladi (har yozuvda tozalamaslik uchun) */
const PURGE_SLACK = 50;
/** Saqlash muddati: hal qilingan — 30 kun, umuman qayta uchramagan — 90 kun (kunlik cron) */
const KEEP_RESOLVED_DAYS = 30;
const KEEP_ANY_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CaptureContext {
  req?: Request;
  kind?: ErrorKind;
  userId?: string | null;
  path?: string;
  method?: string;
  status?: number;
  extra?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Xotiradagi to'fon himoyasi (har server nusxasida alohida)           */
/* ------------------------------------------------------------------ */
const FP_WINDOW_MS = 10_000;
const FP_MAX_WRITES = 5;
const GLOBAL_WINDOW_MS = 60_000;
const GLOBAL_MAX_WRITES = 60;
const BREAKER_MS = 30_000;

interface Throttle {
  perFp: Map<string, { start: number; writes: number; pending: number }>;
  global: { start: number; writes: number };
  /** Baza yozuvi yiqilgan bo'lsa shu vaqtgacha urinilmaydi */
  brokenUntil: number;
  lastSelfLog: number;
}
const g = globalThis as { __keErrorThrottle?: Throttle };
const throttle: Throttle = (g.__keErrorThrottle ??= { perFp: new Map(), global: { start: 0, writes: 0 }, brokenUntil: 0, lastSelfLog: 0 });

/** Yozishga ruxsat: qaytgan son — `count`ga qo'shiladigan miqdor (kutib qolganlar bilan); 0 — bu safar yozilmaydi */
function admit(fp: string, now: number): number {
  if (now - throttle.global.start > GLOBAL_WINDOW_MS) throttle.global = { start: now, writes: 0 };
  if (throttle.perFp.size > 2000) {
    for (const [k, v] of throttle.perFp) if (now - v.start > GLOBAL_WINDOW_MS && !v.pending) throttle.perFp.delete(k);
    if (throttle.perFp.size > 2000) throttle.perFp.clear();
  }
  let e = throttle.perFp.get(fp);
  if (!e || now - e.start > FP_WINDOW_MS) {
    e = { start: now, writes: 0, pending: e?.pending ?? 0 };
    throttle.perFp.set(fp, e);
  }
  if (e.writes >= FP_MAX_WRITES || throttle.global.writes >= GLOBAL_MAX_WRITES) {
    e.pending += 1;
    return 0;
  }
  e.writes += 1;
  throttle.global.writes += 1;
  const n = 1 + e.pending;
  e.pending = 0;
  return n;
}

/* ------------------------------------------------------------------ */
/* Xatoni tavsiflash                                                   */
/* ------------------------------------------------------------------ */
type Loose = { name?: unknown; message?: unknown; stack?: unknown; cause?: unknown; digest?: unknown; status?: unknown };
const asLoose = (v: unknown): Loose | null => (v && typeof v === "object" ? (v as Loose) : null);

/** Next.js boshqaruv signallari (xato emas): redirect(), notFound(), dinamik render belgisi */
const NEXT_SIGNAL = /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING|NEXT_STATIC_GEN_BAILOUT)/;
/** Mijoz ulanishni uzgan — server aybi emas */
const ABORT_RE = /^(AbortError|ResponseAborted)$|aborted|ECONNRESET|EPIPE|socket hang up/i;

function shouldIgnore(error: unknown, ctx: CaptureContext): boolean {
  const e = asLoose(error);
  if (!e) return false;
  if (typeof e.digest === "string" && NEXT_SIGNAL.test(e.digest)) return true;
  if (typeof e.message === "string" && NEXT_SIGNAL.test(e.message)) return true;
  if (ctx.kind !== "client") {
    // ApiError (lib/api.ts) — aylanma importsiz, shakli bo'yicha: kutilgan 4xx javoblar jurnalga tushmaydi
    if (typeof e.status === "number" && e.status >= 400 && e.status < 500) return true;
    const name = typeof e.name === "string" ? e.name : "";
    const msg = typeof e.message === "string" ? e.message : "";
    if (ABORT_RE.test(name) || (msg.length < 80 && ABORT_RE.test(msg))) return true;
  }
  return false;
}

function describe(error: unknown, kind: ErrorKind): { message: string; stack: string; digest: string | null } {
  const e = asLoose(error);
  if (!e) return { message: cleanMessage(typeof error === "string" ? error : String(error)), stack: "", digest: null };
  // Xabar: o'zi + sabab zanjiri (Drizzle «Failed query …» ← libsql «UNIQUE constraint failed: …»)
  const parts: string[] = [];
  let cur: Loose | null = e;
  for (let depth = 0; cur && depth < 4; depth++) {
    const name = typeof cur.name === "string" && cur.name && cur.name !== "Error" ? `${cur.name}: ` : "";
    const msg = typeof cur.message === "string" ? cur.message : "";
    const piece = cleanMessage(`${name}${msg}`, depth === 0 ? 320 : 200);
    if (piece && !parts.includes(piece)) parts.push(piece);
    cur = asLoose(cur.cause);
  }
  let message = parts.join(" ← ");
  if (!message) {
    try {
      message = cleanMessage(JSON.stringify(error));
    } catch {
      message = "Noma'lum xato";
    }
  }
  // Stek: faqat kadrlar (xabar sarlavhasi takrorlanmaydi); sabab steki bo'lsa — qisqa qilib qo'shiladi.
  // Server steki ixchamlanadi (Next/Node ichki kadrlari va serverdagi mutlaq papka yo'q); brauzer steki — o'zicha.
  const tidy = (s: string) => (kind === "server" ? tidyFrames(s, process.cwd()) : s);
  let frames = tidy(stackFrames(e.stack));
  if (!frames && typeof e.stack === "string") frames = e.stack;
  const cause = asLoose(e.cause);
  const causeFrames = cause ? tidy(stackFrames(cause.stack)).split("\n").slice(0, 8).join("\n") : "";
  const stack = cleanStack(causeFrames && !frames.includes(causeFrames.split("\n")[0] ?? "\u0000") ? `${frames}\n    --- sabab ---\n${causeFrames}` : frames);
  return { message: cleanMessage(message), stack, digest: typeof e.digest === "string" && e.digest ? e.digest.slice(0, 60) : null };
}

/** Sessiya cookie'sidan foydalanuvchi id (faqat JWT imzosi tekshiriladi — bazaga borilmaydi); bo'lmasa null */
async function userFromRequest(req: Request): Promise<string | null> {
  try {
    const cookie = req.headers.get("cookie") ?? "";
    if (!cookie) return null;
    const { SESSION_COOKIE, verifySessionToken } = await import("@/lib/auth");
    const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
    if (!m) return null;
    return (await verifySessionToken(decodeURIComponent(m[1])))?.sub ?? null;
  } catch {
    return null;
  }
}

function selfLog(e: unknown) {
  const now = Date.now();
  if (now - throttle.lastSelfLog < 60_000) return;
  throttle.lastSelfLog = now;
  console.error("[xato-jurnali] yozib bo'lmadi:", e instanceof Error ? e.message : e);
}

/**
 * Xatoni jurnalga yozadi. Hech qachon xato tashlamaydi.
 * `ctx.req` berilsa yo'l, usul, user-agent va (sessiya bo'lsa) foydalanuvchi shundan olinadi; aniq berilgan maydon ustun.
 */
export async function captureError(error: unknown, ctx: CaptureContext = {}): Promise<void> {
  try {
    if (shouldIgnore(error, ctx)) return;
    const now = Date.now();
    if (now < throttle.brokenUntil) return;

    const kind: ErrorKind = ctx.kind === "client" ? "client" : "server";
    const { message, stack, digest } = describe(error, kind);
    if (!message) return;

    let rawPath = ctx.path;
    if (rawPath == null && ctx.req) {
      try {
        rawPath = new URL(ctx.req.url).pathname;
      } catch {
        rawPath = "";
      }
    }
    const path = cleanPath(rawPath ?? "");
    const method = (ctx.method ?? ctx.req?.method ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10);
    const status = typeof ctx.status === "number" && ctx.status >= 100 && ctx.status <= 599 ? Math.round(ctx.status) : null;
    const fingerprint = createHash("sha256").update(`${kind}|${normalizeForFingerprint(message)}|${topFrame(stack)}`).digest("hex").slice(0, 40);

    const n = admit(fingerprint, now);
    if (n === 0) return;

    const userAgent = cleanUserAgent(ctx.req?.headers.get("user-agent") ?? "");
    const userId = ctx.userId !== undefined ? ctx.userId : ctx.req ? await userFromRequest(ctx.req) : null;
    // digest — Next bergan xesh (foydalanuvchiga «Kod: …» bo'lib ko'rinadi): tozalagich uni telefon deb o'ylamasin
    const extra = { ...cleanExtra(ctx.extra), ...(digest && /^[A-Za-z0-9_;:.-]{1,60}$/.test(digest) ? { digest } : {}) };
    const at = new Date(now);

    const [row] = await db
      .insert(errorLogs)
      .values({ id: uid(), kind, fingerprint, message, stack, path, method, status, userId: userId ? userId.slice(0, 64) : null, userAgent, extra, count: n, firstAt: at, lastAt: at })
      .onConflictDoUpdate({
        target: errorLogs.fingerprint,
        set: {
          count: sql`${errorLogs.count} + ${n}`,
          lastAt: at,
          // Hal qilingan xato qaytdi — yana ochiq
          resolvedAt: null,
          // Oxirgi uchragan holat (deploydan keyin stek yangilanadi); bo'sh qiymat eskisini o'chirmaydi
          stack: sql`case when ${stack} <> '' then ${stack} else ${errorLogs.stack} end`,
          path: sql`case when ${path} <> '' then ${path} else ${errorLogs.path} end`,
          method,
          status,
          userId: sql`coalesce(${userId ? userId.slice(0, 64) : null}, ${errorLogs.userId})`,
          userAgent: sql`case when ${userAgent} <> '' then ${userAgent} else ${errorLogs.userAgent} end`,
          extra,
        },
      })
      .returning({ count: errorLogs.count });

    // Yangi guruh paydo bo'ldi — qatorlar chegarasini tekshiramiz (takror xatoda jadval o'smaydi)
    if (row && row.count === n) await enforceCap(kind);
  } catch (e) {
    throttle.brokenUntil = Date.now() + BREAKER_MS;
    selfLog(e);
  }
}

/** Chegaradan oshgan bo'lsa eng eski qatorlarni o'chiradi: avval hal qilinganlar, keyin eng uzoq uchramaganlar */
async function enforceCap(kind: ErrorKind): Promise<void> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(errorLogs).where(eq(errorLogs.kind, kind));
  const over = Number(n) - MAX_ROWS[kind];
  if (over <= 0) return;
  const victims = await db
    .select({ id: errorLogs.id })
    .from(errorLogs)
    .where(eq(errorLogs.kind, kind))
    .orderBy(sql`${errorLogs.resolvedAt} is null`, asc(errorLogs.lastAt))
    .limit(over + PURGE_SLACK);
  if (victims.length) await db.delete(errorLogs).where(inArray(errorLogs.id, victims.map((v) => v.id)));
}

/** Kunlik tozalash (cron): eski hal qilingan va uzoq vaqt uchramagan xatolar. O'chirilgan qatorlar soni */
export async function purgeErrorLogs(now = Date.now()): Promise<number> {
  const res = await db
    .delete(errorLogs)
    .where(or(and(isNotNull(errorLogs.resolvedAt), lt(errorLogs.resolvedAt, new Date(now - KEEP_RESOLVED_DAYS * DAY_MS))), lt(errorLogs.lastAt, new Date(now - KEEP_ANY_DAYS * DAY_MS))));
  return res.rowsAffected;
}

/* ------------------------------------------------------------------ */
/* Admin: ro'yxat, sanoq, hal qilish, o'chirish                         */
/* ------------------------------------------------------------------ */
export type ErrorStatusFilter = "open" | "resolved" | "all";
export type ErrorKindFilter = ErrorKind | "all";

export interface ErrorLogView {
  id: string;
  kind: ErrorKind;
  message: string;
  stack: string;
  path: string;
  method: string;
  status: number | null;
  count: number;
  firstAt: number;
  lastAt: number;
  resolvedAt: number | null;
  /** «Chrome · Windows» */
  device: string;
  user: { id: string; name: string | null; email: string | null } | null;
  extra: Record<string, string | number | boolean>;
  fingerprint: string;
}

export interface ErrorListFilter {
  status?: ErrorStatusFilter;
  kind?: ErrorKindFilter;
  /** Xabar yoki yo'l bo'yicha qisman moslik */
  q?: string;
  /** Sahifalash kursori: `<lastAt ms>_<id>` — shundan eskilari */
  before?: string;
  limit?: number;
}

function listWhere(f: ErrorListFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (f.status === "open") conds.push(isNull(errorLogs.resolvedAt));
  else if (f.status === "resolved") conds.push(isNotNull(errorLogs.resolvedAt));
  if (f.kind === "server" || f.kind === "client") conds.push(eq(errorLogs.kind, f.kind));
  const q = f.q?.trim();
  if (q && q.length >= 2) {
    const term = `%${escapeLike(q.toLowerCase().slice(0, 80))}%`;
    const m = or(sql`lower(${errorLogs.message}) like ${term} escape '\\'`, sql`lower(${errorLogs.path}) like ${term} escape '\\'`);
    if (m) conds.push(m);
  }
  return conds.length ? and(...conds) : undefined;
}

export async function listErrorLogs(f: ErrorListFilter = {}): Promise<{ items: ErrorLogView[]; nextCursor: string | null }> {
  const limit = Math.min(100, Math.max(1, f.limit ?? 30));
  const conds: SQL[] = [];
  const base = listWhere(f);
  if (base) conds.push(base);
  const cur = /^(\d{10,16})_([A-Za-z0-9-]{1,64})$/.exec(f.before ?? "");
  if (cur) {
    const t = new Date(Number(cur[1]));
    const c = or(lt(errorLogs.lastAt, t), and(eq(errorLogs.lastAt, t), lt(errorLogs.id, cur[2])));
    if (c) conds.push(c);
  }
  const rows = await db
    .select({ e: errorLogs, userName: users.name, userEmail: users.email })
    .from(errorLogs)
    .leftJoin(users, eq(errorLogs.userId, users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(errorLogs.lastAt), desc(errorLogs.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map(({ e, userName, userEmail }) => ({
      id: e.id,
      kind: e.kind,
      message: e.message,
      stack: e.stack,
      path: e.path,
      method: e.method,
      status: e.status,
      count: e.count,
      firstAt: e.firstAt.getTime(),
      lastAt: e.lastAt.getTime(),
      resolvedAt: e.resolvedAt?.getTime() ?? null,
      device: e.userAgent ? describeUserAgent(e.userAgent).label : "",
      user: e.userId ? { id: e.userId, name: userName ?? null, email: userEmail ?? null } : null,
      extra: e.extra ?? {},
      fingerprint: e.fingerprint.slice(0, 12),
    })),
    nextCursor: rows.length > limit && last ? `${last.e.lastAt.getTime()}_${last.e.id}` : null,
  };
}

export interface ErrorCounts {
  open: number;
  resolved: number;
  openServer: number;
  openClient: number;
  /** So'nggi 24 soatda uchragan ochiq xatolar */
  open24h: number;
}

export async function errorLogCounts(now = Date.now()): Promise<ErrorCounts> {
  const since = now - DAY_MS;
  const [r] = await db
    .select({
      open: sql<number>`coalesce(sum(case when ${errorLogs.resolvedAt} is null then 1 else 0 end), 0)`,
      resolved: sql<number>`coalesce(sum(case when ${errorLogs.resolvedAt} is not null then 1 else 0 end), 0)`,
      openServer: sql<number>`coalesce(sum(case when ${errorLogs.resolvedAt} is null and ${errorLogs.kind} = 'server' then 1 else 0 end), 0)`,
      openClient: sql<number>`coalesce(sum(case when ${errorLogs.resolvedAt} is null and ${errorLogs.kind} = 'client' then 1 else 0 end), 0)`,
      open24h: sql<number>`coalesce(sum(case when ${errorLogs.resolvedAt} is null and ${errorLogs.lastAt} >= ${since} then 1 else 0 end), 0)`,
    })
    .from(errorLogs);
  return { open: Number(r?.open ?? 0), resolved: Number(r?.resolved ?? 0), openServer: Number(r?.openServer ?? 0), openClient: Number(r?.openClient ?? 0), open24h: Number(r?.open24h ?? 0) };
}

/** Ochiq xatolar soni (admin «Tizim» tabi belgisi) — xato bo'lsa 0 (sahifa buzilmasin) */
export async function countOpenErrors(): Promise<number> {
  try {
    const [r] = await db.select({ n: sql<number>`count(*)` }).from(errorLogs).where(isNull(errorLogs.resolvedAt));
    return Number(r?.n ?? 0);
  } catch {
    return 0;
  }
}

/** Hal qilindi / qayta ochish. O'zgargan qatorlar soni */
export async function setErrorsResolved(ids: string[], resolved: boolean): Promise<number> {
  if (!ids.length) return 0;
  const res = await db
    .update(errorLogs)
    .set({ resolvedAt: resolved ? new Date() : null })
    .where(and(inArray(errorLogs.id, ids), resolved ? isNull(errorLogs.resolvedAt) : isNotNull(errorLogs.resolvedAt)));
  return res.rowsAffected;
}

/** Bitta yozuvni o'chirish */
export async function deleteErrorLog(id: string): Promise<boolean> {
  const res = await db.delete(errorLogs).where(eq(errorLogs.id, id));
  return res.rowsAffected > 0;
}

/** Tozalash: faqat hal qilinganlar yoki hammasi. O'chirilgan qatorlar soni */
export async function clearErrorLogs(scope: "resolved" | "all"): Promise<number> {
  const res = await db.delete(errorLogs).where(scope === "resolved" ? isNotNull(errorLogs.resolvedAt) : undefined);
  return res.rowsAffected;
}
