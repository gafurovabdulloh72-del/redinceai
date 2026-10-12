import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hkdfSync } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { rateLimits, users, type User } from "./db/schema";
import { safeInternalPath } from "./utils";

export { hashPassword, verifyPassword } from "./security/password";

export const SESSION_COOKIE = "redince_session";
/** "Meni eslab qolish" bilan — 30 kun; usiz — brauzer yopilguncha (JWT 24 soat) */
const REMEMBER_DAYS = 30;
const SHORT_HOURS = 24;
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
      if (PLACEHOLDER_SECRET.test(s)) throw new Error("AUTH_SECRET namunaviy (.env.example) qiymat — productionda `openssl rand -base64 48` bilan haqiqiy kalit bering");
      if (s.length < MIN_SECRET_PROD) throw new Error(`AUTH_SECRET juda qisqa (kamida ${MIN_SECRET_PROD} belgi) — productionda \`openssl rand -base64 48\` bilan yarating`);
      return new TextEncoder().encode(s);
    }
    if (s.length < 16) warnSecretOnce("AUTH_SECRET juda qisqa (kamida 16 belgi) — e'tiborga olinmadi");
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
}

export interface CreateSessionOptions {
  /** Berilmasa: joriy cookie'dagi tanlov, u ham bo'lmasa true */
  remember?: boolean;
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
  let remember = opts.remember;
  if (remember == null) {
    const current = await getSession();
    remember = current?.sub === user.id ? current.remember : true;
  }

  const token = await new SignJWT({ role: user.role, name: user.name, sv, rm: remember })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(remember ? `${REMEMBER_DAYS}d` : `${SHORT_HOURS}h`)
    .sign(secret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: REMEMBER_DAYS * 24 * 60 * 60 } : {}),
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
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
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
      exp: typeof payload.exp === "number" ? payload.exp : undefined,
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
  const key = revokedKey(session);
  if (!key) return;
  const expSec = session.exp ?? Math.floor(Date.now() / 1000) + REMEMBER_DAYS * 24 * 60 * 60;
  await db.insert(rateLimits).values({ key, count: 1, resetAt: expSec * 1000 }).onConflictDoNothing();
}

async function isRevoked(session: SessionPayload): Promise<boolean> {
  const key = revokedKey(session);
  if (!key) return false;
  const row = await db.query.rateLimits.findFirst({ where: eq(rateLimits.key, key), columns: { resetAt: true } });
  return Boolean(row && row.resetAt > Date.now());
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
 * Bazadagi to'liq foydalanuvchi (parolsiz). React cache() — Navbar, layout va sahifa
 * bitta so'rovda chaqirsa ham baza bir marta o'qiladi. sv mos kelmasa — chiqib ketgan hisoblanadi.
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.sub),
    columns: { passwordHash: false },
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
