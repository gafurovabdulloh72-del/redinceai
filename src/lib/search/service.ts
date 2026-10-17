import "server-only";
import { and, desc, eq, gt, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, jobs, specialists, users, vacancies } from "@/lib/db/schema";
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
  const [spec, vac, grp, job] = await Promise.all([
    db
      .select({ slug: specialists.slug, title: specialists.title, name: users.name, category: specialists.category })
      .from(specialists)
      .innerJoin(users, eq(users.id, specialists.userId))
      .where(and(eq(specialists.isHidden, false), eq(users.isBanned, false), or(like(sql`lower(${users.name})`, needle), like(sql`lower(${specialists.title})`, needle))))
      .orderBy(desc(specialists.createdAt))
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
