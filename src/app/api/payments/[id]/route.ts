import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { siteOrigin } from "@/lib/payments/config";
import { canViewPayment, loadPaymentDetail, toPaymentDto } from "@/lib/payments/dto";
import { markManualSent } from "@/lib/payments/service";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { IMAGE_URL_RE } from "@/components/chat/attachments";

type Ctx = { params: Promise<{ id: string }> };

/** To'lov holati (natija sahifasi poll qiladi). Mijoz, mutaxassis yoki admin ko'radi. */
export const GET = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const p = await loadPaymentDetail(id);
  if (!p || !canViewPayment(p, session)) throw new ApiError(404, "To'lov topilmadi");
  return ok(await toPaymentDto(p, siteOrigin(req.headers, req.url)), { headers: { "Cache-Control": "no-store" } });
});

const actionSchema = z.object({
  action: z.enum(["sent"]),
  /** «To'ladim»da ixtiyoriy chek skrinshoti (/api/upload natijasi) — admin tasdiqlashni tezlashtiradi */
  receiptUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

/** Qo'lda o'tkazma: mijoz "To'ladim" → pending (admin tasdiqlaydi) */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, actionSchema);
  const p = await loadPaymentDetail(id);
  if (!p || !canViewPayment(p, session)) throw new ApiError(404, "To'lov topilmadi");
  if (p.clientId !== session.sub && session.role !== "admin") throw new ApiError(403, "Faqat buyurtmachi tasdiqlay oladi");

  if (input.action === "sent") {
    // Ixtiyoriy chek skrinshoti: faqat rasm va faqat shu foydalanuvchi yuklagan fayl
    const receiptUrl = input.receiptUrl || null;
    if (receiptUrl) {
      if (!IMAGE_URL_RE.test(receiptUrl)) throw new ApiError(422, "Chek rasm bo'lishi kerak (JPG, PNG, WEBP)", { receiptUrl: "Chek rasm bo'lishi kerak" });
      await assertOwnUploads(session.sub, [receiptUrl], [], "receiptUrl");
    }
    const row = await markManualSent(p, session.sub, req, receiptUrl);
    return ok({ id: row.id, state: row.state });
  }
  throw new ApiError(400, "Noma'lum amal");
});
