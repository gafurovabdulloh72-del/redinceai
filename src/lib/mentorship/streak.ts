import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonCompletions } from "@/lib/db/schema";

/** Toshkent kuni (UTC+5) — kun chegarasi foydalanuvchi uchun tabiiy bo'lsin */
const TZ_MS = 5 * 3600 * 1000;
const DAY_MS = 86_400_000;
export const dayIndex = (ts: number) => Math.floor((ts + TZ_MS) / DAY_MS);

export interface LearningStreak {
  /** Ketma-ket kunlar (bugun yoki kecha tugagan zanjir; aks holda 0) */
  current: number;
  /** Eng uzun zanjir (so'nggi 90 kun ichida) */
  best: number;
  /** Bugun kamida bitta dars tugatilganmi */
  todayDone: boolean;
  /** Joriy hafta (Du..Ya) — qaysi kunlarda dars tugatilgan */
  week: boolean[];
  /** So'nggi 30 kunda faol kunlar soni */
  activeDays30: number;
}

/**
 * O'quv seriyasi (Duolingo/Coursera odati): har kuni kamida bitta dars tugatilsa zanjir davom etadi.
 * Faqat lesson_completions'dan hisoblanadi — qo'shimcha jadval yo'q, 90 kunlik oyna.
 */
export async function learningStreak(userId: string, now = Date.now()): Promise<LearningStreak> {
  const since = new Date(now - 90 * DAY_MS);
  const rows = await db.query.lessonCompletions.findMany({
    where: and(eq(lessonCompletions.userId, userId), gte(lessonCompletions.completedAt, since)),
    columns: { completedAt: true },
    orderBy: [desc(lessonCompletions.completedAt)],
    limit: 2000,
  });
  const days = new Set(rows.map((r) => dayIndex(r.completedAt.getTime())));
  const today = dayIndex(now);

  // Joriy zanjir: bugundan (yoki bugun hali yo'q bo'lsa kechadan) orqaga
  let current = 0;
  let cursor = days.has(today) ? today : today - 1;
  while (days.has(cursor)) {
    current++;
    cursor--;
  }

  // Eng uzun zanjir
  let best = 0;
  const sorted = [...days].sort((a, b) => a - b);
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  // Hafta (Du..Ya): 1970-01-01 — payshanba (dayIndex 0 → 4-kun, Du=0 bo'lsa indeks 3)
  const weekday = (((today + 3) % 7) + 7) % 7; // 0=Du … 6=Ya
  const monday = today - weekday;
  const week = Array.from({ length: 7 }, (_, i) => days.has(monday + i));

  const activeDays30 = [...days].filter((d) => d > today - 30).length;
  return { current, best: Math.max(best, current), todayDone: days.has(today), week, activeDays30 };
}
