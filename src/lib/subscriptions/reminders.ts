import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { specialists, users } from "@/lib/db/schema";
import { notify } from "@/lib/notifications";
import { getSettings } from "@/lib/payments/settings";
import { isConsumed, tryConsume } from "@/lib/security/rate-limit";
import { formatDate, formatPrice } from "@/lib/utils";
import { subscriptionState } from "./access";
import { expireStaleInvoices, SUBSCRIPTION_HREF } from "./billing";

/**
 * Obuna eslatmalari (kunlik cron chaqiradi — /api/cron/daily):
 *  d3      — muddat (until) tugashiga 3 yoki 2 kun qolganda (trial/active)
 *  d1      — 1 kun yoki kamroq qolganda (trial/active)
 *  expired — muddat tugadi (grace boshlandi): «N kun ichida to'lang, aks holda profil yashiriladi»
 *  hidden  — imtiyozli kunlar ham tugadi: profil katalogdan yashirildi (grace 0 bo'lsa expired o'rniga shu)
 * Har biri bir marta: rate_limits kaliti `subRemind:<specialistId>:<until ms>:<bosqich>` (60 kun) — obuna uzaytirilsa
 * until o'zgaradi va yangi davr uchun eslatmalar qaytadan ishlaydi. Talab o'chiq (subscriptionEnforced=0) bo'lsa — hech narsa.
 * Joriy etilgan kuni eski, allaqachon tugagan obunalarga ommaviy xat ketmasligi uchun expired/hidden faqat
 * hodisadan keyingi RECENT_DAYS kun ichida yuboriladi. Bir bosqich yuborilsa, kechikkan oldingi bosqich yuborilmaydi.
 * Shuningdek, 12 soatdan eskirgan Payme/Click 'pending' obuna hisoblari bekor qilinadi.
 */
const DAY = 86_400_000;
const KEY_TTL_MS = 60 * DAY;
const RECENT_DAYS = 7;
const BATCH = 500;

type Stage = "d3" | "d1" | "expired" | "hidden";

export interface ReminderResult {
  enforced: boolean;
  checked: number;
  sent: Record<Stage, number>;
  expiredInvoices: number;
  dry: boolean;
}

export async function runSubscriptionReminders(opts: { now?: Date; dry?: boolean } = {}): Promise<ReminderResult> {
  const now = opts.now ?? new Date();
  const dry = Boolean(opts.dry);
  const settings = await getSettings();
  const sent: Record<Stage, number> = { d3: 0, d1: 0, expired: 0, hidden: 0 };
  const expiredInvoices = await expireStaleInvoices(now.getTime(), dry).catch((e) => {
    console.error("[subscription:expire]", e);
    return 0;
  });
  if (settings.subscriptionEnforced !== 1) return { enforced: false, checked: 0, sent, expiredInvoices, dry };

  const t = now.getTime();
  let checked = 0;
  for (let offset = 0; ; offset += BATCH) {
    const rows = await db
      .select({ id: specialists.id, userId: specialists.userId, createdAt: specialists.createdAt, subscriptionUntil: specialists.subscriptionUntil })
      .from(specialists)
      .innerJoin(users, eq(users.id, specialists.userId))
      .where(and(eq(users.isBanned, false), eq(users.role, "specialist")))
      .orderBy(specialists.id)
      .limit(BATCH)
      .offset(offset);
    for (const sp of rows) {
      checked++;
      const st = subscriptionState(sp, settings, now);
      const untilMs = st.until.getTime();
      let stage: Stage | null = null;
      if (st.status === "trial" || st.status === "active") {
        if (st.daysLeft <= 1) stage = "d1";
        else if (st.daysLeft <= 3) stage = "d3";
      } else if (st.status === "grace") {
        if (t - untilMs <= RECENT_DAYS * DAY) stage = "expired";
      } else if (st.status === "expired") {
        if (t - st.graceUntil.getTime() <= RECENT_DAYS * DAY) stage = "hidden";
      }
      if (!stage) continue;
      const key = `subRemind:${sp.id}:${untilMs}:${stage}`;
      if (dry) {
        if (!(await isConsumed(key))) sent[stage]++;
        continue;
      }
      if (!(await tryConsume(key, KEY_TTL_MS))) continue;
      const trial = !st.paid;
      const what = trial ? "Bepul sinov muddati" : "Obuna";
      const price = formatPrice(settings.subscriptionPrice);
      switch (stage) {
        case "d3":
        case "d1":
          await notify(
            sp.userId,
            "subscription_expiring",
            st.daysLeft <= 0 ? `${what} bugun tugaydi` : `${what} tugashiga ${st.daysLeft} kun qoldi`,
            `${what} ${formatDate(st.until)} da tugaydi. Profilingiz katalog va xaritada ko'rinib turishi, yangi buyurtma va takliflar ochiq qolishi uchun obunani uzaytiring — ${price} / oy.`,
            SUBSCRIPTION_HREF,
          );
          break;
        case "expired":
          await notify(
            sp.userId,
            "subscription_expired",
            `${what} tugadi — ${st.daysLeft} kun muhlat`,
            `${formatDate(st.graceUntil)} gacha to'lasangiz profilingiz katalogda qoladi. Aks holda u ro'yxat va xaritadan yashiriladi, yangi buyurtmalar to'xtaydi. Mavjud buyurtmalar davom etadi.`,
            SUBSCRIPTION_HREF,
          );
          break;
        case "hidden":
          await notify(
            sp.userId,
            "subscription_expired",
            "Obuna faol emas — profil katalogdan yashirildi",
            `Mijozlar sizni ro'yxat va xaritada topa olmaydi, yangi buyurtma va takliflar yopiq. Mavjud buyurtmalar davom etadi. Obunani tiklash — ${price} / oy.`,
            SUBSCRIPTION_HREF,
          );
          break;
      }
      sent[stage]++;
    }
    if (rows.length < BATCH) break;
  }
  return { enforced: true, checked, sent, expiredInvoices, dry };
}
