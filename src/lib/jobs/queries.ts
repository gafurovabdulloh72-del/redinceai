import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, proposals, specialists } from "@/lib/db/schema";
import { getSettings } from "@/lib/payments/settings";
import { canReceiveOrders, subscriptionState } from "@/lib/subscriptions/access";
import { PROPOSAL_DAILY_LIMIT } from "@/lib/constants";
import { toListItem, type Viewer } from "@/lib/privacy";
import { clientNotBanned, matchText, openAndLive, proposalsSentToday } from "./server";
import { firstName, REMOTE_REGION } from "./format";
import type { JobFilter } from "./validators";

/* ------------------------------------------------------------------ */
/* Ommaviy ro'yxat                                                     */
/* ------------------------------------------------------------------ */
const listColumns = {
  id: true,
  title: true,
  description: true,
  category: true,
  regionSlug: true,
  budgetMin: true,
  budgetMax: true,
  budgetType: true,
  deadline: true,
  skills: true,
  status: true,
  proposalsCount: true,
  createdAt: true,
  expiresAt: true,
} as const;

type JobRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  regionSlug: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetType: "fixed" | "hourly";
  deadline: string | null;
  skills: string[];
  status: "open" | "hired" | "closed";
  proposalsCount: number;
  createdAt: Date;
  expiresAt: Date | null;
  client: { name: string; emailVerified: boolean };
};

/** Ommaviy DTO: mijozning faqat ismi va email tasdig'i (id/email/telefon chiqmaydi) */
function toJobListItem(j: JobRow) {
  const excerpt = j.description.replace(/\s+/g, " ").trim();
  return {
    id: j.id,
    title: j.title,
    excerpt: excerpt.length > 220 ? `${excerpt.slice(0, 217).trimEnd()}…` : excerpt,
    category: j.category,
    regionSlug: j.regionSlug,
    budgetMin: j.budgetMin,
    budgetMax: j.budgetMax,
    budgetType: j.budgetType,
    deadline: j.deadline,
    skills: j.skills,
    status: j.status,
    proposalsCount: j.proposalsCount,
    createdAt: j.createdAt,
    expiresAt: j.expiresAt,
    client: { firstName: firstName(j.client.name), emailVerified: j.client.emailVerified },
  };
}
export type JobListItem = ReturnType<typeof toJobListItem>;

const budgetHi = sql`coalesce(${jobs.budgetMax}, ${jobs.budgetMin})`;
const budgetLo = sql`coalesce(${jobs.budgetMin}, ${jobs.budgetMax})`;

/** /ishlar va GET /api/jobs: ochiq, muddati o'tmagan e'lonlar (bloklangan mijozlarniki emas) */
export async function listJobs(filter: JobFilter, now = Date.now()) {
  const conds: SQL[] = [openAndLive(now), clientNotBanned()];
  if (filter.category) conds.push(eq(jobs.category, filter.category));
  if (filter.region === REMOTE_REGION) conds.push(isNull(jobs.regionSlug));
  else if (filter.region) conds.push(eq(jobs.regionSlug, filter.region));
  if (filter.q) conds.push(or3(matchText(sql`${jobs.title}`, filter.q), matchText(sql`${jobs.description}`, filter.q), matchText(sql`${jobs.skills}`, filter.q)));
  // Byudjet oralig'i: e'lon oralig'i filtr oralig'i bilan kesishsin; "Kelishiladi" e'lonlar filtr qo'yilsa chiqmaydi
  if (filter.min && filter.min > 0) conds.push(sql`${budgetHi} >= ${filter.min}`);
  if (filter.max && filter.max > 0 && !(filter.min && filter.min >= filter.max)) conds.push(sql`${budgetLo} <= ${filter.max}`);

  const where = and(...conds);
  const orderBy =
    filter.sort === "budget_high"
      ? [sql`${budgetHi} is null`, desc(budgetHi), desc(jobs.createdAt)]
      : filter.sort === "budget_low"
        ? [sql`${budgetLo} is null`, asc(budgetLo), desc(jobs.createdAt)]
        : [desc(jobs.createdAt)];

  const [rows, [{ total }]] = await Promise.all([
    db.query.jobs.findMany({
      where,
      orderBy,
      limit: filter.limit,
      offset: (filter.page - 1) * filter.limit,
      columns: listColumns,
      with: { client: { columns: { name: true, emailVerified: true } } },
    }),
    db.select({ total: count() }).from(jobs).where(where),
  ]);
  return {
    items: rows.map(toJobListItem),
    total,
    page: filter.page,
    pages: Math.max(1, Math.ceil(total / filter.limit)),
  };
}

function or3(a: SQL, b: SQL, c: SQL): SQL {
  return sql`(${a} or ${b} or ${c})`;
}

/** Yo'nalishlar bo'yicha ochiq e'lonlar soni (filtr chiplari uchun) */
export async function openJobCategoryCounts(now = Date.now()): Promise<Record<string, number>> {
  const rows = await db
    .select({ category: jobs.category, n: count() })
    .from(jobs)
    .where(and(openAndLive(now), clientNotBanned()))
    .groupBy(jobs.category);
  return Object.fromEntries(rows.map((r) => [r.category, r.n]));
}

