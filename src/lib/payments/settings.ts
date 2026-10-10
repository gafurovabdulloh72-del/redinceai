import "server-only";
import { cache } from "react";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";
import { PLATFORM_DEFAULTS } from "@/lib/constants";

export type PlatformSettings = { -readonly [K in keyof typeof PLATFORM_DEFAULTS]: number };
export type PlatformSettingKey = keyof PlatformSettings;

const KEYS = Object.keys(PLATFORM_DEFAULTS) as PlatformSettingKey[];
const isKey = (k: string): k is PlatformSettingKey => (KEYS as string[]).includes(k);

/**
 * Platforma sozlamalari (komissiya %, minimal payout, minimal buyurtma summasi).
 * React cache() — bitta so'rov ichida necha marta chaqirilsa ham baza bir marta o'qiladi.
 * Bazada yo'q kalitlar uchun PLATFORM_DEFAULTS ishlatiladi.
 */
export const getSettings = cache(async (): Promise<PlatformSettings> => {
  const out: PlatformSettings = { ...PLATFORM_DEFAULTS };
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

/** Admin: sozlamalarni saqlash (upsert). Yangi qiymatlarni qaytaradi. */
export async function saveSettings(input: PlatformSettings): Promise<PlatformSettings> {
  const now = new Date();
  for (const key of KEYS) {
    const value = Math.round(Number(input[key]));
    await db
      .insert(platformSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: now } });
  }
  return { ...input };
}

/** Komissiyani bo'lish: mijoz to'lagan summadan platformaga qoladigan qism va mutaxassis ulushi */
export function splitAmount(amount: number, commissionPct: number): { commissionAmount: number; netAmount: number } {
  const pct = Math.min(100, Math.max(0, commissionPct));
  const commissionAmount = Math.round((amount * pct) / 100);
  return { commissionAmount, netAmount: Math.max(0, amount - commissionAmount) };
}
