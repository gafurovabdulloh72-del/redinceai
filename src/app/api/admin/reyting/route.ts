import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { monthKeyOf, publishMonthlyTop } from "@/lib/top";

/** POST { month?: "YYYY-MM" } — oy reytingini qo'lda e'lon qilish (standart — joriy oy). Allaqachon e'lon qilingan oy qayta e'lon qilinmaydi */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(req, z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }));
  const month = input.month ?? monthKeyOf(Date.now());
  const res = await publishMonthlyTop(month);
  if ("skipped" in res) throw new ApiError(409, res.skipped === "exists" ? "Bu oy reytingi allaqachon e'lon qilingan" : "Bu oyda reytingga chiqadigan ijodkor yo'q");
  await audit(session.sub, "admin_top_publish", { targetType: "top", targetId: month, meta: { winners: res.published } }, req);
  return ok({ month, ...res });
});
