import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * MAYDON SHIFRLASH (4-audit, 2026-11-03): shaxsiy kontaktlar bazada ochiq matnda yotmaydi.
 *
 * Nega alohida modul: `secret-box.ts` «server-only» va `totp.ts` (db) ga bog'langan — sxema (`db/schema.ts`)
 * esa seed/skriptlarda (tsx) ham yuklanadi, u yerda `server-only` xato beradi. Shuning uchun bu modul TOZA:
 * faqat node:crypto, hech qanday import yo'q.
 *
 * Qayerda ishlatiladi: `db/schema.ts` → `sealedText()` custom type (users.phone, specialists.telegram/instagram).
 * Drizzle orqali o'qish/yozish AVTOMATIK shifrlanadi/ochiladi — kod o'zgarmaydi. Xom SQL (`db.execute`) ustunni
 * shifrmatn holida ko'radi — kontaktni xom SQL bilan O'QIMANG.
 *
 * Format: `fe1:` + base64url(iv(12) ‖ tag(16) ‖ shifrmatn). Prefiksiz qiymat — eski ochiq matn (o'tish davri uchun
 * shundayligicha qaytariladi; `scripts/seal-contacts.ts` bir martalik shifrlab chiqadi).
 *
 * KALIT: `DATA_ENCRYPTION_KEY` (tavsiya — alohida, 32+ belgi) bo'lmasa AUTH_SECRET (totp.ts `ikm()` bilan bir xil
 * tartib). DIQQAT: kalit o'zgarsa shifrlangan kontaktlar O'QILMAYDI (null) — VPS'ga ko'chishda env'ni aynan ko'chiring.
 * `LIKE` qidiruv (admin telefon bo'yicha) shifrlangan qatorlarni topmaydi — bu ataylab.
 */
const PREFIX = "fe1:";

function ikm(): string {
  const dk = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (dk && dk.length >= 16) return `redince-data-v1:${dk}`;
  const prod = process.env.NODE_ENV === "production";
  const s = process.env.AUTH_SECRET?.trim();
  if (s) {
    if (prod) {
      if (!/^(change-me|dev-only)/i.test(s) && s.length >= 32) return s;
    } else if (s.length >= 16) {
      return s;
    }
  }
  const derived = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  if (derived && derived.length >= 16) return `redince-session-v1:${derived}`;
  if (prod) throw new Error("AUTH_SECRET yoki DATA_ENCRYPTION_KEY o'rnatilmagan — kontaktlarni shifrlab bo'lmaydi");
  return "dev-only-insecure-secret-change-me-please-123456";
}

let cached: Buffer | null = null;
let warned = false;
function key(): Buffer {
  if (!cached) cached = Buffer.from(hkdfSync("sha256", ikm(), "redince-field", "field-v1", 32));
  return cached;
}

export function isSealedField(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith(PREFIX);
}

/** Ochiq matn → shifrmatn. Bo'sh/null — o'zgarishsiz (null saqlanadi). Allaqachon shifrlangan bo'lsa tegilmaydi */
export function sealField(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined) return null;
  if (plain === "" || isSealedField(plain)) return plain;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64url");
}

/** Shifrmatn → ochiq matn. Prefiksiz (eski) qiymat shundayligicha; kalit mos kelmasa null */
export function openField(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined) return null;
  if (!isSealedField(stored)) return stored;
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), "base64url");
    if (buf.length < 28) return null;
    const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
  } catch {
    if (!warned) {
      warned = true;
      console.error("[field-crypto] shifrlangan maydon ochilmadi — DATA_ENCRYPTION_KEY/AUTH_SECRET o'zgarganmi? (scripts/seal-contacts.ts --unseal eski kalit bilan)");
    }
    return null;
  }
}
