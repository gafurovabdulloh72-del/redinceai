import "server-only";
import { and, desc, eq, gt, inArray, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, resumes, specialists, users, vacancies, vacancySaves, type Application, type Resume, type Vacancy } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { uid } from "@/lib/utils";
import { APPLICATION_STATUS, COVER_LETTER_MIN, REMOTE_REGION, VACANCY_TTL_DAYS, type ApplicationStatus } from "./format";
import type { ResumeFilter, ResumeInput, VacancyFilter, VacancyInput } from "./validators";

/**
 * Vakansiyalar: ish beruvchi e'lonlari (to'lovsiz), rezyumelar, arizalar.
 * Maxfiylik: nomzodning aloqa ma'lumotlari (email/telefon) FAQAT o'zi ariza yuborgan vakansiya egasiga ko'rinadi;
 * ommaviy rezyumeda kontakt yo'q — ish beruvchi sayt ichidagi chat (/yozish/<username>) orqali yozadi.
 */

type Viewer = { id: string; role: string } | null;

export interface UserMini {
  id: string;
  name: string;
  avatarUrl: string | null;
  username: string | null;
  emailVerified: boolean;
  /** Mutaxassis profili (bor bo'lsa) */
  specialistSlug: string | null;
}

export interface VacancyCard {
  id: string;
  title: string;
  company: string;
  profession: string;
  format: Vacancy["format"];
  employment: Vacancy["employment"];
  experience: Vacancy["experience"];
  salaryMin: number | null;
  salaryMax: number | null;
  regionSlug: string | null;
  skills: string[];
  applicationsCount: number;
  status: Vacancy["status"];
  createdAt: number;
  expiresAt: number | null;
  author: UserMini;
}

export interface VacancyView extends VacancyCard {
  description: string;
  requirements: string;
  applyUrl: string | null;
  viewCount: number;
  isOwner: boolean;
  /** Ko'ruvchining arizasi (bo'lsa) */
  myApplication: { id: string; status: ApplicationStatus; createdAt: number } | null;
  /** Ariza yuborish mumkinmi: ochiq, muddati o'tmagan, egasi emas, hali ariza bermagan */
  canApply: boolean;
  /** Muddati o'tganmi (ro'yxatda chiqmaydi, lekin havola orqali ochiladi) */
  expired: boolean;
  /** Ko'ruvchi saqlab qo'yganmi (bookmark) */
  savedByMe: boolean;
}

export interface ResumeCard {
  id: string;
  userId: string;
  title: string;
  profession: string;
  summary: string;
  skills: string[];
  experience: Resume["experience"];
  expectedSalary: number | null;
  format: Resume["format"];
  regionSlug: string | null;
  updatedAt: number;
  user: UserMini;
}

export interface ResumeView extends ResumeCard {
  links: Array<{ label: string; url: string }>;
  isPublic: boolean;
  isOwner: boolean;
}

export interface ApplicantView {
  id: string;
  status: ApplicationStatus;
  coverLetter: string;
  createdAt: number;
  user: UserMini & { email: string; phone: string | null };
  resume: Pick<ResumeView, "id" | "title" | "profession" | "experience" | "skills" | "expectedSalary" | "links" | "summary"> | null;
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  coverLetter: string;
  createdAt: number;
  vacancy: Pick<VacancyCard, "id" | "title" | "company" | "profession" | "format" | "salaryMin" | "salaryMax" | "status"> & { expired: boolean };
}

/* ------------------------------------------------------------------ */
/* Yordamchilar                                                        */
/* ------------------------------------------------------------------ */
const isAdmin = (v: Viewer) => v?.role === "admin";

async function usersMini(ids: string[]): Promise<Map<string, UserMini & { email: string; phone: string | null }>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const map = new Map<string, UserMini & { email: string; phone: string | null }>();
  if (!unique.length) return map;
  const rows = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl, username: users.username, emailVerified: users.emailVerified, email: users.email, phone: users.phone, slug: specialists.slug })
    .from(users)
    .leftJoin(specialists, eq(specialists.userId, users.id))
    .where(inArray(users.id, unique));
  for (const r of rows) {
    map.set(r.id, { id: r.id, name: r.name, avatarUrl: r.avatarUrl, username: r.username, emailVerified: Boolean(r.emailVerified), specialistSlug: r.slug ?? null, email: r.email, phone: r.phone ?? null });
  }
  return map;
}

