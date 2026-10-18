import { desc, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { groups, users, vacancies } from "@/lib/db/schema";
import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { escapeLike } from "@/lib/utils";

const schema = z.object({ q: z.string().trim().max(80).optional() });

/** Vakansiya avto-bayroqlari: oldindan to'lov so'rash va matnda to'g'ridan-to'g'ri kontakt (sayt ichidagi arizani chetlab o'tish) */
const PREPAYMENT_RE = /(oldindan\s*to['’ʻ]?lov|avans|предоплат|депозит|depozit|kafolat\s*puli|garov\s*puli|ro['’ʻ]?yxat(dan)?\s*o['’ʻ]?tish\s*(uchun\s*)?to['’ʻ]?lov|registratsiya\s*to['’ʻ]?lovi|to['’ʻ]?lov\s*qil(ing|asiz|sangiz)|взнос|оплат[аиу]\s*(за\s*)?(регистрац|обучен|анкет)|платн(ое|ая)\s*обучен)/i;
const CONTACT_RE = /(@[a-z0-9_]{5,}|\+?998[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|t\.me\/)/i;
type VacancyFlag = "prepayment" | "contact";

function vacancyFlags(v: { title: string; description: string; requirements: string; company: string }): VacancyFlag[] {
  const text = `${v.title}\n${v.company}\n${v.description}\n${v.requirements}`;
  const flags: VacancyFlag[] = [];
  if (PREPAYMENT_RE.test(text)) flags.push("prepayment");
  if (CONTACT_RE.test(`${v.description}\n${v.requirements}`)) flags.push("contact");
  return flags;
}

/**
 * Admin: jamoalar va vakansiyalar moderatsiyasi — ro'yxat (qidiruv bilan), egasi, hisoblagichlar,
 * jamoa postlari bo'yicha ochiq shikoyatlar soni, vakansiya avto-bayroqlari. Amallar — alohida route'larda.
 */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const { q } = parseQuery(req.url, schema);
  const term = q ? `%${escapeLike(q.toLowerCase())}%` : null;

  const [groupRows, vacancyRows] = await Promise.all([
    db.query.groups.findMany({
      where: term ? or(sql`lower(${groups.name}) like ${term} escape '\\'`, sql`lower(${groups.slug}) like ${term} escape '\\'`) : undefined,
      orderBy: [desc(groups.lastActivityAt), desc(groups.createdAt)],
      limit: 100,
      columns: { id: true, slug: true, name: true, kind: true, isPrivate: true, isOfficial: true, membersCount: true, postsCount: true, lastActivityAt: true, createdAt: true, ownerId: true },
      extras: {
        // Shu jamoa postlari bo'yicha ochiq shikoyatlar (xom identifikatorlar — relational builder extras cheklovi)
        openReports: sql<number>`(select count(*) from reports r join posts p on p.id = r.target_id where r.target_type = 'post' and r.status = 'open' and p.group_id = groups.id)`.as("open_reports"),
      },
      with: { owner: { columns: { id: true, name: true, email: true, isBanned: true } } },
    }),
    db.query.vacancies.findMany({
      where: term ? or(sql`lower(${vacancies.title}) like ${term} escape '\\'`, sql`lower(${vacancies.company}) like ${term} escape '\\'`) : undefined,
      orderBy: [desc(vacancies.createdAt)],
      limit: 100,
      // vacancies jadvalida users bilan relation yo'q — muallif alohida so'rov bilan
      columns: { id: true, authorId: true, title: true, company: true, profession: true, description: true, requirements: true, status: true, applicationsCount: true, viewCount: true, expiresAt: true, createdAt: true, applyUrl: true },
    }),
  ]);
  const authorIds = [...new Set(vacancyRows.map((v) => v.authorId))];
  const authors = new Map((authorIds.length ? await db.query.users.findMany({ where: inArray(users.id, authorIds), columns: { id: true, name: true, email: true, isBanned: true } }) : []).map((u) => [u.id, u]));

  const now = Date.now();
  return ok({
    groups: groupRows.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      kind: g.kind,
      isPrivate: g.isPrivate,
      isOfficial: g.isOfficial,
      membersCount: g.membersCount,
      postsCount: g.postsCount,
      openReports: Number(g.openReports ?? 0),
      lastActivityAt: g.lastActivityAt?.getTime() ?? null,
      createdAt: g.createdAt.getTime(),
      owner: g.owner ? { id: g.owner.id, name: g.owner.name, email: g.owner.email, isBanned: g.owner.isBanned } : null,
    })),
    vacancies: vacancyRows.map((v) => ({
      id: v.id,
      title: v.title,
      company: v.company,
      profession: v.profession,
      status: v.status,
      expired: Boolean(v.expiresAt && v.expiresAt.getTime() < now),
      applicationsCount: v.applicationsCount,
      viewCount: v.viewCount,
      createdAt: v.createdAt.getTime(),
      expiresAt: v.expiresAt?.getTime() ?? null,
      externalApply: Boolean(v.applyUrl),
      flags: vacancyFlags(v),
      author: authors.get(v.authorId) ?? null,
    })),
  });
});
