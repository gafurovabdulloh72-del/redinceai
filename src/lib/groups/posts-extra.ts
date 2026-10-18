import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, notExists, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedMutes, groups, postComments, postHides, postLikes, postPolls, postPollVotes, postSaves, posts, users, type Post, type PostComment } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { addComment, briefUsers, canModeratePost, postHref, type CommentView, type UserBrief } from "@/lib/groups/service";
import { COMMENT_EDIT_WINDOW_MS, extractTags, POLL_OPTIONS_MAX, POLL_OPTIONS_MIN, POLL_OPTION_MAX, REACTION_KINDS, type ReactionKind } from "./limits";
import { uid } from "@/lib/utils";

/**
 * Postlar sohasi — qo'shimcha server funksiyalari (batch-800, lenta agenti).
 * `service.ts` ga tegilmaydi: so'rovnoma, «qiziq emas», muallifni yashirish, izoh javobi/tahriri,
 * reaksiya qo'yganlar ro'yxati, trend teglar, havola kartasi (OG). Egalik tekshiruvlari route'larda
 * mavjud yordamchilar (assertActiveMember / assertCanInteractProfilePost / assertCanView) bilan.
 */
type Viewer = { id: string; role: string } | null;

/* ------------------------------------------------------------------ */
/* So'rovnoma                                                          */
/* ------------------------------------------------------------------ */
export interface PollOptionView {
  text: string;
  votes: number;
  /** Foiz (0–100, butun) — jami 0 bo'lsa 0 */
  pct: number;
}
export interface PollView {
  id: string;
  options: PollOptionView[];
  total: number;
  /** Mening ovozim — variant indeksi; null — ovoz bermaganman */
  myVote: number | null;
  endsAt: number | null;
  /** Muddati tugagan — ovoz berib bo'lmaydi */
  closed: boolean;
}

