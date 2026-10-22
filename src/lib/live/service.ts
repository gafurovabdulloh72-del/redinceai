import "server-only";
import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, liveBans, liveMessages, liveStreams, users, type Group, type LiveStream } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { getMembership, notifyMembers } from "@/lib/groups/service";
import { uid } from "@/lib/utils";
import { r2Config, r2PublicUrl } from "@/lib/storage/r2";
import { egressInfo, startRoomRecording, stopRecording } from "@/lib/rtc/livekit";
import { IMAGE_URL_RE } from "@/lib/validators";
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
  await finishRecording(s).catch(() => undefined);
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
  await finishRecording(s).catch(() => undefined);
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

/* ------------------------------------------------------------------ */
/* Efir yozuvi (LiveKit Egress → R2)                                   */
/* ------------------------------------------------------------------ */

export function recordingAvailable(): boolean {
  return r2Config() !== null;
}

const recKey = (id: string) => `recordings/${id}.mp4`;

/** Boshlovchi «Yozib olish»ni bosadi: nom — efir mavzusi; efir tugaganda yozuv avtomatik to'xtaydi va mentor bo'limiga tushadi */
export async function startRecording(streamId: string, actor: Viewer): Promise<void> {
  const s = await hostedStream(streamId, actor);
  const cfg = r2Config();
  if (!cfg) throw new ApiError(503, "Yozib olish uchun fayl saqlash (R2) sozlanmagan");
  if (s.recordingStatus === "recording" || s.recordingStatus === "processing") throw new ApiError(409, "Yozib olish allaqachon boshlangan");
  // CAS: bir vaqtda ikki marta bosilsa faqat bittasi o'tadi
  const claimed = await db
    .update(liveStreams)
    .set({ recordingStatus: "recording" })
    .where(and(eq(liveStreams.id, streamId), eq(liveStreams.status, "live"), sql`${liveStreams.recordingStatus} in ('none','failed')`))
    .returning({ id: liveStreams.id });
  if (!claimed.length) throw new ApiError(409, "Yozib olish allaqachon boshlangan");
  try {
    const egressId = await startRoomRecording(s.room, recKey(s.id), { accessKey: cfg.accessKeyId, secret: cfg.secretAccessKey, endpoint: cfg.endpoint, bucket: cfg.bucket });
    await db.update(liveStreams).set({ recordingEgressId: egressId }).where(eq(liveStreams.id, streamId));
  } catch (e) {
    await db.update(liveStreams).set({ recordingStatus: "failed" }).where(eq(liveStreams.id, streamId));
    console.error("[live:record]", e);
    throw new ApiError(502, "Yozib olishni boshlab bo'lmadi — keyinroq urinib ko'ring");
  }
}

/** Efir tugaganda: yozuv ketayotgan bo'lsa to'xtatamiz (fayl tayyorlanishi — processing) */
export async function finishRecording(s: LiveStream): Promise<void> {
  if (s.recordingStatus !== "recording" || !s.recordingEgressId) return;
  await db.update(liveStreams).set({ recordingStatus: "processing" }).where(and(eq(liveStreams.id, s.id), eq(liveStreams.recordingStatus, "recording")));
  await stopRecording(s.room, s.recordingEgressId).catch((e) => console.error("[live:stop-rec]", e));
}

/** processing holatdagi yozuvni Egress bilan solishtiramiz (webhook yo'q — ro'yxat ochilganda tekshiriladi) */
async function syncRecording(s: LiveStream): Promise<LiveStream> {
  if (s.recordingStatus !== "processing" || !s.recordingEgressId) return s;
  const info = await egressInfo(s.room, s.recordingEgressId).catch(() => null);
  if (!info) return s;
  if (info.status === "COMPLETE") {
    const patch = { recordingStatus: "ready" as const, recordingUrl: r2PublicUrl(recKey(s.id)), recordingSeconds: info.seconds };
    await db.update(liveStreams).set(patch).where(eq(liveStreams.id, s.id));
    return { ...s, ...patch };
  }
  if (["FAILED", "ABORTED", "LIMIT_REACHED"].includes(info.status)) {
    await db.update(liveStreams).set({ recordingStatus: "failed" }).where(eq(liveStreams.id, s.id));
    return { ...s, recordingStatus: "failed" };
  }
  return s;
}

export type RecordingView = { id: string; title: string; startedAt: number; seconds: number; url: string | null; coverUrl: string | null; status: LiveStream["recordingStatus"]; hidden: boolean };

/** Mentor bo'limidagi yozuvlar. Mehmon/obunachi: faqat tayyor va yashirilmagan; boshqaruvchi: hammasi (jarayondagilari ham) */
export async function listRecordings(groupId: string, manage: boolean, limit = 30): Promise<RecordingView[]> {
  let rows = await db.query.liveStreams.findMany({
    where: and(eq(liveStreams.groupId, groupId), eq(liveStreams.status, "ended"), sql`${liveStreams.recordingStatus} <> 'none'`),
    orderBy: [desc(liveStreams.startedAt)],
    limit,
  });
  rows = await Promise.all(rows.map(syncRecording));
  return rows
    .filter((r) => (manage ? true : r.recordingStatus === "ready" && !r.recordingHidden))
    .map((r) => ({ id: r.id, title: r.title, startedAt: r.startedAt.getTime(), seconds: r.recordingSeconds ?? Math.max(1, Math.round(((r.endedAt?.getTime() ?? r.startedAt.getTime()) - r.startedAt.getTime()) / 1000)), url: r.recordingUrl, coverUrl: r.coverUrl, status: r.recordingStatus, hidden: r.recordingHidden }));
}

/** Mentor (egasi/admin) yozuv nomi, muqovasi va ko'rinishini tahrirlaydi */
export async function updateRecording(streamId: string, actor: Viewer, patch: { title?: string; coverUrl?: string | null; hidden?: boolean }): Promise<void> {
  const s = await db.query.liveStreams.findFirst({ where: eq(liveStreams.id, streamId) });
  if (!s) throw new ApiError(404, "Yozuv topilmadi");
  const group = await db.query.groups.findFirst({ where: eq(groups.id, s.groupId) });
  if (!group || !(await canHost(group, actor))) throw new ApiError(403, "Tahrirlash faqat ustoz uchun");
  const set: Partial<typeof liveStreams.$inferInsert> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim().slice(0, 100);
    if (!t) throw new ApiError(422, "Nom bo'sh bo'lmasin");
    set.title = t;
  }
  if (patch.coverUrl !== undefined) {
    if (patch.coverUrl !== null && !IMAGE_URL_RE.test(patch.coverUrl)) throw new ApiError(422, "Muqova manzili noto'g'ri");
    set.coverUrl = patch.coverUrl;
  }
  if (patch.hidden !== undefined) set.recordingHidden = patch.hidden;
  if (Object.keys(set).length) await db.update(liveStreams).set(set).where(eq(liveStreams.id, streamId));
}
