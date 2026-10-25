import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  groups,
  liveAttendance,
  liveBreakoutMembers,
  liveBreakouts,
  liveCaptions,
  liveCohosts,
  liveStreams,
  liveWaiting,
  users,
  type Group,
  type LiveStream,
} from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { openSecret, sealSecret, secretEquals } from "@/lib/security/secret-box";
import { getMembership } from "@/lib/groups/service";
import { uid } from "@/lib/utils";
import { closeRoom, liveRoom, removeParticipant } from "@/lib/rtc/livekit";

/**
 * Zoom uslubidagi efir qo'shimchalari:
 *  - kutish xonasi (boshlovchi ruxsat bermaguncha kirilmaydi)
 *  - efir kodi (parol)
 *  - hammuallif (co-host) — moderatsiya huquqi
 *  - davomat (kirish/chiqish vaqti + CSV)
 *  - kichik xonalar (breakout)
 *  - subtitr/transkript (brauzer nutq tanish → matn)
 *
 * Har bir yozuv huquq tekshiruvidan o'tadi: boshqaruvchi = boshlovchi | sayt admini | hammuallif.
 */

type Viewer = { id: string; role: string };

/** Kichik xona nomi: live_<streamId>_b<position> */
export const breakoutRoom = (streamId: string, position: number) => `${liveRoom(streamId)}_b${position}`;

/** Efir kodi: 6–12 belgi (auditdan keyin 4 dan 6 ga ko'tarildi — 4 belgi terib topiladi) */
export const PASSCODE_RE = /^[A-Za-z0-9]{6,12}$/;
export const MAX_BREAKOUTS = 10;
/** Davomat «tirik» signali: shu oynadan keyin kelgan signal yangi sessiya hisoblanadi */
const ATTEND_GAP_MS = 5 * 60_000;
const CAPTION_MAX = 300;

async function streamOr404(streamId: string): Promise<LiveStream> {
  const s = await db.query.liveStreams.findFirst({ where: eq(liveStreams.id, streamId) });
  if (!s) throw new ApiError(404, "Efir topilmadi");
  return s;
}

/** Boshqaruvchi: boshlovchi · sayt admini · hammuallif */
export async function canModerate(s: LiveStream, v: Viewer): Promise<boolean> {
  if (s.hostId === v.id || v.role === "admin") return true;
  const c = await db.query.liveCohosts.findFirst({ where: and(eq(liveCohosts.streamId, s.id), eq(liveCohosts.userId, v.id)) });
  return Boolean(c);
}

/** Boshqaruv amallari uchun: efirni olib kelamiz va huquqni tekshiramiz */
export async function moderatedStream(streamId: string, actor: Viewer, requireLive = true): Promise<LiveStream> {
  const s = await streamOr404(streamId);
  if (requireLive && s.status !== "live") throw new ApiError(409, "Efir tugagan");
  if (!(await canModerate(s, actor))) throw new ApiError(403, "Faqat boshlovchi yoki hammuallif boshqara oladi");
  return s;
}

/** Jamoa egasi/moderatori ham sozlay oladi (efir boshlanishidan oldingi sozlamalar uchun) */
async function groupOf(s: LiveStream): Promise<Group> {
  const g = await db.query.groups.findFirst({ where: eq(groups.id, s.groupId) });
  if (!g) throw new ApiError(404, "Jamoa topilmadi");
  return g;
}

/* ------------------------------------------------------------------ */
/* Kutish xonasi + efir kodi                                           */
/* ------------------------------------------------------------------ */

export type EntryState = { gate: "open" | "code" | "waiting" | "denied" };

/**
 * Kirish darvozasi: kod va kutish xonasini tekshiradi (boshlovchi/hammuallif darvozadan o'tadi).
 *  - `code`   — kod kerak (noto'g'ri yoki berilmagan)
 *  - `waiting` — navbatga qo'yildi, boshlovchi ruxsatini kutadi
 *  - `denied` — boshlovchi rad etdi
 */
