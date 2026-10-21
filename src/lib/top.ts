import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { specialists, topAwards } from "@/lib/db/schema";
import { briefUsers, type UserBrief } from "@/lib/groups/service";
import { notify } from "@/lib/notifications";
import { topCreatorsBetween, type TopCreator } from "@/lib/reels";
import { uid } from "@/lib/utils";

/** Oylik TOP: g'oliblar soni va premium muddati (keyingi oy oxirigacha). Vaqt — Toshkent (UTC+5, yozgi vaqt yo'q) */
export const TOP_AWARD_COUNT = 3;
const TZ_OFFSET = 5 * 3_600_000;
/** E'lon vaqti: oyning oxirgi kuni Toshkent 08:00 (cron 03:00 UTC) */
const PUBLISH_HOUR = 8;

const MONTHS_UZ = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

export function monthKeyOf(ms: number): string {
  const d = new Date(ms + TZ_OFFSET);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** Oy chegaralari (UTC ms): [from, to) */
export function monthRange(key: string): { from: Date; to: Date } {
  const [y, m] = key.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1) - TZ_OFFSET), to: new Date(Date.UTC(y, m, 1) - TZ_OFFSET) };
}
function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(Date.UTC(y, m, 1));
}
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${y}-yil ${MONTHS_UZ[m - 1]}`;
}
/** Bugun (Toshkent) oyning oxirgi kunimi */
export function isLastDayOfMonth(now: number): boolean {
  return monthKeyOf(now) !== monthKeyOf(now + 86_400_000);
}
/** Joriy oy reytingi e'lon qilinadigan vaqt (ms): oyning oxirgi kuni 08:00 Toshkent */
export function publishAtOf(key: string): number {
  const { to } = monthRange(key);
  return to.getTime() - 86_400_000 + PUBLISH_HOUR * 3_600_000;
}

/** Joriy oyning (hozirgacha) jonli reytingi — faqat admin ko'radi */
export function currentMonthTop(limit = 30, now = Date.now()): Promise<TopCreator[]> {
  const { from } = monthRange(monthKeyOf(now));
  return topCreatorsBetween(from, new Date(now + 1), limit);
}
/** Doimiy (butun vaqt) reyting — admin */
export function allTimeTop(limit = 30, now = Date.now()): Promise<TopCreator[]> {
  return topCreatorsBetween(new Date(0), new Date(now + 1), limit);
}

export interface AwardView {
  rank: number;
  score: number;
  likes: number;
  comments: number;
  saves: number;
  views: number;
  followers: number;
  author: UserBrief;
  category: string | null;
}
export interface PublishedMonth {
  month: string;
  label: string;
  publishedAt: number;
  premiumUntil: number | null;
  winners: AwardView[];
}

async function toViews(rows: Array<typeof topAwards.$inferSelect>): Promise<AwardView[]> {
  const ids = rows.map((r) => r.userId);
  const [brief, sp] = await Promise.all([briefUsers(ids), ids.length ? db.select({ userId: specialists.userId, category: specialists.category }).from(specialists).where(inArray(specialists.userId, ids)) : Promise.resolve([])]);
  const cat = new Map(sp.map((s) => [s.userId, s.category]));
  return rows
    .filter((r) => brief.has(r.userId))
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({ rank: r.rank, score: r.score, likes: r.likes, comments: r.comments, saves: r.saves, views: r.views, followers: r.followers, author: brief.get(r.userId) as UserBrief, category: cat.get(r.userId) ?? null }));
}

/** E'lon qilingan oylar (yangisi birinchi) g'oliblari bilan */
export async function publishedMonths(limit = 12): Promise<PublishedMonth[]> {
  const months = await db.selectDistinct({ month: topAwards.month }).from(topAwards).orderBy(desc(topAwards.month)).limit(limit);
  if (!months.length) return [];
  const rows = await db.select().from(topAwards).where(inArray(topAwards.month, months.map((m) => m.month)));
  return Promise.all(
    months.map(async ({ month }) => {
      const mine = rows.filter((r) => r.month === month);
      return { month, label: monthLabel(month), publishedAt: Math.max(...mine.map((r) => r.publishedAt.getTime())), premiumUntil: mine[0]?.premiumUntil?.getTime() ?? null, winners: await toViews(mine) };
    }),
  );
}

/**
 * Oy reytingini e'lon qiladi: TOP-3 yoziladi, g'oliblarga keyingi oy oxirigacha premium beriladi (awardPremiumUntil) va xabar yuboriladi.
 * Bir oy ikki marta e'lon qilinmaydi (noyob indeks + oldindan tekshiruv). Natija: g'oliblar soni yoki null (allaqachon e'lon qilingan / g'olib yo'q).
 */
export async function publishMonthlyTop(key: string): Promise<{ published: number } | { skipped: "exists" | "empty" }> {
  const exists = await db.query.topAwards.findFirst({ where: eq(topAwards.month, key), columns: { id: true } });
  if (exists) return { skipped: "exists" };
  const { from, to } = monthRange(key);
  const top = (await topCreatorsBetween(from, to, TOP_AWARD_COUNT)).slice(0, TOP_AWARD_COUNT);
  if (!top.length) return { skipped: "empty" };
  // Premium: e'londan keyingi oyning oxirigacha
  const premiumUntil = monthRange(nextMonthKey(key)).to;
  try {
    await db.insert(topAwards).values(top.map((t) => ({ id: uid(), month: key, rank: t.rank, userId: t.author.id, score: t.score, likes: t.likes, comments: t.comments, saves: t.saves, views: t.views, followers: t.followers, premiumUntil })));
  } catch {
    return { skipped: "exists" }; // parallel cron — noyob indeks to'sdi
  }
  for (const t of top) {
    await db
      .update(specialists)
      .set({ awardPremiumUntil: sql`max(coalesce(${specialists.awardPremiumUntil}, 0), ${premiumUntil.getTime()})` })
      .where(eq(specialists.userId, t.author.id));
    await notify(t.author.id, "top_award", `Tabriklaymiz! ${monthLabel(key)} TOP-${t.rank}`, `Siz oyning eng yaxshi ijodkorlaridan biri bo'ldingiz. Premium imtiyoz ${new Date(premiumUntil.getTime() - 1 + TZ_OFFSET).toISOString().slice(0, 10)} gacha — post va story cheklovlari yo'q.`, "/top").catch(() => undefined);
  }
  return { published: top.length };
}

/** Kunlik cron: oyning oxirgi kuni bo'lsa joriy oy reytingini e'lon qiladi (boshqa kunlarda hech narsa) */
export async function runMonthlyTop(now = Date.now()): Promise<{ month: string; result: Awaited<ReturnType<typeof publishMonthlyTop>> } | null> {
  if (!isLastDayOfMonth(now)) return null;
  const month = monthKeyOf(now);
  return { month, result: await publishMonthlyTop(month) };
}
