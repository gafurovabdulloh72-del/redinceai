import "server-only";
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { authIkm } from "./totp";

/**
 * Himoyalangan media uchun qisqa muddatli imzolangan token (4-audit, 2026-11-03).
 *
 * Muammo: dars/efir videosi ruxsat tekshiruvidan keyin xom saqlash manziliga (R2/Blob/uploads) 302 qilinardi —
 * brauzer Network panelida haqiqiy URL ko'rinadi, uni nusxalab ulashish mumkin edi (pullik kontent oqib ketadi).
 * Yechim: ruxsat tekshirilgach foydalanuvchiga BOG'LANGAN, 15 daqiqalik token beriladi; `/stream` route'i tokenni
 * tekshirib faylni server orqali oqimlaydi (Range bilan) — xom manzil hech qachon mijozga bermaydi.
 *
 * Token formati: base64url(`${kind}.${id}.${subject}.${exp}`) + "." + base64url(HMAC-SHA256).
 *  kind    — "lesson" | "live" | 5-audit: "dm" | "group" | "order" | "orderfile" | "material" | "receipt" (yopiq fayllar, `lib/media/private-url.ts`)
 *  subject — foydalanuvchi id (mehmon preview uchun "-"): boshqa sessiya ishlata olmaydi
 *  exp     — unix soniya
 * Kalit AUTH_SECRET'dan HKDF bilan alohida maqsad uchun chiqariladi (sessiya kaliti bilan aralashmaydi).
 */
export type MediaKind = "lesson" | "live" | "dm" | "group" | "order" | "orderfile" | "material" | "receipt" | "review";
const TTL_SEC = 15 * 60;

function key(): Buffer {
  return Buffer.from(hkdfSync("sha256", authIkm(), "redince-media", "media-v1", 32));
}
const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const sign = (payload: string) => createHmac("sha256", key()).update(payload).digest();

export function mintMediaToken(kind: MediaKind, id: string, subject: string | null, ttlSec = TTL_SEC): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${kind}.${id}.${subject ?? "-"}.${exp}`;
  return `${b64(payload)}.${b64(sign(payload))}`;
}

/** To'g'ri va muddati o'tmagan bo'lsa — payload; aks holda null. Imzo doimiy vaqtda solishtiriladi. */
export function verifyMediaToken(token: string | null | undefined, expect: { kind: MediaKind; id: string; subject: string | null }): { exp: number } | null {
  if (!token || token.length > 400) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  let payload: string;
  let mac: Buffer;
  try {
    payload = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
    mac = Buffer.from(token.slice(dot + 1), "base64url");
  } catch {
    return null;
  }
  const want = sign(payload);
  if (mac.length !== want.length || !timingSafeEqual(mac, want)) return null;
  const [kind, id, subject, expStr] = payload.split(".");
  const exp = Number(expStr);
  if (kind !== expect.kind || id !== expect.id || subject !== (expect.subject ?? "-")) return null;
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  return { exp };
}
