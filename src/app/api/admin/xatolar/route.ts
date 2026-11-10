import { z } from "zod";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { clearErrorLogs, deleteErrorLog, errorLogCounts, listErrorLogs, setErrorsResolved } from "@/lib/observability/errors";
import { audit } from "@/lib/security/audit";

const listSchema = z.object({
  holat: z.enum(["open", "resolved", "all"]).default("open"),
  tur: z.enum(["server", "client", "all"]).default("all"),
  q: z.string().trim().max(80).optional(),
  /** Kursor: oldingi javobdagi `nextCursor` */
  before: z.string().trim().max(90).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/** Admin: xatolar jurnali — guruhlangan ro'yxat (oxirgi uchraganiga ko'ra) + sanoqlar */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const q = parseQuery(req.url, listSchema);
  const [list, counts] = await Promise.all([listErrorLogs({ status: q.holat, kind: q.tur, q: q.q, before: q.before, limit: q.limit }), errorLogCounts()]);
  return ok({ ...list, counts });
});

const patchSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1, { error: "Yozuv tanlanmagan" }).max(100, { error: "Bir yo'la ko'pi bilan 100 ta" }),
  resolved: z.boolean(),
});

/** Admin: «Hal qilindi» / qayta ochish (bitta yoki bir nechta yozuv) */
export const PATCH = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { ids, resolved } = await parseBody(req, patchSchema);
  const changed = await setErrorsResolved(ids, resolved);
  await audit(session.sub, resolved ? "admin_error_resolved" : "admin_error_reopened", { targetType: "error_log", targetId: ids.length === 1 ? ids[0] : undefined, meta: { count: changed, ids: ids.length > 1 ? ids.slice(0, 20) : undefined } }, req);
  return ok({ changed, counts: await errorLogCounts() });
});

const deleteSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  /** Tozalash: resolved — faqat hal qilinganlar; all — butun jurnal */
  scope: z.enum(["resolved", "all"]).optional(),
});

/** Admin: bitta yozuvni o'chirish (`?id=`) yoki jurnalni tozalash (`?scope=resolved|all`) */
export const DELETE = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { id, scope } = parseQuery(req.url, deleteSchema);
  if (id) {
    if (!(await deleteErrorLog(id))) throw new ApiError(404, "Yozuv topilmadi");
    await audit(session.sub, "admin_error_deleted", { targetType: "error_log", targetId: id }, req);
    return ok({ deleted: 1, counts: await errorLogCounts() });
  }
  if (!scope) throw new ApiError(400, "Nima o'chirilishi ko'rsatilmagan");
  const deleted = await clearErrorLogs(scope);
  await audit(session.sub, "admin_errors_cleared", { targetType: "error_log", meta: { scope, count: deleted } }, req);
  return ok({ deleted, counts: await errorLogCounts() });
});
