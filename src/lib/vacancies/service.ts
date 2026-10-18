import "server-only";
import { and, desc, eq, gt, inArray, isNotNull, isNull, like, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, resumes, specialists, users, vacancies, vacancyAlerts, vacancySaves, type Application, type Resume, type Vacancy } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { uid } from "@/lib/utils";
import { APPLICATION_STATUS, COVER_LETTER_MIN, EMPLOYMENT, EXPERIENCE, PAY_FILTER, REMOTE_REGION, VACANCY_TTL_DAYS, WORK_FORMAT, professionLabel, salaryLabel, vacancyRegionLabel, type ApplicationStatus } from "./format";
import { VACANCY_ALERT_KEYS, vacancyFilterSchema, type ResumeFilter, type ResumeInput, type VacancyFilter, type VacancyInput } from "./validators";

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
  /** Tashqi ariza havolasi bosilishlari (faqat egasiga; boshqalarga 0) */
  applyClicks: number;
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
  /** Ommaviy ko'rishlar — faqat egasiga (boshqalarga 0) */
  viewCount: number;
}

export interface ApplicantView {
  id: string;
  status: ApplicationStatus;
  coverLetter: string;
  createdAt: number;
  /** Ish beruvchi birinchi marta ochgan vaqt */
  viewedAt: number | null;
  /** Ish beruvchining shaxsiy eslatmasi */
  employerNote: string;
  user: UserMini & { email: string; phone: string | null };
  resume: Pick<ResumeView, "id" | "title" | "profession" | "experience" | "skills" | "expectedSalary" | "links" | "summary"> | null;
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  coverLetter: string;
  createdAt: number;
  /** Ish beruvchi ko'rgan vaqt (nomzodga «Ko'rildi: …») */
  viewedAt: number | null;
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
  // pay=set — maosh ko'rsatilgan; pay=neg — faqat «Kelishiladi»
  if (filter.pay === "set") conds.push(or(isNotNull(vacancies.salaryMin), isNotNull(vacancies.salaryMax))!);
  else if (filter.pay === "neg") conds.push(and(isNull(vacancies.salaryMin), isNull(vacancies.salaryMax))!);
  // fresh=1 — so'nggi 48 soat
  if (filter.fresh === "1") conds.push(gt(vacancies.createdAt, new Date(now - 48 * 3_600_000)));
  const where = and(...conds);
  const orderBy =
    filter.sort === "salary_high"
      ? [desc(sql`coalesce(${vacancies.salaryMax}, ${vacancies.salaryMin}, 0)`), desc(vacancies.createdAt)]
      : filter.sort === "applications"
        ? [desc(vacancies.applicationsCount), desc(vacancies.createdAt)]
        : [desc(vacancies.createdAt)];

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
    applyClicks: isOwner ? v.applyClicks : 0,
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

/** Egasiga eslatma: muddat tugashiga shuncha kun qolganda (cron) */
export const VACANCY_EXPIRE_REMIND_DAYS = 3;

/** Cron: muddati VACANCY_EXPIRE_REMIND_DAYS kun ichida tugaydigan ochiq vakansiyalar egasiga bir martalik eslatma (expireRemindedAt) */
export async function remindExpiringVacancies(now = Date.now(), dry = false): Promise<number> {
  const rows = await db.query.vacancies.findMany({
    where: and(
      eq(vacancies.status, "open"),
      isNotNull(vacancies.expiresAt),
      gt(vacancies.expiresAt, new Date(now)),
      lte(vacancies.expiresAt, new Date(now + VACANCY_EXPIRE_REMIND_DAYS * 86_400_000)),
      isNull(vacancies.expireRemindedAt),
    ),
    columns: { id: true, authorId: true, title: true, expiresAt: true },
    limit: 200,
  });
  if (dry) return rows.length;
  let n = 0;
  for (const v of rows) {
    // Holatga bog'liq belgilash — parallel cron chaqiruvida eslatma ikki marta ketmaydi
    const res = await db.update(vacancies).set({ expireRemindedAt: new Date(now) }).where(and(eq(vacancies.id, v.id), isNull(vacancies.expireRemindedAt)));
    if (!res.rowsAffected || !v.expiresAt) continue;
    const days = Math.max(1, Math.ceil((v.expiresAt.getTime() - now) / 86_400_000));
    await notify(
      v.authorId,
      "vacancy_expiring",
      `Vakansiya muddati ${days} kundan keyin tugaydi`,
      `«${v.title}» ro'yxatdan chiqib ketadi. O'rin hali ochiq bo'lsa, kabinetda «Uzaytirish» tugmasini bosing — yana ${VACANCY_TTL_DAYS} kun ko'rinadi.`,
      "/kabinet/vakansiyalar",
    );
    n += 1;
  }
  return n;
}

/** Shu ish beruvchining boshqa ochiq vakansiyalari (joriy e'londan tashqari) */
export async function employerVacancies(v: Vacancy, limit = 3, now = Date.now()): Promise<VacancyCard[]> {
  const rows = await db
    .select({ v: vacancies })
    .from(vacancies)
    .innerJoin(users, eq(users.id, vacancies.authorId))
    .where(and(eq(vacancies.authorId, v.authorId), eq(vacancies.status, "open"), or(isNull(vacancies.expiresAt), gt(vacancies.expiresAt, new Date(now))), eq(users.isBanned, false), sql`${vacancies.id} != ${v.id}`))
    .orderBy(desc(vacancies.createdAt))
    .limit(limit);
  const authors = await usersMini(rows.map((r) => r.v.authorId));
  return rows.map((r) => toCard(r.v, pub(authors.get(r.v.authorId) ?? UNKNOWN)));
}

/** Sitemap: ochiq, muddati o'tmagan vakansiyalar (bloklangan mualliflarniki emas) */
export async function getSitemapVacancies(now = Date.now()): Promise<Array<{ id: string; updatedAt: Date }>> {
  return db
    .select({ id: vacancies.id, updatedAt: vacancies.updatedAt })
    .from(vacancies)
    .innerJoin(users, eq(users.id, vacancies.authorId))
    .where(and(eq(vacancies.status, "open"), or(isNull(vacancies.expiresAt), gt(vacancies.expiresAt, new Date(now))), eq(users.isBanned, false)))
    .orderBy(desc(vacancies.updatedAt))
    .limit(2000);
}

/** Sitemap: ommaviy rezyumelar (bloklangan foydalanuvchilarniki emas) */
export async function getSitemapResumes(): Promise<Array<{ id: string; updatedAt: Date }>> {
  return db
    .select({ id: resumes.id, updatedAt: resumes.updatedAt })
    .from(resumes)
    .innerJoin(users, eq(users.id, resumes.userId))
    .where(and(eq(resumes.isPublic, true), eq(users.isBanned, false)))
    .orderBy(desc(resumes.updatedAt))
    .limit(2000);
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
    // Uzaytirilgach yangi muddat uchun eslatma yana bir marta ketadi
    set.expireRemindedAt = null;
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
      viewedAt: a.viewedAt?.getTime() ?? null,
      employerNote: a.employerNote,
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
  try {
    await db.transaction(async (tx) => {
      await tx.insert(applications).values(row);
      await tx.update(vacancies).set({ applicationsCount: sql`${vacancies.applicationsCount} + 1` }).where(eq(vacancies.id, v.id));
    });
  } catch (e) {
    // Ikki marta bosish / parallel so'rov: yagona indeks (vacancy, user) ikkinchisini to'xtatadi — 500 emas, 409
    if (String(e).includes("UNIQUE")) throw new ApiError(409, "Siz bu vakansiyaga allaqachon ariza yuborgansiz");
    throw e;
  }
  const who = author.get(userId)?.name ?? "Nomzod";
  await notify(v.authorId, "application_new", `Yangi ariza: ${v.title}`, `${who} vakansiyangizga ariza yubordi${resume ? " (rezyume bilan)" : ""}.`, `/kabinet/vakansiyalar?v=${v.id}`);
  return { ...row, status: "new", coverLetter, createdAt: now, updatedAt: now } as Application;
}

/**
 * Holat: «ko'rildi» faqat yangi arizaga qo'llanadi (tanlovdagi/qabul qilingan ariza orqaga qaytmaydi);
 * birinchi ko'rishda viewedAt yoziladi. Nomzodga bildirishnoma — «ko'rildi»dan tashqari haqiqiy o'zgarishda.
 */
export async function setApplicationStatus(app: Application, v: Vacancy, status: ApplicationStatus): Promise<Application> {
  if (status === "viewed" && app.status !== "new") return app;
  const now = new Date();
  const set: Partial<typeof applications.$inferInsert> = { status, updatedAt: now };
  if (!app.viewedAt) set.viewedAt = now;
  const [row] = await db.update(applications).set(set).where(eq(applications.id, app.id)).returning();
  if (status !== "viewed" && status !== app.status) {
    const label = APPLICATION_STATUS[status];
    await notify(app.userId, "application_status", `Ariza holati: ${label}`, `«${v.title}»${v.company ? ` (${v.company})` : ""} — arizangiz holati: ${label.toLowerCase()}.`, `/kabinet/arizalarim`);
  }
  return row;
}

/** Ish beruvchining shaxsiy eslatmasi (nomzodga ko'rinmaydi, bildirishnoma ketmaydi) */
export async function setApplicationNote(app: Application, note: string): Promise<Application> {
  const [row] = await db.update(applications).set({ employerNote: note, updatedAt: new Date() }).where(eq(applications.id, app.id)).returning();
  return row;
}

/** Nomzod arizani qaytarib oladi — faqat hali qaror qilinmagan (yangi / ko'rilgan) holatda */
export async function withdrawApplication(app: Application): Promise<void> {
  if (app.status !== "new" && app.status !== "viewed") throw new ApiError(409, "Ish beruvchi qaror qilgan arizani qaytarib bo'lmaydi");
  await db.transaction(async (tx) => {
    const res = await tx.delete(applications).where(and(eq(applications.id, app.id), inArray(applications.status, ["new", "viewed"])));
    if (res.rowsAffected) await tx.update(vacancies).set({ applicationsCount: sql`max(${vacancies.applicationsCount} - 1, 0)` }).where(eq(vacancies.id, app.vacancyId));
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
    viewedAt: a.viewedAt?.getTime() ?? null,
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

/**
 * Yopiq (isPublic=false) rezyumeni egasi va admin'dan tashqari faqat shu nomzod ariza yuborgan vakansiya egasi
 * ko'radi — ariza bilan rezyume biriktiriladi, aks holda «Rezyume» havolasi 404 berardi. Kontakt baribir chiqmaydi.
 */
async function employerOfApplicant(viewerId: string, applicantId: string): Promise<boolean> {
  const row = await db
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
    .where(and(eq(applications.userId, applicantId), eq(vacancies.authorId, viewerId)))
    .limit(1);
  return row.length > 0;
}

export async function getResumeView(id: string, viewer: Viewer): Promise<ResumeView | null> {
  const r = (await db.query.resumes.findFirst({ where: eq(resumes.id, id) })) ?? null;
  if (!r) return null;
  const isOwner = Boolean(viewer && (viewer.id === r.userId || isAdmin(viewer)));
  if (!r.isPublic && !isOwner && !(viewer && (await employerOfApplicant(viewer.id, r.userId)))) return null;
  const u = (await usersMini([r.userId])).get(r.userId) ?? UNKNOWN;
  return { ...toResumeCard(r, pub(u), false), links: r.links, isPublic: r.isPublic, isOwner, viewCount: isOwner ? r.viewCount : 0 };
}

/** Rezyume ko'rishlari (egasi va botlar emas — chaqiruvchi tekshiradi) */
export async function bumpResumeView(id: string): Promise<void> {
  await db.update(resumes).set({ viewCount: sql`${resumes.viewCount} + 1` }).where(eq(resumes.id, id));
}

/** Rezyumeni katalogda yuqoriga ko'tarish (updatedAt = hozir) — 24 soatda bir marta */
export const RESUME_BUMP_HOURS = 24;
export async function bumpResume(userId: string, now = Date.now()): Promise<{ updatedAt: number }> {
  const r = await getResume(userId);
  if (!r) throw new ApiError(404, "Rezyume topilmadi");
  const since = now - r.updatedAt.getTime();
  if (since < RESUME_BUMP_HOURS * 3_600_000) {
    const h = Math.ceil((RESUME_BUMP_HOURS * 3_600_000 - since) / 3_600_000);
    throw new ApiError(429, `Rezyume yaqinda yangilangan — ${h} soatdan keyin yana ko'tarish mumkin`);
  }
  const [row] = await db.update(resumes).set({ updatedAt: new Date(now) }).where(eq(resumes.id, r.id)).returning({ updatedAt: resumes.updatedAt });
  return { updatedAt: row.updatedAt.getTime() };
}

/** Tashqi ariza havolasi bosildi (ApplyForm, sendBeacon) — egasi uchun statistika */
export async function bumpApplyClick(id: string): Promise<void> {
  await db.update(vacancies).set({ applyClicks: sql`${vacancies.applyClicks} + 1` }).where(and(eq(vacancies.id, id), isNotNull(vacancies.applyUrl)));
}

/* ------------------------------------------------------------------ */
/* Ish beruvchi sahifasi, tavsiyalar, CSV                              */
/* ------------------------------------------------------------------ */
export interface EmployerProfile {
  user: UserMini;
  /** Oxirgi vakansiyadagi kompaniya nomi (bo'lsa) */
  company: string;
  open: VacancyCard[];
  closedCount: number;
  memberSince: number;
}

/** `key` — username yoki user id. Bloklangan yoki vakansiyasi yo'q foydalanuvchi — null */
export async function employerProfile(key: string, now = Date.now()): Promise<EmployerProfile | null> {
  const u = await db.query.users.findFirst({ where: or(eq(users.username, key), eq(users.id, key)), columns: { id: true, isBanned: true, createdAt: true } });
  if (!u || u.isBanned) return null;
  const rows = await db.query.vacancies.findMany({ where: eq(vacancies.authorId, u.id), orderBy: [desc(vacancies.createdAt)] });
  if (!rows.length) return null;
  const author = pub((await usersMini([u.id])).get(u.id) ?? UNKNOWN);
  const open = rows.filter((v) => v.status === "open" && !isExpired(v, now)).map((v) => toCard(v, author));
  return { user: author, company: rows.find((v) => v.company)?.company ?? "", open, closedCount: rows.length - open.length, memberSince: u.createdAt.getTime() };
}

/** Nomzodga mos ochiq vakansiyalar: rezyume kasbi bo'yicha, hali ariza bermagan va o'ziniki emas */
export async function suggestedVacanciesForUser(userId: string, profession: string, limit = 3, now = Date.now()): Promise<VacancyCard[]> {
  const applied = db.select({ id: applications.vacancyId }).from(applications).where(eq(applications.userId, userId));
  const rows = await db
    .select({ v: vacancies })
    .from(vacancies)
    .innerJoin(users, eq(users.id, vacancies.authorId))
    .where(
      and(
        eq(vacancies.status, "open"),
        or(isNull(vacancies.expiresAt), gt(vacancies.expiresAt, new Date(now))),
        eq(users.isBanned, false),
        eq(vacancies.profession, profession),
        ne(vacancies.authorId, userId),
        sql`${vacancies.id} not in ${applied}`,
      ),
    )
    .orderBy(desc(vacancies.createdAt))
    .limit(limit);
  const authors = await usersMini(rows.map((r) => r.v.authorId));
  return rows.map((r) => toCard(r.v, pub(authors.get(r.v.authorId) ?? UNKNOWN)));
}

/** Nomzodlar CSV (faqat egasi — kontakt ruxsatli): UTF-8 BOM bilan, Excel ochadi */
export function applicantsCsv(items: ApplicantView[]): string {
  const cell = (s: string | number | null | undefined) => {
    const t = s == null ? "" : String(s);
    return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const head = ["Ism", "Email", "Telefon", "Holat", "Lavozim (rezyume)", "Tajriba", "Kutilayotgan maosh", "Ko'nikmalar", "Yuborilgan", "Xat"];
  const lines = items.map((a) =>
    [
      a.user.name,
      a.user.email,
      a.user.phone ?? "",
      APPLICATION_STATUS[a.status],
      a.resume?.title ?? "",
      a.resume ? EXPERIENCE[a.resume.experience] : "",
      a.resume?.expectedSalary ?? "",
      a.resume?.skills.join(", ") ?? "",
      new Date(a.createdAt).toISOString().slice(0, 10),
      a.coverLetter,
    ]
      .map(cell)
      .join(";"),
  );
  return `﻿${[head.join(";"), ...lines].join("\r\n")}`;
}

/* ------------------------------------------------------------------ */
/* Saqlangan qidiruvlar (vacancy_alerts): yangi mos vakansiya — bildirishnoma */
/* ------------------------------------------------------------------ */
export const MAX_VACANCY_ALERTS = 10;

/** Querystring'ni kanonik ko'rinishga keltiradi: faqat ma'lum kalitlar, noto'g'ri qiymatlar tashlanadi */
export function canonicalVacancyQuery(raw: string): { query: string; filter: VacancyFilter } {
  const src = new URLSearchParams(raw.replace(/^\?/, ""));
  const flat: Record<string, string> = {};
  for (const k of VACANCY_ALERT_KEYS) {
    const v = src.get(k)?.trim();
    if (v) flat[k] = v;
  }
  let res = vacancyFilterSchema.safeParse(flat);
  if (!res.success) {
    for (const k of new Set(res.error.issues.map((i) => String(i.path[0])))) delete flat[k];
    res = vacancyFilterSchema.safeParse(flat);
  }
  const filter = res.success ? res.data : vacancyFilterSchema.parse({});
  const out = new URLSearchParams();
  for (const k of VACANCY_ALERT_KEYS) {
    const v = filter[k];
    if (v == null || v === "" || v === 0) continue;
    out.set(k, String(v));
  }
  return { query: out.toString(), filter };
}

/** Odam o'qiydigan tavsif: "Video · Masofaviy · 3 mln so'mdan" */
export function describeVacancyQuery(query: string): string {
  const { filter: f } = canonicalVacancyQuery(query);
  const parts: string[] = [];
  if (f.q) parts.push(`«${f.q}»`);
  if (f.profession) parts.push(professionLabel(f.profession, true));
  if (f.format) parts.push(WORK_FORMAT[f.format]);
  if (f.employment) parts.push(EMPLOYMENT[f.employment]);
  if (f.experience) parts.push(EXPERIENCE[f.experience]);
  if (f.region) parts.push(f.region === REMOTE_REGION ? "Faqat masofaviy" : vacancyRegionLabel(f.region));
  if (f.min) parts.push(salaryLabel(f.min, null));
  if (f.pay) parts.push(PAY_FILTER[f.pay]);
  return parts.length ? parts.join(" · ") : "Barcha vakansiyalar";
}

export async function listVacancyAlerts(userId: string) {
  const rows = await db.query.vacancyAlerts.findMany({ where: eq(vacancyAlerts.userId, userId), orderBy: [desc(vacancyAlerts.createdAt)] });
  return rows.map((r) => ({ id: r.id, name: r.name, query: r.query, summary: describeVacancyQuery(r.query), notify: r.notify, lastNotifiedAt: r.lastNotifiedAt?.getTime() ?? null, createdAt: r.createdAt.getTime() }));
}
export type VacancyAlertDTO = Awaited<ReturnType<typeof listVacancyAlerts>>[number];

export async function createVacancyAlert(userId: string, input: { name: string; query: string; notify: boolean }): Promise<VacancyAlertDTO> {
  const { query } = canonicalVacancyQuery(input.query);
  const existing = await db.query.vacancyAlerts.findMany({ where: eq(vacancyAlerts.userId, userId), columns: { id: true, query: true } });
  if (existing.some((r) => r.query === query)) throw new ApiError(409, "Bu qidiruv allaqachon saqlangan", { query: "Bu qidiruv allaqachon saqlangan" });
  if (existing.length >= MAX_VACANCY_ALERTS) throw new ApiError(400, `Ko'pi bilan ${MAX_VACANCY_ALERTS} ta qidiruv saqlash mumkin — keraksizlarini o'chiring`);
  const now = new Date();
  // lastNotifiedAt = hozir: saqlash paytidagi mavjud vakansiyalar «yangi» deb xabar qilinmaydi
  const [row] = await db.insert(vacancyAlerts).values({ id: uid(), userId, name: input.name, query, notify: input.notify, lastNotifiedAt: now, createdAt: now }).returning();
  return { id: row.id, name: row.name, query: row.query, summary: describeVacancyQuery(row.query), notify: row.notify, lastNotifiedAt: now.getTime(), createdAt: now.getTime() };
}

export async function deleteVacancyAlert(userId: string, id: string): Promise<boolean> {
  const res = await db.delete(vacancyAlerts).where(and(eq(vacancyAlerts.id, id), eq(vacancyAlerts.userId, userId)));
  return res.rowsAffected > 0;
}

/**
 * Cron (kunlik): har bir notify=true qidiruv uchun lastNotifiedAt (bo'lmasa — saqlangan vaqt) dan keyin joylangan,
 * filtrga mos ochiq vakansiyalar soni; bor bo'lsa — bitta "saved_search" bildirishnomasi (mavjud tur — sozlamalar bir xil).
 * Egasining o'z vakansiyalari sanalmaydi; lastNotifiedAt har safar yangilanadi (oyna siljiydi — takror xabar yo'q).
 */
export async function checkVacancyAlerts(now = Date.now()): Promise<{ checked: number; notified: number }> {
  const rows = await db.query.vacancyAlerts.findMany({ where: eq(vacancyAlerts.notify, true) });
  let notified = 0;
  for (const row of rows) {
    try {
      const since = row.lastNotifiedAt ?? row.createdAt;
      const { query, filter } = canonicalVacancyQuery(row.query);
      const res = await listVacancies({ ...filter, page: 1, limit: 48, sort: "newest", fresh: "" }, now);
      const n = res.items.filter((v) => v.createdAt > since.getTime() && v.author.id !== row.userId).length;
      if (n > 0) {
        await notify(row.userId, "saved_search", `«${row.name}» qidiruvingizga ${n} ta yangi vakansiya mos keldi`, describeVacancyQuery(query), `/vakansiyalar?${query}`);
        notified++;
      }
      await db.update(vacancyAlerts).set({ lastNotifiedAt: new Date(now) }).where(eq(vacancyAlerts.id, row.id));
    } catch (e) {
      console.error("[vacancy-alert]", row.id, e);
    }
  }
  return { checked: rows.length, notified };
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

