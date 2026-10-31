import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hkdfSync, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "./db";
import { rateLimits, sessions, users, type User } from "./db/schema";
import { clientIpFromHeaders, hashIp } from "./security/request";
import { recordActivity } from "./analytics/activity";
import { safeInternalPath } from "./utils";

export { hashPassword, verifyPassword } from "./security/password";

export const SESSION_COOKIE = "redince_session";
/** "Meni eslab qolish" bilan — 30 kun; usiz — brauzer yopilguncha (JWT 24 soat) */
const REMEMBER_DAYS = 30;
const SHORT_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** sessions.lastSeenAt ko'pi bilan har 5 daqiqada yangilanadi (har so'rovda yozmaslik uchun) */
const TOUCH_MS = 5 * 60 * 1000;
/** 2FA ikkinchi bosqich chiptasi (ticket) — 5 daqiqa */
const TICKET_TTL = "5m";
const ROLES: ReadonlyArray<User["role"]> = ["client", "specialist", "admin"];

/** .env.example / dev namunaviy qiymatlar — productionda haqiqiy kalit sifatida qabul qilinmaydi */
const PLACEHOLDER_SECRET = /^(change-me|dev-only)/i;
/** Productionda AUTH_SECRET uchun minimal uzunlik */
const MIN_SECRET_PROD = 32;
/** Jarayon bo'yicha bir marta (dev'da modul har route uchun qayta yuklanadi — globalThis'da saqlaymiz) */
const warnFlag = globalThis as { __redinceSecretWarned?: boolean; __redinceSecretKey?: Uint8Array };
function warnSecretOnce(msg: string) {
  if (warnFlag.__redinceSecretWarned) return;
  warnFlag.__redinceSecretWarned = true;
  console.warn(`[auth] ${msg}`);
}

/**
 * JWT imzo kaliti (src/middleware.ts secret() bilan BIR XIL baytlar — ikkalasini birga o'zgartiring).
 *  - production: AUTH_SECRET majburiy, kamida 32 belgi, namunaviy ("change-me…") qiymat rad etiladi (xato tashlanadi);
 *    AUTH_SECRET umuman bo'lmasa Turso tokenidan HKDF (sha256, salt "redince", info "session-v1") bilan kalit hosil
 *    qilinadi va bir marta ogohlantiriladi (xom token hech qachon kalit sifatida ishlatilmaydi);
 *  - dev: qisqa (<16) qiymat e'tiborga olinmaydi (ogohlantirish), namunaviy qiymat ishlatilaveradi (sessiyalar saqlansin).
 */
function secret(): Uint8Array {
  if (warnFlag.__redinceSecretKey) return warnFlag.__redinceSecretKey;
  const key = computeSecret();
  warnFlag.__redinceSecretKey = key;
  return key;
}