const UNKNOWN: UserMini & { email: string; phone: string | null } = { id: "", name: "Foydalanuvchi", avatarUrl: null, username: null, emailVerified: false, specialistSlug: null, email: "", phone: null };
const pub = (u: UserMini & { email: string; phone: string | null }): UserMini => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl, username: u.username, emailVerified: u.emailVerified, specialistSlug: u.specialistSlug });

function needle(q: string) {
  return `%${q.toLowerCase().replace(/[%_]/g, "")}%`;
}

function toCard(v: Vacancy, author: UserMini): VacancyCard {
  return {
    id: v.id,
    title: v.title,
    company: v.company,
    profession: v.profession,
    format: v.format,
    employment: v.employment,
    experience: v.experience,
    salaryMin: v.salaryMin,
    salaryMax: v.salaryMax,
    regionSlug: v.regionSlug,
    skills: v.skills,
    applicationsCount: v.applicationsCount,
    status: v.status,
    createdAt: v.createdAt.getTime(),
    expiresAt: v.expiresAt?.getTime() ?? null,
    author,
  };
}

const isExpired = (v: Pick<Vacancy, "expiresAt">, now = Date.now()) => Boolean(v.expiresAt && v.expiresAt.getTime() < now);

/* ------------------------------------------------------------------ */
/* Vakansiyalar                                                        */
/* ------------------------------------------------------------------ */
export async function listVacancies(filter: VacancyFilter, now = Date.now()): Promise<{ items: VacancyCard[]; total: number; page: number; pages: number }> {
  const conds: SQL[] = [eq(vacancies.status, "open"), or(isNull(vacancies.expiresAt), gt(vacancies.expiresAt, new Date(now)))!, eq(users.isBanned, false)];
  if (filter.profession) conds.push(eq(vacancies.profession, filter.profession));
  if (filter.format) conds.push(eq(vacancies.format, filter.format));
  if (filter.employment) conds.push(eq(vacancies.employment, filter.employment));
  if (filter.experience) conds.push(eq(vacancies.experience, filter.experience));
  if (filter.region === REMOTE_REGION) conds.push(isNull(vacancies.regionSlug));
  else if (filter.region) conds.push(or(eq(vacancies.regionSlug, filter.region), isNull(vacancies.regionSlug))!);
  if (filter.q) {
    const n = needle(filter.q);
    conds.push(or(like(sql`lower(${vacancies.title})`, n), like(sql`lower(${vacancies.company})`, n), like(sql`lower(${vacancies.description})`, n), like(sql`lower(${vacancies.skills})`, n))!);
  }
  if (filter.min > 0) conds.push(sql`coalesce(${vacancies.salaryMax}, ${vacancies.salaryMin}, 0) >= ${filter.min}`);
  const where = and(...conds);
  const orderBy = filter.sort === "salary_high" ? [desc(sql`coalesce(${vacancies.salaryMax}, ${vacancies.salaryMin}, 0)`), desc(vacancies.createdAt)] : [desc(vacancies.createdAt)];

  const [[{ total }], rows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(vacancies).innerJoin(users, eq(users.id, vacancies.authorId)).where(where),
    db
      .select({ v: vacancies })
      .from(vacancies)
      .innerJoin(users, eq(users.id, vacancies.authorId))
      .where(where)
      .orderBy(...orderBy)
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit),
  ]);
  const authors = await usersMini(rows.map((r) => r.v.authorId));
  const pages = Math.max(1, Math.ceil(Number(total) / filter.limit));
  return { items: rows.map((r) => toCard(r.v, pub(authors.get(r.v.authorId) ?? UNKNOWN))), total: Number(total), page: filter.page, pages };
}

/** Kasb bo'yicha ochiq vakansiyalar soni (chiplar uchun) */
export async function vacancyCountsByProfession(now = Date.now()): Promise<Record<string, number>> {
  const rows = await db
    .select({ p: vacancies.profession, n: sql<number>`count(*)` })
    .from(vacancies)
    .innerJoin(users, eq(users.id, vacancies.authorId))
    .where(and(eq(vacancies.status, "open"), or(isNull(vacancies.expiresAt), gt(vacancies.expiresAt, new Date(now))), eq(users.isBanned, false)))
    .groupBy(vacancies.profession);
  return Object.fromEntries(rows.map((r) => [r.p, Number(r.n)]));
}

