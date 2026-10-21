import "server-only";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { musicTracks, type PostMusic } from "@/lib/db/schema";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { EXTERNAL_AUDIO_RE } from "@/components/chat/attachments";
import { uid } from "@/lib/utils";

export interface TrackView {
  id: string;
  url: string;
  title: string;
  artist: string | null;
  usesCount: number;
  /** Muqova (faqat ommaviy katalog natijalarida) */
  cover?: string | null;
  source: "library" | "catalog";
}

const toView = (r: typeof musicTracks.$inferSelect): TrackView => ({ id: r.id, url: r.url, title: r.title, artist: r.artist, usesCount: r.usesCount, source: "library" });

/** Ommaviy musiqa katalogi (iTunes Search API, kalitsiz): 30 soniyalik namunalar. Xato/sekin bo'lsa — bo'sh (kutubxona natijasi baribir qaytadi) */
async function catalogSearch(q: string, limit: number): Promise<TrackView[]> {
  try {
    const res = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({ term: q, media: "music", entity: "song", limit: String(limit) })}`, { signal: AbortSignal.timeout(4000), next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const j = (await res.json()) as { results?: Array<{ trackId?: number; trackName?: string; artistName?: string; previewUrl?: string; artworkUrl100?: string }> };
    const out: TrackView[] = [];
    for (const r of j.results ?? []) {
      if (!r.previewUrl || !r.trackName || !EXTERNAL_AUDIO_RE.test(r.previewUrl)) continue;
      out.push({ id: `c${r.trackId ?? out.length}`, url: r.previewUrl, title: r.trackName.slice(0, 80), artist: r.artistName?.slice(0, 80) ?? null, usesCount: 0, cover: r.artworkUrl100?.replace("100x100", "200x200") ?? null, source: "catalog" });
    }
    return out;
  } catch {
    return [];
  }
}

/** Qidiruv: avval saytdagi kutubxona (ommabop birinchi), so'ng ommaviy katalog (internet); so'rovsiz — faqat ommabop kutubxona treklari */
export async function searchTracks(q: string, limit = 30): Promise<TrackView[]> {
  const needle = q.trim().toLowerCase().replace(/[%_\\]/g, "");
  const where = needle
    ? and(eq(musicTracks.isHidden, false), or(like(sql`lower(${musicTracks.title})`, `%${needle}%`), like(sql`lower(coalesce(${musicTracks.artist}, ''))`, `%${needle}%`)))
    : eq(musicTracks.isHidden, false);
  const [rows, remote] = await Promise.all([db.select().from(musicTracks).where(where).orderBy(desc(musicTracks.usesCount), desc(musicTracks.createdAt)).limit(limit), needle.length >= 2 ? catalogSearch(needle, 25) : Promise.resolve([])]);
  const seen = new Set(rows.map((r) => r.url));
  return [...rows.map(toView), ...remote.filter((t) => !seen.has(t.url))];
}

/**
 * Story/postga qo'yilayotgan musiqani tasdiqlaydi: kutubxonadagi trek (yashirilmagan) — hamma ishlata oladi, hisoblagich oshadi;
 * aks holda fayl shu foydalanuvchining o'z yuklamasi bo'lishi shart va u kutubxonaga qo'shiladi.
 */
export async function useMusic(userId: string, m: PostMusic): Promise<void> {
  const row = await db.query.musicTracks.findFirst({ where: eq(musicTracks.url, m.url) });
  const external = EXTERNAL_AUDIO_RE.test(m.url);
  if (row) {
    if (row.isHidden && !external) await assertOwnUploads(userId, [m.url], [], "media");
    await db.update(musicTracks).set({ usesCount: sql`${musicTracks.usesCount} + 1` }).where(eq(musicTracks.id, row.id));
    return;
  }
  if (!external) await assertOwnUploads(userId, [m.url], [], "media");
  await db
    .insert(musicTracks)
    .values({ id: uid(), url: m.url, title: m.title.slice(0, 80), artist: m.artist?.slice(0, 80) || null, uploaderId: external ? null : userId, usesCount: 1 })
    .onConflictDoNothing();
}

export async function listTracksAdmin(): Promise<Array<TrackView & { isHidden: boolean; createdAt: number; uploaderId: string | null }>> {
  const rows = await db.select().from(musicTracks).orderBy(desc(musicTracks.usesCount), desc(musicTracks.createdAt)).limit(1000);
  return rows.map((r) => ({ ...toView(r), isHidden: r.isHidden, createdAt: r.createdAt.getTime(), uploaderId: r.uploaderId }));
}

export async function setTrackHidden(id: string, isHidden: boolean): Promise<void> {
  await db.update(musicTracks).set({ isHidden }).where(eq(musicTracks.id, id));
}
