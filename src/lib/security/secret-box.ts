import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { authIkm } from "./totp";

const VERSION = "sb1";

/**
 * Kichik «sirlar qutisi» (2026-10-25 auditi, 8-band): bazada ochiq matnda yotmasligi kerak,
 * lekin egasiga qayta ko'rsatilishi kerak bo'lgan qiymatlar uchun (masalan jonli efir kodi).
 * AES-256-GCM; kalit AUTH_SECRET'dan HKDF bilan, har maqsad (`purpose`) uchun alohida chiqariladi —
 * bir maqsaddagi shifrmatn boshqasida ochilmaydi.
 */
function key(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", authIkm(), "redince-secret-box", `sb-${purpose}`, 32));
}

export function sealSecret(plain: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(purpose), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url")}`;
}

/** Kalit mos kelmasa, format buzilgan yoki qiymat shifrlanmagan bo'lsa — null */
export function openSecret(payload: string | null | undefined, purpose: string): string | null {
  if (!payload) return null;
  const idx = payload.indexOf(":");
  if (idx < 0 || payload.slice(0, idx) !== VERSION) return null;
  try {
    const buf = Buffer.from(payload.slice(idx + 1), "base64url");
    if (buf.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", key(purpose), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Vaqtga bog'liq bo'lmagan solishtirish (uzunlik farqi baribir sizadi — bu muhim emas) */
export function secretEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