export async function entryGate(s: LiveStream, v: Viewer, passcode?: string, enroll = false): Promise<EntryState> {
  if (await canModerate(s, v)) return { gate: "open" };
  const row = await db.query.liveWaiting.findFirst({ where: and(eq(liveWaiting.streamId, s.id), eq(liveWaiting.userId, v.id)) });
  // Bir marta kiritilgan odam qayta kod so'ralmaydi: chat/savol/subtitr chaqiriqlari ham ishlaydi
  if (row?.status === "approved") return { gate: "open" };
  if (row?.status === "denied") return { gate: "denied" };
  if (s.passcode && !secretEquals(livePasscode(s.passcode) ?? "", (passcode ?? "").trim())) return { gate: "code" };
  if (!s.waitingRoom) {
    // Kutish xonasi yo'q — kirishni belgilaymiz (keyingi chaqiriqlarda kod talab qilinmaydi)
    if (enroll) await admit(s.id, v.id);
    return { gate: "open" };
  }
  // Navbatga faqat haqiqiy kirish urinishida qo'shamiz (chat/so'rov kabi chaqiriqlar navbatni to'ldirmasin)
  if (!row && enroll) await db.insert(liveWaiting).values({ streamId: s.id, userId: v.id, status: "waiting" }).onConflictDoNothing();
  return { gate: "waiting" };
}

/** Kirgan odamni «qabul qilingan» deb belgilash (kodni bir marta kiritgach qayta so'ralmaydi) */
export async function admit(streamId: string, userId: string): Promise<void> {
  await db
    .insert(liveWaiting)
    .values({ streamId, userId, status: "approved" })
    .onConflictDoUpdate({ target: [liveWaiting.streamId, liveWaiting.userId], set: { status: "approved" } });
}

/** Boshlovchiga: navbatdagilar (eng eskisi birinchi) */
export async function waitingList(streamId: string, actor: Viewer): Promise<{ id: string; name: string; avatarUrl: string | null; at: number }[]> {
  await moderatedStream(streamId, actor);
  const rows = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl, at: liveWaiting.createdAt })
    .from(liveWaiting)
    .innerJoin(users, eq(users.id, liveWaiting.userId))
    .where(and(eq(liveWaiting.streamId, streamId), eq(liveWaiting.status, "waiting")))
    .orderBy(asc(liveWaiting.createdAt))
    .limit(100);
  return rows.map((r) => ({ id: r.id, name: r.name ?? "Ishtirokchi", avatarUrl: r.avatarUrl, at: r.at.getTime() }));
}

/** Ruxsat berish / rad etish. `userId === "*"` — navbatdagi hammasiga ruxsat */
export async function decideWaiting(streamId: string, actor: Viewer, userId: string, allow: boolean): Promise<{ count: number }> {
  await moderatedStream(streamId, actor);
  const status = allow ? "approved" : "denied";
  if (userId === "*") {
    if (!allow) throw new ApiError(400, "Hammani rad etish mumkin emas");
    const r = await db
      .update(liveWaiting)
      .set({ status })
      .where(and(eq(liveWaiting.streamId, streamId), eq(liveWaiting.status, "waiting")))
      .returning({ userId: liveWaiting.userId });
    return { count: r.length };
  }
  const r = await db
    .update(liveWaiting)
    .set({ status })
    .where(and(eq(liveWaiting.streamId, streamId), eq(liveWaiting.userId, userId)))
    .returning({ userId: liveWaiting.userId });
  if (!r.length) throw new ApiError(404, "Bu odam navbatda yo'q");
  return { count: 1 };
}

/**
 * Efir kodini ochiq ko'rinishda qaytaradi (boshlavchi/hammuallifga ko'rsatish va solishtirish uchun).
 * Eski yozuvlar shifrlanmagan bo'lishi mumkin — o'sha holda qiymatning o'zi qaytadi (orqaga moslik).
 */
export function livePasscode(stored: string | null | undefined): string | null {
  if (!stored) return null;
  return openSecret(stored, "live-passcode") ?? stored;
}

/** Kutish xonasi va kodni yoqish/o'chirish (boshlovchi, efir davomida ham) */
export async function setEntryRules(streamId: string, actor: Viewer, patch: { waitingRoom?: boolean; passcode?: string | null }): Promise<void> {
  const s = await moderatedStream(streamId, actor);
  const set: Partial<typeof liveStreams.$inferInsert> = {};
  if (patch.waitingRoom !== undefined) set.waitingRoom = patch.waitingRoom;
  if (patch.passcode !== undefined) {
    if (patch.passcode === null || patch.passcode === "") set.passcode = null;
    else {
      if (!PASSCODE_RE.test(patch.passcode)) throw new ApiError(422, "Kod 6–12 belgi, faqat harf va raqam", { passcode: "6–12 belgi" });
      // Bazada shifrlangan holda (boshlovchiga qayta ko'rsatish uchun ochiladi)
      set.passcode = sealSecret(patch.passcode, "live-passcode");
    }
  }
  if (Object.keys(set).length) await db.update(liveStreams).set(set).where(eq(liveStreams.id, s.id));
}

/* ------------------------------------------------------------------ */
/* Hammuallif (co-host)                                               */
/* ------------------------------------------------------------------ */

