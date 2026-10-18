import "server-only";
import { and, desc, eq, isNull, like, lt, not, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { follows, posts, type FileAttachment, type Post } from "@/lib/db/schema";
import { briefUsers, toPostViews, type PostView } from "@/lib/groups/service";
import { notifyMentions } from "@/lib/groups/mentions";
import { notify } from "@/lib/notifications";
import { uid } from "@/lib/utils";

/**
 * Profil postlari (Instagram uslubi): ijodkorning shaxsiy lentasi — `posts.groupId = null`.
 * Like/izoh/o'chirish — jamoa postlari bilan bir xil API (/api/posts/[id]…): guruh bo'lmagani uchun
 * har qanday tizimga kirgan foydalanuvchi yoqtira va izoh qoldira oladi; o'chirish — muallif yoki sayt admini.
 */
type Viewer = { id: string; role: string } | null;
export type ProfilePostFilter = "all" | "video" | "photo" | "text";
export interface ProfilePostPage {
  items: PostView[];
  nextCursor: number | null;
}

/** media JSON matnida video bormi — type "video/…" yoki .mp4/.webm/.mov URL */
const VIDEO_MEDIA: SQL = or(
  like(sql`lower(${posts.media})`, '%"type":"video/%'),
  like(sql`lower(${posts.media})`, "%.mp4%"),
  like(sql`lower(${posts.media})`, "%.webm%"),
  like(sql`lower(${posts.media})`, "%.mov%"),
)!;
const NO_MEDIA: SQL = sql`${posts.media} = '[]'`;

function filterCond(f: ProfilePostFilter): SQL | undefined {
  if (f === "video") return VIDEO_MEDIA;
  if (f === "text") return NO_MEDIA;
  if (f === "photo") return and(sql`${posts.media} != '[]'`, not(VIDEO_MEDIA));
  return undefined;
}

const isVideo = (m: FileAttachment) => m.type.startsWith("video/") || /\.(?:mp4|webm|mov)(?:$|\?)/i.test(m.url);

/** Yangi profil posti; obunachilarga (follows) bildirishnoma — sayt + Telegram, email emas (25 talik bo'laklar) */
export async function createProfilePost(authorId: string, body: string, media: FileAttachment[]): Promise<Post> {
  const now = new Date();
  const row: typeof posts.$inferInsert = {
    id: uid(),
    groupId: null,
    authorId,
    body,
    media,
    likesCount: 0,
    commentsCount: 0,
    isPinned: false,
    eventAt: null,
    eventUrl: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(posts).values(row);

  const author = (await briefUsers([authorId])).get(authorId);
  const href = author?.slug ? `/mutaxassislar/${author.slug}?post=${row.id}` : null;
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 140) || (media.length ? (media.some(isVideo) ? "Yangi video" : "Yangi rasm") : "");
  // @username eslatmalari — obunachi bo'lmasa ham xabar oladi (ochiq profil posti); eslatilganlar umumiy "yangi post" xabarini qayta olmaydi
  const mentioned = new Set(await notifyMentions({ text: body, actorId: authorId, actorName: author?.name ?? "Ijodkor", href: href ?? `/?post=${row.id}`, where: "post" }).catch((e) => (console.error("[profile-post:mentions]", e), [] as string[])));
  const fans = await db.query.follows.findMany({ where: eq(follows.followingId, authorId), columns: { followerId: true } });
  const ids = fans.map((f) => f.followerId).filter((id) => id !== authorId && !mentioned.has(id));
  for (let i = 0; i < ids.length; i += 25) {
    await Promise.all(ids.slice(i, i + 25).map((id) => notify(id, "profile_post", `${author?.name ?? "Ijodkor"} yangi post joyladi`, snippet, href, { skipMail: true }).catch(() => undefined)));
  }
  return { ...row, eventAt: null, eventUrl: null } as Post;
}

/** Ijodkorning profil lentasi: yangi → eski, cursor = oxirgi postning createdAt (ms); filtr — video / rasm / matn */
export async function listProfilePosts(authorId: string, viewer: Viewer, opts: { cursor?: number | null; limit?: number; filter?: ProfilePostFilter } = {}): Promise<ProfilePostPage> {
  const limit = Math.min(48, Math.max(1, opts.limit ?? 18));
  const conds: SQL[] = [eq(posts.authorId, authorId), isNull(posts.groupId)];
  const f = filterCond(opts.filter ?? "all");
  if (f) conds.push(f);
  if (opts.cursor) conds.push(lt(posts.createdAt, new Date(opts.cursor)));
  const rows = await db.query.posts.findMany({ where: and(...conds), orderBy: [desc(posts.createdAt)], limit: limit + 1 });
  const page = rows.slice(0, limit);
  const items = await toPostViews(page, viewer, viewer?.role === "admin");
  return { items, nextCursor: rows.length > limit ? page[page.length - 1].createdAt.getTime() : null };
}

/** Profil sarlavhasi uchun sonlar: jami post, video, faqat matn */
export async function profilePostCounts(authorId: string): Promise<{ posts: number; videos: number; texts: number }> {
  const [r] = await db
    .select({
      n: sql<number>`count(*)`,
      v: sql<number>`coalesce(sum(case when ${VIDEO_MEDIA} then 1 else 0 end), 0)`,
      t: sql<number>`coalesce(sum(case when ${NO_MEDIA} then 1 else 0 end), 0)`,
    })
    .from(posts)
    .where(and(eq(posts.authorId, authorId), isNull(posts.groupId)));
  return { posts: Number(r?.n ?? 0), videos: Number(r?.v ?? 0), texts: Number(r?.t ?? 0) };
}

/** Bitta profil posti (?post=<id> bilan ochish uchun); authorId berilsa — faqat shu muallifniki */
export async function getProfilePostView(id: string, viewer: Viewer, authorId?: string): Promise<PostView | null> {
  const conds: SQL[] = [eq(posts.id, id), isNull(posts.groupId)];
  if (authorId) conds.push(eq(posts.authorId, authorId));
  const row = await db.query.posts.findFirst({ where: and(...conds) });
  if (!row) return null;
  return (await toPostViews([row], viewer, viewer?.role === "admin"))[0] ?? null;
}