/** Variantlarni tozalash: bo'shlarni tashlash, uzunlik, takror, 2–4 ta */
export function normalizePollOptions(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const t = r.replace(/\s+/g, " ").trim().slice(0, POLL_OPTION_MAX);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

export async function createPoll(post: Post, rawOptions: string[], endsAt: number | null): Promise<PollView> {
  const options = normalizePollOptions(rawOptions);
  if (options.length < POLL_OPTIONS_MIN || options.length > POLL_OPTIONS_MAX) throw new ApiError(422, `So'rovnomada ${POLL_OPTIONS_MIN}–${POLL_OPTIONS_MAX} ta variant bo'lsin`, { options: "Variantlar soni" });
  if (endsAt && endsAt < Date.now() + 5 * 60_000) throw new ApiError(422, "Tugash vaqti kamida 5 daqiqa keyin bo'lsin", { endsAt: "Vaqt" });
  const existing = await db.query.postPolls.findFirst({ where: eq(postPolls.postId, post.id), columns: { id: true } });
  if (existing) throw new ApiError(409, "Bu postda so'rovnoma allaqachon bor");
  const id = uid();
  await db.insert(postPolls).values({ id, postId: post.id, options, endsAt: endsAt ? new Date(endsAt) : null, createdAt: new Date() });
  return { id, options: options.map((text) => ({ text, votes: 0, pct: 0 })), total: 0, myVote: null, endsAt, closed: false };
}

/** Postlar bo'yicha so'rovnomalar (ovozlar kesimi va mening ovozim bilan): postId → PollView */
export async function pollsFor(postIds: string[], viewer: Viewer): Promise<Map<string, PollView>> {
  const out = new Map<string, PollView>();
  if (!postIds.length) return out;
  const polls = await db.query.postPolls.findMany({ where: inArray(postPolls.postId, postIds) });
  if (!polls.length) return out;
  const pollIds = polls.map((p) => p.id);
  const [counts, mine] = await Promise.all([
    db.select({ pollId: postPollVotes.pollId, idx: postPollVotes.optionIdx, n: sql<number>`count(*)` }).from(postPollVotes).where(inArray(postPollVotes.pollId, pollIds)).groupBy(postPollVotes.pollId, postPollVotes.optionIdx),
    viewer ? db.query.postPollVotes.findMany({ where: and(eq(postPollVotes.userId, viewer.id), inArray(postPollVotes.pollId, pollIds)), columns: { pollId: true, optionIdx: true } }) : Promise.resolve([] as Array<{ pollId: string; optionIdx: number }>),
  ]);
  const myMap = new Map(mine.map((m) => [m.pollId, m.optionIdx]));
  const now = Date.now();
  for (const p of polls) {
    const votes = p.options.map((_, i) => counts.filter((c) => c.pollId === p.id && c.idx === i).reduce((s, c) => s + Number(c.n), 0));
    const total = votes.reduce((a, b) => a + b, 0);
    const endsAt = p.endsAt?.getTime() ?? null;
    out.set(p.postId, {
      id: p.id,
      options: p.options.map((text, i) => ({ text, votes: votes[i], pct: total ? Math.round((votes[i] / total) * 100) : 0 })),
      total,
      myVote: myMap.get(p.id) ?? null,
      endsAt,
      closed: Boolean(endsAt && endsAt <= now),
    });
  }
  return out;
}

/** Ovoz berish: shu variant bor — qaytariladi; boshqasi — almashadi; yo'q — qo'shiladi */
export async function votePoll(post: Post, userId: string, optionIdx: number): Promise<PollView> {
  const poll = await db.query.postPolls.findFirst({ where: eq(postPolls.postId, post.id) });
  if (!poll) throw new ApiError(404, "So'rovnoma topilmadi");
  if (poll.endsAt && poll.endsAt.getTime() <= Date.now()) throw new ApiError(409, "So'rovnoma yakunlangan");
  if (!Number.isInteger(optionIdx) || optionIdx < 0 || optionIdx >= poll.options.length) throw new ApiError(422, "Variant noto'g'ri", { option: "Indeks" });
  const existing = await db.query.postPollVotes.findFirst({ where: and(eq(postPollVotes.pollId, poll.id), eq(postPollVotes.userId, userId)) });
  if (existing && existing.optionIdx === optionIdx) await db.delete(postPollVotes).where(eq(postPollVotes.id, existing.id));
  else if (existing) await db.update(postPollVotes).set({ optionIdx, createdAt: new Date() }).where(eq(postPollVotes.id, existing.id));
  else await db.insert(postPollVotes).values({ id: uid(), pollId: poll.id, userId, optionIdx, createdAt: new Date() });
  const view = (await pollsFor([post.id], { id: userId, role: "user" })).get(post.id);
  if (!view) throw new ApiError(500, "So'rovnoma o'qilmadi");
  return view;
}

/* ------------------------------------------------------------------ */
/* «Qiziq emas» va muallifni yashirish                                  */
/* ------------------------------------------------------------------ */
export async function setPostHidden(postId: string, userId: string, hidden: boolean): Promise<{ hidden: boolean }> {
  if (hidden) {
    await db
      .insert(postHides)
      .values({ id: uid(), postId, userId, createdAt: new Date() })
      .onConflictDoNothing();
  } else {
    await db.delete(postHides).where(and(eq(postHides.postId, postId), eq(postHides.userId, userId)));
  }
  return { hidden };
}

/** Lenta sharti: foydalanuvchi yashirgan postlar chiqmaydi */
export function notHiddenCondition(userId: string): SQL {
  return notExists(db.select({ x: sql`1` }).from(postHides).where(and(eq(postHides.postId, posts.id), eq(postHides.userId, userId))));
}

/** Lenta sharti: yashirilgan (mute) mualliflar chiqmaydi */
export function notMutedCondition(userId: string): SQL {
  return notExists(db.select({ x: sql`1` }).from(feedMutes).where(and(eq(feedMutes.authorId, posts.authorId), eq(feedMutes.userId, userId))));
}

export async function setAuthorMuted(userId: string, authorId: string, muted: boolean): Promise<{ muted: boolean }> {
  if (authorId === userId) throw new ApiError(400, "O'zingizni yashirib bo'lmaydi");
  if (muted) {
    const exists = await db.query.users.findFirst({ where: eq(users.id, authorId), columns: { id: true } });
    if (!exists) throw new ApiError(404, "Foydalanuvchi topilmadi");
    await db
      .insert(feedMutes)
      .values({ id: uid(), userId, authorId, createdAt: new Date() })
      .onConflictDoNothing();
  } else {
    await db.delete(feedMutes).where(and(eq(feedMutes.userId, userId), eq(feedMutes.authorId, authorId)));
  }
  return { muted };
}

/** Men lentadan yashirgan mualliflar (qisqa DTO — kontakt yo'q) */
export async function listMutedAuthors(userId: string): Promise<UserBrief[]> {
  const rows = await db.query.feedMutes.findMany({ where: eq(feedMutes.userId, userId), orderBy: [desc(feedMutes.createdAt)], limit: 100 });
  const brief = await briefUsers(rows.map((r) => r.authorId));
  return rows.map((r) => brief.get(r.authorId)).filter((u): u is UserBrief => Boolean(u));
}

/* ------------------------------------------------------------------ */
/* Izohlar: javob (1 daraja), tahrir, saralash, jami                   */
/* ------------------------------------------------------------------ */
export interface CommentViewX extends CommentView {
  /** Javob berilgan izoh (qisqa): id va muallif ismi — iqtibos chiziqchasi uchun */
  replyTo: { id: string; authorName: string } | null;
  editedAt: number | null;
  /** Muallif 15 daqiqa ichida tahrirlay oladi */
  canEdit: boolean;
}
export type CommentSort = "old" | "new";

export async function listCommentsX(post: Post, viewer: Viewer, opts: { sort?: CommentSort; limit?: number } = {}): Promise<{ items: CommentViewX[]; total: number }> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 100));
  const sort: CommentSort = opts.sort === "new" ? "new" : "old";
  const rows = await db.query.postComments.findMany({ where: eq(postComments.postId, post.id), orderBy: [sort === "new" ? desc(postComments.createdAt) : asc(postComments.createdAt)], limit });
  // Javob berilgan izohlar sahifadan tashqarida bo'lishi mumkin — alohida olinadi
  const replyIds = Array.from(new Set(rows.map((c) => c.replyToId).filter((x): x is string => Boolean(x)))).filter((id) => !rows.some((r) => r.id === id));
  const extra = replyIds.length ? await db.query.postComments.findMany({ where: inArray(postComments.id, replyIds), columns: { id: true, authorId: true } }) : [];
  const parents = new Map<string, string>([...rows.map((r) => [r.id, r.authorId] as const), ...extra.map((r) => [r.id, r.authorId] as const)]);
  const [authors, moderator, total] = await Promise.all([
    briefUsers([...rows.map((c) => c.authorId), ...extra.map((c) => c.authorId)]),
    canModeratePost(post, viewer),
    db.select({ n: sql<number>`count(*)` }).from(postComments).where(eq(postComments.postId, post.id)).then((r) => Number(r[0]?.n ?? 0)),
  ]);
  const now = Date.now();
  const UNKNOWN = { name: "Foydalanuvchi", avatarUrl: null, username: null, slug: null, online: false };
  return {
    total,
    items: rows.map((c) => {
      const parentAuthor = c.replyToId ? parents.get(c.replyToId) : undefined;
      return {
        id: c.id,
        body: c.body,
        createdAt: c.createdAt.getTime(),
        author: authors.get(c.authorId) ?? { id: c.authorId, ...UNKNOWN },
        canDelete: Boolean(viewer && (viewer.id === c.authorId || moderator)),
        replyTo: c.replyToId && parentAuthor ? { id: c.replyToId, authorName: authors.get(parentAuthor)?.name ?? UNKNOWN.name } : null,
        editedAt: c.editedAt?.getTime() ?? null,
        canEdit: Boolean(viewer && viewer.id === c.authorId && now - c.createdAt.getTime() < COMMENT_EDIT_WINDOW_MS),
      };
    }),
  };
}

