import "server-only";
import { and, asc, desc, eq, gt, isNull, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { challengeEntries, challenges, challengeVotes, posts, specialists, users, type Challenge, type FileAttachment } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { isVideoAttachment } from "@/components/chat/attachments";
import { notify } from "@/lib/notifications";
import { uid } from "@/lib/utils";

/**
 * Konkurslar (2026-11-01, KEYINGI-REJA 6): haftalik ijod challenge.
 * Qoidalar: ishtirok — o'zining OMMAVIY, media'li PROFIL posti (jamoa posti emas), har konkursda 1 ta;
 * ovoz — kirgan foydalanuvchi, har konkursda 1 ta (qayta bosish — bekor, boshqasiga bosish — ko'chadi),
 * o'z ishiga ovoz berib bo'lmaydi. Muddat tugagach kunlik cron g'olibni ovozlar bo'yicha tanlaydi
 * (teng bo'lsa — ertaroq qo'shilgan ish) va egasiga bildirishnoma yuboradi.
 */

export interface ChallengeCard {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  startsAt: number;
  endsAt: number;
  entriesCount: number;
  /** open — davom etyapti; soon — hali boshlanmagan; done — tugagan */
  state: "open" | "soon" | "done";
  winner: { name: string; avatarUrl: string | null; slug: string | null } | null;
}

export interface ChallengeEntryView {
  id: string;
  votesCount: number;
  createdAt: number;
  author: { id: string; name: string; avatarUrl: string | null; slug: string | null };
  post: { id: string; body: string; thumbUrl: string | null; isVideo: boolean; count: number };
  mine: boolean;
  votedByMe: boolean;
  isWinner: boolean;
}

export interface ChallengeDetail extends ChallengeCard {
  entries: ChallengeEntryView[];
  myEntryId: string | null;
  myVoteEntryId: string | null;
}

const stateOf = (c: Pick<Challenge, "startsAt" | "endsAt">, now: number): ChallengeCard["state"] =>
  now < c.startsAt.getTime() ? "soon" : now <= c.endsAt.getTime() ? "open" : "done";

/** Post mediasidan plitka: birinchi rasm yoki video posteri */
function tileOfMedia(media: FileAttachment[]): { thumbUrl: string | null; isVideo: boolean } {
  const video = media.find((m) => isVideoAttachment(m));
  if (video) return { thumbUrl: video.poster ?? media.find((m) => !isVideoAttachment(m))?.url ?? null, isVideo: true };
  return { thumbUrl: media[0]?.url ?? null, isVideo: false };
}

async function winnerBrief(entryId: string | null) {
  if (!entryId) return null;
  const [w] = await db
    .select({ name: users.name, avatarUrl: users.avatarUrl, slug: specialists.slug })
    .from(challengeEntries)
    .innerJoin(users, eq(users.id, challengeEntries.userId))
    .leftJoin(specialists, eq(specialists.userId, challengeEntries.userId))
    .where(eq(challengeEntries.id, entryId))
    .limit(1);
  return w ?? null;
}

/** Ro'yxat: avval ochiq/kutilayotgan (tugashiga yaqinlari oldin), keyin yakunlanganlar (yangi avval) */
export async function listChallenges(): Promise<ChallengeCard[]> {
  const now = Date.now();
  const rows = await db.query.challenges.findMany({ orderBy: [desc(challenges.endsAt)], limit: 40 });
  const cards = await Promise.all(
    rows.map(async (c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      coverUrl: c.coverUrl,
      startsAt: c.startsAt.getTime(),
      endsAt: c.endsAt.getTime(),
      entriesCount: c.entriesCount,
      state: stateOf(c, now),
      winner: await winnerBrief(c.winnerEntryId),
    })),
  );
  const rank = { open: 0, soon: 1, done: 2 } as const;
  return cards.sort((a, b) => rank[a.state] - rank[b.state] || (a.state === "done" ? b.endsAt - a.endsAt : a.endsAt - b.endsAt));
}