/** Ochiq e'lonlar soni (bosh sahifa tizeri) */
export async function countOpenJobs(now = Date.now()): Promise<number> {
  const [row] = await db.select({ n: count() }).from(jobs).where(and(openAndLive(now), clientNotBanned()));
  return row?.n ?? 0;
}

/** Eng yangi ochiq e'lonlar (bosh sahifa uchun) */
export async function listLatestJobs(n = 6, now = Date.now()): Promise<JobListItem[]> {
  const rows = await db.query.jobs.findMany({
    where: and(openAndLive(now), clientNotBanned()),
    orderBy: [desc(jobs.createdAt)],
    limit: Math.max(1, Math.min(24, n)),
    columns: listColumns,
    with: { client: { columns: { name: true, emailVerified: true } } },
  });
  return rows.map(toJobListItem);
}

/* ------------------------------------------------------------------ */
/* Bitta e'lon                                                         */
/* ------------------------------------------------------------------ */
/** E'lon + mijoz (ichki foydalanish: clientId egalikni tekshirish uchun; DTO'ga to'g'ridan-to'g'ri chiqarmang) */
export async function getJobRow(id: string) {
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, id),
    with: { client: { columns: { id: true, name: true, emailVerified: true, createdAt: true, isBanned: true, phone: true } } },
  });
  return job ?? null;
}
export type JobDetailRow = NonNullable<Awaited<ReturnType<typeof getJobRow>>>;

/** Mijoz kartasi: joylagan e'lonlari va yollagan mutaxassislari soni */
export async function clientJobStats(clientId: string): Promise<{ posted: number; hired: number }> {
  const [row] = await db
    .select({ posted: count(), hired: sql<number>`sum(case when ${jobs.status} = 'hired' then 1 else 0 end)` })
    .from(jobs)
    .where(eq(jobs.clientId, clientId));
  return { posted: row?.posted ?? 0, hired: Number(row?.hired ?? 0) };
}

/** Ommaviy e'lon DTO (sahifa va GET /api/jobs/[id]) — mijoz id/telefon chiqmaydi */
export function toJobPublic(job: JobDetailRow) {
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    category: job.category,
    regionSlug: job.regionSlug,
    budgetMin: job.budgetMin,
    budgetMax: job.budgetMax,
    budgetType: job.budgetType,
    deadline: job.deadline,
    skills: job.skills,
    status: job.status,
    proposalsCount: job.proposalsCount,
    viewCount: job.viewCount,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    expiresAt: job.expiresAt,
    client: { firstName: firstName(job.client.name), emailVerified: job.client.emailVerified, memberSince: job.client.createdAt },
  };
}
export type JobPublic = ReturnType<typeof toJobPublic>;

/** Ko'rishlar soni (egasi va botlar emas — chaqiruvchi tekshiradi) */
export async function bumpJobViewCount(id: string): Promise<void> {
  await db
    .update(jobs)
    .set({ viewCount: sql`${jobs.viewCount} + 1` })
    .where(eq(jobs.id, id));
}

/* ------------------------------------------------------------------ */
/* Takliflar                                                           */
/* ------------------------------------------------------------------ */
const proposalSpecialistColumns = {
  id: true,
  slug: true,
  title: true,
  category: true,
  regionSlug: true,
  city: true,
  visibility: true,
  isVerified: true,
  rating: true,
  reviewCount: true,
  completedCount: true,
  topRated: true,
  priceFrom: true,
  createdAt: true,
  subscriptionUntil: true,
} as const;

/**
 * E'lon egasi uchun takliflar (qaytarib olinganlarsiz): mutaxassis — toListItem() orqali maskalangan ro'yxat DTO'si.
 * canHire — mutaxassis hozir yangi buyurtma qabul qila oladimi (obuna, subscriptions/access.ts); obuna sanalari chiqmaydi.
 */
export async function listJobProposalsForOwner(jobId: string, viewer: Viewer) {
  const [rows, settings] = await Promise.all([
    db.query.proposals.findMany({
      where: and(eq(proposals.jobId, jobId), ne(proposals.status, "withdrawn")),
      orderBy: [sql`case ${proposals.status} when 'accepted' then 0 when 'shortlisted' then 1 when 'pending' then 2 else 3 end`, desc(proposals.createdAt)],
      with: { specialist: { columns: proposalSpecialistColumns, with: { user: { columns: { name: true, avatarUrl: true, isBanned: true } } } } },
    }),
    getSettings(),
  ]);
  const now = new Date();
  return rows
    .filter((p) => !p.specialist.user.isBanned)
    .map((p) => {
      const { createdAt: spCreatedAt, subscriptionUntil, ...sp } = p.specialist;
      const canHire = canReceiveOrders({ createdAt: spCreatedAt, subscriptionUntil }, settings, now);
      const item = toListItem({ ...sp, user: { name: sp.user.name, avatarUrl: sp.user.avatarUrl } }, viewer);
      return {
        id: p.id,
        status: p.status,
        amount: p.amount,
        deliveryDays: p.deliveryDays,
        coverLetter: p.coverLetter,
        orderId: p.orderId,
        createdAt: p.createdAt,
        specialist: { ...item, canHire },
      };
    });
}
export type OwnerProposal = Awaited<ReturnType<typeof listJobProposalsForOwner>>[number];