/** Izoh qo'shish — javob bo'lsa `reply_to_id` yoziladi va javob berilgan izoh muallifiga xabar boradi */
export async function addCommentX(post: Post, authorId: string, body: string, replyToId: string | null): Promise<PostComment> {
  let parent: PostComment | null = null;
  if (replyToId) {
    parent = (await db.query.postComments.findFirst({ where: and(eq(postComments.id, replyToId), eq(postComments.postId, post.id)) })) ?? null;
    if (!parent) throw new ApiError(404, "Javob berilayotgan izoh topilmadi");
    // Faqat 1 daraja: javobga javob — asl izohga bog'lanadi
    if (parent.replyToId) parent = (await db.query.postComments.findFirst({ where: eq(postComments.id, parent.replyToId) })) ?? parent;
  }
  const c = await addComment(post, authorId, body);
  if (parent) {
    await db.update(postComments).set({ replyToId: parent.id }).where(eq(postComments.id, c.id));
    if (parent.authorId !== authorId && parent.authorId !== post.authorId) {
      try {
        const who = (await briefUsers([authorId])).get(authorId)?.name ?? "Foydalanuvchi";
        await notify(parent.authorId, "post_comment", `${who} izohingizga javob berdi`, body.length > 100 ? `${body.slice(0, 97)}…` : body, await postHref(post), { skipMail: true });
      } catch (e) {
        console.error("[comment:reply-notify]", e);
      }
    }
    return { ...c, replyToId: parent.id };
  }
  return c;
}

