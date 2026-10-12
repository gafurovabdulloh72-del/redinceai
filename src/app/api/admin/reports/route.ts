import { z } from "zod";
import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { listAdminReports } from "@/app/admin/queries";

const schema = z.object({ status: z.enum(["open", "closed", "all"]).default("open") });

/** Admin: shikoyatlar ro'yxati (F88/F85) — standart: ochiqlar */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const { status } = parseQuery(req.url, schema);
  const rows = await listAdminReports(status);
  return ok(rows);
});
