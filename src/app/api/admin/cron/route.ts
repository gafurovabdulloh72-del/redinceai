import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { CronRunError, cronStatus, runDailyCron } from "@/lib/admin/cron";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
/** Cron og'ir (bildirishnomalar, tozalash) — platforma ruxsat bergan eng uzun vaqt */
export const maxDuration = 60;

/** Admin: kunlik cron holati — qadamlar, oxirgi ishlashlar, xatolar (audit `cron_daily` yozuvlaridan) */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  return ok(await cronStatus());
});

const schema = z.object({
  /** true — hech narsa o'zgartirmasdan nechta yozuvga tegishini ko'rsatadi */
  dry: z.boolean().default(false),
});

/**
 * Admin: «Hozir ishga tushirish» — kunlik cron'ni server ichidan chaqiradi (jadval ishlatadigan kod yo'lining o'zi,
 * serverning o'z CRON_SECRET'i bilan; sir javobga ham, klientga ham chiqmaydi). Limit: 6 / soat (admin bo'yicha).
 */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { dry } = await parseBody(req, schema);
  await enforceLimit("adminCron", session.sub);
  try {
    const result = await runDailyCron({ dry });
    await audit(session.sub, "admin_cron_run", { targetType: "system", meta: { dry, ok: result.ok, errors: result.errors.length, ms: result.ms } }, req);
    return ok({ result, status: await cronStatus() });
  } catch (e) {
    if (e instanceof CronRunError) throw new ApiError(e.status, e.message);
    throw e;
  }
});