function computeSecret(): Uint8Array {
  const prod = process.env.NODE_ENV === "production";
  const s = process.env.AUTH_SECRET;
  if (s) {
    if (prod) {
      // Namunaviy yoki qisqa kalit hech qachon ishlatilmaydi. Sayt butunlay ishdan chiqmasligi uchun xato tashlamaymiz:
      // Turso tokenidan hosil qilingan (maxfiy) kalitga o'tamiz va logga aniq xabar yozamiz.
      if (PLACEHOLDER_SECRET.test(s)) console.error("[auth] AUTH_SECRET namunaviy (.env.example) qiymat — e'tiborga olinmadi. `openssl rand -base64 48` bilan haqiqiy kalit bering");
      else if (s.length < MIN_SECRET_PROD) console.error(`[auth] AUTH_SECRET juda qisqa (kamida ${MIN_SECRET_PROD} belgi) — e'tiborga olinmadi`);
      else return new TextEncoder().encode(s);
    } else if (s.length < 16) warnSecretOnce("AUTH_SECRET juda qisqa (kamida 16 belgi) — e'tiborga olinmadi");
    else {
      if (PLACEHOLDER_SECRET.test(s)) warnSecretOnce("AUTH_SECRET namunaviy qiymat — productionda rad etiladi. `openssl rand -base64 48` bilan yarating");
      return new TextEncoder().encode(s);
    }
  }
  // AUTH_SECRET berilmagan bo'lsa: Turso tokenidan HKDF bilan barqaror, maxfiy kalit hosil qilamiz
  // (token maxfiy va deploylar orasida o'zgarmaydi — sessiyalar saqlanib qoladi; xom token kalit bo'lmaydi)
  const derived = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  if (derived && derived.length >= 16) {
    warnSecretOnce("AUTH_SECRET yo'q — sessiya kaliti Turso tokenidan (HKDF) hosil qilinmoqda; token almashsa barcha sessiyalar bekor bo'ladi");
    return new Uint8Array(hkdfSync("sha256", derived, "redince", "session-v1", 32));
  }
  if (prod) throw new Error("AUTH_SECRET o'rnatilmagan — productionda majburiy (`openssl rand -base64 48`)");
  return new TextEncoder().encode("dev-only-insecure-secret-change-me-please-123456");
}

export interface SessionPayload {
  sub: string;
  role: User["role"];
  name: string;
  /** Sessiya versiyasi (users.sessionVersion) — mos kelmasa cookie bekor */
  sv: number;
  /** "Meni eslab qolish" tanlangan (30 kunlik cookie) */
  remember: boolean;
  /** JWT berilgan vaqt (soniya) — "Chiqish"da aynan shu tokenni bekor qilish kaliti */
  iat?: number;
  /** JWT amal qilish muddati (soniya) */
  exp?: number;
  /** JWT id = sessions.id (eski tokenlarda yo'q — ular uchun denylist fallback) */
  jti?: string;
  /** Telegram Web (iframe) ichida ochilgan sessiya — cookie `SameSite=None; Secure; Partitioned` (qayta chiqarishda saqlanadi) */
  embedded?: boolean;
}

export interface CreateSessionOptions {
  /** Berilmasa: joriy cookie'dagi tanlov, u ham bo'lmasa true */
  remember?: boolean;
  /**
   * Uchinchi tomon konteksti (Telegram Web — web.telegram.org ichidagi iframe): `SameSite=Lax` cookie u yerda
   * saqlanmaydi va yuborilmaydi, shuning uchun `SameSite=None; Secure; Partitioned` (CHIPS — faqat telegram.org
   * ostidagi bo'lakda). Berilmasa: joriy sessiyadagi holat (rol/parol o'zgarganda qayta chiqarish ham iframe'da ishlasin).
   */
  embedded?: boolean;
}

