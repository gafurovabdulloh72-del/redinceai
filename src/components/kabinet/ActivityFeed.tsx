import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { Heart, MessageSquare, Star, UserPlus, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui";
import { db } from "@/lib/db";
import { follows, groups, postComments, postLikes, posts, reviews, specialists, users } from "@/lib/db/schema";
import { REACTIONS } from "@/lib/groups/limits";
import { timeAgo } from "@/lib/utils";

interface ActivityItem {
  key: string;
  kind: "like" | "comment" | "follow" | "review";
  who: { name: string; avatarUrl: string | null };
  text: string;
  href: string | null;
  at: number;
}

const KIND_ICON: Record<ActivityItem["kind"], LucideIcon> = { like: Heart, comment: MessageSquare, follow: UserPlus, review: Star };

const LIMIT = 8;

/** Post havolasi: shaxsiy post — ijodkor profili (?post=), jamoa posti — jamoa sahifasi */
function postHref(p: { id: string; groupSlug: string | null }, slug: string | null) {
  if (p.groupSlug) return `/jamoalar/${p.groupSlug}?post=${p.id}`;
  return slug ? `/mutaxassislar/${slug}?tab=postlar&post=${p.id}` : null;
}

/**
 * Faollik lentasi (kabinet umumiy sahifasi): kim postlaringizni yoqtirdi, izoh yozdi, obuna bo'ldi, sharh qoldirdi —
 * mavjud jadvallardan (post_likes, post_comments, follows, reviews), oxirgi 8 ta. Faqat egasiga ko'rinadi.
 */
export async function ActivityFeed({ userId, specialist }: { userId: string; specialist: { id: string; slug: string } | null }) {
  // Mening postlarim (shaxsiy va jamoa) — reaksiya/izohlar shularga
  const myPosts = await db
    .select({ id: posts.id, groupSlug: groups.slug, body: posts.body })
    .from(posts)
    .leftJoin(groups, eq(groups.id, posts.groupId))
    .where(eq(posts.authorId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(200);
  const postIds = myPosts.map((p) => p.id);
  const postMap = new Map(myPosts.map((p) => [p.id, p]));
  const snippet = (body: string) => {
    const t = body.replace(/\s+/g, " ").trim();
    return t.length > 40 ? `«${t.slice(0, 40)}…»` : t ? `«${t}»` : "postingiz";
  };

  const [likes, comments, followers, revs] = await Promise.all([
    postIds.length
      ? db
          .select({ id: postLikes.id, postId: postLikes.postId, reaction: postLikes.reaction, at: postLikes.createdAt, name: users.name, avatarUrl: users.avatarUrl, uid: users.id })
          .from(postLikes)
          .innerJoin(users, eq(users.id, postLikes.userId))
          .where(inArray(postLikes.postId, postIds))
          .orderBy(desc(postLikes.createdAt))
          .limit(LIMIT)
      : Promise.resolve([]),
    postIds.length
      ? db
          .select({ id: postComments.id, postId: postComments.postId, body: postComments.body, at: postComments.createdAt, name: users.name, avatarUrl: users.avatarUrl, uid: users.id })
          .from(postComments)
          .innerJoin(users, eq(users.id, postComments.authorId))
          .where(inArray(postComments.postId, postIds))
          .orderBy(desc(postComments.createdAt))
          .limit(LIMIT)
      : Promise.resolve([]),
    db
      .select({ id: follows.id, at: follows.createdAt, name: users.name, avatarUrl: users.avatarUrl, slug: specialists.slug })
      .from(follows)
      .innerJoin(users, eq(users.id, follows.followerId))
      .leftJoin(specialists, eq(specialists.userId, users.id))
      .where(eq(follows.followingId, userId))
      .orderBy(desc(follows.createdAt))
      .limit(LIMIT),
    specialist
      ? db
          .select({ id: reviews.id, rating: reviews.rating, at: reviews.createdAt, name: users.name, avatarUrl: users.avatarUrl })
          .from(reviews)
          .innerJoin(users, eq(users.id, reviews.authorId))
          .where(eq(reviews.specialistId, specialist.id))
          .orderBy(desc(reviews.createdAt))
          .limit(LIMIT)
      : Promise.resolve([]),
  ]);

  const slug = specialist?.slug ?? null;
  const items: ActivityItem[] = [
    ...likes
      .filter((l) => l.uid !== userId)
      .map((l) => {
        const p = postMap.get(l.postId);
        const emoji = REACTIONS.find((r) => r.key === l.reaction)?.emoji ?? "❤️";
        return { key: `l${l.id}`, kind: "like" as const, who: l, text: `${emoji} ${p ? snippet(p.body) : "postingiz"}`, href: p ? postHref(p, slug) : null, at: l.at.getTime() };
      }),
    ...comments
      .filter((c) => c.uid !== userId)
      .map((c) => {
        const p = postMap.get(c.postId);
        return { key: `c${c.id}`, kind: "comment" as const, who: c, text: `izoh: ${snippet(c.body)}`, href: p ? postHref(p, slug) : null, at: c.at.getTime() };
      }),
    ...followers.map((f) => ({ key: `f${f.id}`, kind: "follow" as const, who: f, text: "sizga obuna bo'ldi", href: f.slug ? `/mutaxassislar/${f.slug}` : "/kabinet/obunalar", at: f.at.getTime() })),
    ...revs.map((r) => ({ key: `r${r.id}`, kind: "review" as const, who: r, text: `${r.rating} yulduzli sharh qoldirdi`, href: slug ? `/mutaxassislar/${slug}#sharhlar` : null, at: r.at.getTime() })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, LIMIT);

  // Hammasi bo'sh — bo'lim umuman chiqmaydi (shovqin emas)
  if (items.length === 0 && myPosts.length === 0) return null;

  return (
    <section className="card" aria-labelledby="activity-title">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 id="activity-title" className="font-display text-[17px] font-semibold text-fg">
            Faollik
          </h2>
          <p className="text-[12px] text-fg-3">Reaksiya, izoh, obunachi va sharhlar</p>
        </div>
        <Link href="/kabinet/bildirishnomalar?filter=social" className="text-[13px] font-semibold text-fg-2 underline-offset-2 hover:underline">
          Hammasi
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="border-t border-line px-5 py-5 text-[13px] text-fg-3">Hali faollik yo&apos;q — post joylang, obunachilar reaksiya bildiradi.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {items.map((it) => {
            const Icon = KIND_ICON[it.kind];
            const inner = (
              <>
                <span className="relative shrink-0">
                  <Avatar name={it.who.name} src={it.who.avatarUrl} size={36} decorative />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-surface text-fg-3 ring-1 ring-line" aria-hidden="true">
                    <Icon size={10} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-fg">
                    <span className="font-semibold">{it.who.name}</span> <span className="text-fg-2">{it.text}</span>
                  </span>
                  <time dateTime={new Date(it.at).toISOString()} className="block text-[11.5px] text-fg-4">
                    {timeAgo(it.at)}
                  </time>
                </span>
              </>
            );
            const cls = "press flex min-h-12 items-center gap-3 px-5 py-2.5 transition hover:bg-fg/4";
            return (
              <li key={it.key}>
                {it.href ? (
                  <Link href={it.href} className={cls}>
                    {inner}
                  </Link>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
