import { handler, ok, parseBody } from "@/lib/api";
import { getVerifiedSession } from "@/lib/auth";
import { createFeedback, feedbackSchema } from "@/lib/feedback";
import { enforceLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { notifyAdminsNewFeedback } from "@/lib/telegram-bot/admin";

/**
 * Fikr bildirish (2026-11-04): kirgan foydalanuvchi (limit `feedback` 10/soat, userId) yoki mehmon
 * (`feedbackGuest` 3/soat, IP). Matn spam filtridan o'tadi; javobda faqat id. Adminlarga xabar — javobdan keyin.
 */
export const POST = handler(async (req) => {
  const session = await getVerifiedSession();
  if (session) await enforceLimit("feedback", session.sub);
  else await enforceLimit("feedbackGuest", clientIp(req));
  const input = await parseBody(req, feedbackSchema);
  // Mehmon skrinshot yuklay olmaydi (upload sessiya talab qiladi) — kelsa ham tashlab yuboriladi
  const row = await createFeedback(session ? input : { ...input, screenshotUrl: null }, session?.sub ?? null, req.headers.get("user-agent") ?? "");
  void notifyAdminsNewFeedback(row.id);
  return ok({ id: row.id }, { status: 201 });
});
