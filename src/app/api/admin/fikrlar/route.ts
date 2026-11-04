import { z } from "zod";
import { handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { listFeedback, setFeedbackStatus } from "@/lib/feedback";
import { audit } from "@/lib/security/audit";

const listSchema = z.object({ status: z.enum(["open", "done", "all"]).default("open"), before: z.coerce.number().int().positive().optional() });
const patchSchema = z.object({ id: z.string().min(1).max(64), status: z.enum(["open", "done"]) });

/** Admin: fikrlar ro'yxati (standart — ochiqlar) */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const { status, before } = parseQuery(req.url, listSchema);
  return ok({ items: await listFeedback(status, 50, before) });
});

/** Admin: holatni almashtirish (open ↔ done) */
export const PATCH = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { id, status } = await parseBody(req, patchSchema);
  const row = await setFeedbackStatus(id, status);
  await audit(session.sub, status === "done" ? "admin_feedback_done" : "admin_feedback_reopened", { targetType: "feedback", targetId: id }, req);
  return ok({ id: row.id, status: row.status });
});
