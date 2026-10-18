import "server-only";
import { and, desc, eq, gt, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, jobs, portfolioItems, posts, specialists, users, vacancies } from "@/lib/db/schema";
import { briefUsers } from "@/lib/groups/service";
import { getSettings } from "@/lib/payments/settings";
import { listableCondition } from "@/lib/subscriptions/access";
import { isVideoAttachment } from "@/components/chat/attachments";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { HELP_ARTICLES } from "@/app/yordam/articles";
import { professionLabel, salaryLabel } from "@/lib/vacancies/format";

/**
 * Global qidiruv (⌘K): mutaxassislar, vakansiyalar, jamoalar, ishlar, yordam maqolalari, sahifalar.
 * Har bo'limdan 5 tagacha; faqat ommaviy ko'rinadigan yozuvlar (yashirin/bloklangan emas).
 */
export interface SearchItem {
  title: string;
  sub?: string;
  href: string;
}
export interface SearchSection {
  key: "pages" | "specialists" | "vacancies" | "groups" | "jobs" | "help";
  label: string;
  items: SearchItem[];
}

const PAGES: SearchItem[] = [
  { title: "Xarita", sub: "Hudud bo'yicha ijodkorlar", href: "/xarita" },
  { title: "Ijodkorlar katalogi", sub: "Videograf, dizayner, montajchi…", href: "/mutaxassislar" },
  { title: "Lenta", sub: "Ishlar video lentasi", href: "/lenta" },
  { title: "Qidiruv", sub: "Videolar, ishlar, postlar, ijodkorlar", href: "/qidiruv" },
  { title: "Jamoalar va kanallar", sub: "Hamjamiyat, efirlar", href: "/jamoalar" },
  { title: "Vakansiyalar", sub: "Onlayn ish o'rinlari", href: "/vakansiyalar" },
  { title: "Rezyumelar", sub: "Nomzodlar katalogi", href: "/rezyumelar" },
  { title: "Ishlar (e'lonlar)", sub: "Mijozlarning ochiq loyihalari", href: "/ishlar" },
  { title: "Narxlar", sub: "Obuna va komissiya", href: "/narxlar" },
  { title: "Biz haqimizda", sub: "Loyiha va asoschi", href: "/haqida" },
  { title: "Yordam markazi", sub: "Savol-javoblar", href: "/yordam" },
  { title: "Kabinet", sub: "Buyurtmalar, chat, sozlamalar", href: "/kabinet" },
  { title: "Vakansiya joylash", sub: "Bepul, 2 daqiqa", href: "/vakansiyalar/yangi" },
  { title: "Guruh yoki kanal ochish", sub: "Jamoalar", href: "/jamoalar/yangi" },
  { title: "Rezyumem", sub: "Kabinet", href: "/kabinet/rezyume" },
];

