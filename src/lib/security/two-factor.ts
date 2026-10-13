import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";
import { decryptTotpSecret, hashRecoveryCode, verifyTotpOnce } from "./totp";

/** 6 xonali TOTP kod yoki "abcd-efgh" zaxira kodi (bo'sh joy / chiziqcha e'tiborsiz) */
export const secondFactorCode = z
  .string()
  .trim()
  .min(6, "Kodni kiriting")
  .max(20, "Kod juda uzun")
  .transform((v) => v.replace(/\s+/g, ""));

export type SecondFactorKind = "totp" | "recovery";

type TwoFactorUser = Pick<User, "id" | "totpSecretEnc" | "recoveryCodes">;

/**
 * Ikkinchi omilni tekshiradi va "sarflaydi":
 *  - 6 raqam → TOTP (±1 qadam, takroriy ishlatish bloklanadi);
 *  - boshqa → zaxira kodi (sha256 ro'yxatdan atomar o'chiriladi — bir martalik).
 * Mos kelsa turi, aks holda null. Xato tashlamaydi (faqat baza xatosi).
 */
export async function consumeSecondFactor(user: TwoFactorUser, rawCode: string): Promise<SecondFactorKind | null> {
  const code = rawCode.replace(/\s+/g, "");
  if (/^\d{6}$/.test(code)) {
    const secret = decryptTotpSecret(user.totpSecretEnc);
    if (!secret) return null;
    return (await verifyTotpOnce(user.id, secret, code)) ? "totp" : null;
  }
  const list = user.recoveryCodes ?? [];
  const hash = hashRecoveryCode(code);
  if (!list.includes(hash)) return null;
  const next = list.filter((h) => h !== hash);
  // Optimistik yangilash: parallel ikki so'rovdan faqat bittasi o'sha kodni ishlata oladi
  const res = await db
    .update(users)
    .set({ recoveryCodes: next })
    .where(and(eq(users.id, user.id), sql`${users.recoveryCodes} = ${JSON.stringify(list)}`));
  return res.rowsAffected > 0 ? "recovery" : null;
}