/** Sessiya cookie atributlari: oddiy (Lax) yoki iframe uchun bo'lakli (None + Secure + Partitioned) */
export function sessionCookieAttrs(embedded = false) {
  return embedded
    ? ({ httpOnly: true, sameSite: "none", secure: true, partitioned: true, path: "/" } as const)
    : ({ httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" } as const);
}

/**
 * Cookie yaratish. sessionVersion berilmasa bazadan o'qiladi (eski chaqiruvchilar uchun).
 * Faqat Route Handler / Server Action ichida ishlaydi (cookie yozish).
 */
export async function createSession(user: Pick<User, "id" | "role" | "name"> & { sessionVersion?: number }, opts: CreateSessionOptions = {}) {
  let sv = user.sessionVersion;
  if (sv == null) {
    const row = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { sessionVersion: true } });
    sv = row?.sessionVersion ?? 1;
  }
  const current = await getSession();
  const sameUser = current?.sub === user.id ? current : null;
  const remember = opts.remember ?? sameUser?.remember ?? true;
  const embedded = opts.embedded ?? sameUser?.embedded ?? false;

  // Har bir kirish — sessions jadvalida alohida qator (qurilmalar ro'yxati, bittasini bekor qilish)
  const jti = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_DAYS * DAY_MS : SHORT_HOURS * HOUR_MS));
  // Shu brauzerdagi oldingi cookie (shu yoki boshqa foydalanuvchi) ustidan yoziladi — uning qatori yopiladi
  await recordSession(user.id, jti, expiresAt, current?.jti ? { jti: current.jti, userId: current.sub } : undefined);

  const token = await new SignJWT({ role: user.role, name: user.name, sv, rm: remember, ...(embedded ? { emb: true } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(remember ? `${REMEMBER_DAYS}d` : `${SHORT_HOURS}h`)
    .sign(secret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    ...sessionCookieAttrs(embedded),
    ...(remember ? { maxAge: REMEMBER_DAYS * 24 * 60 * 60 } : {}),
  });
}

/**
 * sessions qatorini yozadi (user-agent, IP hash). Shu brauzerdagi oldingi token (rol o'zgarishi, parol yangilash,
 * boshqa hisobga kirish — cookie ustidan yoziladi) bekor qilinadi, ro'yxatda "osilib" qolmasin. Vaqti-vaqti bilan eski qatorlar tozalanadi.
 */
async function recordSession(userId: string, jti: string, expiresAt: Date, previous?: { jti: string; userId: string }): Promise<void> {
  let userAgent: string | null = null;
  let ipHash: string | null = null;
  try {
    const h = await headers();
    userAgent = h.get("user-agent")?.slice(0, 300) || null;
    ipHash = hashIp(clientIpFromHeaders(h));
  } catch {
    /* so'rov kontekstidan tashqarida */
  }
  await db.insert(sessions).values({ id: jti, userId, userAgent, ipHash, expiresAt });
  if (previous) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, previous.jti), eq(sessions.userId, previous.userId), isNull(sessions.revokedAt)));
  }
  if (Math.random() < 0.1) {
    const now = Date.now();
    await db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), or(lt(sessions.expiresAt, new Date(now - 7 * DAY_MS)), lt(sessions.revokedAt, new Date(now - 30 * DAY_MS)))))
      .catch(() => undefined);
  }
}

/** Foydalanuvchining barcha faol sessiya qatorlarini bekor qiladi (parol o'zgarishi, hammasidan chiqish, o'chirish) */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function clearSession() {
  const store = await cookies();
  // Iframe sessiyasi bo'lakli cookie'da — uni faqat xuddi shu atributlar bilan o'chirish mumkin (oddiy o'chirish rad etiladi)
  const current = await getSession();
  if (current?.embedded) store.set(SESSION_COOKIE, "", { ...sessionCookieAttrs(true), maxAge: 0 });
  else store.delete(SESSION_COOKIE);
}

/**
 * sessionVersion'ni oshiradi — barcha mavjud JWT'lar bekor bo'ladi. Yangi qiymatni qaytaradi.
 * Chaqiruvchi (parol o'zgartirish, "hamma qurilmadan chiqish") joriy qurilma uchun cookie'ni qayta beradi.
 */
export async function bumpSessionVersion(userId: string): Promise<number> {
  const [row] = await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ sessionVersion: users.sessionVersion });
  await revokeAllSessions(userId);
  return row?.sessionVersion ?? 1;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const role = ROLES.includes(payload.role as User["role"]) ? (payload.role as User["role"]) : "client";
    const sv = typeof payload.sv === "number" ? payload.sv : 0;
    return {
      sub: payload.sub,
      role,
      name: String(payload.name ?? ""),
      sv,
      remember: payload.rm !== false,
      embedded: payload.emb === true ? true : undefined,
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
      exp: typeof payload.exp === "number" ? payload.exp : undefined,
      jti: typeof payload.jti === "string" && payload.jti ? payload.jti : undefined,
    };
  } catch {
    return null;
  }
}