/** Izohni tahrirlash — faqat muallif, 15 daqiqa ichida */
export async function editComment(comment: PostComment, viewer: NonNullable<Viewer>, body: string): Promise<PostComment> {
  if (comment.authorId !== viewer.id) throw new ApiError(403, "Faqat muallif tahrirlaydi");
  if (Date.now() - comment.createdAt.getTime() >= COMMENT_EDIT_WINDOW_MS) throw new ApiError(409, "Tahrirlash muddati (15 daqiqa) o'tdi");
  const editedAt = new Date();
  await db.update(postComments).set({ body, editedAt }).where(eq(postComments.id, comment.id));
  return { ...comment, body, editedAt };
}

/** Post matni tahrirlanganda — `edited_at` (izohdagi updatedAt bilan aralashmasin) */
export async function markPostEdited(postId: string): Promise<number> {
  const at = new Date();
  await db.update(posts).set({ editedAt: at }).where(eq(posts.id, postId));
  return at.getTime();
}

/* ------------------------------------------------------------------ */
/* Kim reaksiya qo'ydi                                                 */
/* ------------------------------------------------------------------ */
export interface ReactorRow extends UserBrief {
  reaction: ReactionKind;
  at: number;
}
export async function listReactors(postId: string, kind: ReactionKind | null, limit = 60): Promise<ReactorRow[]> {
  const rows = await db.query.postLikes.findMany({
    where: kind ? and(eq(postLikes.postId, postId), eq(postLikes.reaction, kind)) : eq(postLikes.postId, postId),
    orderBy: [desc(postLikes.createdAt)],
    limit,
  });
  const brief = await briefUsers(rows.map((r) => r.userId));
  return rows
    .map((r) => {
      const u = brief.get(r.userId);
      const reaction = (REACTION_KINDS as readonly string[]).includes(r.reaction) ? (r.reaction as ReactionKind) : "heart";
      return u ? { ...u, reaction, at: r.createdAt.getTime() } : null;
    })
    .filter((x): x is ReactorRow => x !== null);
}

/* ------------------------------------------------------------------ */
/* Trend teglar, saqlanganlar soni                                      */
/* ------------------------------------------------------------------ */
export interface TrendingTag {
  tag: string;
  count: number;
}
/** So'nggi `days` kunda ochiq postlarda eng ko'p uchragan #teglar (jamoa yopiq bo'lmasin, muallif bloklanmagan) */
export async function trendingTags(days = 7, limit = 8): Promise<TrendingTag[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select({ body: posts.body })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(groups, eq(groups.id, posts.groupId))
    .where(and(gt(posts.createdAt, since), eq(users.isBanned, false), or(isNull(posts.groupId), eq(groups.isPrivate, false)), sql`instr(${posts.body}, '#') > 0`))
    .orderBy(desc(posts.createdAt))
    .limit(400);
  const count = new Map<string, number>();
  for (const r of rows) for (const t of extractTags(r.body)) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag, n]) => ({ tag, count: n }));
}

export async function savedCount(userId: string): Promise<number> {
  const r = await db.select({ n: sql<number>`count(*)` }).from(postSaves).where(eq(postSaves.userId, userId));
  return Number(r[0]?.n ?? 0);
}

