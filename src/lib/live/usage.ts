import "server-only";
import { and, gt, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { callInvites, liveAttendance, liveStreams, mentorSlots } from "@/lib/db/schema";

/**
 * LiveKit sarfi (admin «Tizim holati», 2026-11-03): LiveKit Cloud o'z sarfini API orqali bermaydi, shuning uchun
 * o'z jadvallarimizdan hisoblaymiz — ishtirokchi-daqiqa (participant-minutes), LiveKit narxlashuvining asosiy birligi:
 *  - efir tomoshabinlari: `live_attendance` (joinedAt → lastSeenAt, 60 s «tirik» signal) — oy oynasiga qirqiladi;
 *  - efir boshlovchisi: `live_streams` (startedAt → endedAt yoki hozir);
 *  - DM qo'ng'iroqlari: `call_invites` (answeredAt → endedAt) × 2 ishtirokchi;
 *  - 1:1 konsultatsiya: `mentor_slots` status=booked, startsAt + durationMin × 2 (taxmin — davomat yozilmaydi).
 * Trafik bahosi: ~1 ishtirokchi-daqiqa ≈ 9 MB (720p ~1.2 Mbit/s; ovozli qo'ng'iroq ancha kam — konservativ).
 * Limit: env LIVEKIT_MONTHLY_GB (standart 50 — LiveKit Cloud bepul rejasining taxminiy chegarasi; pullik rejada oshiring).
 */
export const MB_PER_PARTICIPANT_MIN = 9;
export const LIVEKIT_MONTHLY_GB = Math.max(1, Number(process.env.LIVEKIT_MONTHLY_GB) || 50);
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Toshkent UTC+5

export type LiveKitUsage = {
  month: string;
  minutes: { viewers: number; hosts: number; calls: number; consults: number; total: number };
  streams: number;
  calls: number;
  estGb: number;
  limitGb: number;
  pct: number;
  prevMonthMinutes: number;
};

/** Toshkent bo'yicha oy boshi (UTC ms) */
function monthStart(now: number, shift = 0): number {
  const d = new Date(now + TZ_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + shift, 1) - TZ_OFFSET_MS;
}

async function minutesBetween(from: number, to: number) {
  const clampSql = (start: unknown, end: unknown) => sql<number>`coalesce(sum(max(0, min(coalesce(${end}, ${to}), ${to}) - max(${start}, ${from}))), 0) / 60000.0`;
  const [[v], [h], [c], [k], [s], [cc]] = await Promise.all([
    db.select({ m: clampSql(liveAttendance.joinedAt, liveAttendance.lastSeenAt) }).from(liveAttendance).where(and(gt(liveAttendance.lastSeenAt, new Date(from)), sql`${liveAttendance.joinedAt} < ${to}`)),
    db.select({ m: clampSql(liveStreams.startedAt, liveStreams.endedAt) }).from(liveStreams).where(and(sql`coalesce(${liveStreams.endedAt}, ${to}) > ${from}`, sql`${liveStreams.startedAt} < ${to}`)),
    db.select({ m: clampSql(callInvites.answeredAt, callInvites.endedAt) }).from(callInvites).where(and(isNotNull(callInvites.answeredAt), sql`coalesce(${callInvites.endedAt}, ${to}) > ${from}`, sql`${callInvites.answeredAt} < ${to}`)),
    db.select({ m: sql<number>`coalesce(sum(${mentorSlots.durationMin}), 0)` }).from(mentorSlots).where(and(sql`${mentorSlots.status} = 'booked'`, sql`${mentorSlots.startsAt} >= ${from}`, sql`${mentorSlots.startsAt} < ${Math.min(to, Date.now())}`)),
    db.select({ n: sql<number>`count(*)` }).from(liveStreams).where(and(sql`${liveStreams.startedAt} >= ${from}`, sql`${liveStreams.startedAt} < ${to}`)),
    db.select({ n: sql<number>`count(*)` }).from(callInvites).where(and(isNotNull(callInvites.answeredAt), sql`${callInvites.answeredAt} >= ${from}`, sql`${callInvites.answeredAt} < ${to}`)),
  ]);
  const viewers = Math.round(Number(v.m));
  const hosts = Math.round(Number(h.m));
  const calls = Math.round(Number(c.m) * 2);
  const consults = Math.round(Number(k.m) * 2);
  return { viewers, hosts, calls, consults, total: viewers + hosts + calls + consults, streams: Number(s.n), callCount: Number(cc.n) };
}

export async function liveKitUsage(now = Date.now()): Promise<LiveKitUsage> {
  const from = monthStart(now);
  const next = monthStart(now, 1);
  const prevFrom = monthStart(now, -1);
  const [cur, prev] = await Promise.all([minutesBetween(from, next), minutesBetween(prevFrom, from)]);
  const estGb = Math.round((cur.total * MB_PER_PARTICIPANT_MIN) / 1024 * 100) / 100;
  const d = new Date(from + TZ_OFFSET_MS);
  return {
    month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    minutes: { viewers: cur.viewers, hosts: cur.hosts, calls: cur.calls, consults: cur.consults, total: cur.total },
    streams: cur.streams,
    calls: cur.callCount,
    estGb,
    limitGb: LIVEKIT_MONTHLY_GB,
    pct: Math.min(999, Math.round((estGb / LIVEKIT_MONTHLY_GB) * 100)),
    prevMonthMinutes: prev.total,
  };
}
