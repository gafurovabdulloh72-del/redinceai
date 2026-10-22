import "server-only";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, liveBans, liveMessages, liveStreams, users, type Group, type LiveStream } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { getMembership, notifyMembers } from "@/lib/groups/service";
import { uid } from "@/lib/utils";
import { closeRoom, listIdentities, liveRoom, muteTrack, removeParticipant, setStage } from "@/lib/rtc/livekit";

/** Token 6 soat yashaydi — undan uzoq "jonli" yozuv yetim (host yopmagan) hisoblanadi */
export const LIVE_MAX_MS = 6 * 60 * 60 * 1000;

type Viewer = { id: string; role: string };

/** Boshlovchi xonada yo'qmi (brauzer yopilgan/uzilgan)? 90 s imtiyoz; natija 20 s keshlanadi; LiveKit javob bermasa — "yo'q emas" */
const hostSeen = new Map<string, { at: number; present: boolean; firstMissing: number | null }>();
async function hostGone(s: LiveStream): Promise<boolean> {
  if (Date.now() - s.startedAt.getTime() < 90_000) return false;
  const c = hostSeen.get(s.id);
  let present = c?.present ?? true;
  let firstMissing = c?.firstMissing ?? null;
  if (!c || Date.now() - c.at > 20_000) {
    try {
      present = (await listIdentities(s.room)).includes(s.hostId);
      firstMissing = present ? null : (firstMissing ?? Date.now());
      hostSeen.set(s.id, { at: Date.now(), present, firstMissing });
    } catch {
      return false;
    }
  }
  return !present && firstMissing !== null && Date.now() - firstMissing > 90_000;
}

async function endLiveSystem(s: LiveStream): Promise<void> {
  await db.update(liveStreams).set({ status: "ended", endedAt: new Date() }).where(and(eq(liveStreams.id, s.id), eq(liveStreams.status, "live")));
  hostSeen.delete(s.id);
  await closeRoom(s.room).catch(() => undefined);
}

async function canHost(group: Group, v: Viewer): Promise<boolean> {
  if (v.role === "admin" || group.ownerId === v.id) return true;
  const m = await getMembership(group.id, v.id);
  return Boolean(m && m.status === "active" && (m.role === "owner" || m.role === "admin"));
}

/** Guruhdagi hozirgi jonli efir (yetimlari yopiladi) */
export async function activeLive(groupId: string): Promise<LiveStream | null> {
  const cutoff = new Date(Date.now() - LIVE_MAX_MS);
  await db.update(liveStreams).set({ status: "ended", endedAt: new Date() }).where(and(eq(liveStreams.groupId, groupId), eq(liveStreams.status, "live"), lt(liveStreams.startedAt, cutoff)));
  const row = await db.query.liveStreams.findFirst({ where: and(eq(liveStreams.groupId, groupId), eq(liveStreams.status, "live"), gt(liveStreams.startedAt, cutoff)), orderBy: [desc(liveStreams.startedAt)] });
  if (row && (await hostGone(row))) {
    await endLiveSystem(row);
    return null;
  }
  return row ?? null;
}

export async function startLive(group: Group, host: Viewer, title: string): Promise<LiveStream> {
  if (!(await canHost(group, host))) throw new ApiError(403, "Efir boshlash faqat egasi yoki moderatorlar uchun");
  if (await activeLive(group.id)) throw new ApiError(409, "Bu yerda efir allaqachon davom etmoqda");
  const id = uid();
  const row: typeof liveStreams.$inferInsert = { id, groupId: group.id, hostId: host.id, title: title.trim().slice(0, 100) || "Jonli efir", room: liveRoom(id) };
  await db.insert(liveStreams).values(row);
  const stream = (await db.query.liveStreams.findFirst({ where: eq(liveStreams.id, id) }))!;
  void notifyMembers(group, host.id, "live_event", `Jonli efir boshlandi: ${group.name}`, stream.title, `/jamoalar/${group.slug}?efir=1`).catch(() => undefined);
  return stream;
}

/** CAS: faqat "live" holatdagi efir yopiladi */
export async function endLive(streamId: string, actor: Viewer, peak?: number): Promise<void> {
  const s = await db.query.liveStreams.findFirst({ where: eq(liveStreams.id, streamId) });
  if (!s) throw new ApiError(404, "Efir topilmadi");
  if (s.hostId !== actor.id && actor.role !== "admin") throw new ApiError(403, "Efirni faqat boshlovchi tugatadi");
  await db
    .update(liveStreams)
    .set({ status: "ended", endedAt: new Date(), peakViewers: Math.max(s.peakViewers, Math.min(Math.floor(peak ?? 0), 1_000_000)) })
    .where(and(eq(liveStreams.id, streamId), eq(liveStreams.status, "live")));
  // Xonani yopamiz — hamma tomoshabin uziladi (host sahifani yopib ketgan bo'lsa ham)
  await closeRoom(s.room).catch((e) => console.error("[live:close]", e));
}

