import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { getSettings } from "@/lib/payments/settings";

/**
 * ISHGA TUSHIRISH SOVG'ASI (2026-11-18): aksiya davomida (`platform_settings.launchGiftUntil` > hozir) har bir mutaxassisga
 * BIR MARTA 1 yil Max tarifi bepul beriladi:
 *  - mavjud mutaxassislar — admin «Hozir hammaga berish» tugmasi (va kunlik cron — o'tkazib yuborilganlar uchun);
 *  - yangi mutaxassis — profil ochilishi bilan (`PUT /api/profile`, bot/Mini App ro'yxati `createTelegramAccount`).
 * Muddat: `subscriptionUntil = max(joriy muddat, hozir + 365 kun)`, tarif `max` — to'lab qo'ygan obunasi uzunroq bo'lsa
 * u qisqarmaydi. `giftGrantedAt` CAS bilan band qilinadi — ikki marta berilmaydi. Muddat tugagach odatdagi obuna tartibi.
 */
export const LAUNCH_GIFT_DAYS = 365;
const DAY = 86_400_000;

export async function launchGiftUntil(): Promise<number> {
  return Number((await getSettings()).launchGiftUntil) || 0;
}

export async function launchGiftActive(now = Date.now()): Promise<boolean> {
  return (await launchGiftUntil()) > now;
}

/** Bitta mutaxassisga sovg'a (aksiya faol bo'lsa va hali olmagan bo'lsa). true — shu chaqiruvda berildi */
export async function grantLaunchGift(specialistId: string, opts: { force?: boolean; notifyUser?: boolean } = {}): Promise<boolean> {
  const now = Date.now();
  if (!opts.force && !(await launchGiftActive(now))) return false;
  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.id, specialistId),
    columns: { id: true, userId: true, subscriptionUntil: true, subscriptionTier: true, giftGrantedAt: true },
  });
  if (!sp || sp.giftGrantedAt) return false;
  const giftEnd = now + LAUNCH_GIFT_DAYS * DAY;
  const current = sp.subscriptionUntil ? sp.subscriptionUntil.getTime() : 0;
  // To'langan Max obunasi sovg'adan uzunroq bo'lsa — muddat ham, tarif ham o'zgarmaydi (faqat belgi qo'yiladi)
  const keepPaidMax = current > giftEnd && sp.subscriptionTier === "max";
  const until = new Date(Math.max(current, giftEnd));
  const res = await db
    .update(specialists)
    .set({ giftGrantedAt: new Date(now), subscriptionUntil: until, ...(keepPaidMax ? {} : { subscriptionTier: "max" as const }), updatedAt: new Date(now) })
    .where(and(eq(specialists.id, sp.id), isNull(specialists.giftGrantedAt)));
  if (res.rowsAffected === 0) return false;
  if (opts.notifyUser !== false) {
    const { notify } = await import("@/lib/notifications");
    const { formatDate } = await import("@/lib/utils");
    const when = formatDate(until);
    await notify(
      sp.userId,
      "subscription_paid",
      "Sovg'a: 1 yil Max tarifi bepul 🎁",
      `Kasb Egalari ishga tushgani munosabati bilan sizga Max tarifi ${when} gacha bepul berildi — barcha imkoniyatlar ochiq.`,
      "/kabinet/obuna",
    ).catch(() => undefined);
  }
  return true;
}

/** Hali sovg'a olmagan barcha mutaxassislarga (admin tugmasi / kunlik cron). Sonini qaytaradi */
export async function grantLaunchGiftToAll(opts: { force?: boolean } = {}): Promise<number> {
  if (!opts.force && !(await launchGiftActive())) return 0;
  const rows = await db.select({ id: specialists.id }).from(specialists).where(isNull(specialists.giftGrantedAt));
  let n = 0;
  for (const r of rows) {
    if (await grantLaunchGift(r.id, { force: opts.force }).catch(() => false)) n++;
  }
  return n;
}

export async function launchGiftStats(): Promise<{ until: number; active: boolean; granted: number; pending: number }> {
  const until = await launchGiftUntil();
  const [[{ g }], [{ p }]] = await Promise.all([
    db.select({ g: count() }).from(specialists).where(isNotNull(specialists.giftGrantedAt)),
    db.select({ p: count() }).from(specialists).where(isNull(specialists.giftGrantedAt)),
  ]);
  return { until, active: until > Date.now(), granted: g, pending: p };
}