/** Bekor qilingan token kaliti (rate_limits jadvali — sxema o'zgarishisiz; resetAt = exp, sweep o'zi tozalaydi) */
function revokedKey(session: SessionPayload): string | null {
  return session.iat == null ? null : `revoked:${session.sub}:${session.iat}`;
}

/**
 * "Chiqish": aynan shu token (sub+iat) muddati tugaguncha bekor qilinadi — cookie nusxasi ham ishlamaydi.
 * sessionVersion o'zgarmaydi: boshqa qurilmalar kirgan holda qoladi ("Barcha qurilmalardan chiqish" alohida).
 */
export async function revokeSession(session: SessionPayload): Promise<void> {
  if (session.jti) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, session.jti), eq(sessions.userId, session.sub), isNull(sessions.revokedAt)));
    return;
  }
  // jti'siz eski tokenlar — denylist (rate_limits)
  const key = revokedKey(session);
  if (!key) return;
  const expSec = session.exp ?? Math.floor(Date.now() / 1000) + REMEMBER_DAYS * 24 * 60 * 60;
  await db.insert(rateLimits).values({ key, count: 1, resetAt: expSec * 1000 }).onConflictDoNothing();
}

/**
 * Sessiya qatori tirikmi: mavjud, shu foydalanuvchiniki, bekor qilinmagan va muddati o'tmagan.
 * Bitta so'rov ichida keshlanadi (getVerifiedSession + getCurrentUser — bitta o'qish); lastSeenAt
 * ko'pi bilan 5 daqiqada bir yangilanadi.
 */
const sessionRowAlive = cache(async (jti: string, userId: string): Promise<boolean> => {
  const row = await db.query.sessions.findFirst({
    where: eq(sessions.id, jti),
    columns: { userId: true, expiresAt: true, revokedAt: true, lastSeenAt: true },
  });
  const now = Date.now();
  if (!row || row.userId !== userId || row.revokedAt || row.expiresAt.getTime() <= now) return false;
  if (now - row.lastSeenAt.getTime() > TOUCH_MS) {
    const prev = row.lastSeenAt.getTime();
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(now) })
      .where(eq(sessions.id, jti))
      .catch(() => undefined);
    // Kunlik faollik (admin analitikasi) — fire-and-forget, so'rovni kutmaydi
    void recordActivity(userId, prev, now);
  }
  return true;
});

async function isRevoked(session: SessionPayload): Promise<boolean> {
  if (session.jti) return !(await sessionRowAlive(session.jti, session.sub));
  const key = revokedKey(session);
  if (!key) return false;
  const row = await db.query.rateLimits.findFirst({ where: eq(rateLimits.key, key), columns: { resetAt: true } });
  return Boolean(row && row.resetAt > Date.now());
}

/* ------------------------------------------------------------------ */
/* 2FA: parol bosqichidan keyingi qisqa muddatli chipta (ticket)          */
/* ------------------------------------------------------------------ */
export interface TwoFactorTicket {
  sub: string;
  sv: number;
  remember: boolean;
  /** Parol bosqichi Telegram Web iframe'ida bo'lgan — sessiya ham bo'lakli cookie bilan beriladi */
  embedded: boolean;
  /** Chipta id — rate limit va bir martalik ishlatish kaliti */
  jti: string;
}

/** Chipta kaliti sessiya kalitidan HKDF bilan alohida hosil qilinadi — chiptani cookie sifatida ishlatib bo'lmaydi */
function ticketKey(): Uint8Array {
  return new Uint8Array(hkdfSync("sha256", secret(), "redince", "2fa-ticket-v1", 32));
}