async function hostedStream(streamId: string, actor: Viewer): Promise<LiveStream> {
  const s = await db.query.liveStreams.findFirst({ where: and(eq(liveStreams.id, streamId), eq(liveStreams.status, "live")) });
  if (!s) throw new ApiError(404, "Efir tugagan");
  if (s.hostId !== actor.id && actor.role !== "admin") throw new ApiError(403, "Faqat boshlovchi boshqara oladi");
  return s;
}

/** Boshlovchi amallari: chiqarish (qayta kira olmaydi) · sahnaga ruxsat · ruxsatni olish */
export async function moderateParticipant(streamId: string, actor: Viewer, identity: string, action: "kick" | "allow" | "revoke" | "mute", trackSid?: string): Promise<void> {
  const s = await hostedStream(streamId, actor);
  if (identity === s.hostId) throw new ApiError(400, "Boshlovchini chiqarib bo'lmaydi");
  if (action === "mute") {
    if (!trackSid) throw new ApiError(400, "Trek topilmadi");
    await muteTrack(s.room, identity, trackSid);
    return;
  }
  if (action === "kick") {
    await db.insert(liveBans).values({ streamId, userId: identity }).onConflictDoNothing();
    await removeParticipant(s.room, identity);
  } else {
    await setStage(s.room, identity, action === "allow");
  }
}

/** O'tgan efirlar (tugagan), eng yangisi birinchi */
export async function pastLives(groupId: string, limit = 10): Promise<{ id: string; title: string; startedAt: number; minutes: number; peak: number }[]> {
  const rows = await db.query.liveStreams.findMany({ where: and(eq(liveStreams.groupId, groupId), eq(liveStreams.status, "ended")), orderBy: [desc(liveStreams.startedAt)], limit });
  return rows.map((r) => ({ id: r.id, title: r.title, startedAt: r.startedAt.getTime(), minutes: Math.max(1, Math.round(((r.endedAt?.getTime() ?? r.startedAt.getTime()) - r.startedAt.getTime()) / 60_000)), peak: r.peakViewers }));
}

/** Tomoshabin yoki boshlovchi uchun xona va huquq. Yopiq jamoada faqat a'zo */
export async function liveAccess(streamId: string, v: Viewer): Promise<{ stream: LiveStream; host: boolean; group: Group }> {
  const stream = await db.query.liveStreams.findFirst({ where: eq(liveStreams.id, streamId) });
  if (!stream || stream.status !== "live" || stream.startedAt.getTime() < Date.now() - LIVE_MAX_MS) throw new ApiError(404, "Efir tugagan");
  const group = await db.query.groups.findFirst({ where: eq(groups.id, stream.groupId) });
  if (!group) throw new ApiError(404, "Jamoa topilmadi");
  const host = stream.hostId === v.id;
  if (!host && group.isPrivate && v.role !== "admin") {
    const m = await getMembership(group.id, v.id);
    if (!m || m.status !== "active") throw new ApiError(403, "Bu efir yopiq jamoa a'zolari uchun");
  }
  if (!host) {
    const ban = await db.query.liveBans.findFirst({ where: and(eq(liveBans.streamId, streamId), eq(liveBans.userId, v.id)) });
    if (ban) throw new ApiError(403, "Boshlovchi sizni bu efirdan chiqargan");
  }
  return { stream, host, group };
}

const CHAT_MAX = 300;

/** Efir chatiga yozuv (tarix uchun; realtime — LiveKit data). Taqiqlanganlar yoza olmaydi (liveAccess) */
export async function saveChat(streamId: string, v: Viewer, body: string): Promise<void> {
  await liveAccess(streamId, v);
  const t = body.trim().slice(0, CHAT_MAX);
  if (!t) return;
  await db.insert(liveMessages).values({ id: uid(), streamId, userId: v.id, body: t });
}

/** Oxirgi 50 ta xabar, eskidan yangiga */
export async function chatHistory(streamId: string, v: Viewer): Promise<{ id: string; name: string; body: string; at: number }[]> {
  await liveAccess(streamId, v);
  const rows = await db
    .select({ id: liveMessages.id, body: liveMessages.body, at: liveMessages.createdAt, name: users.name })
    .from(liveMessages)
    .innerJoin(users, eq(users.id, liveMessages.userId))
    .where(eq(liveMessages.streamId, streamId))
    .orderBy(desc(liveMessages.createdAt))
    .limit(50);
  return rows.reverse().map((r) => ({ id: r.id, name: r.name ?? "Ishtirokchi", body: r.body, at: r.at.getTime() }));
}
