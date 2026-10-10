import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payouts } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
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

/** Admin qarori: requested → approved → paid, yoki rejected (sabab bilan) */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const input = await parseBody(req, payoutDecisionSchema);

  const payout = await db.query.payouts.findFirst({ where: eq(payouts.id, id) });
  if (!payout) throw new ApiError(404, "So'rov topilmadi");
  if (!NEXT[payout.state].includes(input.state)) throw new ApiError(400, `«${PAYOUT_STATE_LABEL[payout.state]}» holatidan «${PAYOUT_STATE_LABEL[input.state]}»ga o'tkazib bo'lmaydi`);
  if (input.state === "rejected" && !input.note?.trim()) throw new ApiError(422, "Rad etish sababini yozing", { note: "Sabab majburiy" });

  // To'lashdan oldin balans yetarliligini qayta tekshiramiz (o'rtada qaytarish bo'lgan bo'lishi mumkin)
  if (input.state === "paid" || input.state === "approved") {
    const b = await getSpecialistBalance(payout.specialistId);
    if (b.available + payout.amount < payout.amount) throw new ApiError(400, `Mutaxassis balansi yetarli emas (mavjud: ${formatPrice(b.available + payout.amount)})`);
  }

  const now = new Date();
  const [row] = await db
    .update(payouts)
    .set({ state: input.state, note: input.note?.trim() || payout.note, processedBy: session.sub, processedAt: now })
    .where(eq(payouts.id, id))
    .returning();

  await audit(session.sub, "admin_payout", { targetType: "payout", targetId: id, meta: { from: payout.state, to: input.state, amount: payout.amount, note: input.note || undefined } }, req);

  const ownerId = await specialistOwnerId(payout.specialistId);
  if (ownerId) {
    const title =
      input.state === "paid" ? `Pul o'tkazildi: ${formatPrice(payout.amount)}` : input.state === "approved" ? `Pul chiqarish tasdiqlandi: ${formatPrice(payout.amount)}` : `Pul chiqarish rad etildi: ${formatPrice(payout.amount)}`;
    const body =
      input.state === "paid"
        ? `${payout.details} rekvizitiga o'tkazildi.${input.note ? ` ${input.note}` : ""}`
        : input.state === "approved"
          ? "Tez orada rekvizitingizga o'tkaziladi."
          : `Sabab: ${input.note}. Summa balansingizga qaytdi.`;
    await notify(ownerId, "payout", title, body, "/kabinet/tolovlar");
  }

  return ok({ id: row.id, state: row.state, note: row.note, processedAt: row.processedAt?.getTime() ?? null });
});