/** Mutaxassisning shu e'longa taklifi (bo'lsa) */
export async function getMyProposal(jobId: string, specialistId: string) {
  const p = await db.query.proposals.findFirst({
    where: and(eq(proposals.jobId, jobId), eq(proposals.specialistId, specialistId)),
    columns: { id: true, status: true, amount: true, deliveryDays: true, coverLetter: true, orderId: true, createdAt: true, updatedAt: true },
  });
  return p ?? null;
}
export type MyProposal = NonNullable<Awaited<ReturnType<typeof getMyProposal>>>;

/* ------------------------------------------------------------------ */
/* Kabinet                                                             */
/* ------------------------------------------------------------------ */
/** Mijozning e'lonlari + har biri bo'yicha ko'rib chiqilmagan (pending) takliflar soni */
export async function listClientJobs(clientId: string) {
  const rows = await db.query.jobs.findMany({
    where: eq(jobs.clientId, clientId),
    orderBy: [sql`case ${jobs.status} when 'open' then 0 when 'hired' then 1 else 2 end`, desc(jobs.createdAt)],
    columns: { ...listColumns, viewCount: true, hiredOrderId: true, updatedAt: true },
  });
  const ids = rows.map((r) => r.id);
  const pending = ids.length
    ? await db
        .select({ jobId: proposals.jobId, n: count() })
        .from(proposals)
        .where(and(inArray(proposals.jobId, ids), eq(proposals.status, "pending")))
        .groupBy(proposals.jobId)
    : [];
  const pendingBy = new Map(pending.map((p) => [p.jobId, p.n]));
  return rows.map((r) => ({ ...r, newProposals: pendingBy.get(r.id) ?? 0 }));
}
export type ClientJob = Awaited<ReturnType<typeof listClientJobs>>[number];

/** Mutaxassisning takliflari (eng yangisi birinchi) + e'lon qisqa ma'lumoti */
export async function listSpecialistProposals(specialistId: string) {
  const rows = await db.query.proposals.findMany({
    where: eq(proposals.specialistId, specialistId),
    orderBy: [desc(proposals.updatedAt)],
    columns: { id: true, status: true, amount: true, deliveryDays: true, coverLetter: true, orderId: true, createdAt: true, updatedAt: true },
    with: {
      job: {
        columns: { id: true, title: true, status: true, category: true, regionSlug: true, budgetMin: true, budgetMax: true, budgetType: true, proposalsCount: true },
      },
    },
  });
  return rows;
}
export type SpecialistProposal = Awaited<ReturnType<typeof listSpecialistProposals>>[number];

/** Mutaxassis id (joriy foydalanuvchi) */
export async function specialistForUser(userId: string) {
  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.userId, userId),
    columns: { id: true, userId: true, slug: true, createdAt: true, subscriptionUntil: true, completedCount: true, topRated: true },
  });
  return sp ?? null;
}

/** Muddati o'tgan, lekin hali ochiq e'lonlar (closeExpiredJobs uchun) */
export async function findExpiredOpenJobs(now = Date.now()) {
  return db.query.jobs.findMany({
    where: and(eq(jobs.status, "open"), sql`${jobs.expiresAt} is not null and ${jobs.expiresAt} <= ${now}`),
    columns: { id: true, clientId: true, title: true },
    limit: 500,
  });
}

/**
 * Mutaxassisning taklif yuborish konteksti (sahifalar uchun): obuna holati (subscriptions/access.ts) va
 * bugungi limit. Mutaxassis profili bo'lmasa — null.
 */
export async function getProposerContext(userId: string, now = Date.now()) {
  const sp = await specialistForUser(userId);
  if (!sp) return null;
  const [settings, sentToday] = await Promise.all([getSettings(), proposalsSentToday(sp.id, now)]);
  const state = subscriptionState(sp, settings, new Date(now));
  return {
    specialistId: sp.id,
    slug: sp.slug,
    subscription: { status: state.status, daysLeft: state.daysLeft },
    canPropose: canReceiveOrders(sp, settings, new Date(now)),
    sentToday,
    limit: PROPOSAL_DAILY_LIMIT,
    remaining: Math.max(0, PROPOSAL_DAILY_LIMIT - sentToday),
  };
}
export type ProposerContext = NonNullable<Awaited<ReturnType<typeof getProposerContext>>>;

/** Sitemap uchun: ochiq, muddati o'tmagan e'lonlar (id + updatedAt), bloklangan mijozlarniki emas */
export async function getSitemapJobs(now = Date.now()): Promise<{ id: string; updatedAt: Date }[]> {
  return db.query.jobs.findMany({
    where: and(openAndLive(now), clientNotBanned()),
    columns: { id: true, updatedAt: true },
    orderBy: [desc(jobs.updatedAt)],
    limit: 5000,
  });
}
