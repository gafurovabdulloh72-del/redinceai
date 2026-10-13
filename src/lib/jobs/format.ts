/**
 * E'lonlar uchun sof yordamchilar (server va klientda bir xil natija — Intl ishlatilmaydi).
 */
import { CATEGORY_BY_SLUG, JOB_STATUS_LABEL, PROPOSAL_STATUS_LABEL, REGION_BY_SLUG, type JobStatusValue, type ProposalStatusValue } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";

/** Forma chegaralari (validators.ts va klient formalari uchun umumiy) */
export const JOB_TITLE_MIN = 10;
export const JOB_TITLE_MAX = 120;
export const JOB_DESC_MIN = 40;
export const JOB_DESC_MAX = 5000;
export const JOB_SKILLS_MAX = 10;
export const COVER_MIN = 50;
export const COVER_MAX = 2000;

/** "Masofaviy" filtri qiymati (jobs.regionSlug = null) */
export const REMOTE_REGION = "remote";
export const REMOTE_LABEL = "Masofaviy";

/** Hudud nomi (qisqa) yoki "Masofaviy" */
export function jobRegionLabel(regionSlug: string | null | undefined, full = false): string {
  if (!regionSlug) return REMOTE_LABEL;
  const r = REGION_BY_SLUG[regionSlug];
  return r ? (full ? r.name : r.short) : regionSlug;
}

export function jobCategoryLabel(slug: string): string {
  return CATEGORY_BY_SLUG[slug]?.name ?? slug;
}

/** Ism-familiyadan faqat ism (mijoz maxfiyligi: e'londa to'liq ism chiqmaydi) */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Mijoz";
}

/** 2 500 000 → { value: "2,5", unit: "mln" }; 600 000 → { value: "600", unit: "ming" } */
function compactPart(n: number): { value: string; unit: "mln" | "ming" | "" } {
  if (n >= 1_000_000) return { value: String(Math.round(n / 100_000) / 10).replace(".", ","), unit: "mln" };
  if (n >= 1_000) return { value: String(Math.round(n / 1_000)), unit: "ming" };
  return { value: formatNumber(n), unit: "" };
}

const unitText = (u: "mln" | "ming" | "") => (u ? `${u} so'm` : "so'm");

/**
 * Byudjet yorlig'i: "1–3 mln so'm", "500 ming – 1,5 mln so'm", "2 mln so'm dan", "3 mln so'm gacha" yoki "Kelishiladi".
 * Soatbay e'lonlarda " / soat" qo'shiladi.
 */
export function budgetLabel(min: number | null | undefined, max: number | null | undefined, type: "fixed" | "hourly" = "fixed"): string {
  const lo = min && min > 0 ? min : null;
  const hi = max && max > 0 ? max : null;
  if (!lo && !hi) return "Kelishiladi";
  const suffix = type === "hourly" ? " / soat" : "";
  if (lo && hi && hi > lo) {
    const a = compactPart(lo);
    const b = compactPart(hi);
    if (a.unit === b.unit) return `${a.value}–${b.value} ${unitText(b.unit)}${suffix}`;
    return `${a.unit ? `${a.value} ${a.unit}` : a.value} – ${b.value} ${unitText(b.unit)}${suffix}`;
  }
  if (lo && hi) {
    const a = compactPart(lo);
    return `${a.value} ${unitText(a.unit)}${suffix}`;
  }
  if (lo) {
    const a = compactPart(lo);
    return `${a.value} ${unitText(a.unit)} dan${suffix}`;
  }
  const b = compactPart(hi!);
  return `${b.value} ${unitText(b.unit)} gacha${suffix}`;
}

export const BUDGET_TYPE_LABEL: Record<"fixed" | "hourly", string> = {
  fixed: "Belgilangan narx",
  hourly: "Soatbay",
};

export function jobStatusLabel(s: JobStatusValue): string {
  return JOB_STATUS_LABEL[s] ?? s;
}
export function proposalStatusLabel(s: ProposalStatusValue): string {
  return PROPOSAL_STATUS_LABEL[s] ?? s;
}

export const JOB_STATUS_TONE: Record<JobStatusValue, "success" | "purple" | "neutral"> = {
  open: "success",
  hired: "purple",
  closed: "neutral",
};

export const PROPOSAL_STATUS_TONE: Record<ProposalStatusValue, "neutral" | "info" | "success" | "danger" | "warning"> = {
  pending: "warning",
  shortlisted: "info",
  accepted: "success",
  declined: "danger",
  withdrawn: "neutral",
};

/** "5 ta taklif" / "Hali taklif yo'q" */
export function proposalsCountLabel(n: number): string {
  return n > 0 ? `${n} ta taklif` : "Hali taklif yo'q";
}

/** Muddat tugashiga qolgan kunlar (0 — bugun yoki o'tgan) */
export function daysLeft(expiresAt: Date | number | null | undefined, now = Date.now()): number | null {
  if (expiresAt == null) return null;
  const ms = typeof expiresAt === "number" ? expiresAt : expiresAt.getTime();
  return Math.max(0, Math.ceil((ms - now) / 86_400_000));
}
