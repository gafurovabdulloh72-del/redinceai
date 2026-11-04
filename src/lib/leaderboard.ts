import "server-only";
import { unstable_cache } from "next/cache";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { topCreatorsBetween, type TopCreator } from "@/lib/reels";

/**
 * JONLI REYTING (2026-11-04): /top sahifasidagi «Hafta faollari» — mukofot EMAS, davr bo'yicha jonli ball.
 * Davr: hafta (so'nggi 7 kun) yoki oy (so'nggi 30 kun) — sirpanuvchi oynalar; oldingi oyna bilan taqqoslab
 * o'rin harakati (▲/▼/yangi) chiqariladi. Filtr: kasb (`CATEGORIES` slug) va hudud (`REGIONS` slug).
 * Natija `unstable_cache` bilan 10 daqiqa (kalit: davr + filtrlar). Ball formulasi — `topCreatorsBetween` (reels.ts).
 */
export type LivePeriod = "hafta" | "oy";
export const LIVE_TOP_SIZE = 10;
/** Oynalarni hisoblashda ko'rib chiqiladigan maksimal ijodkor (filtrdan keyin 10 ta qolishi uchun keng olinadi) */
const POOL = 300;
const DAY = 86_400_000;

export interface LiveRow extends TopCreator {
  /** Oldingi davrdagi o'rin (yo'q — null = yangi) */
  prevRank: number | null;
  /** Ijobiy — ko'tarildi, manfiy — tushdi, 0 — joyida, null — yangi */
  move: number | null;
}

export interface LiveLeaderboard {
  period: LivePeriod;
  kasb: string | null;
  hudud: string | null;
  from: number;
  to: number;
  rows: LiveRow[];
  /** Filtrdan o'tgan BARCHA ijodkorlar o'rni (userId → rank) — «Siz: N-o'rin» uchun */
  ranks: Record<string, number>;
  total: number;
}

export function normalizePeriod(v: unknown): LivePeriod {
  return v === "oy" ? "oy" : "hafta";
}
export function normalizeKasb(v: unknown): string | null {
  return typeof v === "string" && CATEGORY_BY_SLUG[v] ? v : null;
}
export function normalizeHudud(v: unknown): string | null {
  return typeof v === "string" && REGION_BY_SLUG[v] ? v : null;
}

function filterRows(rows: TopCreator[], kasb: string | null, hudud: string | null): TopCreator[] {
  return rows.filter((r) => (!kasb || r.author.category === kasb) && (!hudud || r.author.regionSlug === hudud)).map((r, i) => ({ ...r, rank: i + 1 }));
}

async function compute(period: LivePeriod, kasb: string | null, hudud: string | null): Promise<LiveLeaderboard> {
  const now = Date.now();
  const span = (period === "oy" ? 30 : 7) * DAY;
  const from = now - span;
  const [cur, prev] = await Promise.all([topCreatorsBetween(new Date(from), new Date(now + 1), POOL), topCreatorsBetween(new Date(from - span), new Date(from), POOL)]);
  const curF = filterRows(cur, kasb, hudud);
  const prevF = filterRows(prev, kasb, hudud);
  const prevRank = new Map(prevF.map((r) => [r.author.id, r.rank]));
  const ranks: Record<string, number> = {};
  for (const r of curF) ranks[r.author.id] = r.rank;
  const rows: LiveRow[] = curF.slice(0, LIVE_TOP_SIZE).map((r) => {
    const p = prevRank.get(r.author.id) ?? null;
    return { ...r, prevRank: p, move: p === null ? null : p - r.rank };
  });
  return { period, kasb, hudud, from, to: now, rows, ranks, total: curF.length };
}

const cached = unstable_cache(compute, ["top-live-v1"], { revalidate: 600 });

/** Jonli reyting — 10 daqiqa kesh (davr + kasb + hudud kaliti bilan) */
export function liveLeaderboard(period: LivePeriod, kasb: string | null, hudud: string | null): Promise<LiveLeaderboard> {
  return cached(period, kasb, hudud);
}
