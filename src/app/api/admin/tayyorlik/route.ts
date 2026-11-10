import { handler, ok, requireSession } from "@/lib/api";
import { READINESS_GROUPS, launchReadiness } from "@/lib/admin/readiness";

/**
 * Admin: «Ishga tushirishga tayyorlik» ro'yxati — sozlamalar, xavfsizlik, to'lov, aloqa va media bo'yicha tekshiruvlar.
 * Javobda env QIYMATLARI yo'q (faqat holat va ko'rsatma) — lib/admin/readiness.ts.
 */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  const report = await launchReadiness();
  return ok({ ...report, groups: READINESS_GROUPS });
});
