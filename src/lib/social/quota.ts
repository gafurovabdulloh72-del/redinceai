import "server-only";
import { and, asc, count, eq, gt, isNull } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { posts, specialists, stories, users } from "@/lib/db/schema";
import { POST_WEEKLY_LIMIT, POST_WINDOW_MS, STORY_WEEKLY_LIMIT, STORY_WINDOW_MS, type QuotaInfo } from "./limits";

/**
 * Premium: admin, imtiyozli mutaxassis, oylik TOP g'olibi (awardPremiumUntil) yoki obunasi TO'LANGAN va muddati o'tmagan mutaxassis (sinov davri premium emas).
 */
export async function isPremium(userId: string): Promise<boolean> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { role: true } });
  if (!u) return false;
  if (u.role === "admin") return true;
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, userId), columns: { isPrivileged: true, subscriptionUntil: true, awardPremiumUntil: true } });
  if (!sp) return false;
  const now = Date.now();
  return Boolean(sp.isPrivileged || (sp.subscriptionUntil && sp.subscriptionUntil.getTime() > now) || (sp.awardPremiumUntil && sp.awardPremiumUntil.getTime() > now));
}

/** Oyna ichidagi sonlar va eng eski yozuv (limit qachon bo'shashini hisoblash uchun) */
async function windowUsage(kind: "post" | "story", userId: string, windowMs: number): Promise<{ used: number; oldest: number | null }> {
  const since = new Date(Date.now() - windowMs);
  if (kind === "post") {
    const where = and(eq(posts.authorId, userId), isNull(posts.groupId), gt(posts.createdAt, since));
    const [[{ n }], first] = await Promise.all([db.select({ n: count() }).from(posts).where(where), db.select({ t: posts.createdAt }).from(posts).where(where).orderBy(asc(posts.createdAt)).limit(1)]);
    return { used: n, oldest: first[0]?.t.getTime() ?? null };
  }
  const where = and(eq(stories.authorId, userId), gt(stories.createdAt, since));
  const [[{ n }], first] = await Promise.all([db.select({ n: count() }).from(stories).where(where), db.select({ t: stories.createdAt }).from(stories).where(where).orderBy(asc(stories.createdAt)).limit(1)]);
  return { used: n, oldest: first[0]?.t.getTime() ?? null };
}

export async function quotaFor(userId: string): Promise<QuotaInfo> {
  const [premium, p, s] = await Promise.all([isPremium(userId), windowUsage("post", userId, POST_WINDOW_MS), windowUsage("story", userId, STORY_WINDOW_MS)]);
  return {
    premium,
    posts: { used: p.used, limit: premium ? null : POST_WEEKLY_LIMIT, resetAt: !premium && p.used >= POST_WEEKLY_LIMIT && p.oldest ? p.oldest + POST_WINDOW_MS : null },
    stories: { used: s.used, limit: premium ? null : STORY_WEEKLY_LIMIT, resetAt: !premium && s.used >= STORY_WEEKLY_LIMIT && s.oldest ? s.oldest + STORY_WINDOW_MS : null },
  };
}

function untilText(ms: number): string {
  const h = Math.max(1, Math.ceil((ms - Date.now()) / 3_600_000));
  return h >= 24 ? `${Math.ceil(h / 24)} kun` : `${h} soat`;
}

/** Limitdan oshsa 429 (premium taklifi bilan). Jamoa postlariga tegishli emas — faqat profil (Reels) postlari va story */
export async function assertQuota(userId: string, kind: "post" | "story"): Promise<void> {
  const q = await quotaFor(userId);
  const part = kind === "post" ? q.posts : q.stories;
  if (part.limit === null || part.used < part.limit) return;
  const after = part.resetAt ? ` Keyingisi ${untilText(part.resetAt)}dan keyin.` : "";
  throw new ApiError(
    429,
    kind === "post"
      ? `Haftasiga ${POST_WEEKLY_LIMIT} ta post — limit tugadi.${after} Premium obunada cheklov yo'q.`
      : `Haftasiga ${STORY_WEEKLY_LIMIT} ta story — limit tugadi.${after} Premium obunada cheklov yo'q.`,
  );
}
