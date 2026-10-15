import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { payouts } from "@/lib/db/schema";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { payoutDecisionSchema } from "@/lib/validators";
import { PAYOUT_STATE_LABEL } from "@/lib/constants";
import { audit } from "@/lib/security/audit";
import { notify } from "@/lib/notifications";
import { getSpecialistBalance, specialistOwnerId } from "@/lib/payments/queries";
import { formatPrice } from "@/lib/utils";

type State = "requested" | "approved" | "paid" | "rejected";
const NEXT: Record<State, State[]> = {
  requested: ["approved", "paid", "rejected"],
  approved: ["paid", "rejected"],
  paid: [],
  rejected: [],
};

/** "To'landi" bilan birga yuboriladigan o'tkazma raqami (ixtiyoriy) */
const referenceSchema = z.string().trim().min(3).max(64);

/** Admin qarori: requested → approved → paid, yoki rejected (sabab bilan) */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "JSON noto'g'ri");
  }
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  // UI holatni `state` yoki `action` nomi bilan yuborishi mumkin — ikkalasi qabul qilinadi (orqaga moslik)
  const parsed = payoutDecisionSchema.safeParse({ ...body, state: body.state ?? body.action });
  if (!parsed.success) throw new ApiError(422, "Ma'lumotlarni tekshiring", { state: "Holat noto'g'ri" });
  const input = parsed.data;

  // O'tkazma raqami faqat "to'landi" qarori bilan saqlanadi
  let reference: string | null = null;
  if (input.state === "paid" && body.reference != null && body.reference !== "") {
    const r = referenceSchema.safeParse(body.reference);
    if (!r.success) throw new ApiError(422, "Ma'lumotlarni tekshiring", { reference: "O'tkazma raqami 3–64 belgi bo'lsin" });
    reference = r.data;
  }

  const payout = await db.query.payouts.findFirst({ where: eq(payouts.id, id) });
  if (!payout) throw new ApiError(404, "So'rov topilmadi");
  if (!NEXT[payout.state].includes(input.state)) throw new ApiError(400, `«${PAYOUT_STATE_LABEL[payout.state]}» holatidan «${PAYOUT_STATE_LABEL[input.state]}»ga o'tkazib bo'lmaydi`);
  if (input.state === "rejected" && !input.note?.trim()) throw new ApiError(422, "Rad etish sababini yozing", { note: "Sabab majburiy" });

  // To'lashdan oldin balans yetarliligini qayta tekshiramiz (o'rtada qaytarish bo'lgan bo'lishi mumkin).
  // `available` 0 dan pastga tushmaydi (clamp), shuning uchun qoplamani boshqa ochiq so'rovlarni ayirib, o'zini qo'shib hisoblaymiz.
  if (input.state === "paid" || input.state === "approved") {
    const b = await getSpecialistBalance(payout.specialistId);
    const cover = b.released - b.paidOut - (b.pendingPayouts - payout.amount);
    if (cover < payout.amount) throw new ApiError(400, `Mutaxassis balansi yetarli emas (mavjud: ${formatPrice(Math.max(0, cover))})`);
  }

  const now = new Date();
  // Holatga bog'liq (compare-and-swap): faqat o'qilgan holatdan ruxsat etilgan holatga o'tadi —
  // parallel qarorlar bir-birining ustidan yozmaydi ('paid' hech qachon 'rejected' bo'lmaydi)
  const [row] = await db
    .update(payouts)
    .set({
      state: input.state,
      note: input.note?.trim() || payout.note,
      ...(reference ? { reference } : {}),
      processedBy: session.sub,
      processedAt: now,
    })
    .where(and(eq(payouts.id, id), eq(payouts.state, payout.state)))
    .returning();
  if (!row) {
    const fresh = await db.query.payouts.findFirst({ where: eq(payouts.id, id), columns: { state: true } });
    throw new ApiError(409, `So'rov holati parallel o'zgargan — hozir: «${PAYOUT_STATE_LABEL[fresh?.state ?? payout.state]}». Sahifani yangilang`);
  }

  await audit(session.sub, "admin_payout", { targetType: "payout", targetId: id, meta: { from: payout.state, to: input.state, amount: payout.amount, note: input.note || undefined, reference: reference || undefined } }, req);

  const ownerId = await specialistOwnerId(payout.specialistId);
  if (ownerId) {
    const title =
      input.state === "paid" ? `Pul o'tkazildi: ${formatPrice(payout.amount)}` : input.state === "approved" ? `Pul chiqarish tasdiqlandi: ${formatPrice(payout.amount)}` : `Pul chiqarish rad etildi: ${formatPrice(payout.amount)}`;
    const body =
      input.state === "paid"
        ? `${payout.details} rekvizitiga o'tkazildi.${reference ? ` O'tkazma raqami: ${reference}.` : ""}${input.note ? ` ${input.note}` : ""}`
        : input.state === "approved"
          ? "Tez orada rekvizitingizga o'tkaziladi."
          : `Sabab: ${input.note}. Summa balansingizga qaytdi.`;
    await notify(ownerId, "payout", title, body, "/kabinet/tolovlar");
  }

  return ok({ id: row.id, state: row.state, note: row.note, reference: row.reference ?? null, processedAt: row.processedAt?.getTime() ?? null });
});