/* ------------------------------------------------------------------ */
/* Havola kartasi (Open Graph) — server tomonda, xavfsiz               */
/* ------------------------------------------------------------------ */
export interface LinkPreview {
  url: string;
  host: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
}
const PREVIEW_TTL_MS = 60 * 60 * 1000;
const PREVIEW_MAX_BYTES = 300 * 1024;
const previewCache = new Map<string, { exp: number; data: LinkPreview | null }>();

/** Ichki/xususiy manzillar (SSRF) — faqat ommaviy hostlar; dev'da localhost'ga ruxsat (sinov) */
function isPublicHttpUrl(u: URL): boolean {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "80" && u.port !== "443") return process.env.NODE_ENV === "development" && u.hostname === "localhost";
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h === "0.0.0.0") return process.env.NODE_ENV === "development" && h === "localhost";
  // Raqamli IP: xususiy diapazonlar taqiqlanadi
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a >= 224) return false;
  }
  if (h.includes(":")) return false; // IPv6 — oddiylik uchun ruxsat yo'q
  return true;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&(#x([0-9a-f]+)|#(\d+)|amp|lt|gt|quot|apos|nbsp);/gi, (_, _w, hex, dec) => {
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      if (dec) return String.fromCodePoint(parseInt(dec, 10));
      const map: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
      return map[_.slice(1, -1).toLowerCase()] ?? _;
    })
    .replace(/\s+/g, " ")
    .trim();

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(`<meta\\s+[^>]*?(?:property|name)\\s*=\\s*["']${key}["'][^>]*?content\\s*=\\s*["']([^"']*)["']`, "i");
    const re2 = new RegExp(`<meta\\s+[^>]*?content\\s*=\\s*["']([^"']*)["'][^>]*?(?:property|name)\\s*=\\s*["']${key}["']`, "i");
    const m = re.exec(html) ?? re2.exec(html);
    if (m?.[1]) return decodeEntities(m[1]).slice(0, 300) || null;
  }
  return null;
}

/** HTML'dan sarlavha/tavsif — rasm yo'q (CSP img-src cheklangan), faqat matn. Xato/timeout — null (karta chiqmaydi) */
export async function fetchLinkPreview(raw: string): Promise<LinkPreview | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!isPublicHttpUrl(u)) return null;
  u.hash = "";
  const key = u.toString();
  const hit = previewCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.data;
  let data: LinkPreview | null = null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const res = await fetch(key, { signal: ctl.signal, redirect: "follow", headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0 (compatible; KasbEgalariBot/1.0; +https://kasbegalari.vercel.app)" } });
    const finalUrl = new URL(res.url || key);
    if (!res.ok || !isPublicHttpUrl(finalUrl) || !(res.headers.get("content-type") ?? "").includes("html")) throw new Error("skip");
    const reader = res.body?.getReader();
    let html = "";
    let bytes = 0;
    const dec = new TextDecoder();
    while (reader) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      bytes += value.byteLength;
      html += dec.decode(value, { stream: true });
      if (bytes > PREVIEW_MAX_BYTES || /<\/head>/i.test(html)) break;
    }
    reader?.cancel().catch(() => undefined);
    const title = metaContent(html, ["og:title", "twitter:title"]) ?? (/<title[^>]*>([^<]{1,300})<\/title>/i.exec(html)?.[1] ? decodeEntities(/<title[^>]*>([^<]{1,300})<\/title>/i.exec(html)![1]) : null);
    const description = metaContent(html, ["og:description", "twitter:description", "description"]);
    const siteName = metaContent(html, ["og:site_name"]);
    data = title || description ? { url: key, host: finalUrl.hostname.replace(/^www\./, ""), title, description, siteName } : null;
  } catch {
    data = null;
  } finally {
    clearTimeout(timer);
  }
  if (previewCache.size > 500) previewCache.clear();
  // Topilmagan/xato — qisqa kesh (5 daqiqa): vaqtinchalik timeout havolani bir soatga «o'chirib» qo'ymasin
  previewCache.set(key, { exp: Date.now() + (data ? PREVIEW_TTL_MS : 5 * 60_000), data });
  return data;
}