export async function listCohosts(streamId: string): Promise<string[]> {
  const rows = await db.query.liveCohosts.findMany({ where: eq(liveCohosts.streamId, streamId), columns: { userId: true } });
  return rows.map((r) => r.userId);
}

/** Hammuallif qilish / olib tashlash — FAQAT boshlovchi yoki sayt admini (hammuallif yangi hammuallif qo'shmaydi) */
export async function toggleCohost(streamId: string, actor: Viewer, userId: string): Promise<{ on: boolean }> {
  const s = await streamOr404(streamId);
  if (s.hostId !== actor.id && actor.role !== "admin") throw new ApiError(403, "Hammuallifni faqat boshlovchi tayinlaydi");
  if (userId === s.hostId) throw new ApiError(400, "Boshlovchi allaqachon to'liq huquqli");
  const had = await db.query.liveCohosts.findFirst({ where: and(eq(liveCohosts.streamId, streamId), eq(liveCohosts.userId, userId)) });
  if (had) {
    await db.delete(liveCohosts).where(and(eq(liveCohosts.streamId, streamId), eq(liveCohosts.userId, userId)));
    return { on: false };
  }
  // Yopiq jamoada hammuallif a'zo bo'lishi kerak
  const g = await groupOf(s);
  if (g.isPrivate) {
    const m = await getMembership(g.id, userId);
    if (!m || m.status !== "active") throw new ApiError(400, "Hammuallif jamoa a'zosi bo'lishi kerak");
  }
  await db.insert(liveCohosts).values({ streamId, userId }).onConflictDoNothing();
  return { on: true };
}

/* ------------------------------------------------------------------ */
/* Davomat                                                            */
/* ------------------------------------------------------------------ */

/**
 * «Tirik» signal: oxirgi 5 daqiqa ichida yozuv bo'lsa uni uzaytiradi, aks holda yangi sessiya ochadi.
 * Shu tufayli brauzer to'satdan yopilsa ham chiqish vaqti to'g'ri qoladi (oxirgi signal vaqti).
 */
export async function touchAttendance(streamId: string, userId: string): Promise<void> {
  const now = new Date();
  const last = await db.query.liveAttendance.findFirst({
    where: and(eq(liveAttendance.streamId, streamId), eq(liveAttendance.userId, userId)),
    orderBy: [desc(liveAttendance.lastSeenAt)],
  });
  if (last && now.getTime() - last.lastSeenAt.getTime() <= ATTEND_GAP_MS) {
    await db.update(liveAttendance).set({ lastSeenAt: now }).where(eq(liveAttendance.id, last.id));
    return;
  }
  await db.insert(liveAttendance).values({ id: uid(), streamId, userId, joinedAt: now, lastSeenAt: now });
}

export type AttendRow = { userId: string; name: string; username: string | null; sessions: number; firstAt: number; lastAt: number; minutes: number };

/** Davomat jadvali: har odam — bir qator (sessiyalar yig'indisi) */
export async function attendance(streamId: string, actor: Viewer): Promise<AttendRow[]> {
  await moderatedStream(streamId, actor, false);
  const rows = await db
    .select({
      userId: liveAttendance.userId,
      name: users.name,
      username: users.username,
      sessions: sql<number>`count(*)`,
      firstAt: sql<number>`min(${liveAttendance.joinedAt})`,
      lastAt: sql<number>`max(${liveAttendance.lastSeenAt})`,
      ms: sql<number>`sum(${liveAttendance.lastSeenAt} - ${liveAttendance.joinedAt})`,
    })
    .from(liveAttendance)
    .innerJoin(users, eq(users.id, liveAttendance.userId))
    .where(eq(liveAttendance.streamId, streamId))
    .groupBy(liveAttendance.userId, users.name, users.username)
    .orderBy(sql`sum(${liveAttendance.lastSeenAt} - ${liveAttendance.joinedAt}) desc`);
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name ?? "Ishtirokchi",
    username: r.username,
    sessions: Number(r.sessions),
    firstAt: Number(r.firstAt),
    lastAt: Number(r.lastAt),
    minutes: Math.max(1, Math.round(Number(r.ms ?? 0) / 60_000)),
  }));
}

/* ------------------------------------------------------------------ */
/* Kichik xonalar (breakout)                                          */
/* ------------------------------------------------------------------ */

export type BreakoutView = { id: string; name: string; position: number; members: { id: string; name: string }[] };

