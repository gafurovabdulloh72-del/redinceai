import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { siteOrigin } from "@/lib/payments/config";
import { canViewPayment, loadPaymentDetail, toPaymentDto } from "@/lib/payments/dto";
import { markManualSent } from "@/lib/payments/service";

type Ctx = { params: Promise<{ id: string }> };

/** To'lov holati (natija sahifasi poll qiladi). Mijoz, mutaxassis yoki admin ko'radi. */
export const GET = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const p = await loadPaymentDetail(id);
  if (!p || !canViewPayment(p, session)) throw new ApiError(404, "To'lov topilmadi");
  return ok(toPaymentDto(p, siteOrigin(req.headers, req.url)), { headers: { "Cache-Control": "no-store" } });
});

const actionSchema = z.object({ action: z.enum(["sent"]) });

/** Qo'lda o'tkazma: mijoz "To'ladim" → pending (admin tasdiqlaydi) */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { action } = await parseBody(req, actionSchema);
  const p = await loadPaymentDetail(id);
  if (!p || !canViewPayment(p, session)) throw new ApiError(404, "To'lov topilmadi");
  if (p.clientId !== session.sub && session.role !== "admin") throw new ApiError(403, "Faqat buyurtmachi tasdiqlay oladi");

  if (action === "sent") {
    const row = await markManualSent(p, session.sub, req);
    return ok({ id: row.id, state: row.state });
  }
  throw new ApiError(400, "Noma'lum amal");
});
