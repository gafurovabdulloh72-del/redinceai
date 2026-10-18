import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, rateLimits, sessions, users } from "@/lib/db/schema";
import { handler, ok, requireSession } from "@/lib/api";
import { isR2Enabled } from "@/lib/storage/r2";
import { isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";

type Backend = "r2" | "blob" | "disk" | "none";

/** r2/route.ts activeBackend bilan bir xil qoida */
function storageBackend(): Backend {
  if (isR2Enabled()) return "r2";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (!process.env.VERCEL) return "disk";
  return "none";
}

/**
 * Admin: tizim holati kartasi — DB kechikishi, saqlash usuli, cron oxirgi ishlashi, rate-limit faol kalitlari,
 * Telegram/email sozlanganligi, faol sessiyalar. Diagnostika uchun; maxfiy qiymatlar qaytarilmaydi.
 */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  const now = Date.now();

  const t0 = performance.now();
  let dbOk = true;
  try {
    await db.run(sql`select 1`);
  } catch {
    dbOk = false;
  }
  const dbMs = Math.round((performance.now() - t0) * 10) / 10;

  const [cron, [{ n: rlActive }], rlTop, [{ n: activeSessions }], [{ n: usersTotal }]] = await Promise.all([
    db.query.auditLogs.findFirst({ where: eq(auditLogs.action, "cron_daily"), orderBy: [desc(auditLogs.createdAt)], columns: { createdAt: true, meta: true } }),
    db.select({ n: sql<number>`count(*)` }).from(rateLimits).where(gt(rateLimits.resetAt, now)),
    // Kalit prefiksi (":" gacha) bo'yicha eng ko'p faol cheklovlar — qaysi oqimda bosim borligi ko'rinadi
    db
      .select({ prefix: sql<string>`case when instr(${rateLimits.key}, ':') > 0 then substr(${rateLimits.key}, 1, instr(${rateLimits.key}, ':') - 1) else ${rateLimits.key} end`, n: sql<number>`count(*)`, hits: sql<number>`sum(${rateLimits.count})` })
      .from(rateLimits)
      .where(gt(rateLimits.resetAt, now))
      .groupBy(sql`1`)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
    db.select({ n: sql<number>`count(*)` }).from(sessions).where(and(gt(sessions.expiresAt, new Date(now)), isNull(sessions.revokedAt))),
    db.select({ n: sql<number>`count(*)` }).from(users),
  ]);

  const cronMeta = (cron?.meta ?? {}) as Record<string, unknown>;
  const cronErrors = Array.isArray(cronMeta.errors) ? cronMeta.errors.length : 0;
  const cronAt = cron?.createdAt.getTime() ?? null;

  return ok({
    ts: now,
    db: { ok: dbOk, ms: dbMs },
    storage: { backend: storageBackend(), onVercel: Boolean(process.env.VERCEL) },
    cron: { lastRunAt: cronAt, errors: cronErrors, stale: cronAt ? now - cronAt > 36 * 60 * 60 * 1000 : true },
    rateLimit: { active: Number(rlActive), top: rlTop.map((r) => ({ prefix: r.prefix, keys: Number(r.n), hits: Number(r.hits ?? 0) })) },
    telegram: { enabled: isTelegramEnabled(), username: telegramBotUsername() },
    email: { configured: Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM) },
    sessions: { active: Number(activeSessions) },
    users: { total: Number(usersTotal) },
  });
});