/** Parol to'g'ri, 2FA yoqilgan — sessiya o'rniga 5 daqiqalik imzolangan chipta */
export async function createTwoFactorTicket(user: Pick<User, "id" | "sessionVersion">, remember: boolean, embedded = false): Promise<string> {
  return new SignJWT({ sv: user.sessionVersion, rm: remember, typ: "2fa", ...(embedded ? { emb: true } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setJti(randomBytes(12).toString("base64url"))
    .setIssuedAt()
    .setExpirationTime(TICKET_TTL)
    .sign(ticketKey());
}

export async function verifyTwoFactorTicket(ticket: string): Promise<TwoFactorTicket | null> {
  try {
    const { payload } = await jwtVerify(ticket, ticketKey(), { algorithms: ["HS256"] });
    if (!payload.sub || payload.typ !== "2fa" || typeof payload.jti !== "string") return null;
    return { sub: payload.sub, sv: typeof payload.sv === "number" ? payload.sv : 0, remember: payload.rm !== false, embedded: payload.emb === true, jti: payload.jti };
  } catch {
    return null;
  }
}

/** Faqat JWT'dagi ma'lumot (bazaga murojaat qilmaydi). Bitta so'rov ichida keshlanadi. */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
});

/**
 * Eskirgan cookie (foydalanuvchi o'chirilgan yoki sessiya versiyasi o'zgargan):
 *  - Route Handler'da cookie darhol o'chiriladi;
 *  - himoyalangan sahifada (middleware x-pathname beradi) /api/auth/logout orqali tozalanadi —
 *    aks holda /kabinet ↔ /auth/kirish cheksiz aylanib qolardi;
 *  - ommaviy sahifada shunchaki "kirmagan" deb hisoblanadi.
 */
async function onStaleSession(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
    return;
  } catch {
    /* Server Component ichida cookie yozib bo'lmaydi */
  }
  let pathname: string | null = null;
  try {
    pathname = (await headers()).get("x-pathname");
  } catch {
    /* headers() mavjud emas */
  }
  const next = safeInternalPath(pathname);
  if (next) redirect(`/api/auth/logout?next=${encodeURIComponent(next)}`);
}

/**
 * Baza bilan tasdiqlangan sessiya: sv mos kelishi, foydalanuvchi mavjudligi va bloklanmaganligi tekshiriladi,
 * rol/ism bazadan olinadi. API route'lar (requireSession) uchun yengil so'rov.
 */
export const getVerifiedSession = cache(async (): Promise<SessionPayload | null> => {
  const session = await getSession();
  if (!session) return null;
  const row = await db.query.users.findFirst({
    where: eq(users.id, session.sub),
    columns: { id: true, role: true, name: true, sessionVersion: true, isBanned: true },
  });
  // Bloklangan foydalanuvchi hamma joyda chiqib ketadi (cookie tozalanadi)
  if (!row || row.isBanned || row.sessionVersion !== session.sv || (await isRevoked(session))) {
    await onStaleSession();
    return null;
  }
  return { ...session, role: row.role, name: row.name };
});

/**
 * Bazadagi to'liq foydalanuvchi (parol, 2FA siri va zaxira kodlarisiz). React cache() — Navbar, layout va sahifa
 * bitta so'rovda chaqirsa ham baza bir marta o'qiladi. sv mos kelmasa — chiqib ketgan hisoblanadi.
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.sub),
    // Maxfiy maydonlar hech qachon chiqmaydi (/api/auth/me shu obyektni qaytaradi)
    columns: { passwordHash: false, totpSecretEnc: false, recoveryCodes: false },
    with: { specialist: true },
  });
  if (!user || user.isBanned || user.sessionVersion !== session.sv || (await isRevoked(session))) {
    await onStaleSession();
    return null;
  }
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Himoyalangan sahifa uchun yo'naltirish manzili:
 * - cookie yo'q → /auth/kirish?next=…
 * - cookie bor, lekin foydalanuvchi bazada yo'q yoki sessiya eskirgan → cookie'ni tozalab, keyin kirishga
 *   (aks holda /kabinet ↔ /auth/kirish cheksiz aylanib qoladi)
 */
export async function loginRedirectPath(next: string) {
  const session = await getSession();
  const q = `?next=${encodeURIComponent(next)}`;
  return session ? `/api/auth/logout${q}` : `/auth/kirish${q}`;
}