export async function getChallenge(id: string, viewerId: string | null): Promise<ChallengeDetail | null> {
  const c = await db.query.challenges.findFirst({ where: eq(challenges.id, id) });
  if (!c) return null;
  const now = Date.now();
  const rows = await db
    .select({
      id: challengeEntries.id,
      votesCount: challengeEntries.votesCount,
      createdAt: challengeEntries.createdAt,
      userId: challengeEntries.userId,
      name: users.name,
      avatarUrl: users.avatarUrl,
      slug: specialists.slug,
      postId: posts.id,
      body: posts.body,
      media: posts.media,
    })
    .from(challengeEntries)
    .innerJoin(users, eq(users.id, challengeEntries.userId))
    .innerJoin(posts, eq(posts.id, challengeEntries.postId))
    .leftJoin(specialists, eq(specialists.userId, challengeEntries.userId))
    .where(eq(challengeEntries.challengeId, id))
    .orderBy(desc(challengeEntries.votesCount), asc(challengeEntries.createdAt));
  const myVote = viewerId
    ? await db.query.challengeVotes.findFirst({ where: and(eq(challengeVotes.challengeId, id), eq(challengeVotes.userId, viewerId)), columns: { entryId: true } })
    : null;
  const entries: ChallengeEntryView[] = rows.map((r) => {
    const t = tileOfMedia(r.media);
    return {
      id: r.id,
      votesCount: r.votesCount,
      createdAt: r.createdAt.getTime(),
      author: { id: r.userId, name: r.name, avatarUrl: r.avatarUrl, slug: r.slug },
      post: { id: r.postId, body: r.body, thumbUrl: t.thumbUrl, isVideo: t.isVideo, count: r.media.length },
      mine: viewerId === r.userId,
      votedByMe: myVote?.entryId === r.id,
      isWinner: c.winnerEntryId === r.id,
    };
  });
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    coverUrl: c.coverUrl,
    startsAt: c.startsAt.getTime(),
    endsAt: c.endsAt.getTime(),
    entriesCount: c.entriesCount,
    state: stateOf(c, now),
    winner: await winnerBrief(c.winnerEntryId),
    entries,
    myEntryId: entries.find((e) => e.mine)?.id ?? null,
    myVoteEntryId: myVote?.entryId ?? null,
  };
}

/** Ochiq konkursni olish yoki xato (ishtirok/ovoz uchun) */
async function openChallenge(id: string): Promise<Challenge> {
  const c = await db.query.challenges.findFirst({ where: eq(challenges.id, id) });
  if (!c) throw new ApiError(404, "Konkurs topilmadi");
  const now = Date.now();
  if (now < c.startsAt.getTime()) throw new ApiError(409, "Konkurs hali boshlanmagan");
  if (now > c.endsAt.getTime()) throw new ApiError(409, "Konkurs yakunlangan");
  return c;
}

export async function submitEntry(userId: string, challengeId: string, postId: string): Promise<{ entryId: string }> {
  await openChallenge(challengeId);
  const p = await db.query.posts.findFirst({ columns: { id: true, authorId: true, groupId: true, audience: true, media: true }, where: eq(posts.id, postId) });
  if (!p || p.authorId !== userId || p.groupId !== null) throw new ApiError(404, "Post topilmadi yoki sizniki emas");
  if (p.audience !== "public") throw new ApiError(422, "Faqat ommaviy post bilan ishtirok etish mumkin");
  if (!p.media.length) throw new ApiError(422, "Konkurs ishi rasm yoki video bo'lishi kerak — media'li post tanlang");
  const id = uid();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(challengeEntries).values({ id, challengeId, postId, userId });
      await tx.update(challenges).set({ entriesCount: sql`${challenges.entriesCount} + 1` }).where(eq(challenges.id, challengeId));
    });
  } catch (e) {
    // libsql xatosi indeks nomini emas, ustunlarni yozadi (UNIQUE constraint failed: challenge_entries.challenge_id, challenge_entries.user_id) — cause zanjiri bo'ylab yig'amiz
    let msg = "";
    for (let cur: unknown = e; cur instanceof Error; cur = cur.cause) msg += cur.message + "\n";
    if (msg.includes("challenge_entries.user_id")) throw new ApiError(409, "Siz bu konkursda allaqachon ishtirok etyapsiz");
    if (msg.includes("challenge_entries.post_id")) throw new ApiError(409, "Bu post konkursga allaqachon qo'shilgan");
    throw e;
  }
  return { entryId: id };
}

/** Ovoz: yo'q → qo'shiladi; shu ishga bor → bekor; boshqa ishga bor → ko'chadi. Natija: hozirgi ovoz (null — yo'q) */
export async function voteEntry(userId: string, challengeId: string, entryId: string): Promise<{ votedEntryId: string | null }> {
  await openChallenge(challengeId);
  const entry = await db.query.challengeEntries.findFirst({ where: and(eq(challengeEntries.id, entryId), eq(challengeEntries.challengeId, challengeId)) });
  if (!entry) throw new ApiError(404, "Ish topilmadi");
  if (entry.userId === userId) throw new ApiError(422, "O'z ishingizga ovoz berib bo'lmaydi");
  return db.transaction(async (tx) => {
    const prev = await tx.query.challengeVotes.findFirst({ where: and(eq(challengeVotes.challengeId, challengeId), eq(challengeVotes.userId, userId)) });
    if (prev) {
      await tx.delete(challengeVotes).where(eq(challengeVotes.id, prev.id));
      await tx.update(challengeEntries).set({ votesCount: sql`max(${challengeEntries.votesCount} - 1, 0)` }).where(eq(challengeEntries.id, prev.entryId));
      if (prev.entryId === entryId) return { votedEntryId: null };
    }
    await tx.insert(challengeVotes).values({ id: uid(), challengeId, entryId, userId });
    await tx.update(challengeEntries).set({ votesCount: sql`${challengeEntries.votesCount} + 1` }).where(eq(challengeEntries.id, entryId));
    return { votedEntryId: entryId };
  });
}

