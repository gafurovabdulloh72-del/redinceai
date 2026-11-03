import "server-only";
import { and, asc, count, eq, gt, isNull } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { posts, specialists, stories, users } from "@/lib/db/schema";
import { TIER_LIMITS, tierOf, type Tier } from "@/lib/subscriptions/pro";
import { POST_WINDOW_MS, STORY_WINDOW_MS, type QuotaInfo } from "./limits";

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

/** Tarif darajasi (video chegarasi va h.k.): admin — max; mutaxassis — tierOf (lib/subscriptions/pro.ts) */
export async function premiumTier(userId: string): Promise<Tier> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { role: true } });
  if (!u) return "free";
  if (u.role === "admin") return "max";
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, userId), columns: { isPrivileged: true, subscriptionUntil: true, awardPremiumUntil: true, subscriptionTier: true } });
  return sp ? tierOf(sp) : "free";
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

/** Har tarifda chegara bor (TIER_LIMITS, lib/subscriptions/pro.ts): Standart 2/4 · Pro 7/14 · Max 20/40 (post/story, 7 kun) */
export async function quotaFor(userId: string): Promise<QuotaInfo> {
  const [tier, p, s] = await Promise.all([premiumTier(userId), windowUsage("post", userId, POST_WINDOW_MS), windowUsage("story", userId, STORY_WINDOW_MS)]);
  const L = TIER_LIMITS[tier];
  return {
    premium: tier !== "free",
    tier,
    posts: { used: p.used, limit: L.posts, resetAt: p.used >= L.posts && p.oldest ? p.oldest + POST_WINDOW_MS : null },
    stories: { used: s.used, limit: L.stories, resetAt: s.used >= L.stories && s.oldest ? s.oldest + STORY_WINDOW_MS : null },
  };
}

const UPGRADE: Record<"free" | "pro" | "max", (kind: "post" | "story") => string> = {
  free: (k) => ` Pro tarifda haftasiga ${k === "post" ? TIER_LIMITS.pro.posts : TIER_LIMITS.pro.stories} ta.`,
  pro: (k) => ` Max tarifda haftasiga ${k === "post" ? TIER_LIMITS.max.posts : TIER_LIMITS.max.stories} ta.`,
  max: () => "",
};

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
  const up = UPGRADE[q.tier ?? "free"](kind);
  throw new ApiError(429, `Haftasiga ${part.limit} ta ${kind === "post" ? "post" : "story"} — limit tugadi.${after}${up}`);
}