const norm = (s: string) => s.toLowerCase().replace(/[’'ʻ`]/g, "'");

export async function globalSearch(q: string): Promise<SearchSection[]> {
  const needle = `%${norm(q).replace(/[%_]/g, "")}%`;
  const nq = norm(q);
  const now = new Date();
  // Obunasi tugagan profillar katalog kabi paletda ham chiqmasin (listableCondition)
  const settings = await getSettings();
  const [spec, vac, grp, job] = await Promise.all([
    db
      .select({ slug: specialists.slug, title: specialists.title, name: users.name, category: specialists.category })
      .from(specialists)
      .innerJoin(users, eq(users.id, specialists.userId))
      .where(and(eq(specialists.isHidden, false), eq(users.isBanned, false), listableCondition(settings), or(like(sql`lower(${users.name})`, needle), like(sql`lower(${specialists.title})`, needle))))
      .orderBy(desc(specialists.rating), desc(specialists.createdAt))
      .limit(5),
    db
      .select({ id: vacancies.id, title: vacancies.title, company: vacancies.company, profession: vacancies.profession, min: vacancies.salaryMin, max: vacancies.salaryMax })
      .from(vacancies)
      .where(and(eq(vacancies.status, "open"), or(isNull(vacancies.expiresAt), gt(vacancies.expiresAt, now)), or(like(sql`lower(${vacancies.title})`, needle), like(sql`lower(${vacancies.company})`, needle), like(sql`lower(${vacancies.skills})`, needle))))
      .orderBy(desc(vacancies.createdAt))
      .limit(5),
    db
      .select({ slug: groups.slug, name: groups.name, kind: groups.kind, members: groups.membersCount, isOfficial: groups.isOfficial })
      .from(groups)
      .where(or(like(sql`lower(${groups.name})`, needle), like(sql`lower(${groups.description})`, needle)))
      .orderBy(desc(groups.isOfficial), desc(groups.membersCount))
      .limit(5),
    db
      .select({ id: jobs.id, title: jobs.title, category: jobs.category })
      .from(jobs)
      .where(and(eq(jobs.status, "open"), or(like(sql`lower(${jobs.title})`, needle), like(sql`lower(${jobs.description})`, needle))))
      .orderBy(desc(jobs.createdAt))
      .limit(5),
  ]);
  const help = HELP_ARTICLES.filter((a) => norm(a.title).includes(nq) || norm(a.summary).includes(nq) || a.keywords.some((k) => norm(k).includes(nq))).slice(0, 4);
  const pages = PAGES.filter((p) => norm(p.title).includes(nq) || norm(p.sub ?? "").includes(nq)).slice(0, 4);

  const sections: SearchSection[] = [
    { key: "pages", label: "Sahifalar", items: pages },
    { key: "specialists", label: "Ijodkorlar", items: spec.map((s) => ({ title: s.name, sub: `${s.title} · ${CATEGORY_BY_SLUG[s.category]?.name ?? s.category}`, href: `/mutaxassislar/${s.slug}` })) },
    { key: "vacancies", label: "Vakansiyalar", items: vac.map((v) => ({ title: v.title, sub: `${v.company || professionLabel(v.profession, true)} · ${salaryLabel(v.min, v.max)}`, href: `/vakansiyalar/${v.id}` })) },
    { key: "groups", label: "Jamoalar", items: grp.map((g) => ({ title: g.name, sub: `${g.isOfficial ? "Rasmiy kanal" : g.kind === "channel" ? "Kanal" : "Guruh"} · ${g.members} a'zo`, href: `/jamoalar/${g.slug}` })) },
    { key: "jobs", label: "Ishlar", items: job.map((j) => ({ title: j.title, sub: CATEGORY_BY_SLUG[j.category]?.name ?? j.category, href: `/ishlar/${j.id}` })) },
    { key: "help", label: "Yordam", items: help.map((a) => ({ title: a.title, sub: a.summary.slice(0, 80), href: `/yordam/${a.slug}` })) },
  ];
  return sections.filter((s) => s.items.length > 0);
}

/* ------------------------------------------------------------------ */
/* Ommaviy qidiruv zonasi (/qidiruv, Explore)                          */
/* ------------------------------------------------------------------ */
export const EXPLORE_TYPES = ["all", "video", "work", "post", "people", "groups", "vacancies"] as const;
export type ExploreType = (typeof EXPLORE_TYPES)[number];
export interface PersonHit {
  slug: string;
  name: string;
  title: string;
  avatarUrl: string | null;
  category: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
}
export interface MediaHit {
  kind: "work" | "post";
  id: string;
  href: string;
  thumbUrl: string | null;
  videoUrl: string | null;
  isVideo: boolean;
  textOnly: boolean;
  count: number;
  /** Video ostidagi matn: ish sarlavhasi/tavsifi yoki post matni */
  caption: string;
  author: { name: string; avatarUrl: string | null; slug: string | null };
  likes: number;
  comments: number;
  createdAt: number;
}
export interface ExploreResult {
  q: string;
  type: ExploreType;
  people: PersonHit[];
  media: MediaHit[];
  sections: SearchSection[];
}

/** Post media JSON'ida video bormi (type "video/…" yoki .mp4/.webm/.mov) */
const POST_VIDEO = or(
  like(sql`lower(${posts.media})`, '%"type":"video/%'),
  like(sql`lower(${posts.media})`, "%.mp4%"),
  like(sql`lower(${posts.media})`, "%.webm%"),
  like(sql`lower(${posts.media})`, "%.mov%"),
)!;

/**
 * Video ostidagi matnlar (portfolio sarlavha/tavsif/teglar), post matnlari va ijodkor nomlari bo'yicha ommaviy qidiruv.
 * Faqat ko'rinadigan ijodkorlar (bloklanmagan, yashirilmagan, obunasi faol) va ochiq jamoalar/profil postlari.
 * So'rov bo'sh bo'lsa — eng yangi media (Explore lentasi).
 */
export async function exploreSearch(qRaw: string, type: ExploreType = "all"): Promise<ExploreResult> {
  const q = qRaw.trim();
  const needle = q ? `%${norm(q).replace(/[%_]/g, "")}%` : null;
  const settings = await getSettings();
  const visible = and(eq(users.isBanned, false), eq(specialists.isHidden, false), listableCondition(settings))!;
  // "groups" / "vacancies" turlari — faqat bo'limlar (globalSearch), media va odamlar so'ralmaydi
  const onlySections = type === "groups" || type === "vacancies";
  const wantPeople = Boolean(needle) && (type === "all" || type === "people");
  const wantWorks = !onlySections && (type === "all" || type === "video" || type === "work");
  const wantPosts = !onlySections && (type === "all" || type === "video" || type === "post");
  const limit = needle ? 24 : 18;

  const [people, works, postRows] = await Promise.all([
    wantPeople && needle
      ? db
          .select({ slug: specialists.slug, name: users.name, title: specialists.title, avatarUrl: users.avatarUrl, category: specialists.category, rating: specialists.rating, reviewCount: specialists.reviewCount, isVerified: specialists.isVerified })
          .from(specialists)
          .innerJoin(users, eq(users.id, specialists.userId))
          .where(and(visible, or(like(sql`lower(${users.name})`, needle), like(sql`lower(${specialists.title})`, needle), like(sql`lower(${specialists.bio})`, needle), like(sql`lower(${specialists.skills})`, needle))))
          .orderBy(desc(specialists.rating), desc(specialists.reviewCount))
          .limit(12)
      : Promise.resolve([]),
    wantWorks
      ? db
          .select({ id: portfolioItems.id, title: portfolioItems.title, type: portfolioItems.type, url: portfolioItems.url, thumbnailUrl: portfolioItems.thumbnailUrl, description: portfolioItems.description, createdAt: portfolioItems.createdAt, slug: specialists.slug, name: users.name, avatarUrl: users.avatarUrl })
          .from(portfolioItems)
          .innerJoin(specialists, eq(specialists.id, portfolioItems.specialistId))
          .innerJoin(users, eq(users.id, specialists.userId))
          .where(
            and(
              visible,
              type === "video" ? eq(portfolioItems.type, "video") : undefined,
              needle ? or(like(sql`lower(${portfolioItems.title})`, needle), like(sql`lower(${portfolioItems.description})`, needle), like(sql`lower(${portfolioItems.tags})`, needle), like(sql`lower(${users.name})`, needle), like(sql`lower(${specialists.title})`, needle)) : undefined,
            ),
          )
          .orderBy(desc(portfolioItems.createdAt))
          .limit(limit)
      : Promise.resolve([]),
    wantPosts
      ? db
          .select({ p: posts, gslug: groups.slug })
          .from(posts)
          .innerJoin(users, eq(users.id, posts.authorId))
          .leftJoin(groups, eq(groups.id, posts.groupId))
          .where(
            and(
              eq(users.isBanned, false),
              or(isNull(posts.groupId), eq(groups.isPrivate, false)),
              type === "video" ? POST_VIDEO : undefined,
              needle ? or(like(sql`lower(${posts.body})`, needle), like(sql`lower(${users.name})`, needle)) : sql`${posts.media} != '[]'`,
            ),
          )
          .orderBy(desc(posts.createdAt))
          .limit(limit)
      : Promise.resolve([]),
  ]);

  const authors = await briefUsers(postRows.map((r) => r.p.authorId));
  const mediaPosts: MediaHit[] = postRows.map(({ p, gslug }) => {
    const a = authors.get(p.authorId);
    const first = p.media[0];
    const video = first ? isVideoAttachment(first) : false;
    return {
      kind: "post",
      id: p.id,
      href: gslug ? `/jamoalar/${gslug}?post=${p.id}` : a?.slug ? `/mutaxassislar/${a.slug}?tab=postlar&post=${p.id}` : "/jamoalar",
      thumbUrl: first && !video ? first.url : null,
      videoUrl: first && video ? first.url : null,
      isVideo: video,
      textOnly: p.media.length === 0,
      count: p.media.length,
      caption: p.body.replace(/\s+/g, " ").trim().slice(0, 160),
      author: { name: a?.name ?? "Foydalanuvchi", avatarUrl: a?.avatarUrl ?? null, slug: a?.slug ?? null },
      likes: p.likesCount,
      comments: p.commentsCount,
      createdAt: p.createdAt.getTime(),
    };
  });
  const mediaWorks: MediaHit[] = works.map((w) => ({
    kind: "work",
    id: w.id,
    // ?ish=<id> — profil oynasida aynan shu ish ochiladi (ProfileTabs chuqur havolasi)
    href: `/mutaxassislar/${w.slug}?tab=${w.type === "video" ? "videolar" : "ishlar"}&ish=${w.id}`,
    thumbUrl: w.type === "image" ? w.url : w.thumbnailUrl,
    videoUrl: w.type === "video" ? w.url : null,
    isVideo: w.type === "video",
    textOnly: false,
    count: 1,
    caption: [w.title, w.description].filter(Boolean).join(" — ").slice(0, 160),
    author: { name: w.name, avatarUrl: w.avatarUrl, slug: w.slug },
    likes: 0,
    comments: 0,
    createdAt: w.createdAt.getTime(),
  }));
  let media = [...mediaWorks, ...mediaPosts];
  if (type === "video") media = media.filter((m) => m.isVideo);
  media.sort((a, b) => b.createdAt - a.createdAt);
  const wantedSections = type === "groups" ? ["groups"] : type === "vacancies" ? ["vacancies", "jobs"] : type === "all" ? ["groups", "vacancies", "jobs", "help"] : [];
  const sections = needle && wantedSections.length ? (await globalSearch(q)).filter((s) => wantedSections.includes(s.key)) : [];
  return { q, type, people, media: media.slice(0, 48), sections };
}
