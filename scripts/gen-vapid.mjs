/**
 * VAPID kalit juftligini yaratadi (Web Push bildirishnomalari uchun).
 * Ishlatish: node scripts/gen-vapid.mjs
 * Natijani .env (lokal) va Vercel env (prod) ga qo'ying.
 */
import crypto from "node:crypto";

const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
// Ochiq kalit — siqilmagan P-256 nuqtasi: 0x04 | x(32) | y(32)
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]);
void publicKey;

console.log("# Web Push (VAPID) kalitlari — .env va Vercel env ga qo'shing:");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${pub.toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log(`VAPID_SUBJECT=mailto:admin@kasbegalari.uz`);
