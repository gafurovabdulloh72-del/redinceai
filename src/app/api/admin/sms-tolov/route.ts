import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { audit } from "@/lib/security/audit";
import { SITE_URL } from "@/lib/site-url";
import { rotateSmsKey, setSmsAutoEnabled, smsAutoState } from "@/lib/payments/sms-auto";

/** Admin: kartaga o'tkazmani bank SMS'i orqali avtomatik tasdiqlash — holat, yoqish/o'chirish, kalit almashtirish */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  const state = await smsAutoState();
  const recent = await db
    .select({ id: auditLogs.id, targetId: auditLogs.targetId, meta: auditLogs.meta, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "payment_sms_auto")))
    .orderBy(desc(auditLogs.createdAt))
    .limit(15);
  return ok({
    ...state,
    endpoint: `${SITE_URL.replace(/\/$/, "")}/api/tolov/sms`,
    recent: recent.map((r) => ({ id: r.id, invoiceId: r.targetId, amount: Number((r.meta as { amount?: number }).amount ?? 0), at: r.createdAt.getTime() })),
  });
});

const schema = z.object({ action: z.enum(["enable", "disable", "rotate"]) });

export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { action } = await parseBody(req, schema);
  let key: string | null = null;
  if (action === "rotate") key = await rotateSmsKey();
  else await setSmsAutoEnabled(action === "enable");
  await audit(session.sub, "admin_sms_auto", { meta: { action } }, req);
  return ok({ ...(await smsAutoState()), key });
});