export async function loadVacancy(id: string): Promise<Vacancy | null> {
  return (await db.query.vacancies.findFirst({ where: eq(vacancies.id, id) })) ?? null;
}

export async function getVacancyView(id: string, viewer: Viewer): Promise<VacancyView | null> {
  const v = await loadVacancy(id);
  if (!v) return null;
  const [authors, mine, saved] = await Promise.all([
    usersMini([v.authorId]),
    viewer ? db.query.applications.findFirst({ where: and(eq(applications.vacancyId, v.id), eq(applications.userId, viewer.id)) }) : Promise.resolve(null),
    viewer ? db.query.vacancySaves.findFirst({ where: and(eq(vacancySaves.vacancyId, v.id), eq(vacancySaves.userId, viewer.id)), columns: { id: true } }) : Promise.resolve(null),
  ]);
  const isOwner = Boolean(viewer && (viewer.id === v.authorId || isAdmin(viewer)));
  const expired = isExpired(v);
  return {
    ...toCard(v, pub(authors.get(v.authorId) ?? UNKNOWN)),
    description: v.description,
    requirements: v.requirements,
    applyUrl: v.applyUrl,
    viewCount: v.viewCount,
    isOwner,
    myApplication: mine ? { id: mine.id, status: mine.status, createdAt: mine.createdAt.getTime() } : null,
    canApply: Boolean(viewer) && !isOwner && v.status === "open" && !expired && !mine,
    expired,
    savedByMe: Boolean(saved),
  };
}

/** Saqlash/olib tashlash (bookmark) — {saved} qaytaradi */
export async function toggleSaveVacancy(vacancyId: string, userId: string): Promise<{ saved: boolean }> {
  const existing = await db.query.vacancySaves.findFirst({ where: and(eq(vacancySaves.vacancyId, vacancyId), eq(vacancySaves.userId, userId)) });
  if (existing) {
    await db.delete(vacancySaves).where(eq(vacancySaves.id, existing.id));
    return { saved: false };
  }
  await db.insert(vacancySaves).values({ id: uid(), vacancyId, userId, createdAt: new Date() }).onConflictDoNothing();
  return { saved: true };
}

/** Saqlangan vakansiyalar (yangi saqlanganlar tepada) */
export async function mySavedVacancies(userId: string): Promise<Array<VacancyCard & { expired: boolean }>> {
  const rows = await db
    .select({ v: vacancies })
    .from(vacancySaves)
    .innerJoin(vacancies, eq(vacancies.id, vacancySaves.vacancyId))
    .where(eq(vacancySaves.userId, userId))
    .orderBy(desc(vacancySaves.createdAt))
    .limit(50);
  const authors = await usersMini(rows.map((r) => r.v.authorId));
  return rows.map((r) => ({ ...toCard(r.v, pub(authors.get(r.v.authorId) ?? UNKNOWN)), expired: isExpired(r.v) }));
}

/** Shunga o'xshash ochiq vakansiyalar: avval shu kasb, keyin shu format — joriy e'londan tashqari */
export async function similarVacancies(v: Vacancy, limit = 3, now = Date.now()): Promise<VacancyCard[]> {
  const rows = await db
    .select({ v: vacancies })
    .from(vacancies)
    .innerJoin(users, eq(users.id, vacancies.authorId))
    .where(and(eq(vacancies.status, "open"), or(isNull(vacancies.expiresAt), gt(vacancies.expiresAt, new Date(now))), eq(users.isBanned, false), sql`${vacancies.id} != ${v.id}`, or(eq(vacancies.profession, v.profession), eq(vacancies.format, v.format))))
    .orderBy(desc(sql`case when ${vacancies.profession} = ${v.profession} then 1 else 0 end`), desc(vacancies.createdAt))
    .limit(limit);
  const authors = await usersMini(rows.map((r) => r.v.authorId));
  return rows.map((r) => toCard(r.v, pub(authors.get(r.v.authorId) ?? UNKNOWN)));
}

