import { and, asc, gte, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { handler, ok, requireSession } from "@/lib/api";

/** Efirlar kalendari oynasi: o'tgan 7 kun + barcha kelgusi */
const PAST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Admin: barcha kanal/jamoalardagi jonli efir e'lonlari (posts.eventAt) — bitta kalendar.
 * Faqat o'qish; havola va matn parchasi bilan.
 */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  const now = Date.now();
  const rows = await db.query.posts.findMany({
    where: and(isNotNull(posts.eventAt), gte(posts.eventAt, new Date(now - PAST_WINDOW_MS))),
    orderBy: [asc(posts.eventAt)],
    limit: 60,
    columns: { id: true, body: true, eventAt: true, eventUrl: true, groupId: true },
    with: {
      group: { columns: { slug: true, name: true, kind: true, isOfficial: true } },
      author: { columns: { name: true } },
    },
  });
  return ok(
    rows.map((p) => ({
      id: p.id,
      title: p.body.trim().split("\n")[0]?.slice(0, 120) || "Efir",
      eventAt: p.eventAt!.getTime(),
      eventUrl: p.eventUrl,
      past: p.eventAt!.getTime() < now,
      group: p.group ? { slug: p.group.slug, name: p.group.name, kind: p.group.kind, isOfficial: p.group.isOfficial } : null,
      author: p.author?.name ?? null,
      href: p.group ? `/jamoalar/${p.group.slug}?post=${p.id}` : null,
    })),
  );
});