export async function breakouts(streamId: string): Promise<BreakoutView[]> {
  const rooms = await db.query.liveBreakouts.findMany({ where: eq(liveBreakouts.streamId, streamId), orderBy: [asc(liveBreakouts.position)] });
  if (!rooms.length) return [];
  const members = await db
    .select({ breakoutId: liveBreakoutMembers.breakoutId, id: users.id, name: users.name })
    .from(liveBreakoutMembers)
    .innerJoin(users, eq(users.id, liveBreakoutMembers.userId))
    .where(eq(liveBreakoutMembers.streamId, streamId));
  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    members: members.filter((m) => m.breakoutId === r.id).map((m) => ({ id: m.id, name: m.name ?? "Ishtirokchi" })),
  }));
}

/** Kichik xonalarni yaratish (avvalgilari o'rniga). Nomlar bo'sh bo'lsa «1-xona…» */
export async function createBreakouts(streamId: string, actor: Viewer, count: number, names: string[] = []): Promise<BreakoutView[]> {
  const s = await moderatedStream(streamId, actor);
  if (!Number.isInteger(count) || count < 2 || count > MAX_BREAKOUTS) throw new ApiError(422, `Kichik xonalar soni 2 – ${MAX_BREAKOUTS}`, { count: `2 – ${MAX_BREAKOUTS}` });
  await closeAllBreakoutRooms(s);
  await db.delete(liveBreakouts).where(eq(liveBreakouts.streamId, streamId));
  const rows = Array.from({ length: count }, (_, i) => ({
    id: uid(),
    streamId,
    name: (names[i] ?? "").trim().slice(0, 40) || `${i + 1}-xona`,
    position: i + 1,
  }));
  await db.insert(liveBreakouts).values(rows);
  await db.update(liveStreams).set({ breakoutOpen: false }).where(eq(liveStreams.id, streamId));
  return breakouts(streamId);
}

/** Ishtirokchini xonaga biriktirish (null — asosiy xonaga qaytarish) */
export async function assignBreakout(streamId: string, actor: Viewer, userId: string, breakoutId: string | null): Promise<void> {
  const s = await moderatedStream(streamId, actor);
  if (userId === s.hostId) throw new ApiError(400, "Boshlovchi xonalar orasida o'zi yuradi");
  await db.delete(liveBreakoutMembers).where(and(eq(liveBreakoutMembers.streamId, streamId), eq(liveBreakoutMembers.userId, userId)));
  if (breakoutId) {
    const r = await db.query.liveBreakouts.findFirst({ where: and(eq(liveBreakouts.id, breakoutId), eq(liveBreakouts.streamId, streamId)) });
    if (!r) throw new ApiError(404, "Kichik xona topilmadi");
    await db.insert(liveBreakoutMembers).values({ streamId, breakoutId, userId });
  }
  // Xonalar ochiq bo'lsa ishtirokchini uzamiz — qayta ulanib yangi xonaga tushadi
  if (s.breakoutOpen) await removeParticipant(s.room, userId).catch(() => undefined);
  if (s.breakoutOpen) await Promise.all((await db.query.liveBreakouts.findMany({ where: eq(liveBreakouts.streamId, streamId), columns: { position: true } })).map((b) => removeParticipant(breakoutRoom(streamId, b.position), userId).catch(() => undefined)));
}

/** Avtomatik taqsimlash: tomoshabinlarni teng bo'lib chiqadi */
export async function autoAssign(streamId: string, actor: Viewer, userIds: string[]): Promise<BreakoutView[]> {
  const s = await moderatedStream(streamId, actor);
  const rooms = await db.query.liveBreakouts.findMany({ where: eq(liveBreakouts.streamId, streamId), orderBy: [asc(liveBreakouts.position)] });
  if (!rooms.length) throw new ApiError(409, "Avval kichik xonalarni yarating");
  const list = [...new Set(userIds)].filter((u) => u !== s.hostId).slice(0, 500);
  await db.delete(liveBreakoutMembers).where(eq(liveBreakoutMembers.streamId, streamId));
  if (list.length) await db.insert(liveBreakoutMembers).values(list.map((userId, i) => ({ streamId, breakoutId: rooms[i % rooms.length].id, userId })));
  return breakouts(streamId);
}

