import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Payout rekvizitlarini shifrlash (E55): AES-256-GCM, kalit = HKDF(AUTH_SECRET yoki fallback, "payout-v1").
 * Bazada faqat maskalangan ko'rinish (payouts.details) ochiq saqlanadi; to'liq rekvizit — payouts.detailsEnc.
 * Format: "v1:" + base64url(iv ‖ tag ‖ ciphertext). Kalit o'zgarsa eski yozuvlar ochilmaydi (null qaytadi).
 */
const VERSION = "v1";
const INFO = "payout-v1";
const SALT = "redince-payout";

/** src/lib/auth.ts secret() bilan bir xil manba: AUTH_SECRET → Turso token → dev fallback */
function ikm(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (s && s.length >= 16) return s;
  const derived = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  if (derived && derived.length >= 16) return `redince-session-v1:${derived}`;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET o'rnatilmagan — rekvizitlarni shifrlab bo'lmaydi");
  return "dev-only-insecure-secret-change-me-please-123456";
}

function key(): Buffer {
  return Buffer.from(hkdfSync("sha256", ikm(), SALT, INFO, 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, enc]).toString("base64url")}`;
}

/** Noto'g'ri format / kalit mos kelmasa null (xato tashlamaydi) */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const idx = payload.indexOf(":");
  if (idx < 0 || payload.slice(0, idx) !== VERSION) return null;
  try {
    const buf = Buffer.from(payload.slice(idx + 1), "base64url");
    if (buf.length < 12 + 16 + 1) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
