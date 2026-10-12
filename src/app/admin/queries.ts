import "server-only";
import { and, desc, eq, gte, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, reports, reviews, specialists, users } from "@/lib/db/schema";
import { auditLabel } from "@/lib/security/audit";
import { escapeLike } from "@/lib/utils";

/** admin_payment bitta kod ostida 4 xil amal — meta.action bo'yicha aniq nom (umumiy nom "tasdiqlandi" chalg'itadi) */
const ADMIN_PAYMENT_LABELS: Record<string, string> = {
  confirm: "Admin: o'tkazma tasdiqlandi",
  release: "Admin: pul mutaxassisga o'tkazildi",
  refund: "Admin: pul mijozga qaytarildi",
  cancel: "Admin: to'lov bekor qilindi",
};
export function labelFor(action: string, meta?: Record<string, unknown> | null): string {
  if (action === "admin_payment") {
    const a = typeof meta?.action === "string" ? meta.action : null;
    return (a && ADMIN_PAYMENT_LABELS[a]) || "Admin: to'lov amali";
  }
  return auditLabel(action);
}

/* ------------------------------------------------------------------ */
/* Audit jurnali: filtrlar (harakat, kim, sana) — sahifa va CSV eksport */
/* ------------------------------------------------------------------ */
export interface AuditFilter {
  action?: string;
  /** Ism yoki email bo'yicha (qisman moslik) */
  actor?: string;
  /** YYYY-MM-DD (Toshkent kuni boshidan) */
  from?: string;
  /** YYYY-MM-DD (shu kun oxirigacha) */
  to?: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
/** "2026-10-12" → shu kun 00:00 (Toshkent) ms; noto'g'ri bo'lsa null */
export function dayStartMs(day: string | undefined): number | null {
  if (!day || !DAY_RE.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(t) ? t - TASHKENT_OFFSET_MS : null;
}

/** Querystring'dan xavfsiz filtr (noto'g'ri qiymatlar tashlab yuboriladi) */
export function auditFilterFromQuery(q: { action?: string; actor?: string; from?: string; to?: string }): AuditFilter {
  return {
    action: q.action && /^[a-z_]{1,40}$/.test(q.action) ? q.action : undefined,
    actor: q.actor?.trim() ? q.actor.trim().slice(0, 120) : undefined,
    from: dayStartMs(q.from) != null ? q.from : undefined,
    to: dayStartMs(q.to) != null ? q.to : undefined,
  };
}

function auditWhere(f: AuditFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (f.action) conds.push(eq(auditLogs.action, f.action));
  if (f.actor) {
    const term = `%${escapeLike(f.actor.toLowerCase())}%`;
    const match = db
      .select({ id: users.id })
      .from(users)
      .where(or(sql`lower(${users.name}) like ${term} escape '\\'`, sql`lower(${users.email}) like ${term} escape '\\'`));
    conds.push(inArray(auditLogs.actorId, match));
  }
  const from = dayStartMs(f.from);
  const to = dayStartMs(f.to);
  if (from != null) conds.push(gte(auditLogs.createdAt, new Date(from)));
  if (to != null) conds.push(lt(auditLogs.createdAt, new Date(to + 24 * 60 * 60 * 1000)));
  return conds.length ? and(...conds) : undefined;
}

export async function queryAuditLogs(f: AuditFilter, page: { limit: number; offset: number }) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      ip: auditLogs.ip,
      meta: auditLogs.meta,
      createdAt: auditLogs.createdAt,
      actorId: auditLogs.actorId,
      actorName: users.name,
      actorEmail: users.email,
      actorAvatar: users.avatarUrl,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(auditWhere(f))
    .orderBy(desc(auditLogs.createdAt))
    .limit(page.limit)
    .offset(page.offset);
}

/** Filtrga mos yozuvlar soni va harakat bo'yicha taqsimot (chiplar uchun — filtrning action qismisiz) */
export async function countAuditLogs(f: AuditFilter) {
  const [[{ n }], byAction] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(auditLogs).where(auditWhere(f)),
    db
      .select({ action: auditLogs.action, n: sql<number>`count(*)` })
      .from(auditLogs)
      .where(auditWhere({ ...f, action: undefined }))
      .groupBy(auditLogs.action)
      .orderBy(desc(sql`count(*)`)),
  ]);
  return { total: Number(n), byAction: byAction.map((a) => ({ action: a.action, n: Number(a.n) })) };
}

