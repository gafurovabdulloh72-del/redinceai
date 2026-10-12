import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";

const schema = z.object({ status: z.enum(["closed", "open"]) });

/** Admin: shikoyatni yopish (yoki qayta ochish) */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const { status } = await parseBody(req, schema);
  const [row] = await db
    .update(reports)
    .set({ status, resolvedBy: status === "closed" ? session.sub : null })
    .where(eq(reports.id, id))
    .returning({ id: reports.id, status: reports.status, targetType: reports.targetType, targetId: reports.targetId });
  if (!row) throw new ApiError(404, "Shikoyat topilmadi");
  await audit(session.sub, status === "closed" ? "admin_report_closed" : "admin_report_reopened", { targetType: "report", targetId: id, meta: { target: `${row.targetType}:${row.targetId}` } }, req);
  return ok({ id: row.id, status: row.status });
});
