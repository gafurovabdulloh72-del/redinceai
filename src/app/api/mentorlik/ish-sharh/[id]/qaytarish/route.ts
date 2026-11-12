import { handler, ok, requireSession } from "@/lib/api";
import { requestWorkReviewRefund } from "@/lib/mentorship/work-review";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — talaba: muddati o'tgan, javobsiz so'rov bo'yicha bepul bo'lsa bekor qiladi, pullik bo'lsa pulni qaytarishni so'raydi
 * (adminga xabar ketadi; qaror va qaytarish — admin «Mentorlik» sahifasida). Faqat so'rov egasi; boshqalarga 404.
 */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok(await requestWorkReviewRefund(id, session.sub));
});
