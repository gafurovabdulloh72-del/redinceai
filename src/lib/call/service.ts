import "server-only";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { callInvites, conversations, dmMessages, users, type CallInvite } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { uid } from "@/lib/utils";
import { loadConversationFor } from "@/lib/chat/dm";
import { isBlockedEither } from "@/lib/privacy/blocks";
import { notify } from "@/lib/notifications";
import { callPreview, type CallEndStatus, type CallInfo } from "@/lib/call/format";
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
 * Tugagan qo'ng'iroqni suhbat tarixiga yozish (Telegram kabi): kim chaqirdi, qachon boshlandi/tugadi, davomiylik.
 * Bir marta yoziladi — `message_id` ustuniga CAS (ikkala tomon ham tugatsa ham dublikat bo'lmaydi).
 * Javobsiz/bekor qilingan qo'ng'iroq uchun qabul qiluvchiga bildirishnoma.
 */
async function recordCall(inv: CallInvite, status: CallEndStatus, endedAt: Date): Promise<void> {
  const msgId = uid();
  const claimed = await db
    .update(callInvites)
    .set({ messageId: msgId })
    .where(and(eq(callInvites.id, inv.id), isNull(callInvites.messageId)))
    .returning({ id: callInvites.id });
  if (!claimed.length) return; // boshqa tomon allaqachon yozgan

  const answeredMs = inv.answeredAt?.getTime() ?? null;
  const call: CallInfo = {
    video: inv.video,
    status,
    startedAt: inv.createdAt.getTime(),
    answeredAt: status === "ended" ? answeredMs : null,
    endedAt: endedAt.getTime(),
    durationSec: status === "ended" && answeredMs ? Math.max(0, Math.round((endedAt.getTime() - answeredMs) / 1000)) : 0,
  };
  const row: typeof dmMessages.$inferInsert = {
    id: msgId,
    conversationId: inv.conversationId,
    senderId: inv.callerId,
    body: callPreview(call, true),
    attachments: [],
    call,
    createdAt: endedAt,
  };
  await db.insert(dmMessages).values(row);
  await db.update(conversations).set({ lastMessageAt: endedAt }).where(eq(conversations.id, inv.conversationId));

  if (status === "missed" || status === "cancelled") {
    const caller = await brief(inv.callerId);
    await notify(inv.calleeId, "chat", `Javobsiz ${inv.video ? "video " : ""}qo'ng'iroq`, caller?.name ?? "Foydalanuvchi", `/kabinet/chat?s=${inv.conversationId}`).catch(() => undefined);
  }
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
    const at = new Date();
    const won = await db
      .update(callInvites)
      .set({ status: "missed", endedAt: at, updatedAt: at })
      .where(and(eq(callInvites.id, inviteId), eq(callInvites.status, "ringing")))
      .returning({ id: callInvites.id });
    inv = { ...inv, status: "missed", endedAt: at };
    if (won.length) await recordCall(inv, "missed", at);
  }
  return { status: inv.status, room: inv.room, conversationId: inv.conversationId, callerId: inv.callerId, calleeId: inv.calleeId, video: inv.video };
}

/** Qabul qilish (faqat chaqiriluvchi): accepted + chaqiriluvchiga token */
export async function acceptCall(inviteId: string, meId: string, meName: string) {
  const inv = await loadMine(inviteId, meId);
  if (inv.calleeId !== meId) throw new ApiError(403, "Bu qo'ng'iroqni siz qabul qila olmaysiz");
  if (!["ringing", "accepted"].includes(inv.status)) throw new ApiError(409, "Qo'ng'iroq allaqachon tugagan");
  const now = new Date();
  // answeredAt faqat birinchi qabulda (qayta chaqirilsa davomiylik buzilmasin)
  await db.update(callInvites).set({ status: "accepted", updatedAt: now, ...(inv.answeredAt ? {} : { answeredAt: now }) }).where(eq(callInvites.id, inviteId));
  const token = await mintCallToken({ identity: meId, name: meName, room: inv.room });
  return { room: inv.room, token, url: LIVEKIT_WS_URL, video: inv.video };
}

/** Rad etish (faqat chaqiriluvchi) */
export async function declineCall(inviteId: string, meId: string) {
  const inv = await loadMine(inviteId, meId);
  if (inv.calleeId !== meId) throw new ApiError(403, "Ruxsat yo'q");
  if (inv.status === "ringing") {
    const at = new Date();
    const won = await db
      .update(callInvites)
      .set({ status: "declined", endedAt: at, updatedAt: at })
      .where(and(eq(callInvites.id, inviteId), eq(callInvites.status, "ringing")))
      .returning({ id: callInvites.id });
    if (won.length) await recordCall({ ...inv, status: "declined", endedAt: at }, "declined", at);
  }
  return { ok: true };
}

/** Bekor qilish (faqat chaqiruvchi, hali javob bo'lmaganda) */
export async function cancelCall(inviteId: string, meId: string) {
  const inv = await loadMine(inviteId, meId);
  if (inv.callerId !== meId) throw new ApiError(403, "Ruxsat yo'q");
  if (inv.status === "ringing") {
    const at = new Date();
    const won = await db
      .update(callInvites)
      .set({ status: "cancelled", endedAt: at, updatedAt: at })
      .where(and(eq(callInvites.id, inviteId), eq(callInvites.status, "ringing")))
      .returning({ id: callInvites.id });
    if (won.length) await recordCall({ ...inv, status: "cancelled", endedAt: at }, "cancelled", at);
  }
  return { ok: true };
}

/** Tugatish (ikkala tomon ham chaqiradi — birinchisi yozadi, ikkinchisi no-op). Davomiylik tarixga yoziladi. */
export async function endCall(inviteId: string, meId: string) {
  const inv = await loadMine(inviteId, meId);
  const at = new Date();
  const won = await db
    .update(callInvites)
    .set({ status: "ended", endedAt: at, updatedAt: at })
    .where(and(eq(callInvites.id, inviteId), eq(callInvites.status, "accepted")))
    .returning({ id: callInvites.id });
  if (won.length) {
    await recordCall({ ...inv, status: "ended", endedAt: at }, "ended", at);
  } else if (inv.status === "ringing" && inv.callerId === meId) {
    // Hali jiringlayotganda chiqib ketdi — bekor qilish sifatida yoziladi
    await cancelCall(inviteId, meId);
  }
  return { ok: true };
}
