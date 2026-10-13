import "server-only";
import { eq, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, proposals, users } from "@/lib/db/schema";
import { notify, type NotificationType } from "@/lib/notifications";
import { RATE_LIMITS, rateLimit } from "@/lib/security/rate-limit";
import { PROPOSAL_DAILY_LIMIT } from "@/lib/constants";
import { tashkentNow } from "@/lib/privacy";
import { escapeLike, translit } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Bildirishnomalar                                                    */
/* ------------------------------------------------------------------ */
/** E'lon/taklif bildirishnoma turlari (NotificationType'ning bir qismi) */
export type JobNotificationType = Extract<NotificationType, "proposal_new" | "proposal_accepted" | "proposal_declined" | "job_expired">;

export function notifyJob(userId: string, type: JobNotificationType, title: string, body?: string | null, href?: string | null): Promise<void> {
  return notify(userId, type, title, body, href);
}

export const jobHref = (id: string) => `/ishlar/${id}`;

/* ------------------------------------------------------------------ */
/* Rate limitlar                                                       */
/* ------------------------------------------------------------------ */
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Lokal limitlar: shared RATE_LIMITS'ga shu nomlar qo'shilsa — o'sha qiymat ustun (deferredShared).
 *  jobs        — userId: kuniga yangi e'lonlar
 *  jobEdit     — userId: tahrirlash / yopish / qayta ochish
 *  proposals   — userId: taklif yuborish urinishlari (asl kunlik limit — server hisobi, PROPOSAL_DAILY_LIMIT)
 *  proposalAct — userId: saralash / rad etish / qabul / qaytarib olish
 */
const LOCAL_LIMITS = {
  jobs: { limit: 10, windowMs: DAY },
  jobEdit: { limit: 60, windowMs: HOUR },
  proposals: { limit: PROPOSAL_DAILY_LIMIT * 3, windowMs: DAY },
  proposalAct: { limit: 120, windowMs: HOUR },
} as const;
type JobLimitName = keyof typeof LOCAL_LIMITS;

export function enforceJobLimit(name: JobLimitName, id: string): Promise<void> {
  const shared = (RATE_LIMITS as Record<string, { limit: number; windowMs: number } | undefined>)[name];
  const cfg = shared ?? LOCAL_LIMITS[name];
  // Kalit formati enforceLimit() bilan bir xil: `${nom}:${id}`
  return rateLimit(`${name}:${id}`, cfg.limit, cfg.windowMs);
}

/* ------------------------------------------------------------------ */
/* SQL yordamchilari                                                    */
/* ------------------------------------------------------------------ */
/** Bloklangan mijozning e'lonlari hech qayerda chiqmaydi */
export function clientNotBanned(): SQL {
  return notInArray(jobs.clientId, db.select({ id: users.id }).from(users).where(eq(users.isBanned, true)));
}

/** Ochiq va muddati o'tmagan (cron hali yopmagan bo'lsa ham) */
export function openAndLive(now = Date.now()): SQL {
  return sql`(${jobs.status} = 'open' and (${jobs.expiresAt} is null or ${jobs.expiresAt} > ${now}))`;
}

/** Apostrof variantlari — utils.translit() bilan bir xil (queries.ts dagi qidiruv qoidasi) */
const APOSTROPHES = ["'", "ʼ", "ʻ", "‘", "’", "`", "´"];
function plainCol(col: SQL): SQL {
  let s = sql`lower(${col})`;
  for (const a of APOSTROPHES) s = sql`replace(${s}, ${a}, '')`;
  return s;
}
function likeTerm(col: SQL, term: string): SQL {
  return sql`${col} like ${`%${escapeLike(term)}%`} escape '\\'`;
}
/** Asl yozuv (kichik harf) va translit/apostrofsiz yozuv — ikkalasi ham topiladi ("Фарғона" / "fargona" → "Farg'ona") */
export function matchText(col: SQL, q: string): SQL {
  const raw = q.toLowerCase();
  const norm = translit(q);
  if (!norm) return likeTerm(sql`lower(${col})`, raw);
  return or(likeTerm(sql`lower(${col})`, raw), likeTerm(plainCol(col), norm))!;
}

/** Toshkent vaqti bo'yicha bugungi kun boshi (ms) — kunlik taklif limiti uchun */
export function tashkentDayStart(now = Date.now()): number {
  const [y, m, d] = tashkentNow(now).date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - 5 * HOUR;
}

/** Bugun yuborilgan takliflar soni (qaytarib olinganlari ham hisoblanadi — spam bo'lmasin) */
export async function proposalsSentToday(specialistId: string, now = Date.now()): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(proposals)
    .where(sql`${proposals.specialistId} = ${specialistId} and ${proposals.createdAt} >= ${tashkentDayStart(now)}`);
  return Number(row?.n ?? 0);
}

/** proposalsCount denormalizatsiyasi: qaytarib olinganlardan tashqari hammasi */
export async function syncProposalsCount(jobId: string): Promise<void> {
  await db
    .update(jobs)
    .set({ proposalsCount: sql`(select count(*) from ${proposals} where ${proposals.jobId} = ${jobId} and ${proposals.status} != 'withdrawn')` })
    .where(eq(jobs.id, jobId));
}