/** Kichik xonalarni ochish / yopish. Yopilganda hamma asosiy xonaga qaytadi */
export async function setBreakoutOpen(streamId: string, actor: Viewer, open: boolean): Promise<void> {
  const s = await moderatedStream(streamId, actor);
  if (open) {
    const n = await db.$count(liveBreakouts, eq(liveBreakouts.streamId, streamId));
    if (!n) throw new ApiError(409, "Avval kichik xonalarni yarating");
  }
  await db.update(liveStreams).set({ breakoutOpen: open }).where(eq(liveStreams.id, streamId));
  if (open) {
    // Biriktirilganlarni asosiy xonadan uzamiz — ular o'z xonasiga qayta ulanadi
    const m = await db.query.liveBreakoutMembers.findMany({ where: eq(liveBreakoutMembers.streamId, streamId), columns: { userId: true } });
    await Promise.all(m.map((x) => removeParticipant(s.room, x.userId).catch(() => undefined)));
  } else {
    await closeAllBreakoutRooms(s);
  }
}

async function closeAllBreakoutRooms(s: LiveStream): Promise<void> {
  const rooms = await db.query.liveBreakouts.findMany({ where: eq(liveBreakouts.streamId, s.id), columns: { position: true } });
  await Promise.all(rooms.map((b) => closeRoom(breakoutRoom(s.id, b.position)).catch(() => undefined)));
}

/** Tomoshabin qaysi xonaga ulanadi: kichik xonalar ochiq va u biriktirilgan bo'lsa — kichik xona */
export async function roomFor(s: LiveStream, userId: string): Promise<{ room: string; breakout: string | null }> {
  if (!s.breakoutOpen || s.hostId === userId) return { room: s.room, breakout: null };
  const mine = await db
    .select({ name: liveBreakouts.name, position: liveBreakouts.position })
    .from(liveBreakoutMembers)
    .innerJoin(liveBreakouts, eq(liveBreakouts.id, liveBreakoutMembers.breakoutId))
    .where(and(eq(liveBreakoutMembers.streamId, s.id), eq(liveBreakoutMembers.userId, userId)))
    .limit(1);
  const b = mine[0];
  return b ? { room: breakoutRoom(s.id, b.position), breakout: b.name } : { room: s.room, breakout: null };
}

/** Boshlovchi kichik xonaga kiradi (position bo'yicha) */
export async function hostBreakoutRoom(streamId: string, actor: Viewer, position: number | null): Promise<string> {
  const s = await moderatedStream(streamId, actor);
  if (position === null) return s.room;
  const b = await db.query.liveBreakouts.findFirst({ where: and(eq(liveBreakouts.streamId, streamId), eq(liveBreakouts.position, position)) });
  if (!b) throw new ApiError(404, "Kichik xona topilmadi");
  return breakoutRoom(streamId, b.position);
}

/* ------------------------------------------------------------------ */
/* Subtitr / transkript                                               */
/* ------------------------------------------------------------------ */

/** Sahnadagi odamning nutqi matnga aylantirilib saqlanadi (brauzer Web Speech API) */
export async function saveCaption(streamId: string, v: Viewer, body: string, atSec: number): Promise<void> {
  const s = await streamOr404(streamId);
  if (s.status !== "live") return;
  const t = body.trim().replace(/\s+/g, " ").slice(0, CAPTION_MAX);
  if (!t) return;
  await db.insert(liveCaptions).values({ id: uid(), streamId, userId: v.id, body: t, atSec: Math.max(0, Math.min(Math.floor(atSec), 86_400)) });
}

export type CaptionRow = { id: string; name: string; body: string; atSec: number };

/** Transkript: efir subtitrlari ketma-ket (yozuv bilan birga ko'riladi) */
export async function transcript(streamId: string, limit = 2000): Promise<CaptionRow[]> {
  const rows = await db
    .select({ id: liveCaptions.id, name: users.name, body: liveCaptions.body, atSec: liveCaptions.atSec })
    .from(liveCaptions)
    .innerJoin(users, eq(users.id, liveCaptions.userId))
    .where(eq(liveCaptions.streamId, streamId))
    .orderBy(asc(liveCaptions.createdAt))
    .limit(limit);
  return rows.map((r) => ({ id: r.id, name: r.name ?? "Ishtirokchi", body: r.body, atSec: r.atSec }));
}

/** Efir o'chirilganda bog'liq qatorlar CASCADE bilan ketadi; bu yerda faqat navbatni tozalaymiz */
export async function clearWaiting(streamId: string): Promise<void> {
  await db.delete(liveWaiting).where(eq(liveWaiting.streamId, streamId));
}

/** Bir nechta efir uchun hammuallif bo'lgan foydalanuvchilar (ro'yxatni bir so'rovda olish) */
export async function cohostMap(streamIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!streamIds.length) return out;
  const rows = await db.query.liveCohosts.findMany({ where: inArray(liveCohosts.streamId, streamIds), columns: { streamId: true, userId: true } });
  for (const r of rows) out.set(r.streamId, [...(out.get(r.streamId) ?? []), r.userId]);
  return out;
}