export async function bumpVacancyView(id: string): Promise<void> {
  await db.update(vacancies).set({ viewCount: sql`${vacancies.viewCount} + 1` }).where(eq(vacancies.id, id));
}

export async function createVacancy(userId: string, input: VacancyInput): Promise<Vacancy> {
  const now = new Date();
  const row: typeof vacancies.$inferInsert = {
    id: uid(),
    authorId: userId,
    title: input.title,
    company: input.company ?? "",
    profession: input.profession,
    description: input.description,
    requirements: input.requirements ?? "",
    format: input.format,
    employment: input.employment,
    experience: input.experience,
    salaryMin: input.salaryMin,
    salaryMax: input.salaryMax,
    regionSlug: input.regionSlug,
    skills: input.skills,
    applyUrl: input.applyUrl,
    status: "open",
    applicationsCount: 0,
    viewCount: 0,
    expiresAt: new Date(now.getTime() + VACANCY_TTL_DAYS * 86_400_000),
    createdAt: now,
    updatedAt: now,
  };
  const [created] = await db.insert(vacancies).values(row).returning();
  return created;
}

export function assertVacancyOwner(v: Vacancy, viewer: Viewer): void {
  if (!viewer) throw new ApiError(401, "Avval tizimga kiring");
  if (viewer.id !== v.authorId && !isAdmin(viewer)) throw new ApiError(403, "Bu vakansiya sizniki emas");
}

export async function updateVacancy(v: Vacancy, patch: Partial<VacancyInput> & { status?: Vacancy["status"]; extend?: boolean }): Promise<Vacancy> {
  const set: Partial<typeof vacancies.$inferInsert> = { updatedAt: new Date() };
  for (const k of ["title", "company", "profession", "description", "requirements", "format", "employment", "experience", "salaryMin", "salaryMax", "regionSlug", "skills", "applyUrl"] as const) {
    if (patch[k] !== undefined) (set as Record<string, unknown>)[k] = patch[k];
  }
  if (patch.status) set.status = patch.status;
  // Uzaytirish: muddat bugundan boshlab yana 30 kun, e'lon qayta ochiladi
  if (patch.extend) {
    set.expiresAt = new Date(Date.now() + VACANCY_TTL_DAYS * 86_400_000);
    set.status = "open";
  }
  const [row] = await db.update(vacancies).set(set).where(eq(vacancies.id, v.id)).returning();
  return row;
}

export async function deleteVacancy(id: string): Promise<void> {
  await db.delete(vacancies).where(eq(vacancies.id, id));
}

/** Mening vakansiyalarim (yangi arizalar soni bilan) — kabinet */
export async function myVacancies(userId: string): Promise<Array<VacancyCard & { newApplications: number; viewCount: number; expired: boolean }>> {
  const rows = await db.query.vacancies.findMany({ where: eq(vacancies.authorId, userId), orderBy: [desc(vacancies.createdAt)] });
  if (!rows.length) return [];
  const [authors, fresh] = await Promise.all([
    usersMini([userId]),
    db
      .select({ vacancyId: applications.vacancyId, n: sql<number>`count(*)` })
      .from(applications)
      .where(
        and(
          inArray(
            applications.vacancyId,
            rows.map((r) => r.id),
          ),
          eq(applications.status, "new"),
        ),
      )
      .groupBy(applications.vacancyId),
  ]);
  const freshMap = new Map(fresh.map((f) => [f.vacancyId, Number(f.n)]));
  const me = pub(authors.get(userId) ?? UNKNOWN);
  return rows.map((v) => ({ ...toCard(v, me), newApplications: freshMap.get(v.id) ?? 0, viewCount: v.viewCount, expired: isExpired(v) }));
}

/* ------------------------------------------------------------------ */
/* Arizalar                                                            */
/* ------------------------------------------------------------------ */
export async function loadApplication(id: string): Promise<Application | null> {
  return (await db.query.applications.findFirst({ where: eq(applications.id, id) })) ?? null;
}

