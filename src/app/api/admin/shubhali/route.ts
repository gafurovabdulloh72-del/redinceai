import { z } from "zod";
import { and, desc, eq, gt, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, rateLimits, users } from "@/lib/db/schema";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { ABUSE_ALERT_SCORE, ABUSE_FREEZE_SCORE, clearAbuse } from "@/lib/security/abuse";

/**
 * «Hisob tuzog'i» (lib/security/abuse.ts) — admin uchun:
 * GET  — hozir ball to'plagan / muzlatilgan hisoblar va so'nggi ogohlantirishlar (audit: abuse_suspected / abuse_frozen);
 * POST {userId, action: "clear"} — muzlatishni olib tashlash va ballni nolga tushirish (xato signal bo'lsa).
 */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  const now = Date.now();
  const rows = await db
    .select({ key: rateLimits.key, count: rateLimits.count, resetAt: rateLimits.resetAt })
    .from(rateLimits)
    .where(and(or(like(rateLimits.key, "abuse:%"), like(rateLimits.key, "frozen:%")), gt(rateLimits.resetAt, now)));
  const byUser = new Map<string, { score: number; frozenUntil: number | null }>();
  for (const r of rows) {
    const frozen = r.key.startsWith("frozen:");
    const id = r.key.slice(frozen ? "frozen:".length : "abuse:".length);
    const cur = byUser.get(id) ?? { score: 0, frozenUntil: null };
    if (frozen) cur.frozenUntil = r.resetAt;
    else cur.score = r.count;
    byUser.set(id, cur);
  }
  const ids = [...byUser.keys()];
  const people = ids.length ? await db.query.users.findMany({ where: or(...ids.map((id) => eq(users.id, id))), columns: { id: true, name: true, email: true, role: true, username: true, isBanned: true } }) : [];
  const info = new Map(people.map((p) => [p.id, p]));
  const recent = await db
    .select({ id: auditLogs.id, actorId: auditLogs.actorId, action: auditLogs.action, meta: auditLogs.meta, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(or(eq(auditLogs.action, "abuse_suspected"), eq(auditLogs.action, "abuse_frozen")))
    .orderBy(desc(auditLogs.createdAt))
    .limit(30);
  return ok({
    thresholds: { alert: ABUSE_ALERT_SCORE, freeze: ABUSE_FREEZE_SCORE },
    active: ids
      .map((id) => ({ userId: id, ...byUser.get(id)!, user: info.get(id) ?? null }))
      .filter((a) => a.frozenUntil || a.score >= 5)
      .sort((a, b) => Number(Boolean(b.frozenUntil)) - Number(Boolean(a.frozenUntil)) || b.score - a.score),
    recent: recent.map((r) => ({ id: r.id, userId: r.actorId, action: r.action, meta: r.meta, at: r.createdAt.getTime() })),
  });
});

export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { userId } = await parseBody(req, z.object({ userId: z.string().min(1).max(64), action: z.literal("clear") }));
  await clearAbuse(userId);
  await audit(session.sub, "abuse_cleared", { targetType: "user", targetId: userId }, req);
  return ok({ userId, cleared: true });
});
