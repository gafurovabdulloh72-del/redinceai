import "server-only";
import { cache } from "react";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";
import { PLATFORM_DEFAULTS, TOP_RATED_RULE } from "@/lib/constants";

/**
 * Komissiya darajalari (F21). PLATFORM_DEFAULTS (constants.ts) hali bu kalitlarni bilmasa ham ishlaydi —
 * constants'dagi qiymat bo'lsa u ustun (keyin spread).
 *  commissionPctNew — yangi mutaxassis (bajarilgan buyurtmalar < NEW_TIER_MAX)
 *  commissionPct    — oddiy daraja
 *  commissionPctTop — "Top mutaxassis" (topRated)
 */
const TIER_DEFAULTS = { commissionPctNew: 15, commissionPctTop: 7 } as const;
export const ALL_DEFAULTS = { ...TIER_DEFAULTS, ...PLATFORM_DEFAULTS } as const;
/** Shu sondan kam bajarilgan buyurtmasi bo'lgan mutaxassis "yangi" darajada */
export const NEW_TIER_MAX_COMPLETED = 3;
/**
 * "Top mutaxassis" (F21/F69) — recalcRating (queries.ts) bilan BIR XIL qoida (constants TOP_RATED_RULE), aks holda
 * nishon sharh yozilganda va buyurtma yakunlanganda almashib turadi. Qoidaga minCompleted qo'shilsa — u ham hisobga olinadi.
 */
const RULE: { minRating: number; minReviews: number; minCompleted?: number } = TOP_RATED_RULE;
export const TOP_RATED_MIN_RATING = RULE.minRating;
export const TOP_RATED_MIN_REVIEWS = RULE.minReviews;
export const TOP_RATED_MIN_COMPLETED = RULE.minCompleted ?? 0;
export function isTopRated(sp: { rating: number; reviewCount: number; completedCount: number }): boolean {
  return sp.rating >= TOP_RATED_MIN_RATING && sp.reviewCount >= TOP_RATED_MIN_REVIEWS && sp.completedCount >= TOP_RATED_MIN_COMPLETED;
}

export type PlatformSettings = { -readonly [K in keyof typeof ALL_DEFAULTS]: number };
export type PlatformSettingKey = keyof PlatformSettings;

const KEYS = Object.keys(ALL_DEFAULTS) as PlatformSettingKey[];
const isKey = (k: string): k is PlatformSettingKey => (KEYS as string[]).includes(k);

/**
 * Platforma sozlamalari (komissiya darajalari, minimal payout, minimal buyurtma summasi).
 * React cache() — bitta so'rov ichida necha marta chaqirilsa ham baza bir marta o'qiladi.
 * Bazada yo'q kalitlar uchun standart qiymatlar ishlatiladi.
 */
export const getSettings = cache(async (): Promise<PlatformSettings> => {
  const out: PlatformSettings = { ...ALL_DEFAULTS };
  try {
    const rows = await db.select().from(platformSettings).where(inArray(platformSettings.key, KEYS));
    for (const r of rows) {
      if (!isKey(r.key)) continue;
      const n = Number(r.value);
      if (Number.isFinite(n) && n >= 0) out[r.key] = Math.round(n);
    }
  } catch (e) {
    console.error("[settings] o'qib bo'lmadi, standart qiymatlar ishlatiladi", e);
  }
  return out;
});

export async function getSetting<K extends PlatformSettingKey>(key: K): Promise<PlatformSettings[K]> {
  return (await getSettings())[key];
}

/** Admin: sozlamalarni saqlash (upsert). Faqat berilgan kalitlar yoziladi; to'liq yangi qiymatlarni qaytaradi. */
export async function saveSettings(input: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const now = new Date();
  for (const key of KEYS) {
    const raw = input[key];
    if (raw == null) continue;
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value)) continue;
    await db
      .insert(platformSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: now } });
  }
  return { ...(await getSettings()), ...Object.fromEntries(Object.entries(input).filter(([k, v]) => isKey(k) && v != null).map(([k, v]) => [k, Math.round(Number(v))])) } as PlatformSettings;
}

export type CommissionTier = "new" | "standard" | "top";

/** Mutaxassisning komissiya darajasi: topRated → top; bajarilgan buyurtmalar kam → new; aks holda standart */
export function commissionTierFor(sp: { completedCount?: number | null; topRated?: boolean | null }): CommissionTier {
  if (sp.topRated) return "top";
  if ((sp.completedCount ?? 0) < NEW_TIER_MAX_COMPLETED) return "new";
  return "standard";
}

/** Daraja bo'yicha foiz (narx belgilash paytida buyurtmaga snapshot qilinadi) */
export function commissionPctFor(settings: PlatformSettings, sp: { completedCount?: number | null; topRated?: boolean | null }): { pct: number; tier: CommissionTier } {
  const tier = commissionTierFor(sp);
  const pct = tier === "top" ? settings.commissionPctTop : tier === "new" ? settings.commissionPctNew : settings.commissionPct;
  return { pct, tier };
}

/** Komissiyani bo'lish: mijoz to'lagan summadan platformaga qoladigan qism va mutaxassis ulushi */
export function splitAmount(amount: number, commissionPct: number): { commissionAmount: number; netAmount: number } {
  const pct = Math.min(100, Math.max(0, commissionPct));
  const commissionAmount = Math.round((amount * pct) / 100);
  return { commissionAmount, netAmount: Math.max(0, amount - commissionAmount) };
}