export async function listApplicants(vacancyId: string): Promise<ApplicantView[]> {
  const rows = await db.query.applications.findMany({ where: eq(applications.vacancyId, vacancyId), orderBy: [desc(applications.createdAt)] });
  if (!rows.length) return [];
  const ids = rows.map((r) => r.userId);
  const [people, res] = await Promise.all([usersMini(ids), db.query.resumes.findMany({ where: inArray(resumes.userId, ids) })]);
  const resumeBy = new Map(res.map((r) => [r.userId, r]));
  return rows.map((a) => {
    const u = people.get(a.userId) ?? UNKNOWN;
    const r = resumeBy.get(a.userId);
    return {
      id: a.id,
      status: a.status,
      coverLetter: a.coverLetter,
      createdAt: a.createdAt.getTime(),
      // Ariza yuborgan nomzod kontaktini ish beruvchiga ochadi (ariza formasida ogohlantiriladi)
      user: u,
      resume: r ? { id: r.id, title: r.title, profession: r.profession, experience: r.experience, skills: r.skills, expectedSalary: r.expectedSalary, links: r.links, summary: r.summary } : null,
    };
  });
}

export async function applyToVacancy(v: Vacancy, userId: string, coverLetter: string): Promise<Application> {
  if (v.authorId === userId) throw new ApiError(400, "O'z vakansiyangizga ariza bera olmaysiz");
  if (v.status !== "open" || isExpired(v)) throw new ApiError(409, "Bu vakansiya yopilgan yoki muddati o'tgan");
  const [existing, resume, author] = await Promise.all([
    db.query.applications.findFirst({ where: and(eq(applications.vacancyId, v.id), eq(applications.userId, userId)) }),
    db.query.resumes.findFirst({ where: eq(resumes.userId, userId), columns: { id: true } }),
    usersMini([userId]),
  ]);
  if (existing) throw new ApiError(409, "Siz bu vakansiyaga allaqachon ariza yuborgansiz");
  if (!resume && coverLetter.length < COVER_LETTER_MIN) {
    throw new ApiError(422, "Rezyume yo'q — qisqacha o'zingiz haqingizda yozing", { coverLetter: `Kamida ${COVER_LETTER_MIN} ta belgi (yoki avval rezyume to'ldiring)` });
  }
  const now = new Date();
  const row: typeof applications.$inferInsert = { id: uid(), vacancyId: v.id, userId, coverLetter, status: "new", createdAt: now, updatedAt: now };
  await db.transaction(async (tx) => {
    await tx.insert(applications).values(row);
    await tx.update(vacancies).set({ applicationsCount: sql`${vacancies.applicationsCount} + 1` }).where(eq(vacancies.id, v.id));
  });
  const who = author.get(userId)?.name ?? "Nomzod";
  await notify(v.authorId, "application_new", `Yangi ariza: ${v.title}`, `${who} vakansiyangizga ariza yubordi${resume ? " (rezyume bilan)" : ""}.`, `/kabinet/vakansiyalar?v=${v.id}`);
  return { ...row, status: "new", coverLetter, createdAt: now, updatedAt: now } as Application;
}

export async function setApplicationStatus(app: Application, v: Vacancy, status: ApplicationStatus): Promise<Application> {
  const [row] = await db.update(applications).set({ status, updatedAt: new Date() }).where(eq(applications.id, app.id)).returning();
  if (status !== "viewed" && status !== app.status) {
    const label = APPLICATION_STATUS[status];
    await notify(app.userId, "application_status", `Ariza holati: ${label}`, `«${v.title}»${v.company ? ` (${v.company})` : ""} — arizangiz holati: ${label.toLowerCase()}.`, `/kabinet/arizalarim`);
  }
  return row;
}

export async function withdrawApplication(app: Application): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(applications).where(eq(applications.id, app.id));
    await tx.update(vacancies).set({ applicationsCount: sql`max(${vacancies.applicationsCount} - 1, 0)` }).where(eq(vacancies.id, app.vacancyId));
  });
}

export async function myApplications(userId: string): Promise<MyApplication[]> {
  const rows = await db
    .select({ a: applications, v: vacancies })
    .from(applications)
    .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.createdAt));
  return rows.map(({ a, v }) => ({
    id: a.id,
    status: a.status,
    coverLetter: a.coverLetter,
    createdAt: a.createdAt.getTime(),
    vacancy: { id: v.id, title: v.title, company: v.company, profession: v.profession, format: v.format, salaryMin: v.salaryMin, salaryMax: v.salaryMax, status: v.status, expired: isExpired(v) },
  }));
}

