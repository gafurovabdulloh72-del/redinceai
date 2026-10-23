import "server-only";
import crypto from "node:crypto";
import { SignJWT } from "jose";

/**
 * Web Push (brauzer bildirishnomalari) — tashqi paketsiz, Node `crypto` va `jose` bilan.
 *
 * Standartlar:
 *  - RFC 8291 — xabar shifrlash (`aes128gcm`): ECDH P-256 + HKDF-SHA256 + AES-128-GCM
 *  - RFC 8292 — VAPID: `Authorization: vapid t=<ES256 JWT>, k=<ochiq kalit>`
 *
 * Env (uchalasi bo'lmasa push umuman o'chiq — tugma ko'rinmaydi):
 *  - NEXT_PUBLIC_VAPID_PUBLIC_KEY  base64url, 65 bayt (uncompressed P-256 nuqta) — klientga ham kerak
 *  - VAPID_PRIVATE_KEY             base64url, 32 bayt (maxfiy skalyar)
 *  - VAPID_SUBJECT                 `mailto:...` yoki sayt manzili (push xizmati bog'lanishi uchun)
 *
 * Kalit juftligini yaratish: `node scripts/gen-vapid.mjs`
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const SUBJECT = process.env.VAPID_SUBJECT ?? "";

export function isPushEnabled(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY && SUBJECT);
}
export const pushPublicKey = () => PUBLIC_KEY;

const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

/** HKDF (RFC 5869) — SHA-256; Node 22 `crypto.hkdfSync` bilan */
const hkdf = (salt: Buffer, ikm: Buffer, info: Buffer, len: number) => Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, len));

/** `Content-Encoding: <name>` + 0x00 shaklidagi info satri */
const ceInfo = (name: string) => Buffer.concat([Buffer.from(`Content-Encoding: ${name}`, "ascii"), Buffer.from([0])]);

/**
 * Xabarni obuna kalitlariga shifrlaydi (aes128gcm bir yozuv).
 * Natija tanasi: salt(16) | rs(4) | idlen(1) | serverOchiqKalit(65) | shifrmatn
 */
export function encryptPayload(payload: string, p256dh: string, authSecret: string): Buffer {
  const clientPub = fromB64u(p256dh);
  const clientAuth = fromB64u(authSecret);
  if (clientPub.length !== 65 || clientAuth.length < 16) throw new Error("Obuna kalitlari noto'g'ri");

  // Bir martalik (ephemeral) server kalit juftligi
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const serverPub = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(clientPub);

  // RFC 8291: IKM = HKDF(salt = auth_secret, ikm = ECDH, info = "WebPush: info" | 0x00 | ua_pub | as_pub)
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info", "ascii"), Buffer.from([0]), clientPub, serverPub]);
  const ikm = hkdf(clientAuth, shared, keyInfo, 32);

  const salt = crypto.randomBytes(16);
  const cek = hkdf(salt, ikm, ceInfo("aes128gcm"), 16);
  const nonce = hkdf(salt, ikm, ceInfo("nonce"), 12);

  // Oxirgi (yagona) yozuv chegarasi — 0x02
  const plain = Buffer.concat([Buffer.from(payload, "utf8"), Buffer.from([2])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, rs, Buffer.from([serverPub.length]), serverPub, body]);
}

/** VAPID JWT (ES256): aud = push xizmati origini, 12 soat amal qiladi */
async function vapidHeader(endpoint: string): Promise<string> {
  const pub = fromB64u(PUBLIC_KEY);
  const key = crypto.createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: PRIVATE_KEY, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: "jwk",
  });
  const jwt = await new SignJWT({ sub: SUBJECT })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setAudience(new URL(endpoint).origin)
    .setExpirationTime("12h")
    .sign(key);
  return `vapid t=${jwt}, k=${PUBLIC_KEY}`;
}

export type PushResult = { ok: true } | { ok: false; gone: boolean; status: number };

/**
 * Bitta obunaga xabar yuborish. `gone: true` — obuna o'lgan (404/410), qatorni o'chirish kerak.
 * `urgency` — `high` muhim xabarlar uchun (telefon darhol ko'rsatadi).
 */
export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string, urgency: "normal" | "high" = "normal"): Promise<PushResult> {
  if (!isPushEnabled()) return { ok: false, gone: false, status: 0 };
  const body = encryptPayload(payload, sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      authorization: await vapidHeader(sub.endpoint),
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: "86400",
      urgency,
    },
    body: new Uint8Array(body),
    cache: "no-store",
  });
  if (res.ok) return { ok: true };
  return { ok: false, gone: res.status === 404 || res.status === 410, status: res.status };
}
