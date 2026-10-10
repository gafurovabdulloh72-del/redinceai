import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { checkoutSchema } from "@/lib/validators";
import { enforceLimit } from "@/lib/security/rate-limit";
import { siteOrigin } from "@/lib/payments/config";
import { createCheckout, loadOrderWithParties } from "@/lib/payments/service";

/**
 * Mijoz to'lovni boshlaydi: {orderId, provider} → to'lov yozuvi (created) + provayder havolasi.
 * Qo'lda o'tkazmada havola yo'q — /tolov/[paymentId] sahifasida rekvizitlar ko'rsatiladi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, checkoutSchema);
  await enforceLimit("checkout", session.sub);

  const order = await loadOrderWithParties(input.orderId);
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  if (order.clientId !== session.sub && session.role !== "admin") throw new ApiError(403, "Faqat buyurtmachi to'lay oladi");

  const origin = siteOrigin(req.headers, req.url);
  const { payment, redirectUrl } = await createCheckout({ order, provider: input.provider, actorId: session.sub, origin, req });
  return ok(
    {
      paymentId: payment.id,
      provider: payment.provider,
      amount: payment.amount,
      commissionPct: payment.commissionPct,
      commissionAmount: payment.commissionAmount,
      netAmount: payment.netAmount,
      redirectUrl,
      checkoutPath: `/tolov/${payment.id}`,
    },
    { status: 201 },
  );
});
