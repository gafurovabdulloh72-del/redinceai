import "server-only";
import { SignJWT } from "jose";

/**
 * LiveKit video qo'ng'iroq token qatlami — o'z serverimizda joylashtirilgan LiveKit SFU uchun.
 *
 * Sabab (do'st-dasturchi maslahati + O'zR ma'lumot lokalizatsiyasi): qo'ng'iroq oqimi uchinchi
 * tomon (Zoom/Agora) serverlaridan emas, O'ZIMIZNING VPS'da turgan LiveKit orqali o'tadi — media
 * va metama'lumot bizda qoladi. Bepul (faqat server haqi), to'liq nazorat.
 *
 * Token — oddiy HS256 JWT (jose bilan, yangi paketsiz): LiveKit AccessToken aynan shu shaklni kutadi.
 * Imzo = API_SECRET, iss = API_KEY, video grant = qaysi xonaga qo'shilish huquqi.
 *
 * Env (barchasi to'liq bo'lsa qo'ng'iroq yoqiladi, aks holda tugma umuman ko'rinmaydi — Google kirish naqshi):
 *  - LIVEKIT_URL           wss://livekit.kasbegalari.uz (brauzer ulanadigan WS manzil, NEXT_PUBLIC ham)
 *  - LIVEKIT_API_KEY       LiveKit API kaliti (server, serverga chiqmaydi)
 *  - LIVEKIT_API_SECRET    LiveKit API siri (server, hech qachon klientga bermaymiz)
 *
 * NEXT_PUBLIC_LIVEKIT_URL — klientga WS manzilni ko'rsatish uchun (sir emas, faqat manzil).
 */

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
/** Server ↔ klient uchun bitta manzil: avval ommaviy (NEXT_PUBLIC), keyin server-only */
export const LIVEKIT_WS_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? process.env.LIVEKIT_URL ?? "";

/** Qo'ng'iroq yoqilganmi — uchala sir ham to'liq bo'lsa (aks holda UI tugmani yashiradi) */
export function isCallEnabled(): boolean {
  return Boolean(API_KEY && API_SECRET && LIVEKIT_WS_URL);
}

/** Video grant — LiveKit JWT ichidagi "video" klaymi (qaysi xona, qanday huquq) */
type VideoGrant = {
  room: string;
  roomJoin: boolean;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
};

/**
 * Bitta ishtirokchi uchun xonaga kirish tokeni (6 soat amal qiladi).
 * `identity` — foydalanuvchi id (xonada noyob), `name` — ko'rinadigan ism, `room` — xona nomi.
 * Huquqlar: xonaga qo'shilish + ovoz/video chiqarish + obuna + data (chat/reaksiya).
 */
export async function mintCallToken(opts: { identity: string; name: string; room: string }): Promise<string> {
  if (!API_KEY || !API_SECRET) throw new Error("LIVEKIT_API_KEY/SECRET sozlanmagan");
  const grant: VideoGrant = { room: opts.room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true };
  const secret = new TextEncoder().encode(API_SECRET);
  // LiveKit token: iss = API_KEY, sub = identity, video = grant. jti noyob bo'lishi tavsiya etiladi.
  return new SignJWT({ video: grant, name: opts.name, metadata: "" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(API_KEY)
    .setSubject(opts.identity)
    .setJti(opts.identity)
    .setIssuedAt()
    .setExpirationTime("6h")
    .sign(secret);
}

/** DM suhbati uchun xona nomi (ikkala tomon bir xil nom oladi) */
export function dmRoom(conversationId: string): string {
  return `dm_${conversationId}`;
}

/** Guruh/jamoa qo'ng'irog'i uchun xona nomi */
export function groupRoom(slug: string): string {
  return `group_${slug}`;
}
