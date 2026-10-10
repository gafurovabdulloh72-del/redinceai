import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { payouts, specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { payoutRequestSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { notifyAdmins } from "@/lib/notifications";
import { findOpenPayout, getSpecialistBalance, listPayoutsForSpecialist } from "@/lib/payments/queries";
import { getSettings } from "@/lib/payments/settings";
import { formatPrice, uid } from "@/lib/utils";

async function ownSpecialist(userId: string) {
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, userId), columns: { id: true, userId: true } });
  if (!sp) throw new ApiError(404, "Pul chiqarish faqat mutaxassis profili uchun");
  return sp;
}

/** Balans + payout tarixi (faqat o'zi) */
export const GET = handler(async () => {
  const session = await requireSession();
  const sp = await ownSpecialist(session.sub);
  const [balance, rows, settings] = await Promise.all([getSpecialistBalance(sp.id), listPayoutsForSpecialist(sp.id), getSettings()]);
  return ok({
    balance,
    minPayout: settings.minPayout,
    payouts: rows.map((p) => ({ id: p.id, amount: p.amount, state: p.state, method: p.method, details: p.details, note: p.note, createdAt: p.createdAt.getTime(), processedAt: p.processedAt?.getTime() ?? null })),
  });
});

/**
 * Pul chiqarish so'rovi: summa ≥ minPayout, ≤ mavjud balans, bir vaqtda bitta ochiq so'rov.
 * Rekvizitlar (karta raqami) faqat oxirgi 4 raqam bilan ko'rsatiladi, to'liq ko'rinishda saqlanmaydi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const sp = await ownSpecialist(session.sub);
  const input = await parseBody(req, payoutRequestSchema);
  await rateLimit(`payout:${session.sub}`, 5, 60 * 60 * 1000);

  const [balance, settings, open] = await Promise.all([getSpecialistBalance(sp.id), getSettings(), findOpenPayout(sp.id)]);
  if (open) throw new ApiError(400, "Sizda ko'rib chiqilayotgan so'rov bor. U yakunlangach yangisini yuborasiz");
  if (input.amount < settings.minPayout) throw new ApiError(422, "Summa juda kichik", { amount: `Kamida ${formatPrice(settings.minPayout)}` });
  if (input.amount > balance.available) throw new ApiError(422, "Balans yetarli emas", { amount: `Mavjud: ${formatPrice(balance.available)}` });

  // Karta raqamini maskalaymiz: 8600 **** **** 1234
  const digits = input.details.replace(/\D/g, "");
  const details = input.method === "card" && digits.length >= 12 ? `${digits.slice(0, 4)} **** **** ${digits.slice(-4)}` : input.details;

  const id = uid();
  await db.insert(payouts).values({ id, specialistId: sp.id, amount: input.amount, method: input.method, details, state: "requested" });

  // Parallel so'rovlarga qarshi qayta tekshiruv: bitta ochiq so'rov va balans manfiy bo'lmasin
  const fresh = await getSpecialistBalance(sp.id);
  const [{ n: openCount }] = await db
    .select({ n: count() })
    .from(payouts)
    .where(and(eq(payouts.specialistId, sp.id), inArray(payouts.state, ["requested", "approved"])));
  if (Number(openCount) > 1 || fresh.released - fresh.pendingPayouts - fresh.paidOut < 0) {
    await db.delete(payouts).where(eq(payouts.id, id));
    throw new ApiError(409, "So'rov takrorlandi yoki balans o'zgardi. Sahifani yangilab, qayta urinib ko'ring");
  }

  await audit(session.sub, "payout_requested", { targetType: "payout", targetId: id, meta: { amount: input.amount, method: input.method } }, req);
  await notifyAdmins("payout_requested", `Yangi pul chiqarish so'rovi: ${formatPrice(input.amount)}`, `${session.name} — ${details}`, "/admin#payoutlar");

  return ok({ id, amount: input.amount, state: "requested", method: input.method, details, balance: fresh }, { status: 201 });
});
