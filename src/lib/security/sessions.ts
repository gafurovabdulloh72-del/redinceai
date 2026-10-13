import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { describeUserAgent } from "./device";

/** "Faol sessiyalar" ro'yxatidagi bitta qator (IP hash va user-agent xomi tashqariga chiqmaydi) */
export interface SessionListItem {
  /** sessions.id (JWT jti); eski formatdagi joriy sessiya uchun null — uni alohida bekor qilib bo'lmaydi */
  id: string | null;
  browser: string;
  os: string;
  mobile: boolean;
  label: string;
  /** Shu qurilma (so'rov yuborgan cookie) */
  current: boolean;
  /** ms */
  lastSeenAt: number;
  createdAt: number;
  expiresAt: number | null;
}

/**
 * Foydalanuvchining faol (bekor qilinmagan, muddati o'tmagan) sessiyalari — oxirgi faollik bo'yicha.
 * Joriy token jti'siz (eski format) bo'lsa, ro'yxat boshiga "Shu qurilma" qatori qo'shiladi (id = null).
 */
export async function listUserSessions(userId: string, current: { jti?: string; iat?: number } | null, currentUserAgent?: string | null): Promise<SessionListItem[]> {
  const rows = await db.query.sessions.findMany({
    where: and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())),
    orderBy: [desc(sessions.lastSeenAt)],
    limit: 50,
    columns: { id: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true },
  });
  const items: SessionListItem[] = rows.map((r) => {
    const d = describeUserAgent(r.userAgent);
    return {
      id: r.id,
      ...d,
      current: Boolean(current?.jti && current.jti === r.id),
      lastSeenAt: r.lastSeenAt.getTime(),
      createdAt: r.createdAt.getTime(),
      expiresAt: r.expiresAt.getTime(),
    };
  });
  // Joriy qurilma birinchi
  items.sort((a, b) => Number(b.current) - Number(a.current));
  if (current && !current.jti) {
    const d = describeUserAgent(currentUserAgent);
    const now = Date.now();
    items.unshift({ id: null, ...d, current: true, lastSeenAt: now, createdAt: current.iat ? current.iat * 1000 : now, expiresAt: null });
  }
  return items;
}

/** Bitta sessiyani bekor qilish — faqat egasi. true: bekor qilindi; false: topilmadi / allaqachon yopilgan */
export async function revokeUserSession(userId: string, id: string): Promise<boolean> {
  const res = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, id), eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())));
  return res.rowsAffected > 0;
}
