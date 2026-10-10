import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { users, type User } from "./db/schema";
import { safeInternalPath } from "./utils";

export { hashPassword, verifyPassword } from "./security/password";

export const SESSION_COOKIE = "redince_session";
/** "Meni eslab qolish" bilan — 30 kun; usiz — brauzer yopilguncha (JWT 24 soat) */
const REMEMBER_DAYS = 30;
const SHORT_HOURS = 24;
const ROLES: ReadonlyArray<User["role"]> = ["client", "specialist", "admin"];

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return new TextEncoder().encode(s);
  // AUTH_SECRET berilmagan bo'lsa: Turso tokenidan barqaror, maxfiy kalit hosil qilamiz
  // (token maxfiy va deploylar orasida o'zgarmaydi — sessiyalar saqlanib qoladi)
  const derived = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  if (derived && derived.length >= 16) return new TextEncoder().encode(`redince-session-v1:${derived}`);
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET o'rnatilmagan");
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
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const role = ROLES.includes(payload.role as User["role"]) ? (payload.role as User["role"]) : "client";
    const sv = typeof payload.sv === "number" ? payload.sv : 0;
    return { sub: payload.sub, role, name: String(payload.name ?? ""), sv, remember: payload.rm !== false };
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
 * Baza bilan tasdiqlangan sessiya: sv mos kelishi va foydalanuvchi mavjudligi tekshiriladi,
 * rol/ism bazadan olinadi. API route'lar (requireSession) uchun yengil so'rov.
 */
export const getVerifiedSession = cache(async (): Promise<SessionPayload | null> => {
  const session = await getSession();
  if (!session) return null;
  const row = await db.query.users.findFirst({
    where: eq(users.id, session.sub),
    columns: { id: true, role: true, name: true, sessionVersion: true },
  });
  if (!row || row.sessionVersion !== session.sv) {
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
  if (!user || user.sessionVersion !== session.sv) {
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
