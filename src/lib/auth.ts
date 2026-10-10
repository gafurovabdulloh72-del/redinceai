import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, type User } from "./db/schema";

export const SESSION_COOKIE = "redince_session";
const SESSION_DAYS = 30;
const ROLES: ReadonlyArray<User["role"]> = ["client", "specialist", "admin"];

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET o'rnatilmagan");
    return new TextEncoder().encode("dev-only-insecure-secret-change-me-please-123456");
  }
  return new TextEncoder().encode(s);
}

export interface SessionPayload {
  sub: string;
  role: User["role"];
  name: string;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: Pick<User, "id" | "role" | "name">) {
  const token = await new SignJWT({ role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const role = ROLES.includes(payload.role as User["role"]) ? (payload.role as User["role"]) : "client";
    return { sub: payload.sub, role, name: String(payload.name ?? "") };
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
 * Bazadagi to'liq foydalanuvchi (parolsiz). React cache() — Navbar, layout va sahifa
 * bitta so'rovda chaqirsa ham baza bir marta o'qiladi.
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.sub),
    columns: { passwordHash: false },
    with: { specialist: true },
  });
  return user ?? null;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Himoyalangan sahifa uchun yo'naltirish manzili:
 * - cookie yo'q → /auth/kirish?next=…
 * - cookie bor, lekin foydalanuvchi bazada yo'q (eski cookie) → cookie'ni tozalab, keyin kirishga
 *   (aks holda /kabinet ↔ /auth/kirish cheksiz aylanib qoladi)
 */
export async function loginRedirectPath(next: string) {
  const session = await getSession();
  const q = `?next=${encodeURIComponent(next)}`;
  return session ? `/api/auth/logout${q}` : `/auth/kirish${q}`;
}
