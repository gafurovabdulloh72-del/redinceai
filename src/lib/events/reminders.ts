import "server-only";
import { and, eq, gt, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, posts } from "@/lib/db/schema";
import { notifyMembers } from "@/lib/groups/service";

/**
 * Efir eslatmalari: boshlanishidan ~1 soat va ~10 daqiqa oldin a'zolarga (sayt + Telegram).
 * Vercel cron kuniga bir marta ishlaydi, shuning uchun bu funksiya faol sahifalardan (efir paneli, lenta) chaqiriladi:
 * bir instansiyada daqiqada bir martadan ko'p ishlamaydi va har eslatma `posts.reminder_flags` CAS bilan BIR MARTA ketadi.
 * Eslatmani o'chirgan a'zolarga (group_members.event_reminders=false) notifyMembers o'zi yubormaydi.
 */
let lastRun = 0;

export async function runEventReminders(now = Date.now()): Promise<number> {
  if (now - lastRun < 60_000) return 0;
  lastRun = now;
  const rows = await db.query.posts.findMany({
    where: and(isNotNull(posts.groupId), isNotNull(posts.eventAt), gt(posts.eventAt, new Date(now)), lte(posts.eventAt, new Date(now + 62 * 60_000))),
    columns: { id: true, groupId: true, body: true, eventAt: true, reminderFlags: true, authorId: true },
    limit: 40,
  });
  let sent = 0;
  for (const p of rows) {
    const left = ((p.eventAt as Date).getTime() - now) / 60_000;
    // 10 daqiqa oldin (eng yaqin) yoki 1 soat oldin; 10 daqiqali bosqichga o'tgan bo'lsa 1 soatlik ham bajarilgan hisoblanadi
    const stage = left <= 11 ? 2 : 1;
    if (p.reminderFlags & stage) continue;
    const mask = stage === 2 ? 3 : 1;
    const claimed = await db.update(posts).set({ reminderFlags: sql`${posts.reminderFlags} | ${mask}` }).where(and(eq(posts.id, p.id), sql`(${posts.reminderFlags} & ${stage}) = 0`)).returning({ id: posts.id });
    if (!claimed.length) continue;
    const group = await db.query.groups.findFirst({ where: eq(groups.id, p.groupId as string) });
    if (!group) continue;
    const title = p.body.split("\n")[0]?.slice(0, 80) || "Jonli efir";
    const when = stage === 2 ? "10 daqiqadan keyin boshlanadi" : "1 soatdan keyin boshlanadi";
    await notifyMembers(group, p.authorId, "live_event", `${group.name}: ${title}`, `Efir ${when}`, `/jamoalar/${group.slug}?efir=1`).catch(() => undefined);
    sent++;
  }
  return sent;
}
