import "server-only";
import { and, eq, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, proposals, specialists, users } from "@/lib/db/schema";
import { notify, type NotificationType } from "@/lib/notifications";
import { RATE_LIMITS, rateLimit } from "@/lib/security/rate-limit";
import { MAX_PROPOSAL_DAILY_LIMIT } from "@/lib/constants";
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

/**
 * PRO TARIF: yangi e'lon joylanganda kasbi (va hududi — e'lon masofaviy bo'lsa istalgan hudud) mos
 * Pro mutaxassislarga DARHOL bildirishnoma (sayt + Telegram + push — `notify()` fan-out, foydalanuvchi
 * sozlamalari hurmat qilinadi). Oddiy mutaxassislar e'lonni «Ishlar» bo'limida ko'radi.
 * Pro qoidasi lib/subscriptions/pro.ts bilan bir xil. Ko'pi bilan 200 kishi.
 */
export async function alertProSpecialistsAboutJob(job: { id: string; clientId: string; title: string; category: string; regionSlug: string | null; budgetMax: number | null }): Promise<number> {
  const now = Date.now();
  const rows = await db
    .select({ userId: specialists.userId })
    .from(specialists)
    .innerJoin(users, eq(users.id, specialists.userId))
    .where(
      and(
        eq(specialists.category, job.category),
        job.regionSlug ? eq(specialists.regionSlug, job.regionSlug) : undefined,
        ne(specialists.userId, job.clientId),
        eq(users.isBanned, false),
        sql`(${specialists.isPrivileged} = 1 or coalesce(${specialists.subscriptionUntil}, 0) > ${now} or coalesce(${specialists.awardPremiumUntil}, 0) > ${now})`,
      ),
    )
    // Max tarif birinchi navbatda xabar oladi (Max — «birinchi bo'lib»)
    .orderBy(sql`case when ${specialists.isPrivileged} = 1 or ${specialists.subscriptionTier} = 'max' then 0 else 1 end`)
    .limit(200);
  const budget = job.budgetMax ? ` · ${job.budgetMax.toLocaleString("ru-RU").replace(/,/g, " ")} so'mgacha` : "";
  for (const r of rows) {
    await notify(r.userId, "job_new", `Yangi e'lon: ${job.title}`.slice(0, 160), `Kasbingizga mos buyurtma${budget}. Birinchilardan bo'lib taklif yuboring.`, jobHref(job.id)).catch(() => {});
  }
  return rows.length;
}

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
  proposals: { limit: MAX_PROPOSAL_DAILY_LIMIT * 2, windowMs: DAY },
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
