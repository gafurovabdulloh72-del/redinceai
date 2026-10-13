/**
 * Buyurtma sehrgari (F72) variantlari — sahifa (server) va komponent (client) uchun umumiy, sof ma'lumot.
 * URL parametrlari: yonalish (kategoriya slug), byudjet, hudud (viloyat slug | "masofaviy"), muddat, natija=1.
 */
export const WIZARD_BUDGETS = [
  { key: "500k", label: "500 ming so'mgacha", max: 500_000 },
  { key: "1m", label: "1 mln so'mgacha", max: 1_000_000 },
  { key: "3m", label: "3 mln so'mgacha", max: 3_000_000 },
  { key: "5m", label: "5 mln so'mgacha", max: 5_000_000 },
  { key: "any", label: "Hali bilmayman", max: null },
] as const;
export type WizardBudgetKey = (typeof WIZARD_BUDGETS)[number]["key"];

export const WIZARD_DEADLINES = [
  { key: "shoshilinch", label: "Shoshilinch", hint: "3 kun ichida — hozir bo'sh mutaxassislar", days: 3 },
  { key: "hafta", label: "1 hafta ichida", hint: "Odatiy loyihalar uchun", days: 7 },
  { key: "oy", label: "1 oy ichida", hint: "Katta loyiha yoki tayyorgarlik kerak", days: 30 },
  { key: "erkin", label: "Muddat muhim emas", hint: "Kelishiladi", days: null },
] as const;
export type WizardDeadlineKey = (typeof WIZARD_DEADLINES)[number]["key"];

export const REMOTE_KEY = "masofaviy";

export interface WizardState {
  yonalish: string | null;
  byudjet: WizardBudgetKey | null;
  hudud: string | null;
  muddat: WizardDeadlineKey | null;
}

export function wizardQuery(s: WizardState, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  if (s.yonalish) q.set("yonalish", s.yonalish);
  if (s.byudjet) q.set("byudjet", s.byudjet);
  if (s.hudud) q.set("hudud", s.hudud);
  if (s.muddat) q.set("muddat", s.muddat);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return q.toString();
}