/* ------------------------------------------------------------------ */
/* Sharhlar moderatsiyasi                                              */
/* ------------------------------------------------------------------ */
export async function listAdminReviews(limit = 30) {
  return db.query.reviews.findMany({
    orderBy: [desc(reviews.createdAt)],
    limit,
    with: {
      author: { columns: { id: true, name: true, email: true } },
      specialist: { columns: { id: true, slug: true }, with: { user: { columns: { name: true } } } },
    },
  });
}

/* ------------------------------------------------------------------ */
/* Shikoyatlar                                                         */
/* ------------------------------------------------------------------ */
export interface AdminReportRow {
  id: string;
  targetType: "specialist" | "review";
  targetId: string;
  reason: string;
  status: "open" | "closed";
  createdAt: number;
  reporter: { name: string; email: string };
  /** Nishon: mutaxassis (slug + ism) yoki sharh (muallif + matn parchasi + mutaxassis slug) */
  target: { label: string; href: string | null; snippet: string | null } | null;
  /** Profil shikoyatida — profil egasi (admin shu yerning o'zidan bloklay oladi, F87) */
  owner?: { userId: string; name: string; isBanned: boolean; bannedReason: string | null } | null;
}

export async function listAdminReports(status: "open" | "closed" | "all" = "open", limit = 50): Promise<AdminReportRow[]> {
  const rows = await db.query.reports.findMany({
    where: status === "all" ? undefined : eq(reports.status, status),
    orderBy: [sql`case when ${reports.status} = 'open' then 0 else 1 end`, desc(reports.createdAt)],
    limit,
    with: { reporter: { columns: { name: true, email: true } } },
  });
  const spIds = rows.filter((r) => r.targetType === "specialist").map((r) => r.targetId);
  const rvIds = rows.filter((r) => r.targetType === "review").map((r) => r.targetId);
  const [sps, rvs] = await Promise.all([
    spIds.length ? db.query.specialists.findMany({ where: inArray(specialists.id, spIds), columns: { id: true, slug: true, userId: true }, with: { user: { columns: { name: true, isBanned: true, bannedReason: true } } } }) : Promise.resolve([]),
    rvIds.length
      ? db.query.reviews.findMany({
          where: inArray(reviews.id, rvIds),
          columns: { id: true, text: true, rating: true },
          with: { author: { columns: { name: true } }, specialist: { columns: { slug: true } } },
        })
      : Promise.resolve([]),
  ]);
  const spMap = new Map(sps.map((s) => [s.id, s]));
  const rvMap = new Map(rvs.map((r) => [r.id, r]));
  return rows.map((r) => {
    let target: AdminReportRow["target"] = null;
    let owner: AdminReportRow["owner"] = null;
    if (r.targetType === "specialist") {
      const s = spMap.get(r.targetId);
      target = s ? { label: s.user.name, href: `/mutaxassislar/${s.slug}`, snippet: null } : { label: "O'chirilgan profil", href: null, snippet: null };
      owner = s ? { userId: s.userId, name: s.user.name, isBanned: s.user.isBanned, bannedReason: s.user.bannedReason } : null;
    } else {
      const v = rvMap.get(r.targetId);
      target = v ? { label: `${v.author.name} · ${v.rating}★`, href: `/mutaxassislar/${v.specialist.slug}#sharhlar`, snippet: v.text.slice(0, 160) } : { label: "O'chirilgan sharh", href: null, snippet: null };
    }
    return {
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.getTime(),
      reporter: { name: r.reporter.name, email: r.reporter.email },
      target,
      owner,
    };
  });
}

/** Admin: mutaxassis egalarining blok holati (pending jadvali uchun) */
export async function banFlagsFor(userIds: string[]): Promise<Map<string, { isBanned: boolean; bannedReason: string | null }>> {
  const out = new Map<string, { isBanned: boolean; bannedReason: string | null }>();
  if (!userIds.length) return out;
  const rows = await db.query.users.findMany({ where: inArray(users.id, userIds), columns: { id: true, isBanned: true, bannedReason: true } });
  for (const r of rows) out.set(r.id, { isBanned: r.isBanned, bannedReason: r.bannedReason });
  return out;
}
