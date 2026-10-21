import "server-only";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { callInvites, users, type CallInvite } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { uid } from "@/lib/utils";
import { loadConversationFor } from "@/lib/chat/dm";
import { isBlockedEither } from "@/lib/privacy/blocks";
import { mintCallToken, dmRoom, LIVEKIT_WS_URL } from "@/lib/rtc/livekit";

/** Jiringlash muddati: shuncha vaqt javob bo'lmasa — «javobsiz» (missed) */
export const RING_TTL_MS = 45_000;

type BriefUser = { id: string; name: string; avatarUrl: string | null };

/** Qisqa foydalanuvchi ma'lumoti (qo'ng'iroq ekrani uchun: ism + rasm) */
async function brief(userId: string): Promise<BriefUser | null> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, name: true, avatarUrl: true } });
  return u ?? null;
}

/**
 * Chaqiruvni boshlash: A → B. Suhbat ishtirokchisi + blok tekshiruvi.
 * Avvalgi «jiringlayotgan» (ringing) takliflarim shu suhbatda bekor qilinadi (duplikat bo'lmasin).
 * Natija: taklif + qarshi tomon brief + chaqiruvchiga token.
 */
export async function startCall(meId: string, meName: string, conversationId: string, video: boolean) {
  const conv = await loadConversationFor(meId, conversationId);
  if (!conv) throw new ApiError(404, "Suhbat topilmadi");
  if (await isBlockedEither(meId, conv.peer.id)) throw new ApiError(403, "Bu foydalanuvchi bilan bog'lanib bo'lmaydi");

  // Mening eski jiringlayotgan takliflarim (shu suhbatda) — bekor
  await db
    .update(callInvites)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(callInvites.callerId, meId), eq(callInvites.conversationId, conversationId), eq(callInvites.status, "ringing")));

  const room = dmRoom(conversationId);
  const row: typeof callInvites.$inferInsert = { id: uid(), conversationId, callerId: meId, calleeId: conv.peer.id, room, status: "ringing", video };
  const [invite] = await db.insert(callInvites).values(row).returning();
  const token = await mintCallToken({ identity: meId, name: meName, room });
  return { invite, peer: { id: conv.peer.id, name: conv.peer.name, avatarUrl: conv.peer.avatarUrl ?? null }, token, room, url: LIVEKIT_WS_URL, video };
}

/** Men uchun aktiv kiruvchi qo'ng'iroq (jiringlamoqda, muddati o'tmagan) — eng so'nggisi yoki null */
export async function getIncoming(meId: string) {
  const since = new Date(Date.now() - RING_TTL_MS);
  const inv = await db.query.callInvites.findFirst({
    where: and(eq(callInvites.calleeId, meId), eq(callInvites.status, "ringing"), gt(callInvites.createdAt, since)),
    orderBy: [desc(callInvites.createdAt)],
  });
  if (!inv) return null;
  const caller = await brief(inv.callerId);
  if (!caller) return null;
  return { id: inv.id, room: inv.room, conversationId: inv.conversationId, caller, video: inv.video };
}

/** Taklifni yuklaymiz va men ishtirokchi ekanimni tekshiramiz (caller yoki callee) */
async function loadMine(inviteId: string, meId: string): Promise<CallInvite> {
  const inv = await db.query.callInvites.findFirst({ where: eq(callInvites.id, inviteId) });
  if (!inv || (inv.callerId !== meId && inv.calleeId !== meId)) throw new ApiError(404, "Qo'ng'iroq topilmadi");
  return inv;
}

/** Holatni so'rash (chaqiruvchi/chaqiriluvchi polling qiladi). Muddati o'tgan «ringing» → «missed». */
export async function getStatus(inviteId: string, meId: string) {
  let inv = await loadMine(inviteId, meId);
  if (inv.status === "ringing" && inv.createdAt.getTime() < Date.now() - RING_TTL_MS) {
    await db.update(callInvites).set({ status: "missed", updatedAt: new Date() }).where(and(eq(callInvites.id, inviteId), eq(callInvites.status, "ringing")));
    inv = { ...inv, status: "missed" };
  }
  return { status: inv.status, room: inv.room, conversationId: inv.conversationId, callerId: inv.callerId, calleeId: inv.calleeId, video: inv.video };
}

/** Qabul qilish (faqat chaqiriluvchi): accepted + chaqiriluvchiga token */
export async function acceptCall(inviteId: string, meId: string, meName: string) {
  const inv = await loadMine(inviteId, meId);
  if (inv.calleeId !== meId) throw new ApiError(403, "Bu qo'ng'iroqni siz qabul qila olmaysiz");
  if (!["ringing", "accepted"].includes(inv.status)) throw new ApiError(409, "Qo'ng'iroq allaqachon tugagan");
  await db.update(callInvites).set({ status: "accepted", updatedAt: new Date() }).where(eq(callInvites.id, inviteId));
  const token = await mintCallToken({ identity: meId, name: meName, room: inv.room });
  return { room: inv.room, token, url: LIVEKIT_WS_URL, video: inv.video };
}

/** Rad etish (faqat chaqiriluvchi) */
export async function declineCall(inviteId: string, meId: string) {
  const inv = await loadMine(inviteId, meId);
  if (inv.calleeId !== meId) throw new ApiError(403, "Ruxsat yo'q");
  if (inv.status === "ringing") await db.update(callInvites).set({ status: "declined", updatedAt: new Date() }).where(eq(callInvites.id, inviteId));
  return { ok: true };
}

/** Bekor qilish (faqat chaqiruvchi, hali javob bo'lmaganda) */
export async function cancelCall(inviteId: string, meId: string) {
  const inv = await loadMine(inviteId, meId);
  if (inv.callerId !== meId) throw new ApiError(403, "Ruxsat yo'q");
  if (inv.status === "ringing") await db.update(callInvites).set({ status: "cancelled", updatedAt: new Date() }).where(eq(callInvites.id, inviteId));
  return { ok: true };
}

/** Tugatish (ikkala tomon ham) — suhbat yopilganda. Faqat hali faol (accepted/ringing) bo'lsa. */
export async function endCall(inviteId: string, meId: string) {
  await loadMine(inviteId, meId);
  await db
    .update(callInvites)
    .set({ status: "ended", updatedAt: new Date() })
    .where(and(eq(callInvites.id, inviteId), inArray(callInvites.status, ["accepted", "ringing"])));
  return { ok: true };
}
