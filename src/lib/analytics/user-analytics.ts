import { count, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { dmMessages, groupMessages, messages, orders, postComments, postLikes, posts, userActivity, users } from "@/lib/db/schema";
import { tashkentDay, dayStartMs } from "./activity";
import type { UserAnalytics } from "./types";

export type { UserAnalytics } from "./types";

const TZ = 5 * 3_600_000;
/** Kun kaliti → "DD.MM" (Toshkent) */
function dayLabel(day: number): string {
  const d = new Date(dayStartMs(day) + TZ); // UTC ko'rinishida Toshkent sana komponentlari
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Bitta COUNT(*) natijasini oladi */
async function one(q: Promise<{ n: number }[]>): Promise<number> {
  return q.then((r) => Number(r[0]?.n ?? 0)).catch(() => 0);
}

/**
 * Admin: bitta foydalanuvchining to'liq faollik tahlili — faol kunlar, taqribiy vaqt (hafta/oy/jami),
 * tashriflar, o'rtachalar, 30 kunlik grafik va asosiy faoliyat (post/buyurtma/xabar/izoh/reaksiya).
 * Vaqt `user_activity` (auth touch) dan; faoliyat jami jadvallardan.
 */
export async function userAnalytics(userId: string): Promise<UserAnalytics | null> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, name: true, role: true, createdAt: true, lastSeenAt: true, lastLoginAt: true },
  });
  if (!u) return null;

  const today = tashkentDay(Date.now());
  const weekFrom = today - 6; // so'nggi 7 kun
  const monthFrom = today - 29; // so'nggi 30 kun
  const seriesFrom = today - 29;

  const [actRows, orderMe, dmMe, grpMe, chatMe] = await Promise.all([
    db.select({ day: userActivity.day, minutes: userActivity.minutes, visits: userActivity.visits }).from(userActivity).where(eq(userActivity.userId, userId)),
    // Buyurtmalar: mijoz yoki mutaxassis sifatida
    one(db.select({ n: count() }).from(orders).where(or(eq(orders.clientId, userId), eq(orders.specialistId, userId)))),
    one(db.select({ n: count() }).from(dmMessages).where(eq(dmMessages.senderId, userId))),
    one(db.select({ n: count() }).from(groupMessages).where(eq(groupMessages.senderId, userId))),
    one(db.select({ n: count() }).from(messages).where(eq(messages.senderId, userId))),
  ]);
  const [postN, commentN, reactionN] = await Promise.all([
    one(db.select({ n: count() }).from(posts).where(eq(posts.authorId, userId))),
    one(db.select({ n: count() }).from(postComments).where(eq(postComments.authorId, userId))),
    one(db.select({ n: count() }).from(postLikes).where(eq(postLikes.userId, userId))),
  ]);

  // user_activity yig'indilari
  let tMin = 0,
    tVisits = 0,
    wMin = 0,
    wVisits = 0,
    wDays = 0,
    mMin = 0,
    mVisits = 0,
    mDays = 0;
  const byDay = new Map<number, number>();
  for (const r of actRows) {
    tMin += r.minutes;
    tVisits += r.visits;
    byDay.set(r.day, r.minutes);
    if (r.day >= weekFrom) {
      wMin += r.minutes;
      wVisits += r.visits;
      wDays += 1;
    }
    if (r.day >= monthFrom) {
      mMin += r.minutes;
      mVisits += r.visits;
      mDays += 1;
    }
  }
  const totalDays = actRows.length;

  const series: UserAnalytics["series"] = [];
  for (let d = seriesFrom; d <= today; d++) series.push({ day: d, minutes: byDay.get(d) ?? 0, label: dayLabel(d) });

  const messagesN = dmMe + grpMe + chatMe;
  const activity = [
    { key: "messages", label: "Xabarlar", count: messagesN },
    { key: "posts", label: "Postlar", count: postN },
    { key: "orders", label: "Buyurtmalar", count: orderMe },
    { key: "reactions", label: "Reaksiyalar", count: reactionN },
    { key: "comments", label: "Izohlar", count: commentN },
  ]
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    user: { id: u.id, name: u.name, role: u.role, createdAt: u.createdAt.getTime(), lastSeenAt: u.lastSeenAt?.getTime() ?? null, lastLoginAt: u.lastLoginAt?.getTime() ?? null },
    activeDays: { total: totalDays, week: wDays, month: mDays },
    minutes: { total: tMin, week: wMin, month: mMin },
    visits: { total: tVisits, week: wVisits, month: mVisits },
    avg: {
      minutesPerActiveDay: totalDays ? Math.round(tMin / totalDays) : 0,
      daysPerWeek: mDays ? Math.round((mDays / 30) * 7 * 10) / 10 : 0,
    },
    series,
    activity,
  };
}
