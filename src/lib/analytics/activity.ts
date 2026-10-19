import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userActivity } from "@/lib/db/schema";

const DAY_MS = 86_400_000;
/** Toshkent (UTC+5) — server va brauzerda bir xil kun kaliti */
const TZ = 5 * 3_600_000;

/** ms → Toshkent kun kaliti (floor) */
export const tashkentDay = (ms: number): number => Math.floor((ms + TZ) / DAY_MS);
/** Kun kaliti → o'sha kunning 00:00 (Toshkent) ms'da */
export const dayStartMs = (day: number): number => day * DAY_MS - TZ;

/**
 * Faollikni yozib boradi — auth «touch» bloki (sessiya lastSeenAt ≤5 daqiqada bir yangilanganda) chaqiradi.
 * `prevMs` — shu sessiyaning avvalgi lastSeenAt'i; oradagi vaqt touch oynasi (≤6 daq) ichida bo'lsa uzluksiz
 * deb hisoblanadi va qo'shiladi, aks holda «yangi kelish» (1 daqiqa). 30 daqiqadan uzun tanaffus — yangi tashrif.
 * Fire-and-forget: xatolik so'rovni sekinlashtirmasin.
 */
export async function recordActivity(userId: string, prevMs: number, nowMs: number): Promise<void> {
  const gapMin = (nowMs - prevMs) / 60_000;
  const add = Math.max(1, gapMin > 0 && gapMin <= 6 ? Math.round(gapMin) : 1);
  const visit = !Number.isFinite(gapMin) || gapMin > 30 ? 1 : 0;
  const day = tashkentDay(nowMs);
  await db
    .insert(userActivity)
    .values({ userId, day, minutes: add, visits: visit })
    .onConflictDoUpdate({
      target: [userActivity.userId, userActivity.day],
      set: { minutes: sql`${userActivity.minutes} + ${add}`, visits: sql`${userActivity.visits} + ${visit}` },
    })
    .catch(() => undefined);
}
