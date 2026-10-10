import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResets } from "@/lib/db/schema";
import { uid } from "@/lib/utils";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 soat

/** 256 bit tasodifiy token (URL uchun xavfsiz) */
export function generateToken() {
  return randomBytes(32).toString("base64url");
}

/** Bazada faqat sha256 hash saqlanadi — baza sizsa ham tokenlar ishlamaydi */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Yangi tiklash tokeni: eski ishlatilmagan tokenlar bekor qilinadi */
export async function createPasswordReset(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt)));
  await db.insert(passwordResets).values({ id: uid(), userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

/** Tokenni tekshirib, bir martalik ishlatadi. userId yoki null (noto'g'ri/eskirgan/ishlatilgan). */
export async function consumePasswordReset(token: string): Promise<string | null> {
  if (!token || token.length < 16 || token.length > 128) return null;
  const row = await db.query.passwordResets.findFirst({ where: eq(passwordResets.tokenHash, hashToken(token)) });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, row.id));
  return row.userId;
}

/** Tokenning hali amal qilishini (ishlatmasdan) tekshirish — sahifani ochganda */
export async function peekPasswordReset(token: string): Promise<boolean> {
  if (!token || token.length < 16 || token.length > 128) return false;
  const row = await db.query.passwordResets.findFirst({ where: eq(passwordResets.tokenHash, hashToken(token)), columns: { usedAt: true, expiresAt: true } });
  return Boolean(row && !row.usedAt && row.expiresAt.getTime() >= Date.now());
}
