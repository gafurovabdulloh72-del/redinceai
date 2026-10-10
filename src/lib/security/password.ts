import "server-only";
import bcrypt from "bcryptjs";

/** bcrypt narxi: 12 (≈250 ms) — brute-force'ni sekinlashtiradi, login uchun sezilmaydi */
export const BCRYPT_COST = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string) {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Foydalanuvchi topilmaganda ham bcrypt ishlaydi — javob vaqti mavjud/mavjud emas
 * emailni farqlashga imkon bermaydi (user enumeration). Har doim false qaytaradi.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= bcrypt.hash("redince-dummy-password-9f1c", BCRYPT_COST);
  await bcrypt.compare(password, await dummyHash);
  return false;
}

export { passwordStrength } from "./password-strength";
