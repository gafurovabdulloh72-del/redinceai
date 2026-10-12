import "server-only";
import { createHash, randomInt } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResets, users } from "@/lib/db/schema";
import { uid } from "@/lib/utils";

export const VERIFY_CODE_TTL_MS = 15 * 60 * 1000; // 15 daqiqa
const PURPOSE = "verify_email" as const;

/** Bazada faqat sha256(kod + userId) saqlanadi — kod foydalanuvchiga bog'langan, boshqa hisobda ishlamaydi */
function hashCode(code: string, userId: string) {
  return createHash("sha256").update(`${code}:${userId}`).digest("hex");
}

/** Foydalanuvchining ishlatilmagan tasdiqlash kodlarini bekor qiladi (yangi kod so'ralganda) */
async function invalidateEmailVerifications(userId: string): Promise<void> {
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResets.userId, userId), eq(passwordResets.purpose, PURPOSE), isNull(passwordResets.usedAt)));
}

/** Yangi 6 xonali kod (eski kodlar bekor qilinadi). Kodning o'zi faqat emailga yuboriladi. */
export async function createEmailVerification(userId: string): Promise<{ code: string; expiresAt: Date }> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + VERIFY_CODE_TTL_MS);
  await invalidateEmailVerifications(userId);
  await db.insert(passwordResets).values({ id: uid(), userId, tokenHash: hashCode(code, userId), purpose: PURPOSE, expiresAt });
  return { code, expiresAt };
}

/**
 * Kodni tekshirib, bir martalik ishlatadi. Bitta atomar UPDATE … RETURNING (check-then-update emas).
 * true — kod to'g'ri va amal qilgan.
 */
export async function consumeEmailVerification(userId: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const rows = await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResets.userId, userId),
        eq(passwordResets.purpose, PURPOSE),
        eq(passwordResets.tokenHash, hashCode(code, userId)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    )
    .returning({ id: passwordResets.id });
  return rows.length > 0;
}

/** Foydalanuvchining emaili tasdiqlanganmi (maxfiylik "clients" darajasi va h.k. uchun) */
export async function isEmailVerified(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { emailVerified: true } });
  return Boolean(row?.emailVerified);
}