/** Admin/bot: yangi konkurs yaratish (standart: hozirdan `days` kun) */
export async function createChallenge(createdBy: string, input: { title: string; description?: string; days?: number; coverUrl?: string | null }): Promise<Challenge> {
  const title = input.title.trim().slice(0, 120);
  if (title.length < 4) throw new ApiError(422, "Sarlavha kamida 4 ta belgi", { title: "Sarlavha kamida 4 ta belgi" });
  const days = Math.min(Math.max(Math.round(input.days ?? 7), 1), 60);
  const now = new Date();
  const [row] = await db
    .insert(challenges)
    .values({ id: uid(), title, description: (input.description ?? "").trim().slice(0, 2000), coverUrl: input.coverUrl ?? null, startsAt: now, endsAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000), createdBy })
    .returning();
  return row;
}

/**
 * Kunlik cron: muddati tugagan, g'olibi tanlanmagan konkurslar — ovozlar bo'yicha g'olib + bildirishnoma.
 * Ishtiroki yo'q konkurslar tegilmaydi (winnerEntryId null qoladi) — «G'olib yo'q» deb ko'rsatiladi.
 */
export async function closeDueChallenges(now = new Date()): Promise<number> {
  const due = await db.query.challenges.findMany({
    where: and(lte(challenges.endsAt, now), isNull(challenges.winnerEntryId), gt(challenges.entriesCount, 0)),
    columns: { id: true, title: true },
    limit: 20,
  });
  let closed = 0;
  for (const c of due) {
    const [top] = await db
      .select({ id: challengeEntries.id, userId: challengeEntries.userId, votes: challengeEntries.votesCount })
      .from(challengeEntries)
      .where(eq(challengeEntries.challengeId, c.id))
      .orderBy(desc(challengeEntries.votesCount), asc(challengeEntries.createdAt))
      .limit(1);
    if (!top) continue;
    // CAS: faqat hali g'olibi yo'q bo'lsa yozamiz — parallel cron ikki marta e'lon qilmasin
    const res = await db
      .update(challenges)
      .set({ winnerEntryId: top.id })
      .where(and(eq(challenges.id, c.id), isNull(challenges.winnerEntryId)));
    if ((res.rowsAffected ?? 0) === 0) continue;
    closed++;
    await notify(top.userId, "top_award", `«${c.title}» konkursida g'olib bo'ldingiz 🏆`, `Ishingiz ${top.votes} ta ovoz bilan birinchi o'rinni oldi. Tabriklaymiz!`, `/konkurs/${c.id}`).catch(() => undefined);
  }
  return closed;
}

/** Ishtirok uchun yaroqli o'z postlari (ommaviy, media'li, shu konkursda ishlatilmagan) */
export async function eligiblePosts(userId: string, challengeId: string) {
  const used = db.select({ pid: challengeEntries.postId }).from(challengeEntries).where(eq(challengeEntries.challengeId, challengeId));
  const rows = await db.query.posts.findMany({
    where: and(eq(posts.authorId, userId), isNull(posts.groupId), eq(posts.audience, "public"), sql`${posts.media} != '[]'`, notInArray(posts.id, used)),
    orderBy: [desc(posts.createdAt)],
    limit: 30,
    columns: { id: true, body: true, media: true, createdAt: true },
  });
  return rows.map((p) => {
    const t = tileOfMedia(p.media);
    return { id: p.id, body: p.body.slice(0, 120), thumbUrl: t.thumbUrl, isVideo: t.isVideo, createdAt: p.createdAt.getTime() };
  });
}

/** Sitemap uchun: konkurslar (id + boshlanish sanasi) */
export async function getSitemapChallenges(): Promise<Array<{ id: string; updatedAt: Date }>> {
  const rows = await db.select({ id: challenges.id, createdAt: challenges.createdAt }).from(challenges).orderBy(desc(challenges.createdAt)).limit(200);
  return rows.map((r) => ({ id: r.id, updatedAt: r.createdAt }));
}
