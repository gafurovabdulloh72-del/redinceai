import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

/**
 * Ikki bosqichli himoya (TOTP, RFC 6238 / HOTP RFC 4226) — kutubxonasiz: HMAC-SHA1, 30 soniya, 6 raqam.
 * Sir bazada AES-256-GCM bilan shifrlangan (kalit — AUTH_SECRET'dan HKDF, payments/crypto.ts bilan bir xil manba,
 * lekin boshqa "info" — kalitlar aralashmaydi). Zaxira kodlari faqat sha256 hash ko'rinishida saqlanadi.
 */
export const TOTP_STEP_SEC = 30;
export const TOTP_DIGITS = 6;
export const TOTP_ISSUER = "Kasb Egalari";
export const RECOVERY_CODE_COUNT = 10;

/* ---------------------------- base32 (RFC 4648) ---------------------------- */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("base32: noto'g'ri belgi");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/* ---------------------------------- HOTP / TOTP ---------------------------------- */
export function hotp(key: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function totpStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SEC);
}

/** Joriy kod (testlar va dev uchun) */
export function totpNow(secretB32: string, nowMs = Date.now()): string {
  return hotp(base32Decode(secretB32), totpStep(nowMs));
}

/**
 * Kodni ±window qadam oralig'ida tekshiradi (soat farqi uchun). Mos kelgan qadam raqami yoki null.
 * Taqqoslash vaqtga bog'liq emas (timingSafeEqual).
 */
export function matchTotp(secretB32: string, code: string, window = 1, nowMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secretB32);
  const step = totpStep(nowMs);
  const given = Buffer.from(code);
  let found: number | null = null;
  for (let w = -window; w <= window; w++) {
    const expected = Buffer.from(hotp(key, step + w));
    if (timingSafeEqual(expected, given) && found === null) found = step + w;
  }
  return found;
}

/**
 * Kodni tekshirish + takroriy ishlatishdan himoya: mos kelgan qadam rate_limits'da band qilinadi
 * (`totpUsed:<userId>:<step>`), shu kod ikkinchi marta qabul qilinmaydi (ushlab olingan kod bilan kirib bo'lmaydi).
 */
export async function verifyTotpOnce(userId: string, secretB32: string, code: string): Promise<boolean> {
  const step = matchTotp(secretB32, code);
  if (step === null) return false;
  const resetAt = (step + 3) * TOTP_STEP_SEC * 1000;
  const rows = await db
    .insert(rateLimits)
    .values({ key: `totpUsed:${userId}:${step}`, count: 1, resetAt })
    .onConflictDoNothing()
    .returning({ key: rateLimits.key });
  return rows.length > 0;
}

/* ---------------------------------- Sir ---------------------------------- */
/** 160 bit tasodifiy sir (base32, 32 belgi) */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** otpauth://totp/<issuer>:email?secret=…&issuer=<issuer> — autentifikator ilovalari uchun */
export function otpauthUri(secretB32: string, account: string): string {
  const label = encodeURIComponent(`${TOTP_ISSUER}:${account}`);
  const params = new URLSearchParams({ secret: secretB32, issuer: TOTP_ISSUER, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_STEP_SEC) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

const VERSION = "v1";
const PLACEHOLDER_SECRET = /^(change-me|dev-only)/i;
const MIN_SECRET_PROD = 32;
/**
 * TOTP sirini shifrlash kaliti uchun IKM. Sessiya kaliti (auth.ts) bilan bir xil qat'iylik:
 * productionda namunaviy yoki 32 belgidan qisqa AUTH_SECRET ishlatilmaydi (aks holda DB sizsa,
 * taxmin qilinadigan kalit bilan TOTP urug'larini ochish mumkin edi) — Turso tokeniga o'tiladi.
 */
/** Ildiz kalit materiali — `secret-box` ham shundan HKDF qiladi (maqsad bo'yicha ajratilgan) */
export function authIkm(): string {
  return ikm();
}

function ikm(): string {
  const prod = process.env.NODE_ENV === "production";
  const s = process.env.AUTH_SECRET?.trim();
  if (s) {
    if (prod) {
      if (!PLACEHOLDER_SECRET.test(s) && s.length >= MIN_SECRET_PROD) return s;
      // namunaviy/qisqa — e'tiborga olinmaydi, quyida Turso tokeniga tushadi
    } else if (s.length >= 16) {
      return s;
    }
  }
  const derived = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  if (derived && derived.length >= 16) return `redince-session-v1:${derived}`;
  if (prod) throw new Error("AUTH_SECRET o'rnatilmagan yoki kuchsiz — 2FA sirini xavfsiz shifrlab bo'lmaydi");
  return "dev-only-insecure-secret-change-me-please-123456";
}
function key(): Buffer {
  return Buffer.from(hkdfSync("sha256", ikm(), "redince-totp", "totp-v1", 32));
}

export function encryptTotpSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url")}`;
}

/** Kalit mos kelmasa yoki format buzilgan bo'lsa null */
export function decryptTotpSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const idx = payload.indexOf(":");
  if (idx < 0 || payload.slice(0, idx) !== VERSION) return null;
  try {
    const buf = Buffer.from(payload.slice(idx + 1), "base64url");
    if (buf.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* ------------------------------ Zaxira kodlari ------------------------------ */
const RC_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** "abcd-efgh" ko'rinishidagi kodlar (o'xshash belgilar — 0/o, 1/l/i — yo'q) */
export function generateRecoveryCodes(n = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: n }, () => {
    const chars = Array.from({ length: 8 }, () => RC_ALPHABET[randomInt(RC_ALPHABET.length)]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}

export function normalizeRecoveryCode(code: string): string {
  const c = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(`redince-rc:${normalizeRecoveryCode(code)}`).digest("hex");
}