/* ------------------------------------------------------------------ */
/* Rezyume                                                             */
/* ------------------------------------------------------------------ */
export async function getResume(userId: string): Promise<Resume | null> {
  return (await db.query.resumes.findFirst({ where: eq(resumes.userId, userId) })) ?? null;
}

export async function upsertResume(userId: string, input: ResumeInput): Promise<Resume> {
  const now = new Date();
  const existing = await getResume(userId);
  const values = {
    title: input.title,
    profession: input.profession,
    summary: input.summary ?? "",
    skills: input.skills,
    experience: input.experience,
    expectedSalary: input.expectedSalary,
    format: input.format,
    regionSlug: input.regionSlug,
    links: input.links,
    isPublic: input.isPublic,
    updatedAt: now,
  };
  if (existing) {
    const [row] = await db.update(resumes).set(values).where(eq(resumes.id, existing.id)).returning();
    return row;
  }
  const [row] = await db
    .insert(resumes)
    .values({ id: uid(), userId, createdAt: now, ...values })
    .returning();
  return row;
}

export async function deleteResume(userId: string): Promise<void> {
  await db.delete(resumes).where(eq(resumes.userId, userId));
}

function toResumeCard(r: Resume, user: UserMini, excerpt = true): ResumeCard {
  return {
    id: r.id,
    userId: r.userId,
    title: r.title,
    profession: r.profession,
    summary: excerpt ? r.summary.slice(0, 220) : r.summary,
    skills: r.skills,
    experience: r.experience,
    expectedSalary: r.expectedSalary,
    format: r.format,
    regionSlug: r.regionSlug,
    updatedAt: r.updatedAt.getTime(),
    user,
  };
}

export async function getResumeView(id: string, viewer: Viewer): Promise<ResumeView | null> {
  const r = (await db.query.resumes.findFirst({ where: eq(resumes.id, id) })) ?? null;
  if (!r) return null;
  const isOwner = Boolean(viewer && (viewer.id === r.userId || isAdmin(viewer)));
  if (!r.isPublic && !isOwner) return null;
  const u = (await usersMini([r.userId])).get(r.userId) ?? UNKNOWN;
  return { ...toResumeCard(r, pub(u), false), links: r.links, isPublic: r.isPublic, isOwner };
}

export async function listResumes(filter: ResumeFilter): Promise<{ items: ResumeCard[]; total: number; page: number; pages: number }> {
  const conds: SQL[] = [eq(resumes.isPublic, true), eq(users.isBanned, false)];
  if (filter.profession) conds.push(eq(resumes.profession, filter.profession));
  if (filter.experience) conds.push(eq(resumes.experience, filter.experience));
  if (filter.format) conds.push(filter.format === "any" ? eq(resumes.format, "any") : or(eq(resumes.format, filter.format), eq(resumes.format, "any"))!);
  if (filter.region === REMOTE_REGION) conds.push(isNull(resumes.regionSlug));
  else if (filter.region) conds.push(or(eq(resumes.regionSlug, filter.region), isNull(resumes.regionSlug))!);
  if (filter.q) {
    const n = needle(filter.q);
    conds.push(or(like(sql`lower(${resumes.title})`, n), like(sql`lower(${resumes.summary})`, n), like(sql`lower(${resumes.skills})`, n), like(sql`lower(${users.name})`, n))!);
  }
  const where = and(...conds);
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(resumes).innerJoin(users, eq(users.id, resumes.userId)).where(where),
    db
      .select({ r: resumes })
      .from(resumes)
      .innerJoin(users, eq(users.id, resumes.userId))
      .where(where)
      .orderBy(desc(resumes.updatedAt))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit),
  ]);
  const people = await usersMini(rows.map((r) => r.r.userId));
  return { items: rows.map((r) => toResumeCard(r.r, pub(people.get(r.r.userId) ?? UNKNOWN))), total: Number(total), page: filter.page, pages: Math.max(1, Math.ceil(Number(total) / filter.limit)) };
}

